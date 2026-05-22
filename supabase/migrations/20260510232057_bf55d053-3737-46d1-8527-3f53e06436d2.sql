
-- ============================================================
-- ATLANTIX LAB — Autonomous Digital Hedge Fund Terminal
-- Full schema, RLS, roles, triggers, seed XOM demo
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.app_role AS ENUM ('owner', 'operator', 'viewer');
CREATE TYPE public.market_regime AS ENUM ('risk_on', 'risk_off', 'neutral', 'inflation_shock', 'liquidity_squeeze');
CREATE TYPE public.idea_status AS ENUM ('draft', 'researching', 'debating', 'risk_review', 'awaiting_approval', 'approved', 'rejected', 'executed', 'closed', 'invalidated');
CREATE TYPE public.risk_verdict AS ENUM ('approve', 'reduce_size', 'wait', 'reject', 'kill_switch');
CREATE TYPE public.agent_kind AS ENUM ('cio','macro','fundamental','news','options','flow','quant','bear','risk','portfolio','execution','operations','memory');
CREATE TYPE public.position_side AS ENUM ('long', 'short');
CREATE TYPE public.system_status AS ENUM ('green','yellow','red','black');

-- ---------- TIMESTAMP HELPER ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------- PROFILES ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- USER ROLES (separate table, security-definer check) ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_operator(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','operator'));
$$;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "Only owners manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

-- ---------- AUTO-PROVISION: first user = owner, others = viewer ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles(user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  assigned_role := CASE WHEN user_count = 0 THEN 'owner'::public.app_role ELSE 'viewer'::public.app_role END;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- ASSETS ----------
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  sector TEXT,
  exchange TEXT,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators write assets" ON public.assets FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- WATCHLIST ----------
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  trigger_note TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read watchlist" ON public.watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage watchlist" ON public.watchlist FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- EVENTS ----------
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  importance INT NOT NULL DEFAULT 50 CHECK (importance BETWEEN 0 AND 100),
  sentiment NUMERIC(4,3),
  source TEXT,
  url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage events" ON public.events FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));
CREATE INDEX events_occurred_idx ON public.events(occurred_at DESC);
CREATE INDEX events_asset_idx ON public.events(asset_id);

-- ---------- IDEAS ----------
CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  thesis TEXT NOT NULL,
  trigger TEXT,
  side public.position_side NOT NULL,
  status public.idea_status NOT NULL DEFAULT 'draft',
  edge_score INT CHECK (edge_score BETWEEN 0 AND 100),
  risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
  consensus_score INT CHECK (consensus_score BETWEEN 0 AND 100),
  timing_score INT CHECK (timing_score BETWEEN 0 AND 100),
  liquidity_score INT CHECK (liquidity_score BETWEEN 0 AND 100),
  asymmetry NUMERIC(6,2),
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  invalidation TEXT,
  recommended_action TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ideas" ON public.ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage ideas" ON public.ideas FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));
CREATE TRIGGER ideas_updated BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- INVESTMENT MEMO ----------
CREATE TABLE public.investment_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  generated_by_model TEXT,
  tokens_in INT,
  tokens_out INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read memos" ON public.investment_memos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage memos" ON public.investment_memos FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- AGENT DEBATES ----------
CREATE TABLE public.agent_debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  agent public.agent_kind NOT NULL,
  stance TEXT,
  argument TEXT NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  model TEXT,
  tokens_in INT,
  tokens_out INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read debates" ON public.agent_debates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage debates" ON public.agent_debates FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));
CREATE INDEX debates_idea_idx ON public.agent_debates(idea_id, created_at);

-- ---------- RISK ASSESSMENTS ----------
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  verdict public.risk_verdict NOT NULL,
  max_position_pct NUMERIC(5,2),
  rationale TEXT,
  limits_used JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read risk" ON public.risk_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage risk" ON public.risk_assessments FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- PORTFOLIO ----------
CREATE TABLE public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_equity NUMERIC(18,2) NOT NULL,
  cash NUMERIC(18,2) NOT NULL,
  daily_pnl NUMERIC(18,2) DEFAULT 0,
  daily_risk_used_pct NUMERIC(5,2) DEFAULT 0,
  regime public.market_regime DEFAULT 'neutral',
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read snapshots" ON public.portfolio_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage snapshots" ON public.portfolio_snapshots FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  side public.position_side NOT NULL,
  quantity NUMERIC(18,6) NOT NULL,
  avg_price NUMERIC(18,6) NOT NULL,
  current_price NUMERIC(18,6),
  unrealized_pnl NUMERIC(18,2) DEFAULT 0,
  weight_pct NUMERIC(5,2),
  stop_loss NUMERIC(18,6),
  take_profit NUMERIC(18,6),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  idea_id UUID REFERENCES public.ideas(id)
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read positions" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage positions" ON public.positions FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- ORDERS / EXECUTIONS / JOURNAL ----------
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  side public.position_side NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'limit',
  quantity NUMERIC(18,6) NOT NULL,
  limit_price NUMERIC(18,6),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

CREATE TABLE public.trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES public.ideas(id),
  asset_id UUID REFERENCES public.assets(id),
  side public.position_side NOT NULL,
  entry_price NUMERIC(18,6),
  exit_price NUMERIC(18,6),
  pnl NUMERIC(18,2),
  reason_in TEXT,
  reason_out TEXT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read journal" ON public.trade_journal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage journal" ON public.trade_journal FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid())) WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- ---------- SYSTEM HEALTH + AUDIT + KILL SWITCH ----------
CREATE TABLE public.system_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  status public.system_status NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_health_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read health" ON public.system_health_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators write health" ON public.system_health_log FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_operator(auth.uid()));

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner'));
CREATE POLICY "Authenticated insert audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.kill_switch_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  engaged BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  engaged_by UUID,
  engaged_at TIMESTAMPTZ
);
INSERT INTO public.kill_switch_state(id, engaged) VALUES (1, false);
ALTER TABLE public.kill_switch_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read kill switch" ON public.kill_switch_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners toggle kill switch" ON public.kill_switch_state FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- ---------- REALTIME ----------
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_debates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_log;

-- ---------- SEED DATA: assets, XOM demo idea, debates, risk, portfolio ----------
INSERT INTO public.assets(ticker, name, asset_class, sector, exchange) VALUES
  ('XOM','Exxon Mobil Corporation','equity','Energy','NYSE'),
  ('CVX','Chevron Corporation','equity','Energy','NYSE'),
  ('SLB','SLB (Schlumberger)','equity','Energy Services','NYSE'),
  ('SPY','SPDR S&P 500 ETF','etf','Index','NYSE'),
  ('TLT','iShares 20+ Year Treasury','etf','Bonds','NASDAQ'),
  ('GLD','SPDR Gold Shares','etf','Commodities','NYSE'),
  ('USO','United States Oil Fund','etf','Commodities','NYSE');

INSERT INTO public.watchlist(asset_id, trigger_note)
  SELECT id, 'Supply shock + capex cycle' FROM public.assets WHERE ticker = 'XOM';

INSERT INTO public.events(asset_id, event_type, headline, summary, importance, sentiment, source, occurred_at)
SELECT id, 'contract_award',
  'Exxon Mobil wins unexpected long-term LNG supply contract',
  'XOM announced a 15-year LNG offtake agreement that materially raises forward cash flow visibility. Equity reacted modestly; options market has not repriced.',
  85, 0.65, 'press_release', now() - interval '2 hours'
FROM public.assets WHERE ticker = 'XOM';

WITH new_idea AS (
  INSERT INTO public.ideas(asset_id, title, thesis, trigger, side, status,
    edge_score, risk_score, consensus_score, timing_score, liquidity_score,
    asymmetry, confidence, invalidation, recommended_action)
  SELECT id,
    'Long XOM — LNG contract underpriced by market',
    'XOM secured a 15-year LNG supply contract that materially raises forward free cash flow. Spot price reacted modestly while options market shows no IV expansion — suggesting delayed pricing of the structural tailwind. Macro backdrop (sticky oil supply, weak inventories) reinforces the bullish skew.',
    'Unexpected long-dated LNG offtake announcement',
    'long','awaiting_approval',
    82, 44, 78, 85, 88, 3.2, 74,
    'Oil breaks below $68/bbl OR contract counterparty risk emerges OR XOM guides down at next earnings.',
    'Enter via limit order, sized at 1.2% of portfolio NAV. Stop at -8%. First target +18% (3-6 months).'
  FROM public.assets WHERE ticker = 'XOM'
  RETURNING id
)
INSERT INTO public.investment_memos(idea_id, content, generated_by_model)
SELECT id, jsonb_build_object(
  'idea','Long XOM',
  'trigger','15-year LNG supply contract announcement',
  'why_now','Spot reacted weakly; options market has not priced in structural FCF uplift',
  'whats_priced_in','Short-term oil price; one-quarter earnings beat',
  'what_market_missed','Long-dated cash flow durability and re-rating potential',
  'main_risk','Oil breakdown below key support; counterparty risk on LNG buyer',
  'invalidation','Crude < $68 OR contract amended OR negative guidance',
  'recommended_action','Limit buy, 1.2% NAV, stop -8%, target +18% in 3-6 months'
), 'gemini-2.5-pro'
FROM new_idea;

-- Insert debates for the seeded idea
WITH idea AS (SELECT id FROM public.ideas WHERE title LIKE 'Long XOM%' LIMIT 1)
INSERT INTO public.agent_debates(idea_id, agent, stance, argument, confidence, model)
SELECT idea.id, kind::public.agent_kind, stance, argument, conf, 'gemini-2.5-flash' FROM idea, (VALUES
  ('macro','for','Energy backdrop constructive: OECD inventories below 5-year average, no SPR refill, geopolitics supportive. Risk-on regime with inflation persistence favors energy equities.', 82),
  ('fundamental','for','LNG contract adds ~$1.2B/yr to forward EBITDA at conservative spread. Boosts FCF yield from 7.2% to ~8.4% — material re-rating catalyst.', 86),
  ('news','for','Announcement is fresh (<3h). Limited analyst coverage so far. Headline density on competing names suggests crowded sector attention but XOM is mispriced relative to peers.', 74),
  ('options','neutral','IV unchanged vs 30d average. Put/call ratio neutral. No unusual flow. Suggests derivatives market has NOT priced in the contract — supports asymmetric long.', 70),
  ('flow','for','XOM ADV $1.6B, tight spreads. Block-friendly. ETF flows into energy turning positive 3 days running. Entry size of 1.2% NAV is well-absorbable.', 80),
  ('quant','for','Backtest: similar long-dated contract announcements in mega-cap energy delivered avg +14.6% over 90d with 71% win rate when IV did not expand within 24h.', 77),
  ('bear','against','Risk: market may treat LNG offtake as already-known via sector ETF flows. Crude could break $68 if OPEC+ disappoints. Concentration risk vs existing energy exposure.', 65),
  ('risk','approve','Approved with size constraint: max 1.2% NAV. Daily risk budget 38% used. No correlated event in 48h. Stop -8% mandatory.', 90),
  ('portfolio','for','Current energy weight 6.4%, target 9%. Correlation with TLT short hedge favorable. Improves portfolio Sharpe by ~0.04 in scenario test.', 78)
) AS t(kind, stance, argument, conf);

-- Risk assessment for XOM
WITH idea AS (SELECT id FROM public.ideas WHERE title LIKE 'Long XOM%' LIMIT 1)
INSERT INTO public.risk_assessments(idea_id, verdict, max_position_pct, rationale, limits_used)
SELECT id, 'approve','1.20',
  'Within all risk envelopes. Liquidity ample. No event collision in next 48h. Hard stop -8%. Position cleared for owner approval.',
  jsonb_build_object('per_trade_pct',1.2,'daily_loss_budget_used_pct',38,'gross_exposure_pct',62,'corr_with_existing',0.31)
FROM idea;

-- Portfolio snapshot
INSERT INTO public.portfolio_snapshots(total_equity, cash, daily_pnl, daily_risk_used_pct, regime)
VALUES (1250000, 320000, 4280, 38, 'risk_on');

-- Sample positions
INSERT INTO public.positions(asset_id, side, quantity, avg_price, current_price, unrealized_pnl, weight_pct)
SELECT id,'long',1200,165.40,168.90,4200,5.4 FROM public.assets WHERE ticker='CVX';
INSERT INTO public.positions(asset_id, side, quantity, avg_price, current_price, unrealized_pnl, weight_pct)
SELECT id,'short',800,98.20,95.60,2080,3.1 FROM public.assets WHERE ticker='TLT';

-- System health entries
INSERT INTO public.system_health_log(component, status, message) VALUES
  ('gemini_api','green','API reachable, p50 latency 420ms'),
  ('market_data','green','Feed live, 0 gaps last 60min'),
  ('risk_engine','green','All limits operational'),
  ('news_ingestion','yellow','3 sources delayed >5min');
