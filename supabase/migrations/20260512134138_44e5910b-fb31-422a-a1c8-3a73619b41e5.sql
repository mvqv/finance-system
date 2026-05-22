
REVOKE EXECUTE ON FUNCTION public.set_terminal_mode(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_terminal_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_idea_to_committee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_risk_to_mode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_order_to_mode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_position_to_mode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_killswitch_to_mode() FROM PUBLIC, anon, authenticated;
