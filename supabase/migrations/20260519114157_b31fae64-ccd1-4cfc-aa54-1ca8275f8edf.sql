ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS shariah_status TEXT,
  ADD COLUMN IF NOT EXISTS debt_to_market_cap NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_bearing_cash NUMERIC,
  ADD COLUMN IF NOT EXISTS haram_revenue_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS shariah_last_checked TIMESTAMP WITH TIME ZONE;