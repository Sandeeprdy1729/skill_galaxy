-- ════════════════════════════════════════════════════════════════
-- SkillGalaxy — Migration: SkillForge Composites & Skill Graph
-- Run this in: Supabase Dashboard → SQL Editor
-- Requires: supabase-setup.sql + supabase-migrations.sql first
-- ════════════════════════════════════════════════════════════════


-- ── 1. SKILL COMPOSITES TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_composites (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT        NOT NULL,
  query           TEXT        NOT NULL,
  original_ids    TEXT[]      NOT NULL DEFAULT '{}',
  composite_md    TEXT        NOT NULL,
  total_tokens    INT         DEFAULT 0,
  baseline_tokens INT         DEFAULT 0,
  token_savings   NUMERIC     DEFAULT 0,
  fitness_score   NUMERIC     DEFAULT 0,
  overlap_pruned  NUMERIC     DEFAULT 0,
  version         INT         DEFAULT 1,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  download_count  INT         DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_composites_user
  ON public.skill_composites (user_id);

CREATE INDEX IF NOT EXISTS idx_composites_created
  ON public.skill_composites (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_composites_original_ids
  ON public.skill_composites USING GIN (original_ids);

-- RLS
ALTER TABLE public.skill_composites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view composites"
  ON public.skill_composites FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create composites"
  ON public.skill_composites FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own composites"
  ON public.skill_composites FOR UPDATE
  USING (auth.uid() = user_id);


-- ── 2. SKILL GRAPH EDGES TABLE ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_graph_edges (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id    TEXT        NOT NULL,
  target_id    TEXT        NOT NULL,
  synergy_score NUMERIC    DEFAULT 0,
  overlap_score NUMERIC    DEFAULT 0,
  shared_tags   TEXT[]     DEFAULT '{}',
  co_usage_count INT       DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source
  ON public.skill_graph_edges (source_id);

CREATE INDEX IF NOT EXISTS idx_graph_edges_target
  ON public.skill_graph_edges (target_id);

CREATE INDEX IF NOT EXISTS idx_graph_edges_synergy
  ON public.skill_graph_edges (synergy_score DESC);

-- RLS
ALTER TABLE public.skill_graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view graph edges"
  ON public.skill_graph_edges FOR SELECT
  USING (true);


-- ── 3. COMPOSITE ANALYTICS FUNCTION ─────────────────────────────

-- Increment download count for a composite
CREATE OR REPLACE FUNCTION public.increment_composite_download(p_composite_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.skill_composites
  SET download_count = download_count + 1,
      updated_at = NOW()
  WHERE id = p_composite_id;
END;
$$;

-- Get top composites by downloads
CREATE OR REPLACE FUNCTION public.get_top_composites(
  p_limit  INT DEFAULT 10,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  query           TEXT,
  original_ids    TEXT[],
  total_tokens    INT,
  token_savings   NUMERIC,
  fitness_score   NUMERIC,
  download_count  INT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name, c.query, c.original_ids,
           c.total_tokens, c.token_savings, c.fitness_score,
           c.download_count, c.created_at
    FROM   public.skill_composites c
    ORDER  BY c.download_count DESC, c.created_at DESC
    LIMIT  p_limit OFFSET p_offset;
END;
$$;


-- ── 4. UPSERT GRAPH EDGE (for learning synergies from usage) ────

CREATE OR REPLACE FUNCTION public.upsert_graph_edge(
  p_source_id    TEXT,
  p_target_id    TEXT,
  p_synergy      NUMERIC DEFAULT 0,
  p_overlap      NUMERIC DEFAULT 0,
  p_shared_tags  TEXT[]  DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.skill_graph_edges
    (source_id, target_id, synergy_score, overlap_score, shared_tags, co_usage_count)
  VALUES
    (p_source_id, p_target_id, p_synergy, p_overlap, p_shared_tags, 1)
  ON CONFLICT (source_id, target_id) DO UPDATE SET
    synergy_score  = (skill_graph_edges.synergy_score + EXCLUDED.synergy_score) / 2,
    overlap_score  = (skill_graph_edges.overlap_score + EXCLUDED.overlap_score) / 2,
    shared_tags    = EXCLUDED.shared_tags,
    co_usage_count = skill_graph_edges.co_usage_count + 1,
    updated_at     = NOW();
END;
$$;


-- ── 5. MATERIALIZED VIEW: Popular Skill Pairs ───────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_popular_skill_pairs AS
  SELECT
    source_id,
    target_id,
    synergy_score,
    overlap_score,
    shared_tags,
    co_usage_count
  FROM public.skill_graph_edges
  WHERE co_usage_count >= 2
  ORDER BY co_usage_count DESC, synergy_score DESC
  LIMIT 500;

-- Refresh periodically (call via cron or manual)
-- REFRESH MATERIALIZED VIEW public.mv_popular_skill_pairs;
