
-- Alerts inbox
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  source text,
  title text NOT NULL,
  body text,
  ticker text,
  idea_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage alerts" ON public.alerts FOR ALL TO authenticated USING (is_owner_or_operator(auth.uid())) WITH CHECK (is_owner_or_operator(auth.uid()));
CREATE INDEX IF NOT EXISTS alerts_created_idx ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_severity_idx ON public.alerts(severity);

-- Agent scorecards (rolling stats per agent)
CREATE TABLE IF NOT EXISTS public.agent_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  window_days integer NOT NULL DEFAULT 30,
  signals_total integer NOT NULL DEFAULT 0,
  signals_correct integer NOT NULL DEFAULT 0,
  hit_rate numeric,
  avg_confidence numeric,
  avg_latency_ms numeric,
  win_rate numeric,
  contribution_to_pnl numeric,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(agent, window_days)
);
ALTER TABLE public.agent_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read scorecards" ON public.agent_scorecards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage scorecards" ON public.agent_scorecards FOR ALL TO authenticated USING (is_owner_or_operator(auth.uid())) WITH CHECK (is_owner_or_operator(auth.uid()));

-- Position reconciliation log (Operations Agent)
CREATE TABLE IF NOT EXISTS public.position_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid,
  ticker text NOT NULL,
  internal_quantity numeric,
  broker_quantity numeric,
  internal_avg_price numeric,
  broker_avg_price numeric,
  delta_quantity numeric,
  delta_value numeric,
  status text NOT NULL DEFAULT 'mismatch',
  notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.position_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read recon" ON public.position_reconciliation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage recon" ON public.position_reconciliation FOR ALL TO authenticated USING (is_owner_or_operator(auth.uid())) WITH CHECK (is_owner_or_operator(auth.uid()));

-- Stress scenarios + results
CREATE TABLE IF NOT EXISTS public.stress_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  shocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stress_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read scenarios" ON public.stress_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage scenarios" ON public.stress_scenarios FOR ALL TO authenticated USING (is_owner_or_operator(auth.uid())) WITH CHECK (is_owner_or_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS public.stress_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL,
  projected_pnl numeric,
  projected_drawdown_pct numeric,
  worst_position_ticker text,
  worst_position_pnl numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stress_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read stress_results" ON public.stress_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage stress_results" ON public.stress_results FOR ALL TO authenticated USING (is_owner_or_operator(auth.uid())) WITH CHECK (is_owner_or_operator(auth.uid()));

-- Augment ideas with confidence_score
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS confidence_score integer;

-- Index audit_log to query overrides quickly
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action, created_at DESC);

-- Seed default stress scenarios
INSERT INTO public.stress_scenarios (name, description, shocks)
SELECT 'Equity -5% / VIX +20%', 'Sudden equity selloff with vol expansion', '{"spx_pct": -5, "vix_pct": 20, "oil_pct": -3, "usd_pct": 1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.stress_scenarios WHERE name = 'Equity -5% / VIX +20%');

INSERT INTO public.stress_scenarios (name, description, shocks)
SELECT 'Oil -15% / Energy Rout', 'Crude collapse stresses energy book', '{"spx_pct": -2, "vix_pct": 15, "oil_pct": -15, "usd_pct": 2}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.stress_scenarios WHERE name = 'Oil -15% / Energy Rout');

INSERT INTO public.stress_scenarios (name, description, shocks)
SELECT 'Rates +50bps Shock', 'Hawkish surprise lifts real yields', '{"spx_pct": -3, "vix_pct": 10, "rates_bps": 50, "usd_pct": 1.5}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.stress_scenarios WHERE name = 'Rates +50bps Shock');
