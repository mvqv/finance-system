-- 1. Vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. research_documents (RAG memory)
CREATE TABLE IF NOT EXISTS public.research_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid,
  idea_id uuid,
  kind text NOT NULL CHECK (kind IN ('memo','event','note','external','postmortem','debate')),
  title text NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_documents_embedding_idx
  ON public.research_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS research_documents_asset_idx ON public.research_documents(asset_id);
CREATE INDEX IF NOT EXISTS research_documents_idea_idx ON public.research_documents(idea_id);
CREATE INDEX IF NOT EXISTS research_documents_kind_idx ON public.research_documents(kind);

ALTER TABLE public.research_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read research_documents"
  ON public.research_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators manage research_documents"
  ON public.research_documents FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid()))
  WITH CHECK (public.is_owner_or_operator(auth.uid()));

-- 3. match function
CREATE OR REPLACE FUNCTION public.match_research_documents(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter_asset uuid DEFAULT NULL,
  filter_idea uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  asset_id uuid,
  idea_id uuid,
  kind text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.asset_id, d.idea_id, d.kind, d.title, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.research_documents d
  WHERE d.embedding IS NOT NULL
    AND (filter_asset IS NULL OR d.asset_id = filter_asset)
    AND (filter_idea IS NULL OR d.idea_id = filter_idea)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 4. postmortems
CREATE TABLE IF NOT EXISTS public.postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL UNIQUE,
  trade_journal_id uuid,
  summary text NOT NULL,
  what_worked text,
  what_failed text,
  lessons text,
  score int CHECK (score BETWEEN 0 AND 100),
  generated_by_model text,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postmortems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read postmortems"
  ON public.postmortems FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators manage postmortems"
  ON public.postmortems FOR ALL TO authenticated
  USING (public.is_owner_or_operator(auth.uid()))
  WITH CHECK (public.is_owner_or_operator(auth.uid()));