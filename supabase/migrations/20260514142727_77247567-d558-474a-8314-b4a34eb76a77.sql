
-- Audit trail trigger
DROP TRIGGER IF EXISTS trg_log_terminal_transition ON public.terminal_state;
CREATE TRIGGER trg_log_terminal_transition
  AFTER UPDATE ON public.terminal_state
  FOR EACH ROW EXECUTE FUNCTION public.log_terminal_transition();

-- Idea → Committee
DROP TRIGGER IF EXISTS trg_idea_to_committee ON public.ideas;
CREATE TRIGGER trg_idea_to_committee
  AFTER INSERT OR UPDATE OF status ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.tg_idea_to_committee();

-- Risk verdict → Execution / Risk Review
DROP TRIGGER IF EXISTS trg_risk_to_mode ON public.risk_assessments;
CREATE TRIGGER trg_risk_to_mode
  AFTER INSERT ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.tg_risk_to_mode();

-- Order created → Execution; filled → Live
DROP TRIGGER IF EXISTS trg_order_to_mode ON public.orders;
CREATE TRIGGER trg_order_to_mode
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_to_mode();

-- Position open/close → Live / Post-Mortem
DROP TRIGGER IF EXISTS trg_position_to_mode ON public.positions;
CREATE TRIGGER trg_position_to_mode
  AFTER INSERT OR UPDATE OF closed_at ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_position_to_mode();

-- Position close → postmortem hook
DROP TRIGGER IF EXISTS trg_position_postmortem ON public.positions;
CREATE TRIGGER trg_position_postmortem
  AFTER UPDATE OF closed_at ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_position_postmortem();

-- Kill switch → Emergency / Watch
DROP TRIGGER IF EXISTS trg_killswitch_to_mode ON public.kill_switch_state;
CREATE TRIGGER trg_killswitch_to_mode
  AFTER UPDATE OF engaged ON public.kill_switch_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_killswitch_to_mode();

-- Idea market sync (already had function, attach trigger)
DROP TRIGGER IF EXISTS trg_idea_market_sync ON public.ideas;
CREATE TRIGGER trg_idea_market_sync
  BEFORE INSERT OR UPDATE OF asset_id ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.tg_idea_market_sync();
