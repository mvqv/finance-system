
-- ============ 1. ADD owner_id COLUMNS ============
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'assets','asset_features','events','macro_indicators',
    'agent_debates','investment_memos','risk_assessments','postmortems',
    'positions','orders','trade_journal','portfolio_snapshots','position_reconciliation',
    'alerts','watchlist','research_documents',
    'agent_scorecards','stress_scenarios','stress_results','market_limits',
    'system_health_log','terminal_transitions','ideas'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_id uuid', t);
  END LOOP;
END $$;

-- ============ 2. BACKFILL existing rows to current owner ============
UPDATE public.assets SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.asset_features SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.events SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.macro_indicators SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.agent_debates SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.investment_memos SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.risk_assessments SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.postmortems SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.positions SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.orders SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.trade_journal SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.portfolio_snapshots SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.position_reconciliation SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.alerts SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.watchlist SET owner_id = COALESCE(added_by, 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8') WHERE owner_id IS NULL;
UPDATE public.research_documents SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.agent_scorecards SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.stress_scenarios SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.stress_results SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.market_limits SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.system_health_log SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE owner_id IS NULL;
UPDATE public.terminal_transitions SET owner_id = COALESCE(changed_by, 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8') WHERE owner_id IS NULL;
UPDATE public.ideas SET owner_id = COALESCE(created_by, 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8') WHERE owner_id IS NULL;

-- ============ 3. SET NOT NULL + DEFAULT auth.uid() ============
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'assets','asset_features','events','macro_indicators',
    'agent_debates','investment_memos','risk_assessments','postmortems',
    'positions','orders','trade_journal','portfolio_snapshots','position_reconciliation',
    'alerts','watchlist','research_documents',
    'agent_scorecards','stress_scenarios','stress_results','market_limits',
    'system_health_log','terminal_transitions','ideas'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET DEFAULT auth.uid()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(owner_id)', t || '_owner_idx', t);
  END LOOP;
END $$;

-- ============ 4. REPLACE RLS POLICIES (drop all old, create owner-scoped) ============
DO $$
DECLARE
  r record;
  t text;
  tables text[] := ARRAY[
    'assets','asset_features','events','macro_indicators',
    'agent_debates','investment_memos','risk_assessments','postmortems',
    'positions','orders','trade_journal','portfolio_snapshots','position_reconciliation',
    'alerts','watchlist','research_documents',
    'agent_scorecards','stress_scenarios','stress_results','market_limits',
    'system_health_log','terminal_transitions','ideas'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Owner read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (owner_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Owner insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Owner update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Owner delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (owner_id = auth.uid())', t);
  END LOOP;
END $$;

-- ============ 5. terminal_state — per-user ============
-- Drop old single-row constraints, switch to (user_id PK)
ALTER TABLE public.terminal_state DROP CONSTRAINT IF EXISTS terminal_state_pkey;
ALTER TABLE public.terminal_state ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.terminal_state SET user_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8' WHERE user_id IS NULL;
ALTER TABLE public.terminal_state ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.terminal_state ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.terminal_state DROP COLUMN IF EXISTS id;
ALTER TABLE public.terminal_state ADD PRIMARY KEY (user_id);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='terminal_state' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.terminal_state', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Owner read terminal_state" ON public.terminal_state FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner insert terminal_state" ON public.terminal_state FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner update terminal_state" ON public.terminal_state FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner delete terminal_state" ON public.terminal_state FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ 6. Update set_terminal_mode + triggers to be per-user ============
CREATE OR REPLACE FUNCTION public.set_terminal_mode(_mode text, _reason text, _source_type text, _source_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  _user uuid := auth.uid();
  _cur text;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  INSERT INTO public.terminal_state(user_id, current_mode, reason, source_type, source_id, changed_by, changed_at)
  VALUES (_user, _mode, _reason, _source_type, _source_id, _user, now())
  ON CONFLICT (user_id) DO UPDATE
    SET current_mode = EXCLUDED.current_mode,
        reason = EXCLUDED.reason,
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        changed_by = EXCLUDED.changed_by,
        changed_at = now()
    WHERE public.terminal_state.current_mode <> EXCLUDED.current_mode
      AND NOT (public.terminal_state.current_mode = 'emergency' AND EXCLUDED.current_mode <> 'emergency');
END;
$fn$;

-- Auto-create terminal_state row on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles(user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  -- New users are operators (own data only) — first ever is owner
  assigned_role := CASE WHEN user_count = 0 THEN 'owner'::public.app_role ELSE 'operator'::public.app_role END;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, assigned_role);

  INSERT INTO public.terminal_state(user_id, current_mode, reason, changed_by, changed_at)
  VALUES (NEW.id, 'research', 'initial', NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$fn$;
