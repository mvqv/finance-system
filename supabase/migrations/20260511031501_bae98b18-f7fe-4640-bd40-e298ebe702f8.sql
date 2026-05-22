-- Enable pg_cron + pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unique constraint on events.url so ingest-news upserts dedupe correctly.
-- Allow multiple rows with NULL url, but enforce uniqueness on real URLs.
CREATE UNIQUE INDEX IF NOT EXISTS events_url_unique
  ON public.events (url) WHERE url IS NOT NULL;