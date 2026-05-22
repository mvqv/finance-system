-- 1. Add market column to ideas
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS market text DEFAULT 'US';
CREATE INDEX IF NOT EXISTS idx_ideas_market ON public.ideas(market);

-- 2. Add benchmark fields to asset_features
ALTER TABLE public.asset_features ADD COLUMN IF NOT EXISTS beta_benchmark numeric;
ALTER TABLE public.asset_features ADD COLUMN IF NOT EXISTS benchmark_ticker text DEFAULT 'SPY';

-- 3. Add market to risk_assessments
ALTER TABLE public.risk_assessments ADD COLUMN IF NOT EXISTS market text DEFAULT 'US';

-- 4. market_limits config table
CREATE TABLE IF NOT EXISTS public.market_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL UNIQUE,
  max_position_pct numeric NOT NULL DEFAULT 5,
  max_daily_risk_pct numeric NOT NULL DEFAULT 2,
  max_gross_exposure_pct numeric NOT NULL DEFAULT 100,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read market_limits" ON public.market_limits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage market_limits" ON public.market_limits
  FOR ALL TO authenticated
  USING (is_owner_or_operator(auth.uid()))
  WITH CHECK (is_owner_or_operator(auth.uid()));

INSERT INTO public.market_limits(market, max_position_pct, max_daily_risk_pct, max_gross_exposure_pct, notes)
VALUES
  ('US',   5, 2, 100, 'Standard US equities limits'),
  ('BIST', 4, 1.5, 60, 'Tighter due to TRY volatility / liquidity')
ON CONFLICT (market) DO NOTHING;

-- 5. Trigger to sync ideas.market from assets.country
CREATE OR REPLACE FUNCTION public.tg_idea_market_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _country text;
BEGIN
  IF NEW.asset_id IS NOT NULL AND (NEW.market IS NULL OR NEW.market = 'US') THEN
    SELECT country INTO _country FROM public.assets WHERE id = NEW.asset_id;
    IF _country = 'TR' THEN
      NEW.market := 'BIST';
    ELSIF _country IS NOT NULL THEN
      NEW.market := 'US';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_idea_market_sync ON public.ideas;
CREATE TRIGGER trg_idea_market_sync
BEFORE INSERT OR UPDATE OF asset_id ON public.ideas
FOR EACH ROW EXECUTE FUNCTION public.tg_idea_market_sync();

-- 6. Backfill existing ideas
UPDATE public.ideas i
SET market = CASE WHEN a.country = 'TR' THEN 'BIST' ELSE 'US' END
FROM public.assets a
WHERE i.asset_id = a.id AND (i.market IS NULL OR i.market = 'US');

-- 7. Set benchmark_ticker for BIST assets in asset_features
UPDATE public.asset_features af
SET benchmark_ticker = 'XU100'
FROM public.assets a
WHERE af.asset_id = a.id AND a.country = 'TR';

-- 8. Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;