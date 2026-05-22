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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.match_research_documents(vector, int, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_research_documents(vector, int, uuid, uuid) TO authenticated;