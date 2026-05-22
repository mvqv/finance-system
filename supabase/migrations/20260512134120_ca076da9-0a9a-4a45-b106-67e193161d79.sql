
-- 1. Singleton: текущий режим терминала
CREATE TABLE public.terminal_state (
  id integer PRIMARY KEY DEFAULT 1,
  current_mode text NOT NULL DEFAULT 'research',
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  reason text,
  source_type text,
  source_id uuid,
  CONSTRAINT terminal_state_singleton CHECK (id = 1),
  CONSTRAINT terminal_state_mode_chk CHECK (current_mode IN
    ('research','watch','committee','risk_review','execution','live','post_mortem','emergency'))
);
INSERT INTO public.terminal_state(id, current_mode) VALUES (1, 'research') ON CONFLICT DO NOTHING;

ALTER TABLE public.terminal_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read terminal_state"
  ON public.terminal_state FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators update terminal_state"
  ON public.terminal_state FOR UPDATE TO authenticated
  USING (public.is_owner_or_operator(auth.uid()))
  WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- 2. История переходов
CREATE TABLE public.terminal_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_mode text,
  to_mode text NOT NULL,
  reason text,
  source_type text,
  source_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_terminal_transitions_changed_at ON public.terminal_transitions(changed_at DESC);

ALTER TABLE public.terminal_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read terminal_transitions"
  ON public.terminal_transitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators insert terminal_transitions"
  ON public.terminal_transitions FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- 3. Trigger: каждый UPDATE terminal_state пишет в историю
CREATE OR REPLACE FUNCTION public.log_terminal_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_mode IS DISTINCT FROM OLD.current_mode THEN
    INSERT INTO public.terminal_transitions(from_mode, to_mode, reason, source_type, source_id, changed_by)
    VALUES (OLD.current_mode, NEW.current_mode, NEW.reason, NEW.source_type, NEW.source_id, NEW.changed_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_terminal_transition
  AFTER UPDATE ON public.terminal_state
  FOR EACH ROW EXECUTE FUNCTION public.log_terminal_transition();

-- 4. Helper: безопасный авто-переход (не понижает приоритет, не выходит из emergency)
CREATE OR REPLACE FUNCTION public.set_terminal_mode(_mode text, _reason text, _source_type text, _source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cur text;
BEGIN
  SELECT current_mode INTO _cur FROM public.terminal_state WHERE id = 1 FOR UPDATE;
  -- emergency блокирует любые автопереходы кроме явного выхода
  IF _cur = 'emergency' AND _mode <> 'emergency' THEN
    RETURN;
  END IF;
  IF _cur = _mode THEN
    RETURN;
  END IF;
  UPDATE public.terminal_state
    SET current_mode = _mode, changed_at = now(),
        reason = _reason, source_type = _source_type, source_id = _source_id
    WHERE id = 1;
END;
$$;

-- 5. Auto-transitions

-- 5a. ideas: статус 'committee' → committee
CREATE OR REPLACE FUNCTION public.tg_idea_to_committee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'committee' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.set_terminal_mode('committee', 'idea entered committee', 'idea', NEW.id);
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_idea_to_committee
  AFTER INSERT OR UPDATE OF status ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.tg_idea_to_committee();

-- 5b. risk_assessments: новая оценка → risk_review; verdict 'pass' → execution
CREATE OR REPLACE FUNCTION public.tg_risk_to_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verdict::text = 'pass' THEN
    PERFORM public.set_terminal_mode('execution', 'risk pass', 'risk_assessment', NEW.id);
  ELSE
    PERFORM public.set_terminal_mode('risk_review', 'risk under review', 'risk_assessment', NEW.id);
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_risk_to_mode
  AFTER INSERT ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tg_risk_to_mode();

-- 5c. orders: новый ордер → execution; filled → live
CREATE OR REPLACE FUNCTION public.tg_order_to_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.set_terminal_mode('execution', 'order created', 'order', NEW.id);
  ELSIF NEW.status = 'filled' AND OLD.status IS DISTINCT FROM 'filled' THEN
    PERFORM public.set_terminal_mode('live', 'order filled', 'order', NEW.id);
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_order_to_mode
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_to_mode();

-- 5d. positions: открыта → live; закрыта → post_mortem
CREATE OR REPLACE FUNCTION public.tg_position_to_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.closed_at IS NULL THEN
    PERFORM public.set_terminal_mode('live', 'position opened', 'position', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
    PERFORM public.set_terminal_mode('post_mortem', 'position closed', 'position', NEW.id);
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_position_to_mode
  AFTER INSERT OR UPDATE OF closed_at ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_position_to_mode();

-- 5e. kill_switch_state: engaged → emergency
CREATE OR REPLACE FUNCTION public.tg_killswitch_to_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.engaged = true AND (OLD.engaged IS DISTINCT FROM true) THEN
    -- Принудительно: даже если уже в emergency, обновим reason
    UPDATE public.terminal_state
      SET current_mode = 'emergency', changed_at = now(),
          reason = COALESCE(NEW.reason, 'kill switch engaged'),
          source_type = 'kill_switch', source_id = NULL,
          changed_by = NEW.engaged_by
      WHERE id = 1;
  ELSIF NEW.engaged = false AND OLD.engaged = true THEN
    UPDATE public.terminal_state
      SET current_mode = 'watch', changed_at = now(),
          reason = 'kill switch released',
          source_type = 'kill_switch', source_id = NULL,
          changed_by = NEW.engaged_by
      WHERE id = 1;
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_killswitch_to_mode
  AFTER UPDATE OF engaged ON public.kill_switch_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_killswitch_to_mode();

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_transitions;
ALTER TABLE public.terminal_state REPLICA IDENTITY FULL;
