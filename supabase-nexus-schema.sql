-- SkillForge Nexus — Supabase Schema Updates
-- Run this SQL to add meta_skills table and indexes for the graph-based composition engine

-- ═══════════════════════════════════════════════════════════════════════
-- Meta Skills Table (synthesized skill bundles)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS meta_skills (
  id TEXT PRIMARY KEY,
  source_skill_ids TEXT[] NOT NULL,
  synthesized_at TIMESTAMPTZ DEFAULT NOW(),
  nexus_score FLOAT NOT NULL,
  token_savings INTEGER DEFAULT 0,
  md_content TEXT,
  query_used TEXT,
  times_used INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_via TEXT DEFAULT 'nexus_api' CHECK (created_via IN ('nexus_api', 'frontend', 'mcp'))
);

COMMENT ON TABLE meta_skills IS 'Auto-synthesized skill bundles from SkillForge Nexus composition engine';

-- ═══════════════════════════════════════════════════════════════════════
-- Skill Composition History (tracks which skills are composed together)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS skill_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id_a TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_id_b TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  success_prob FLOAT DEFAULT 0.75,
  times_used INTEGER DEFAULT 0,
  avg_token_delta INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id_a, skill_id_b)
);

COMMENT ON TABLE skill_compositions IS 'Tracks skill pair compositions for graph edge weights';

-- ═══════════════════════════════════════════════════════════════════════
-- Embedding Index for Vector Search (when Supabase pgvector is enabled)
-- ═══════════════════════════════════════════════════════════════════════

-- Option A: HNSW index (requires pgvector extension)
-- ALTER TABLE skills ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_skills_embedding ON skills USING hnsw (embedding vector_cosine_ops);

-- Option B: Simple trigram index (works without pgvector)
CREATE INDEX IF NOT EXISTS idx_skills_name_trgm ON skills USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skills_desc_trgm ON skills USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skills_tags ON skills USING gin (tags);

-- ═══════════════════════════════════════════════════════════════════════
-- Token Estimate Column
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE skills ADD COLUMN IF NOT EXISTS token_estimate INTEGER DEFAULT 200;

-- ═══════════════════════════════════════════════════════════════════════
-- Functions
-- ═══════════════════════════════════════════════════════════════════════

-- Function to update composition stats when a meta-skill is used
CREATE OR REPLACE FUNCTION record_meta_skill_usage(p_meta_skill_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE meta_skills SET times_used = times_used + 1 WHERE id = p_meta_skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update composition edge weights from usage
CREATE OR REPLACE FUNCTION update_skill_composition(
  p_skill_id_a TEXT,
  p_skill_id_b TEXT,
  p_success BOOLEAN,
  p_token_delta INTEGER
)
RETURNS void AS $$
DECLARE
  v_existing RECORD;
BEGIN
  SELECT * INTO v_existing FROM skill_compositions 
  WHERE (skill_id_a = p_skill_id_a AND skill_id_b = p_skill_id_b)
     OR (skill_id_a = p_skill_id_b AND skill_id_b = p_skill_id_a);

  IF FOUND THEN
    UPDATE skill_compositions SET
      times_used = times_used + 1,
      success_prob = CASE 
        WHEN p_success THEN (success_prob * times_used + 1.0) / (times_used + 1)
        ELSE (success_prob * times_used) / (times_used + 1)
      END,
      avg_token_delta = ((avg_token_delta * times_used) + p_token_delta) / (times_used + 1),
      last_used = NOW()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO skill_compositions (skill_id_a, skill_id_b, success_prob, avg_token_delta)
    VALUES (p_skill_id_a, p_skill_id_b, CASE WHEN p_success THEN 0.9 ELSE 0.6 END, p_token_delta);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get composition graph edges for a skill
CREATE OR REPLACE FUNCTION get_skill_neighbors(p_skill_id TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  neighbor_id TEXT,
  success_prob FLOAT,
  avg_token_delta INTEGER,
  times_used INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN sc.skill_id_a = p_skill_id THEN sc.skill_id_b ELSE sc.skill_id_a END as neighbor_id,
    sc.success_prob,
    sc.avg_token_delta,
    sc.times_used
  FROM skill_compositions sc
  WHERE sc.skill_id_a = p_skill_id OR sc.skill_id_b = p_skill_id
  ORDER BY sc.success_prob DESC, sc.times_used DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular meta-skills
CREATE OR REPLACE FUNCTION get_popular_meta_skills(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id TEXT,
  nexus_score FLOAT,
  times_used INTEGER,
  source_skill_ids TEXT[],
  synthesized_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT ms.id, ms.nexus_score, ms.times_used, ms.source_skill_ids, ms.synthesized_at
  FROM meta_skills ms
  ORDER BY ms.times_used DESC, ms.nexus_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════
-- Triggers for automatic composition tracking
-- ═══════════════════════════════════════════════════════════════════════

-- Trigger to increment download count on meta-skills
CREATE OR REPLACE FUNCTION trigger_record_meta_skill_usage()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM record_meta_skill_usage(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Create trigger when meta_skills has downloads if needed
-- DROP TRIGGER IF EXISTS trg_meta_skill_usage ON meta_skills;
-- CREATE TRIGGER trg_meta_skill_usage AFTER INSERT ON meta_skills FOR EACH ROW EXECUTE FUNCTION trigger_record_meta_skill_usage();

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE meta_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_compositions ENABLE ROW LEVEL SECURITY;

-- Meta skills: public read, authenticated insert
CREATE POLICY "Public read meta_skills" ON meta_skills FOR SELECT USING (true);
CREATE POLICY "Authenticated insert meta_skills" ON meta_skills FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Service role manage meta_skills" ON meta_skills FOR ALL USING (auth.role() = 'service_role');

-- Skill compositions: public read, service role write
CREATE POLICY "Public read compositions" ON skill_compositions FOR SELECT USING (true);
CREATE POLICY "Service role manage compositions" ON skill_compositions FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- Views for analytics
-- ═══════════════════════════════════════════════════════════════════════

-- View: Top composition pairs (most used skill combinations)
CREATE OR REPLACE VIEW v_top_compositions AS
SELECT 
  sc.skill_id_a,
  sc.skill_id_b,
  s_a.name AS skill_a_name,
  s_b.name AS skill_b_name,
  sc.times_used,
  sc.success_prob,
  sc.avg_token_delta
FROM skill_compositions sc
JOIN skills s_a ON sc.skill_id_a = s_a.id
JOIN skills s_b ON sc.skill_id_b = s_b.id
ORDER BY sc.times_used DESC, sc.success_prob DESC
LIMIT 100;

-- View: Meta-skill analytics
CREATE OR REPLACE VIEW v_meta_skill_analytics AS
SELECT 
  ms.id,
  ms.nexus_score,
  ms.times_used,
  ms.synthesized_at,
  ms.source_skill_ids,
  array_length(ms.source_skill_ids, 1) AS num_skills,
  u.username
FROM meta_skills ms
LEFT JOIN profiles u ON ms.created_by = u.id
ORDER BY ms.times_used DESC, ms.nexus_score DESC;

-- ═══════════════════════════════════════════════════════════════════════
-- Grant permissions
-- ═══════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON meta_skills, skill_compositions, v_top_compositions, v_meta_skill_analytics TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON meta_skills, skill_compositions TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
