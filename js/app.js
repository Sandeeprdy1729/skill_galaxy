/**
 * SkillVault — app.js
 * Frontend application logic.
 * Depends on: db.js (SKILLS_DB, CATEGORIES, getAllSkills, saveCommunitySkill)
 */

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let state = {
  filter: 'all',      // category key or 'all'
  diff: 'all',        // difficulty or 'all'
  query: '',          // search string
  submitTab: 'form',  // 'form' | 'upload'
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function scoreClass(v) { return v >= 9 ? 'hi' : ''; }
function scoreColorClass(v) { return v >= 9 ? 'green' : 'amber'; }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function getFiltered() {
  const skills = getAllSkills();
  const q = state.query.toLowerCase();
  return skills.filter(s => {
    const catOk  = state.filter === 'all' || s.cat === state.filter;
    const diffOk = state.diff   === 'all' || s.difficulty === state.diff;
    if (!q) return catOk && diffOk;
    const haystack = [s.name, s.desc, ...(s.tags||[]), ...(s.skills||[]), ...(s.tools||[]),
      CATEGORIES[s.cat]?.label || ''].join(' ').toLowerCase();
    return catOk && diffOk && haystack.includes(q);
  });
}

/* ─────────────────────────────────────────────
   RENDER GRID
───────────────────────────────────────────── */
function renderGrid() {
  const list = getFiltered();
  const grid = document.getElementById('skillsGrid');
  const countEl = document.getElementById('sectionCount');
  const tbCount = document.getElementById('countDisplay');
  const navAll  = document.getElementById('navAll');

  const total = getAllSkills().length;
  if (countEl) countEl.textContent = list.length;
  if (tbCount)  tbCount.textContent = total;
  if (navAll)   navAll.textContent  = total;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No skills found</h3>
        <p>Try a different search or category — or <button onclick="openSubmit()" style="background:none;border:none;color:var(--copper);cursor:pointer;font-size:inherit;text-decoration:underline">submit a new skill</button></p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(s => {
    const c = CATEGORIES[s.cat] || CATEGORIES.ai;
    return `
    <div class="skill-card" onclick="openDetail('${esc(s.id)}')">
      <div class="card-head">
        <div class="card-icon" style="background:${c.tag}">${s.icon}</div>
        <div class="card-head-r">
          <div class="card-name">${esc(s.name)}</div>
          <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(c.label)}</span>
          <span class="diff-badge ${esc(s.difficulty || '')}">${esc(s.difficulty || 'intermediate')}</span>
        </div>
      </div>
      <div class="card-desc">${esc(s.desc)}</div>
      <div class="card-foot">
        <div class="score-row">
          <span class="s-pill ${scoreClass(s.d)}">Demand ${s.d}/10</span>
          <span class="s-pill ${scoreClass(s.f)}">Future ${s.f}/10</span>
          ${s.source === 'community' ? '<span class="source-badge community">community</span>' : ''}
        </div>
        <button class="btn-dl" onclick="event.stopPropagation();dlSkill('${esc(s.id)}')">↓ .md</button>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   SIDEBAR NAVIGATION
───────────────────────────────────────────── */
function buildSidebar() {
  const nav = document.getElementById('catNav');
  if (!nav) return;

  // count per category
  const all = getAllSkills();
  const counts = {};
  all.forEach(s => { counts[s.cat] = (counts[s.cat] || 0) + 1; });

  nav.innerHTML = Object.entries(CATEGORIES).map(([key, c]) => {
    const n = counts[key] || 0;
    if (!n) return '';
    return `
    <div class="nav-item${state.filter === key ? ' active' : ''}" 
         onclick="setFilter('${key}',this)" data-cat="${key}">
      <span class="nav-dot" style="background:${c.dot}"></span>
      ${esc(c.label)}
      <span class="nav-count">${n}</span>
    </div>`;
  }).join('');
}

function setFilter(cat, el) {
  state.filter = cat;
  // update active state
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => n.classList.remove('active'));
  const allItem = document.getElementById('navAll-item');
  if (allItem) allItem.classList.remove('active');
  if (el) el.classList.add('active');
  if (cat === 'all' && allItem) allItem.classList.add('active');
  renderGrid();
}

function setFilterAll() {
  state.filter = 'all';
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => n.classList.remove('active'));
  const allItem = document.getElementById('navAll-item');
  if (allItem) allItem.classList.add('active');
  renderGrid();
}

/* ─────────────────────────────────────────────
   DIFFICULTY FILTER PILLS
───────────────────────────────────────────── */
function setDiff(d, el) {
  state.diff = d;
  document.querySelectorAll('.f-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  renderGrid();
}

/* ─────────────────────────────────────────────
   DETAIL MODAL
───────────────────────────────────────────── */
function openDetail(id) {
  const s = getAllSkills().find(x => x.id === id);
  if (!s) return;
  const c = CATEGORIES[s.cat] || CATEGORIES.ai;

  document.getElementById('mIcon').style.background = c.tag;
  document.getElementById('mIcon').textContent = s.icon;
  document.getElementById('mTitle').textContent = s.name;
  document.getElementById('mMeta').innerHTML = `
    <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(c.label)}</span>
    <span class="diff-badge ${esc(s.difficulty || '')}">${esc(s.difficulty || '')}</span>
    ${s.timeToMaster ? `<span style="color:var(--text-ter);font-size:.7rem">· ${esc(s.timeToMaster)}</span>` : ''}`;

  document.getElementById('mBody').innerHTML = `
    <p class="modal-desc">${esc(s.desc)}</p>
    <p style="font-size:.74rem;color:var(--text-ter);font-style:italic;margin-bottom:12px">
      Trigger: ${esc(s.trigger || '')}
    </p>

    <div class="m-lbl">Market Scores</div>
    <div class="scores-row">
      ${[['Demand',s.d],['Income',s.i],['Future',s.f]].map(([l,v])=>`
      <div class="score-block">
        <div class="lbl">${l}</div>
        <div class="val ${scoreColorClass(v)}">${v}/10</div>
      </div>`).join('')}
    </div>

    <div class="m-lbl">Atomic Skills</div>
    <div class="chips">${(s.skills||[]).map(sk=>`<span class="chip">${esc(sk)}</span>`).join('')}</div>

    <div class="m-lbl">Essential Tools</div>
    <div class="chips">${(s.tools||[]).map(t=>`<span class="tool-chip">${esc(t)}</span>`).join('')}</div>

    <div class="m-lbl">Skill File Preview</div>
    <div class="code-block">${esc(s.md||'')}</div>

    <div class="m-lbl">How to use in Claude</div>
    <div class="how-to">
      <div class="ht-step"><div class="step-n">1</div><div>Click <strong>Download .md</strong> below</div></div>
      <div class="ht-step"><div class="step-n">2</div><div>Open Claude → <strong>Projects</strong> → select or create a project</div></div>
      <div class="ht-step"><div class="step-n">3</div><div>Go to <strong>Project Instructions</strong> → paste or upload the file content</div></div>
      <div class="ht-step"><div class="step-n">4</div><div>Claude uses this skill automatically in all project conversations</div></div>
    </div>

    <div class="modal-actions">
      <button class="btn-main" onclick="dlSkill('${esc(s.id)}')">↓ Download .md file</button>
      <button class="btn-ghost" onclick="closeDetail()">Close</button>
    </div>`;

  const ov = document.getElementById('overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────
   DOWNLOAD
───────────────────────────────────────────── */
function dlSkill(id) {
  const s = getAllSkills().find(x => x.id === id);
  if (!s) return;
  const blob = new Blob([s.md || `---\nname: ${s.id}\n---\n\n${s.desc}`], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${s.id}.md`;
  a.click();
  toast(`Downloaded ${s.name}.md`);
}

/* ─────────────────────────────────────────────
   SUBMIT SKILL MODAL
───────────────────────────────────────────── */
function openSubmit() {
  document.getElementById('submitOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  switchTab('form');
}

function closeSubmit() {
  document.getElementById('submitOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('submitForm').reset();
  const preview = document.getElementById('uploadPreview');
  if (preview) preview.textContent = '';
}

function switchTab(tab) {
  state.submitTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
}

/* ── Form submission ── */
function handleFormSubmit() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const name      = get('f-name');
  const cat       = get('f-cat');
  const diff      = get('f-diff');
  const time      = get('f-time');
  const desc      = get('f-desc');
  const trigger   = get('f-trigger');
  const skillsRaw = get('f-skills');
  const toolsRaw  = get('f-tools');
  const tagsRaw   = get('f-tags');
  const d         = parseInt(get('f-demand')) || 7;
  const i         = parseInt(get('f-income')) || 7;
  const f         = parseInt(get('f-future')) || 7;

  if (!name || !cat || !desc) {
    toast('Please fill in Name, Category, and Description', true);
    return;
  }

  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  const skillsList = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const toolsList  = toolsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const tagsList   = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const md = `---\nname: ${id}\ndescription: ${desc}\ntags: ${tagsList.join(', ')}\ndifficulty: ${diff}\ntime_to_master: ${time}\n---\n\n## DESCRIPTION\n${desc}\n\n## WHEN TO USE\n${trigger}\n\n## ATOMIC SKILLS\n${skillsList.map(s => `- ${s}`).join('\n')}\n\n## ESSENTIAL TOOLS\n${toolsList.map(t => `- ${t}`).join('\n')}`;

  const skill = {
    id, name, icon: '◈', cat, difficulty: diff, timeToMaster: time,
    d, i, f, desc, trigger, tags: tagsList,
    skills: skillsList, tools: toolsList,
    source: 'community', md
  };

  saveCommunitySkill(skill);
  buildSidebar();
  renderGrid();
  closeSubmit();
  toast(`"${name}" submitted to SkillVault!`);
}

/* ── File upload (inside submit modal) ── */
function handleFileUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const nm   = (text.match(/^name:\s*(.+)/m)  || ['',''])[1].trim() || file.name.replace('.md','');
    const desc = (text.match(/^description:\s*(.+)/m) || ['','Custom uploaded skill.'])[1].trim();
    const tags = (text.match(/^tags:\s*(.+)/m)  || ['',''])[1].trim().split(',').map(s=>s.trim()).filter(Boolean);
    const diff = (text.match(/^difficulty:\s*(.+)/m) || ['','intermediate'])[1].trim();
    const time = (text.match(/^time_to_master:\s*(.+)/m) || ['',''])[1].trim();
    const id   = nm.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now();

    // show preview
    const preview = document.getElementById('uploadPreview');
    if (preview) preview.textContent = text.slice(0, 400) + (text.length > 400 ? '\n…' : '');

    const skill = {
      id, name: nm, icon: '◈', cat: 'ai', difficulty: diff, timeToMaster: time,
      d: 8, i: 8, f: 8, desc, trigger: desc, tags,
      skills: [], tools: [], source: 'community', md: text
    };

    saveCommunitySkill(skill);
    buildSidebar();
    renderGrid();
    closeSubmit();
    toast(`"${nm}" uploaded to SkillVault!`);
  };
  reader.readAsText(file);
}

/* ─────────────────────────────────────────────
   DRAG & DROP (bottom upload zone)
───────────────────────────────────────────── */
function initDropZone() {
  const uz = document.getElementById('uploadZone');
  if (!uz) return;

  uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('over'); });
  uz.addEventListener('dragleave', () => uz.classList.remove('over'));
  uz.addEventListener('drop', e => {
    e.preventDefault();
    uz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f);
  });
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  const m  = document.getElementById('toastMsg');
  m.textContent = msg;
  el.style.background = isError ? '#8a3a4e' : 'var(--text-pri)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────────────
   KEYBOARD / CLICK OUTSIDE
───────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDetail(); closeSubmit(); }
});

document.getElementById('overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('overlay')) closeDetail();
});

document.getElementById('submitOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('submitOverlay')) closeSubmit();
});

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  renderGrid();
  initDropZone();

  // search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    state.query = e.target.value;
    renderGrid();
  });

  // cat counts in sidebar nav (refresh after community loads)
  buildSidebar();
});
