-- ============================================================
-- Fix owner_id for rows inserted by edge functions (service_role)
-- Edge functions run as service_role — auth.uid() returns NULL.
-- We backfill any NULL owner_id rows to the known owner UUID.
-- ============================================================

-- Backfill any agent_debates rows with NULL owner_id
UPDATE public.agent_debates
SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8'
WHERE owner_id IS NULL;

-- Backfill any risk_assessments rows with NULL owner_id
UPDATE public.risk_assessments
SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8'
WHERE owner_id IS NULL;

-- Backfill any investment_memos rows with NULL owner_id
UPDATE public.investment_memos
SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8'
WHERE owner_id IS NULL;

-- Backfill any ideas rows with NULL owner_id
UPDATE public.ideas
SET owner_id = 'be7e0b13-f952-4dbf-a2c6-333d56c53ed8'
WHERE owner_id IS NULL;

-- Change DEFAULT for tables written by edge functions to use the known owner
-- so future inserts without explicit owner_id still get the right value.
-- This is safe because this is a single-owner terminal.
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
