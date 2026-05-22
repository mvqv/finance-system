-- ============================================================
-- SHARIAH GUARD — Additive migration
-- Adds Shariah compliance columns to assets and trade_journal.
-- Nothing is dropped or modified. All existing data is preserved.
-- ============================================================

-- ---------- assets: new Shariah columns ----------
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS shariah_status TEXT
    CHECK (shariah_status IN ('compliant', 'non-compliant', 'questionable')),
  ADD COLUMN IF NOT EXISTS debt_to_market_cap NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_bearing_cash NUMERIC,
  ADD COLUMN IF NOT EXISTS haram_revenue_pct NUMERIC;

-- ---------- trade_journal: purification amount ----------
ALTER TABLE public.trade_journal
  ADD COLUMN IF NOT EXISTS purification_amount NUMERIC;

-- ---------- system health entry ----------
INSERT INTO public.system_health_log(component, status, message, owner_id)
SELECT 'shariah_guard', 'green', 'Shariah Guard module initialized', owner_id
FROM public.system_health_log
LIMIT 1;
