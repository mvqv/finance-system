-- Enable scheduling + outbound HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- Auto-postmortem trigger: when a position is closed, fire the
-- /api/public/hooks/postmortem endpoint via pg_net (async).
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_position_postmortem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.closed_at IS NULL
     AND NEW.closed_at IS NOT NULL
     AND NEW.idea_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/postmortem',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('idea_id', NEW.idea_id, 'position_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_position_postmortem ON public.positions;
CREATE TRIGGER trg_position_postmortem
AFTER UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.tg_position_postmortem();

-- ============================================================
-- pg_cron schedules. Idempotent: unschedule if exists, then re-add.
-- ============================================================
DO $$
DECLARE
  jobs text[] := ARRAY[
    'atlantix-stop-loss',
    'atlantix-macro-us',
    'atlantix-macro-tr',
    'atlantix-news',
    'atlantix-kap',
    'atlantix-try-crisis',
    'atlantix-features',
    'atlantix-fundamentals',
    'atlantix-portfolio-sync',
    'atlantix-daily-snapshot'
  ];
  j text;
BEGIN
  FOREACH j IN ARRAY jobs LOOP
    BEGIN
      PERFORM cron.unschedule(j);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Stop-loss / take-profit watcher: every minute
SELECT cron.schedule(
  'atlantix-stop-loss', '* * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"stop-loss"}'::jsonb); $$
);

-- US macro: every 6h
SELECT cron.schedule(
  'atlantix-macro-us', '17 */6 * * *',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"macro-us"}'::jsonb); $$
);

-- TR macro (USD/TRY etc): every 15 min
SELECT cron.schedule(
  'atlantix-macro-tr', '*/15 * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"macro-tr"}'::jsonb); $$
);

-- US/global news: every hour
SELECT cron.schedule(
  'atlantix-news', '7 * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"news"}'::jsonb); $$
);

-- KAP (TR disclosures): every hour
SELECT cron.schedule(
  'atlantix-kap', '23 * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"kap"}'::jsonb); $$
);

-- TRY crisis monitor: every 5 min during Istanbul market hours (UTC 07:00-15:00)
SELECT cron.schedule(
  'atlantix-try-crisis', '*/5 7-15 * * 1-5',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"try-crisis"}'::jsonb); $$
);

-- Quant features: 4x per US trading day
SELECT cron.schedule(
  'atlantix-features', '0 14,17,20,23 * * 1-5',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"features"}'::jsonb); $$
);

-- Fundamentals: once a day after US close (22:00 UTC)
SELECT cron.schedule(
  'atlantix-fundamentals', '0 22 * * 1-5',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"fundamentals"}'::jsonb); $$
);

-- Broker portfolio sync: every 10 min during US trading
SELECT cron.schedule(
  'atlantix-portfolio-sync', '*/10 13-21 * * 1-5',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"portfolio-sync"}'::jsonb); $$
);

-- End-of-day snapshot (chains sync + features + fundamentals): 22:30 UTC
SELECT cron.schedule(
  'atlantix-daily-snapshot', '30 22 * * 1-5',
  $$ SELECT net.http_post(
       url := 'https://project--79456f7e-b7b6-47e7-9c04-7459f284c11c.lovable.app/api/public/hooks/tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"job":"daily-snapshot"}'::jsonb); $$
);