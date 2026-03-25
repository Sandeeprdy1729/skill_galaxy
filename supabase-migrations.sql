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
