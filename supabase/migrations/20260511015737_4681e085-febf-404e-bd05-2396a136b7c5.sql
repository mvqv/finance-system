-- Block B: real data schema additions

-- macro_indicators: FRED series cache
CREATE TABLE IF NOT EXISTS public.macro_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id text NOT NULL,
  label text NOT NULL,
  value numeric NOT NULL,
  unit text,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, observed_at)
);
ALTER TABLE public.macro_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read macro" ON public.macro_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators write macro" ON public.macro_indicators FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid()))
  WITH CHECK (public.is_owner_or_operator(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_macro_series_time ON public.macro_indicators(series_id, observed_at DESC);

-- events: dedupe by url
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_url ON public.events(url) WHERE url IS NOT NULL;

-- positions: last sync
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- orders: broker fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS broker_order_id text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS filled_price numeric,
  ADD COLUMN IF NOT EXISTS filled_quantity numeric,
  ADD COLUMN IF NOT EXISTS error_message text;