-- ════════════════════════════════════════════════════════════════
-- SkillGalaxy — Migration: Ratings, Reviews & Versioning
-- Run this in: Supabase Dashboard → SQL Editor
-- Requires: supabase-setup.sql to have been run first
-- ════════════════════════════════════════════════════════════════


-- ── 1. VERSIONING COLUMNS ────────────────────────────────────────

ALTER TABLE public.community_skills
  ADD COLUMN IF NOT EXISTS version    TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS changelog  TEXT DEFAULT '';

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS version    TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS changelog  TEXT DEFAULT '';


-- ── 2. SKILL REVIEWS TABLE ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_reviews (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- skill_id works for both TEXT ids (skills table) and UUID cast to TEXT (community_skills)
  skill_id    TEXT        NOT NULL,
  skill_table TEXT        NOT NULL DEFAULT 'community_skills'
                          CHECK (skill_table IN ('skills', 'community_skills')),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  TEXT,
  rating      INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- One review per user per skill
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_reviews_unique
  ON public.skill_reviews (skill_id, user_id);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_skill_id
  ON public.skill_reviews (skill_id);

-- RLS
ALTER TABLE public.skill_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skill reviews"
  ON public.skill_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reviews"
  ON public.skill_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own reviews"
  ON public.skill_reviews FOR UPDATE
  USING (auth.uid() = user_id);


-- ── 3. REVIEW FUNCTIONS ──────────────────────────────────────────

-- Upsert a review; returns updated avg_rating + review_count
CREATE OR REPLACE FUNCTION public.upsert_skill_review(
  p_skill_id    TEXT,
  p_skill_table TEXT,
  p_rating      INT,
  p_review_text TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email   TEXT;
  v_avg     NUMERIC;
  v_count   BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.skill_reviews
    (skill_id, skill_table, user_id, user_email, rating, review_text)
  VALUES
    (p_skill_id, p_skill_table, v_user_id, v_email, p_rating, p_review_text)
  ON CONFLICT (skill_id, user_id) DO UPDATE SET
    rating      = EXCLUDED.rating,
    review_text = EXCLUDED.review_text,
    updated_at  = NOW();

  SELECT ROUND(AVG(r.rating)::NUMERIC, 1), COUNT(*)::BIGINT
  INTO v_avg, v_count
  FROM public.skill_reviews r
  WHERE r.skill_id = p_skill_id;

  RETURN json_build_object(
    'avg_rating',   COALESCE(v_avg, 0),
    'review_count', COALESCE(v_count, 0)
  );
END;
$$;


-- Get paginated reviews for a skill
CREATE OR REPLACE FUNCTION public.get_skill_reviews(
  p_skill_id TEXT,
  p_limit    INT DEFAULT 5,
  p_offset   INT DEFAULT 0
)
RETURNS TABLE (
  id          UUID,
  user_email  TEXT,
  rating      INT,
  review_text TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT r.id, r.user_email, r.rating, r.review_text, r.created_at
    FROM   public.skill_reviews r
    WHERE  r.skill_id = p_skill_id
    ORDER  BY r.created_at DESC
    LIMIT  p_limit OFFSET p_offset;
END;
$$;


-- Get avg rating + count for a skill
CREATE OR REPLACE FUNCTION public.get_skill_rating(p_skill_id TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_avg   NUMERIC;
  v_count BIGINT;
BEGIN
  SELECT ROUND(AVG(r.rating)::NUMERIC, 1), COUNT(*)::BIGINT
  INTO v_avg, v_count
  FROM public.skill_reviews r
  WHERE r.skill_id = p_skill_id;

  RETURN json_build_object(
    'avg_rating',   COALESCE(v_avg, 0),
    'review_count', COALESCE(v_count, 0)
  );
END;
$$;


-- ── 4. TOGGLE UPVOTE (community_skills) ─────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_upvote(p_skill_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.community_skills
  SET    upvotes = upvotes + 1
  WHERE  id = p_skill_id
  RETURNING upvotes INTO v_count;

  RETURN v_count;
END;
$$;


-- ── 5. DOWNLOAD LOG TABLE (for analytics) ───────────────────────

CREATE TABLE IF NOT EXISTS public.skill_downloads (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id   TEXT        NOT NULL,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_downloads_skill
  ON public.skill_downloads (skill_id);

ALTER TABLE public.skill_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert download log"
  ON public.skill_downloads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view download stats"
  ON public.skill_downloads FOR SELECT
  USING (true);


-- ── 6. SECURITY SCORE + AI SCAN COLUMNS ─────────────────────────

ALTER TABLE public.community_skills
  ADD COLUMN IF NOT EXISTS security_score   INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS security_badge   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS security_scanned BOOLEAN DEFAULT FALSE;


-- ── 7. SKILL BUNDLES TABLE ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_bundles (
  id          TEXT         PRIMARY KEY,           -- kebab-case slug
  name        TEXT         NOT NULL,
  icon        TEXT         DEFAULT '📦',
  tagline     TEXT         DEFAULT '',
  description TEXT         DEFAULT '',
  skill_ids   TEXT[]       DEFAULT '{}',          -- array of skill IDs
  cat         TEXT         DEFAULT 'ai',
  difficulty  TEXT         DEFAULT 'intermediate',
  featured    BOOLEAN      DEFAULT FALSE,
  download_count INT       DEFAULT 0,
  created_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.skill_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundles"
  ON public.skill_bundles FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create bundles"
  ON public.skill_bundles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_skill_bundles_cat
  ON public.skill_bundles (cat);


-- ── 8. SKILL TRACES TABLE (SkillForge usage tracking) ────────────

CREATE TABLE IF NOT EXISTS public.skill_traces (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  query       TEXT        NOT NULL DEFAULT '',
  skill_ids   JSONB       NOT NULL DEFAULT '[]',   -- array of skill IDs used together
  source      TEXT        DEFAULT 'web'
                          CHECK (source IN ('web', 'mcp', 'api', 'bundle')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_traces_created
  ON public.skill_traces (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_traces_user
  ON public.skill_traces (user_id);

-- GIN index on skill_ids JSONB for containment queries
CREATE INDEX IF NOT EXISTS idx_skill_traces_skill_ids
  ON public.skill_traces USING GIN (skill_ids);

ALTER TABLE public.skill_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert traces"
  ON public.skill_traces FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view traces"
  ON public.skill_traces FOR SELECT
  USING (true);


-- ── 9. SKILL CO-USAGE MATERIALIZED VIEW ─────────────────────────
-- Aggregates pairwise co-usage counts from skill_traces for SkillForge
-- graph-based recommendations. Refresh periodically via cron or manual call.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.skill_co_usage AS
SELECT
  a.skill AS skill_a,
  b.skill AS skill_b,
  COUNT(*) AS freq
FROM (
  SELECT id AS trace_id, jsonb_array_elements_text(skill_ids) AS skill
  FROM public.skill_traces
) a
JOIN (
  SELECT id AS trace_id, jsonb_array_elements_text(skill_ids) AS skill
  FROM public.skill_traces
) b ON a.trace_id = b.trace_id AND a.skill < b.skill
GROUP BY a.skill, b.skill;

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_co_usage_pair
  ON public.skill_co_usage (skill_a, skill_b);


-- ── 10. HELPER FUNCTIONS FOR SKILLFORGE ──────────────────────────

-- Log a usage trace (called from frontend/API after skill recommendation)
CREATE OR REPLACE FUNCTION public.log_skill_trace(
  p_query     TEXT,
  p_skill_ids JSONB,
  p_source    TEXT DEFAULT 'web'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.skill_traces (user_id, query, skill_ids, source)
  VALUES (auth.uid(), p_query, p_skill_ids, p_source)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Get top co-used skills for a given skill ID
CREATE OR REPLACE FUNCTION public.get_co_used_skills(
  p_skill_id TEXT,
  p_limit    INT DEFAULT 10
)
RETURNS TABLE (
  related_skill TEXT,
  frequency     BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      CASE WHEN skill_a = p_skill_id THEN skill_b ELSE skill_a END AS related_skill,
      freq AS frequency
    FROM public.skill_co_usage
    WHERE skill_a = p_skill_id OR skill_b = p_skill_id
    ORDER BY freq DESC
    LIMIT p_limit;
END;
$$;

