-- ============================================================
-- ATLANTIX LAB — CRITICAL FIX
-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: agent debates not showing in UI (RLS blocking realtime)
-- ============================================================

-- Step 1: Backfill NULL owner_id on all tables
DO $$
DECLARE
  t text;
  owner_uuid text := 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';
  tables text[] := ARRAY[
    'assets','asset_features','events','macro_indicators',
    'agent_debates','investment_memos','risk_assessments','postmortems',
    'positions','orders','trade_journal','portfolio_snapshots',
    'alerts','watchlist','research_documents',
    'agent_scorecards','stress_scenarios','stress_results','market_limits',
    'system_health_log','ideas'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE public.%I SET owner_id = %L WHERE owner_id IS NULL', t, owner_uuid);
  END LOOP;
END $$;

-- Step 2: Fix SELECT policies — allow all authenticated users to read
-- (edge functions insert with service_role, owner_id may differ from auth.uid())

DROP POLICY IF EXISTS "Owner read agent_debates" ON public.agent_debates;
CREATE POLICY "Authenticated read agent_debates"
  ON public.agent_debates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read risk_assessments" ON public.risk_assessments;
CREATE POLICY "Authenticated read risk_assessments"
  ON public.risk_assessments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read investment_memos" ON public.investment_memos;
CREATE POLICY "Authenticated read investment_memos"
  ON public.investment_memos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read ideas" ON public.ideas;
CREATE POLICY "Authenticated read ideas"
  ON public.ideas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read assets" ON public.assets;
CREATE POLICY "Authenticated read assets"
  ON public.assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read watchlist" ON public.watchlist;
CREATE POLICY "Authenticated read watchlist"
  ON public.watchlist FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read events" ON public.events;
CREATE POLICY "Authenticated read events"
  ON public.events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read positions" ON public.positions;
CREATE POLICY "Authenticated read positions"
  ON public.positions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read orders" ON public.orders;
CREATE POLICY "Authenticated read orders"
  ON public.orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read portfolio_snapshots" ON public.portfolio_snapshots;
CREATE POLICY "Authenticated read portfolio_snapshots"
  ON public.portfolio_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read trade_journal" ON public.trade_journal;
CREATE POLICY "Authenticated read trade_journal"
  ON public.trade_journal FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read postmortems" ON public.postmortems;
CREATE POLICY "Authenticated read postmortems"
  ON public.postmortems FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read system_health_log" ON public.system_health_log;
CREATE POLICY "Authenticated read system_health_log"
  ON public.system_health_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read macro_indicators" ON public.macro_indicators;
CREATE POLICY "Authenticated read macro_indicators"
  ON public.macro_indicators FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read asset_features" ON public.asset_features;
CREATE POLICY "Authenticated read asset_features"
  ON public.asset_features FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read alerts" ON public.alerts;
CREATE POLICY "Authenticated read alerts"
  ON public.alerts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read research_documents" ON public.research_documents;
CREATE POLICY "Authenticated read research_documents"
  ON public.research_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read agent_scorecards" ON public.agent_scorecards;
CREATE POLICY "Authenticated read agent_scorecards"
  ON public.agent_scorecards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read stress_scenarios" ON public.stress_scenarios;
CREATE POLICY "Authenticated read stress_scenarios"
  ON public.stress_scenarios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read stress_results" ON public.stress_results;
CREATE POLICY "Authenticated read stress_results"
  ON public.stress_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read market_limits" ON public.market_limits;
CREATE POLICY "Authenticated read market_limits"
  ON public.market_limits FOR SELECT TO authenticated USING (true);

-- Step 3: Fix DEFAULT owner_id for edge function inserts
ALTER TABLE public.agent_debates
  ALTER COLUMN owner_id SET DEFAULT 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';

ALTER TABLE public.risk_assessments
  ALTER COLUMN owner_id SET DEFAULT 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';

ALTER TABLE public.investment_memos
  ALTER COLUMN owner_id SET DEFAULT 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';

ALTER TABLE public.ideas
  ALTER COLUMN owner_id SET DEFAULT 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';

ALTER TABLE public.postmortems
  ALTER COLUMN owner_id SET DEFAULT 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8';

SELECT 'FIX APPLIED SUCCESSFULLY' as result;
