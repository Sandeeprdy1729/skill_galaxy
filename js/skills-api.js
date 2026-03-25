/**
 * SkillGalaxy — skills-api.js
 * All Supabase operations for community skills:
 * fetch, submit, validate, upvote, download, realtime sync.
 */

/* ── IN-MEMORY CACHE ─────────────────────────────── */
let communitySkillsCache = [];
let realtimeChannel = null;

/* ── FETCH ───────────────────────────────────────── */
/**
 * Fetch ALL approved community skills from Supabase.
 * PostgREST caps a single request at ~1 000 rows, so we paginate
 * in chunks until every approved skill has been retrieved.
 */
async function fetchCommunitySkills() {
  const PAGE = 1000;          // Supabase default max per request
  let allRows = [];
  let from    = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await sb
      .from('community_skills')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    if (data.length < PAGE) break;   // last page
    from += PAGE;
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

/* Map DB row → app skill object.
 * Handles both schema variants:
 *   supabase-setup.sql uses: slug, desc, score_d/i/f
 *   SUPABASE_SETUP.sql uses: skill_id, description, demand_score/income_score/future_score
 */
function mapDbSkill(row) {
  return {
    id:           (row.slug || row.skill_id || row.id) + '-community-' + row.id.slice(0,8),
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
    status:       row.status,
    createdAt:    row.created_at,
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
  await sb.rpc('increment_downloads', { p_skill_id: dbId });
  await sb.from('skill_downloads').insert({
    skill_id: dbId,
    user_id:  currentUser?.id || null
  });
}

/* ── GET ALL SKILLS (DB + Community) ─────────────── */
function getAllSkills() {
  return [...communitySkillsCache, ...SKILLS_DB];
}