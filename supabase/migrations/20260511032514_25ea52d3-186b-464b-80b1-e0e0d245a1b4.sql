
CREATE TABLE IF NOT EXISTS public.asset_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  as_of date NOT NULL DEFAULT CURRENT_DATE,
  vol_20d numeric,
  vol_60d numeric,
  momentum_5d numeric,
  momentum_20d numeric,
  rvol numeric,
  dist_52w_high numeric,
  dist_52w_low numeric,
  beta_spy numeric,
  latest_close numeric,
  latest_volume numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_asset_features_asset ON public.asset_features(asset_id, as_of DESC);

ALTER TABLE public.asset_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read features"
  ON public.asset_features FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators manage features"
  ON public.asset_features FOR ALL TO authenticated
  USING (is_owner_or_operator(auth.uid()))
  WITH CHECK (is_owner_or_operator(auth.uid()));
