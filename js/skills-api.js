/**
 * SkillGalaxy — skills-api.js
 * All Supabase operations for community skills:
 * fetch, submit, validate, upvote, download, realtime sync.
 */

/* ── IN-MEMORY CACHE ─────────────────────────────── */
let communitySkillsCache = [];
let skillsTableCache     = [];   // skills loaded from the "skills" Supabase table
let realtimeChannel = null;

/* ── FETCH ───────────────────────────────────────── */
/**
 * Fetch ALL approved community skills from Supabase.
 * PostgREST caps a single request at ~1000 rows, so we paginate
 * in chunks until every approved skill has been retrieved.
 */
async function fetchCommunitySkills() {
  const PAGE = 1000;          // Supabase default max per request
  let allRows = [];
  let from    = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sb
      .from('community_skills')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) { hasMore = false; break; }

    allRows = allRows.concat(data);
    from += PAGE;
    if (data.length < PAGE) hasMore = false;   // last page
  }

  communitySkillsCache = allRows.map(mapDbSkill);
  return communitySkillsCache;
}

/* Fetch skills submitted by current user (all statuses) */
async function fetchMySkills() {
  if (!currentUser) return [];
  const { data, error } = await sb
    .from('community_skills')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('Fetch my skills error:', error); return []; }
  return (data || []).map(mapDbSkill);
}

/* ── SKILLS TABLE (bulk-loaded skills) ───────────── */
/**
 * Fetch ALL approved skills from the "skills" table.
 * This table holds bulk-imported skills (10 000+) with a simpler
 * schema (TEXT id, TEXT tags, direct d/i/f columns).
 */
async function fetchSkillsTable() {
  const PAGE = 1000;
  let allRows = [];
  let from    = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sb
      .from('skills')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Skills table fetch error:', error); break; }
    if (!data || data.length === 0) { hasMore = false; break; }

    allRows = allRows.concat(data);
    from += PAGE;
    if (data.length < PAGE) hasMore = false;
  }

  skillsTableCache = allRows.map(mapSkillsRow);
  return skillsTableCache;
}

/**
 * Map a row from the "skills" table → app skill object.
 * Schema differences vs community_skills:
 *   - id is TEXT (not UUID)
 *   - tags is TEXT (comma-separated, not TEXT[])
 *   - d/i/f directly (not score_d/score_i/score_f)
 *   - "trigger" column (not trigger_text)
 *   - "description" column (not desc)
 *   - "submitted_by" (not user_email)
 */
function mapSkillsRow(row) {
  // Parse tags: could be comma-separated string or already an array
  let tags = row.tags || [];
  if (typeof tags === 'string') {
    tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  return {
    id:           row.id,
    _dbId:        row.id,
    _table:       'skills',             // track which table this came from
    name:         row.name,
    icon:         row.icon || '◈',
    cat:          row.cat || 'ai',
    d:            row.d || 7,
    i:            row.i || 7,
    f:            row.f || 7,
    difficulty:   row.difficulty || 'intermediate',
    timeToMaster: row.time_to_master || '',
    tags:         tags,
    desc:         row.description || '',
    trigger:      row.trigger || '',
    skills:       [],
    tools:        [],
    md:           row.md_content || '',
    source:       row.source || 'official',
    submittedBy:  row.submitted_by || 'SkillGalaxy',
    upvotes:      row.upvotes || 0,
    downloads:    row.downloads || 0,
    version:      row.version || '1.0.0',
    changelog:    row.changelog || '',
    status:       row.status,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at || row.created_at,
  };
}

/* Map community_skills DB row → app skill object.
 * Handles both schema variants:
 *   supabase-setup.sql uses: slug, desc, score_d/i/f
 *   SUPABASE_SETUP.sql uses: skill_id, description, demand_score/income_score/future_score
 */
function mapDbSkill(row) {
  return {
    id:           (row.slug || row.skill_id || row.id) + '-community-' + String(row.id).slice(0,8),
    _dbId:        row.id,
    name:         row.name,
    icon:         row.icon || '◈',
    cat:          row.cat,
    d:            row.score_d   || row.demand_score || 7,
    i:            row.score_i   || row.income_score || 7,
    f:            row.score_f   || row.future_score || 7,
    difficulty:   row.difficulty,
    timeToMaster: row.time_to_master || '',
    tags:         row.tags || [],
    desc:         row.description || row.desc || '',
    trigger:      row.trigger_text || '',
    skills:       row.skills_list || [],
    tools:        row.tools_list || [],
    md:           row.md_content,
    source:       'community',
    submittedBy:  row.user_email?.split('@')[0] || 'Community',
    upvotes:      row.upvotes || 0,
    downloads:    row.downloads || 0,
    version:      row.version || '1.0.0',
    changelog:    row.changelog || '',
    status:       row.status,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at || row.created_at,
  };
}

/* ── REALTIME SUBSCRIPTION ───────────────────────── */
function subscribeToSkillUpdates() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);

  realtimeChannel = sb
    .channel('community_skills_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'community_skills', filter: 'status=eq.approved' },
      async (payload) => {
        await refreshCommunitySkills();
        const evt = payload.eventType;
        if (evt === 'INSERT') showToast('✨ New skill added to the library!');
        if (evt === 'UPDATE') showToast('🔄 A skill was updated');
      }
    )
    .subscribe();
}

async function refreshCommunitySkills() {
  await fetchCommunitySkills();
  if (typeof renderGrid === 'function') renderGrid();
  if (typeof buildSidebar === 'function') buildSidebar();
  updateTotalCount();
}

function updateTotalCount() {
  const total = getAllSkills().length;
  const els = ['countDisplay','navAll','sectionCount','heroCount'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = total; });
}

/* ── VALIDATION ──────────────────────────────────── */
function validateSkillForm(data) {
  const errors = [];

  if (!data.name || data.name.length < VALIDATION.nameMinLen)
    errors.push(`Name must be at least ${VALIDATION.nameMinLen} characters`);
  if (data.name && data.name.length > VALIDATION.nameMaxLen)
    errors.push(`Name must be under ${VALIDATION.nameMaxLen} characters`);
  if (!data.cat || !VALIDATION.allowedCats.includes(data.cat))
    errors.push('Please select a valid category');
  if (!data.description || data.description.length < VALIDATION.descMinLen)
    errors.push(`Description must be at least ${VALIDATION.descMinLen} characters`);
  if (data.description && data.description.length > VALIDATION.descMaxLen)
    errors.push(`Description must be under ${VALIDATION.descMaxLen} characters`);
  if (!data.md_content || data.md_content.length < VALIDATION.mdMinLen)
    errors.push(`Skill content must be at least ${VALIDATION.mdMinLen} characters`);

  // Security: reject any script injection
  const fullText = JSON.stringify(data);
  for (const pattern of VALIDATION.forbiddenPatterns) {
    if (pattern.test(fullText)) {
      errors.push('Skill content contains disallowed patterns (no scripts or event handlers)');
      break;
    }
  }

  // Validate YAML frontmatter presence
  if (data.md_content && !data.md_content.trim().startsWith('---')) {
    errors.push('Skill file must start with YAML frontmatter (---). See the format guide.');
  }

  // Must have a name in frontmatter
  if (data.md_content && !data.md_content.includes('name:')) {
    errors.push('Skill frontmatter must include a "name:" field');
  }

  // Must have a description in frontmatter
  if (data.md_content && !data.md_content.includes('description:')) {
    errors.push('Skill frontmatter must include a "description:" field');
  }

  return errors;
}

/* Parse YAML frontmatter from uploaded .md file */
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let val = line.slice(sep + 1).trim();
    // Remove quotes
    val = val.replace(/^['"]|['"]$/g, '');
    fm[key] = val;
  }
  return fm;
}

/* Parse tags from frontmatter string */
function parseTags(tagStr) {
  if (!tagStr) return [];
  return tagStr.split(',').map(t => t.trim().replace(/[[\]'"]/g, '')).filter(Boolean).slice(0, 10);
}

/* ── SUBMIT ──────────────────────────────────────── */
async function submitSkill(formData) {
  if (!currentUser) throw new Error('You must be logged in to submit a skill');

  const errors = validateSkillForm(formData);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  // Generate skill_id from name
  const skillId = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);

  const row = {
    user_id:        currentUser.id,
    user_email:     currentUser.email,
    slug:           skillId,               // DB uses "slug" not "skill_id"
    name:           formData.name.trim(),
    icon:           formData.icon || '◈',
    cat:            formData.cat,
    difficulty:     formData.difficulty || 'intermediate',
    time_to_master: formData.timeToMaster || '',
    score_d:        Math.max(1, Math.min(10, parseInt(formData.demand) || 7)),
    score_i:        Math.max(1, Math.min(10, parseInt(formData.income) || 7)),
    score_f:        Math.max(1, Math.min(10, parseInt(formData.future) || 7)),
    tags:           formData.tags || [],
    description:    formData.description.trim(),
    trigger_text:   formData.trigger || '',
    skills_list:    formData.skillsList || [],
    tools_list:     formData.toolsList || [],
    md_content:     formData.md_content.trim(),
    version:        formData.version || '1.0.0',
    changelog:      formData.changelog || '',
    status:         'pending',
  };

  const { data, error } = await sb
    .from('community_skills')
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('You\'ve already submitted a skill with this name. Try a slightly different name.');
    throw new Error('Submission failed: ' + error.message);
  }

  return data;
}

/* ── UPVOTE ──────────────────────────────────────── */
async function upvoteSkill(dbId) {
  if (!currentUser) { requireLogin(() => upvoteSkill(dbId)); return; }
  const { data, error } = await sb.rpc('toggle_upvote', { p_skill_id: dbId });
  if (error) throw error;
  // Update cache
  const skill = communitySkillsCache.find(s => s._dbId === dbId);
  if (skill) skill.upvotes = data;
  return data;
}

/* ── DOWNLOAD LOG ────────────────────────────────── */
async function logDownload(dbId) {
  if (!dbId) return;

  // Check if this skill came from the "skills" table (TEXT id)
  const fromSkillsTable = skillsTableCache.some(s => s._dbId === dbId);
  if (fromSkillsTable) {
    await sb.rpc('increment_skill_downloads', { p_skill_id: dbId });
    return;
  }

  // Otherwise it's a community_skills row (UUID id)
  await sb.rpc('increment_downloads', { p_skill_id: dbId });
  await sb.from('skill_downloads').insert({
    skill_id: dbId,
    user_id:  currentUser?.id || null
  });
}

/* ── RATINGS & REVIEWS ───────────────────────────── */

/**
 * Fetch avg rating + review count for a skill.
 * Returns { avg_rating, review_count } or null on error.
 */
async function fetchSkillRating(skillId) {
  const { data, error } = await sb.rpc('get_skill_rating', { p_skill_id: String(skillId) });
  if (error) { console.warn('fetchSkillRating error:', error); return null; }
  return data;
}

/**
 * Fetch paginated reviews for a skill.
 * Returns array of { id, user_email, rating, review_text, created_at }.
 */
async function fetchReviews(skillId, limit = 5, offset = 0) {
  const { data, error } = await sb.rpc('get_skill_reviews', {
    p_skill_id: String(skillId),
    p_limit:    limit,
    p_offset:   offset,
  });
  if (error) { console.warn('fetchReviews error:', error); return []; }
  return data || [];
}

/**
 * Submit or update a review for a skill.
 * Returns { avg_rating, review_count } or throws on error.
 */
async function submitReview(skillId, skillTable, rating, reviewText) {
  if (!currentUser) throw new Error('Sign in to leave a review');
  const { data, error } = await sb.rpc('upsert_skill_review', {
    p_skill_id:    String(skillId),
    p_skill_table: skillTable,
    p_rating:      rating,
    p_review_text: reviewText || '',
  });
  if (error) throw new Error(error.message);
  return data;
}

/* ── AI SKILL VALIDATOR ──────────────────────────── */

/**
 * Call the Vercel serverless AI validator.
 * Returns { score, feedback, approved, configured } or null on network error.
 * Works gracefully when ANTHROPIC_API_KEY is not configured.
 */
async function validateSkillWithAI(name, description, md_content) {
  try {
    const res = await fetch('/api/validate-skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, md_content }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('AI validation unavailable:', err.message);
    return null;
  }
}

/* ── GET ALL SKILLS (skills table + community + hardcoded) ── */
function getAllSkills() {
  // Merge all sources; skills table first (bulk-loaded), then community, then local DB.
  // Deduplicate by skill id — later sources yield to earlier ones.
  const seen = new Set();
  const merged = [];

  for (const list of [skillsTableCache, communitySkillsCache, SKILLS_DB]) {
    for (const s of list) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push(s);
      }
    }
  }

  return merged;
}