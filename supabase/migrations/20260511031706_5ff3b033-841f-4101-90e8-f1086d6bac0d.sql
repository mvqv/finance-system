DROP INDEX IF EXISTS public.events_url_unique;
ALTER TABLE public.events ADD CONSTRAINT events_url_unique UNIQUE (url);