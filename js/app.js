/* 
 * SkillGalaxy — app.js
 * UI logic: render grid, modals, submit form, file upload, download.
 * Depends on: config.js → auth.js → skills-api.js → db.js
 * UPDATED: Simple Icons support for app skill icons
 */

/* ── ICON SYSTEM ─────────────────────────────────── */
const SI_CDN = 'https://cdn.simpleicons.org/';

/*
 * Render a skill icon.
 * - If skill has iconType:'simpleicons', fetches brand SVG from CDN
 * - Falls back to emoji/character icon for legacy skills
 */
function renderIcon(skill, size = 26) {
  if (skill.iconType === 'simpleicons' && skill.icon) {
    const slug  = skill.icon.toLowerCase();
    const color = (skill.brandColor || '#888888').replace('#', '');
    const url   = `${SI_CDN}${slug}/${color}`;
    // Invert near-black icons so they show on dark bg
    const needsInvert = ['000000','181717','1a1a1a','2d2d2d','111111'].includes(color.toLowerCase());
    const style = needsInvert ? 'filter:invert(1) brightness(0.85);' : '';
    return `<img
      src="${url}"
      alt="${esc(skill.name)} icon"
      class="si-icon"
      width="${size}" height="${size}"
      style="${style}"
      loading="lazy"
      onerror="this.outerHTML='<span class=\\'icon-fallback\\'>◈</span>'"
    />`;
  }
  // Legacy: emoji or character
  return `<span class="icon-fallback">${esc(skill.icon || '◈')}</span>`;
}

/**
 * Get brand accent color for a skill (for hover borders etc.)
 */
function getBrandColor(skill) {
  if (skill.iconType === 'simpleicons' && skill.brandColor) return skill.brandColor;
  return null;
}

/* ── STATE ───────────────────────────────────────── */
const appState = {
  filter: 'all',
  diff:   'all',
  query:  '',
  submitTab: 'form',
  view:   'all', // 'all' | 'mine'
  page:   1,     // current page (1-based)
  perPage: 48,   // skills per page
};

// /* ── INIT ────────────────────────────────────────── */
// document.addEventListener('DOMContentLoaded', async () => {
//   await initAuth();
//   checkResetFlow();

//   showGridSkeleton();
//   await fetchCommunitySkills();
//   subscribeToSkillUpdates();

//   buildSidebar();
//   renderGrid();
//   updateTotalCount();

//   // Search
//   document.getElementById('searchInput')?.addEventListener('input', e => {
//     appState.query = e.target.value;
//     renderGrid();
//   });

//   // Close modals on overlay click
//   document.getElementById('overlay')?.addEventListener('click', e => {
//     if (e.target === document.getElementById('overlay')) closeDetail();
//   });
//   document.getElementById('authOverlay')?.addEventListener('click', e => {
//     if (e.target === document.getElementById('authOverlay')) closeAuthModal();
//   });
//   document.getElementById('submitOverlay')?.addEventListener('click', e => {
//     if (e.target === document.getElementById('submitOverlay')) closeSubmit();
//   });

//   // Keyboard
//   document.addEventListener('keydown', e => {
//     if (e.key === 'Escape') { closeDetail(); closeAuthModal(); closeSubmit(); }
//     if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
//       e.preventDefault(); document.getElementById('searchInput')?.focus();
//     }
//   });

//   // File drop zones
//   initDropZone('uploadZone', 'quickFileInput');
//   initDropZone('fileZone',   'modalFileInput');
// });

/* ── INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  checkResetFlow();

  // Render immediately with local SKILLS_DB — don't wait for Supabase
  buildSidebar();
  renderGrid();
  updateTotalCount();

  // Then fetch community skills + bulk skills table in background and re-render
  showGridSkeleton();
  try {
    await Promise.all([
      fetchCommunitySkills(),
      fetchSkillsTable(),
    ]);
    subscribeToSkillUpdates();
  } catch (err) {
    console.warn('Remote skills fetch failed, showing official skills only:', err);
  }

  // Re-render after community skills load (or fail gracefully)
  buildSidebar();
  renderGrid();
  updateTotalCount();

  // Search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    appState.query = e.target.value;
    appState.page  = 1;
    renderGrid();
  });

  // Close modals on overlay click
  document.getElementById('overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('overlay')) closeDetail();
  });
  document.getElementById('authOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('authOverlay')) closeAuthModal();
  });
  document.getElementById('submitOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('submitOverlay')) closeSubmit();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetail(); closeAuthModal(); closeSubmit(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault(); document.getElementById('searchInput')?.focus();
    }
  });

  // File drop zones
  initDropZone('uploadZone', 'quickFileInput');
  initDropZone('fileZone',   'modalFileInput');
});

/* ── SKELETON ────────────────────────────────────── */
function showGridSkeleton() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({length: 6}, () => `
    <div class="skill-card skeleton">
      <div class="sk-icon"></div>
      <div class="sk-lines">
        <div class="sk-line w70"></div>
        <div class="sk-line w40"></div>
      </div>
      <div class="sk-body">
        <div class="sk-line w100"></div>
        <div class="sk-line w90"></div>
        <div class="sk-line w60"></div>
      </div>
    </div>`).join('');
}

/* ── FILTER / SEARCH ─────────────────────────────── */
function getFiltered() {
  const all = getAllSkills();
  const q   = appState.query.toLowerCase().trim();

  return all.filter(s => {
    const catOk  = appState.filter === 'all' || s.cat === appState.filter;
    const diffOk = appState.diff   === 'all' || s.difficulty === appState.diff;
    const viewOk = appState.view   === 'all' ||
      (appState.view === 'mine' && s.source === 'community' && s.submittedBy === getUserName(currentUser));
    if (!catOk || !diffOk || !viewOk) return false;
    if (!q) return true;
    const hay = [
      s.name, s.desc, ...(s.tags || []), ...(s.skills || []), ...(s.tools || []),
      CATEGORIES[s.cat]?.label || ''
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/* ── RENDER GRID ─────────────────────────────────── */
function renderGrid() {
  const allFiltered = getFiltered();
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;

  /* ── Pagination math ───────────────────── */
  const total      = allFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / appState.perPage));

  // Clamp page to valid range whenever filters change
  if (appState.page > totalPages) appState.page = totalPages;
  if (appState.page < 1) appState.page = 1;

  const start = (appState.page - 1) * appState.perPage;
  const list  = allFiltered.slice(start, start + appState.perPage);

  document.getElementById('sectionCount').textContent = total;

  if (!total) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size:2rem;margin-bottom:12px">◌</div>
        <h3>No skills found</h3>
        <p>Try a different search or
          <button onclick="requireLogin(openSubmit)"
            style="background:none;border:none;color:var(--copper);cursor:pointer;font-size:inherit;text-decoration:underline">
            submit a new skill
          </button>
        </p>
      </div>`;
    removePagination();
    return;
  }

  grid.innerHTML = list.map(s => {
    const c           = CATEGORIES[s.cat] || CATEGORIES.ai;
    const isCommunity = s.source === 'community';
    const brand       = getBrandColor(s);
    const iconHtml    = renderIcon(s, 26);

    // Icon wrapper: brand-colored bg tint for SI icons, category color for legacy
    const iconBg = (s.iconType === 'simpleicons' && brand)
      ? `${brand}18`          // 18 = ~10% opacity hex
      : c.tag;

    const iconBorder = (s.iconType === 'simpleicons' && brand)
      ? `${brand}44`          // 44 = ~27% opacity
      : 'transparent';

    return `
    <div class="skill-card${isCommunity ? ' community-card' : ''}"
         onclick="openDetail('${esc(s.id)}')"
         ${brand ? `style="--brand:${brand}"` : ''}>
      <div class="card-head">
        <div class="card-icon"
             style="background:${iconBg};border:1px solid ${iconBorder};display:flex;align-items:center;justify-content:center;">
          ${iconHtml}
        </div>
        <div class="card-head-r">
          <div class="card-name">${esc(s.name)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:3px">
            <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(c.label)}</span>
            <span class="diff-badge ${esc(s.difficulty || '')}">${esc(s.difficulty || 'intermediate')}</span>
            ${isCommunity ? `<span class="source-badge community">community</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-desc">${esc(s.desc)}</div>
      <div class="card-foot">
        <div class="score-row">
          <span class="s-pill ${s.d >= 9 ? 'hi' : ''}">Demand ${s.d}/10</span>
          <span class="s-pill ${s.f >= 9 ? 'hi' : ''}">Future ${s.f}/10</span>
          ${isCommunity && s.upvotes > 0
            ? `<span class="s-pill" style="color:var(--copper)">▲ ${s.upvotes}</span>`
            : ''}
        </div>
        <button class="btn-dl"
                onclick="event.stopPropagation();handleDownload('${esc(s.id)}')">
          ↓ .md
        </button>
      </div>
    </div>`;
  }).join('');

  /* ── Pagination controls ───────────────── */
  renderPagination(totalPages);
}

/* ── PAGINATION UI ───────────────────────────────── */
function renderPagination(totalPages) {
  let wrap = document.getElementById('paginationWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'paginationWrap';
    wrap.className = 'pagination-wrap';
    const grid = document.getElementById('skillsGrid');
    if (grid && grid.parentNode) grid.parentNode.insertBefore(wrap, grid.nextSibling);
  }

  if (totalPages <= 1) { wrap.innerHTML = ''; return; }

  const cur = appState.page;

  // Build page buttons: show first, last, current ± 2, and ellipses
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= cur - 2 && p <= cur + 2)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  wrap.innerHTML = `
    <button class="pg-btn" ${cur <= 1 ? 'disabled' : ''} onclick="goPage(${cur - 1})">‹ Prev</button>
    ${pages.map(p =>
      p === '…'
        ? `<span class="pg-ellipsis">…</span>`
        : `<button class="pg-btn${p === cur ? ' pg-active' : ''}" onclick="goPage(${p})">${p}</button>`
    ).join('')}
    <button class="pg-btn" ${cur >= totalPages ? 'disabled' : ''} onclick="goPage(${cur + 1})">Next ›</button>
    <span class="pg-info">Page ${cur} of ${totalPages}</span>
  `;
}

function removePagination() {
  const wrap = document.getElementById('paginationWrap');
  if (wrap) wrap.innerHTML = '';
}

function goPage(n) {
  appState.page = n;
  renderGrid();
  // Scroll to top of grid
  document.getElementById('skillsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── SIDEBAR ─────────────────────────────────────── */
function buildSidebar() {
  const nav = document.getElementById('catNav');
  if (!nav) return;
  const all    = getAllSkills();
  const counts = {};
  all.forEach(s => { counts[s.cat] = (counts[s.cat] || 0) + 1; });

  nav.innerHTML = Object.entries(CATEGORIES)
    .filter(([key]) => counts[key])
    .map(([key, c]) => `
    <div class="nav-item${appState.filter === key ? ' active' : ''}"
         onclick="setFilter('${key}',this)" data-cat="${key}">
      <span class="nav-dot" style="background:${c.dot}"></span>
      ${esc(c.label)}
      <span class="nav-count">${counts[key]}</span>
    </div>`).join('');

  document.getElementById('navAll').textContent = all.length;
}

function setFilter(cat, el) {
  appState.filter = cat;
  appState.page   = 1;
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => n.classList.remove('active'));
  document.getElementById('navAll-item')?.classList.remove('active');
  if (el) el.classList.add('active');
  renderGrid();
}

function setFilterAll() {
  appState.filter = 'all';
  appState.page   = 1;
  document.querySelectorAll('.nav-item[data-cat]').forEach(n => n.classList.remove('active'));
  document.getElementById('navAll-item')?.classList.add('active');
  renderGrid();
}

function setDiff(d, el) {
  appState.diff = d;
  appState.page = 1;
  document.querySelectorAll('.f-pill').forEach(p => p.classList.remove('active'));
  el?.classList.add('active');
  renderGrid();
}

async function showMySkills() {
  await fetchMySkills();
  appState.view = 'mine';
  document.getElementById('mySkillsBtn')?.classList.add('active');
  renderGrid();
}

function showAllSkills() {
  appState.view = 'all';
  renderGrid();
  document.getElementById('mySkillsBtn')?.classList.remove('active');
}

/* ── STAR RATINGS ────────────────────────────────── */

/**
 * Render a read-only star display (e.g. ★★★★☆ 4.2 · 18 reviews)
 */
function renderStarDisplay(avg, count) {
  if (!avg || !count) return '';
  const full  = Math.floor(avg);
  const half  = avg - full >= 0.4 ? 1 : 0;
  const empty = 5 - full - half;
  const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  return `<span class="star-display" title="${avg} out of 5 (${count} review${count !== 1 ? 's' : ''})">
    <span class="stars">${stars}</span>
    <span class="star-avg">${avg}</span>
    <span class="star-count">· ${count} review${count !== 1 ? 's' : ''}</span>
  </span>`;
}

/**
 * Render interactive star picker (1–5).
 * starRatingValue tracks the current selection.
 */
let starRatingValue = 0;

function renderStarPicker(currentVal) {
  return `<div class="star-picker" id="starPicker">
    ${[1,2,3,4,5].map(n => `
      <span class="star-pick${n <= (currentVal || 0) ? ' sel' : ''}"
            data-val="${n}"
            onmouseover="highlightStars(${n})"
            onmouseout="highlightStars(starRatingValue)"
            onclick="selectStar(${n})">★</span>`
    ).join('')}
  </div>`;
}

function highlightStars(n) {
  document.querySelectorAll('.star-pick').forEach((s, i) => {
    s.classList.toggle('sel', i < n);
  });
}

function selectStar(n) {
  starRatingValue = n;
  highlightStars(n);
  const hidden = document.getElementById('ratingInput');
  if (hidden) hidden.value = n;
}

/* ── DETAIL MODAL ────────────────────────────────── */
function openDetail(id) {
  const s = getAllSkills().find(x => x.id === id);
  if (!s) return;
  const c     = CATEGORIES[s.cat] || CATEGORIES.ai;
  const brand = getBrandColor(s);

  // Icon in modal header — larger size
  const iconHtml   = renderIcon(s, 32);
  const iconBg     = (s.iconType === 'simpleicons' && brand) ? `${brand}18` : c.tag;
  const iconBorder = (s.iconType === 'simpleicons' && brand) ? `${brand}44` : 'transparent';

  const mIcon = document.getElementById('mIcon');
  if (mIcon) {
    mIcon.style.background = iconBg;
    mIcon.style.border     = `1px solid ${iconBorder}`;
    mIcon.style.display    = 'flex';
    mIcon.style.alignItems = 'center';
    mIcon.style.justifyContent = 'center';
    mIcon.innerHTML = iconHtml;
  }

  // Version + last-updated badge
  const updatedAgo = s.updatedAt ? timeAgo(s.updatedAt) : '';
  const versionMeta = s.version && s.version !== '1.0.0'
    ? `<span class="version-badge">v${esc(s.version)}</span>`
    : '';
  const updatedMeta = updatedAgo
    ? `<span style="color:var(--text-ter);font-size:.68rem">Updated ${updatedAgo}</span>`
    : '';

  document.getElementById('mTitle').textContent = s.name;
  document.getElementById('mMeta').innerHTML = `
    <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(c.label)}</span>
    <span class="diff-badge ${esc(s.difficulty || '')}">${esc(s.difficulty || '')}</span>
    ${s.timeToMaster
      ? `<span style="color:var(--text-ter);font-size:.7rem">· ${esc(s.timeToMaster)}</span>`
      : ''}
    ${s.source === 'community'
      ? `<span class="source-badge community">by ${esc(s.submittedBy || 'Community')}</span>`
      : ''}
    ${versionMeta}
    ${updatedMeta}`;

  // Determine skill identifier for ratings (use _dbId when available, else id)
  const ratingId    = s._dbId ? String(s._dbId) : s.id;
  const ratingTable = s._table === 'skills' ? 'skills' : 'community_skills';

  document.getElementById('mBody').innerHTML = `
    <p class="modal-desc">${esc(s.desc)}</p>
    ${s.trigger
      ? `<p style="font-size:.74rem;color:var(--text-ter);font-style:italic;margin-bottom:14px">📍 ${esc(s.trigger)}</p>`
      : ''}

    <div class="m-lbl">Market Scores</div>
    <div class="scores-row">
      ${[['Demand', s.d], ['Income', s.i], ['Future', s.f]].map(([l, v]) => `
      <div class="score-block">
        <div class="lbl">${l}</div>
        <div class="val ${v >= 9 ? 'green' : 'amber'}">${v}/10</div>
      </div>`).join('')}
    </div>

    ${s.skills?.length ? `
    <div class="m-lbl">Atomic Skills</div>
    <div class="chips">
      ${s.skills.map(sk => `<span class="chip">${esc(sk)}</span>`).join('')}
    </div>` : ''}

    ${s.tools?.length ? `
    <div class="m-lbl">Essential Tools</div>
    <div class="chips">
      ${s.tools.map(t => `<span class="tool-chip">${esc(t)}</span>`).join('')}
    </div>` : ''}

    ${s.changelog ? `
    <div class="m-lbl">Changelog</div>
    <div style="font-size:.74rem;color:var(--text-sec);line-height:1.6;background:var(--cream-dark);border:1px solid var(--border-lt);border-radius:var(--r-sm);padding:10px 13px;margin-top:7px">${esc(s.changelog)}</div>
    ` : ''}

    <div class="m-lbl">Skill File Preview</div>
    <div class="code-block">${esc((s.md || '').slice(0, 600))}${(s.md || '').length > 600 ? '\n…' : ''}</div>

    <div class="m-lbl">How to use in Claude</div>
    <div class="how-to">
      <div class="ht-step"><div class="step-n">1</div><div>Click <strong>Download .md</strong> below</div></div>
      <div class="ht-step"><div class="step-n">2</div><div>Open Claude → <strong>Projects</strong> → select or create a project</div></div>
      <div class="ht-step"><div class="step-n">3</div><div>Go to <strong>Project Instructions</strong> → paste or upload the file content</div></div>
      <div class="ht-step"><div class="step-n">4</div><div>Claude uses this skill automatically in all project conversations</div></div>
    </div>

    <!-- Analytics: downloads + upvotes -->
    ${s._dbId ? `
    <div class="m-lbl">Community Stats</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
      <button class="btn-upvote" id="upvoteBtn-${s._dbId}"
              onclick="handleUpvote('${s._dbId}')">
        ▲ Upvote <span id="uv-${s._dbId}">${s.upvotes || 0}</span>
      </button>
      <span style="color:var(--text-ter);font-size:.72rem">
        ↓ <strong style="color:var(--text-sec)">${s.downloads || 0}</strong> downloads
      </span>
      <span id="ratingDisplay-${esc(ratingId)}" style="font-size:.72rem;color:var(--text-ter)">
        Loading rating…
      </span>
    </div>` : `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px;margin-bottom:4px">
      <span style="color:var(--text-ter);font-size:.72rem">
        ↓ <strong style="color:var(--text-sec)">${s.downloads || 0}</strong> downloads
      </span>
      <span id="ratingDisplay-${esc(ratingId)}" style="font-size:.72rem;color:var(--text-ter)">
        Loading rating…
      </span>
    </div>`}

    <!-- Star rating widget -->
    <div class="m-lbl" style="margin-top:14px">Rate this Skill</div>
    <div class="rating-widget" id="ratingWidget-${esc(ratingId)}">
      ${renderStarPicker(0)}
      <div id="reviewInputWrap-${esc(ratingId)}" style="display:none;margin-top:8px">
        <textarea class="form-textarea" id="reviewText-${esc(ratingId)}"
                  rows="2" placeholder="Optional: share a quick review…"
                  style="font-size:.76rem;min-height:52px"></textarea>
        <input type="hidden" id="ratingInput" value="0">
        <div style="display:flex;gap:7px;margin-top:6px">
          <button class="btn-main" style="flex:none;padding:7px 14px;font-size:.74rem"
                  onclick="handleSubmitReview('${esc(ratingId)}','${ratingTable}')">Submit Review</button>
          <button class="btn-ghost" style="padding:7px 12px;font-size:.74rem"
                  onclick="cancelReview('${esc(ratingId)}')">Cancel</button>
        </div>
        <div class="review-msg" id="reviewMsg-${esc(ratingId)}" style="display:none;margin-top:6px;font-size:.72rem"></div>
      </div>
    </div>

    <!-- Existing reviews -->
    <div id="reviewsList-${esc(ratingId)}" style="margin-top:10px"></div>

    <div class="modal-actions">
      <button class="btn-main" onclick="handleDownload('${esc(s.id)}')">↓ Download .md file</button>
      <button class="btn-ghost" onclick="openClaudeDesktopModal()">🔌 Add to Claude Desktop</button>
      <button class="btn-ghost" onclick="closeDetail()">Close</button>
    </div>`;

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset star picker state
  starRatingValue = 0;

  // Wire star picker to show review form on selection
  document.querySelectorAll('.star-pick').forEach(el => {
    el.addEventListener('click', () => {
      const wrap = document.getElementById(`reviewInputWrap-${ratingId}`);
      if (wrap) wrap.style.display = 'block';
    });
  });

  // Load rating + reviews asynchronously
  loadSkillRatingAndReviews(ratingId);
}

/* Load rating summary + recent reviews into the modal */
async function loadSkillRatingAndReviews(ratingId) {
  const [ratingData, reviews] = await Promise.all([
    fetchSkillRating(ratingId),
    fetchReviews(ratingId, 3, 0),
  ]);

  const displayEl = document.getElementById(`ratingDisplay-${ratingId}`);
  if (displayEl) {
    if (ratingData && ratingData.review_count > 0) {
      displayEl.innerHTML = renderStarDisplay(ratingData.avg_rating, ratingData.review_count);
    } else {
      displayEl.textContent = 'No ratings yet — be first!';
    }
  }

  const listEl = document.getElementById(`reviewsList-${ratingId}`);
  if (listEl && reviews.length > 0) {
    listEl.innerHTML = `
      <div class="m-lbl">Recent Reviews</div>
      ${reviews.map(r => `
        <div class="review-card">
          <div class="review-header">
            <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <span class="review-author">${esc(r.user_email?.split('@')[0] || 'User')}</span>
            <span class="review-date">${timeAgo(r.created_at)}</span>
          </div>
          ${r.review_text ? `<div class="review-text">${esc(r.review_text)}</div>` : ''}
        </div>`).join('')}`;
  }
}

async function handleSubmitReview(ratingId, ratingTable) {
  const rating = starRatingValue;
  if (!rating) { toast('Select a star rating first', true); return; }
  const reviewText = document.getElementById(`reviewText-${ratingId}`)?.value || '';
  const msgEl = document.getElementById(`reviewMsg-${ratingId}`);
  try {
    const result = await submitReview(ratingId, ratingTable, rating, reviewText);
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--teal)';
      msgEl.textContent = `✓ Review saved! Average: ${result?.avg_rating ?? '–'}/5`;
    }
    // Refresh rating display
    await loadSkillRatingAndReviews(ratingId);
  } catch (err) {
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--red)';
      msgEl.textContent = err.message;
    }
    if (!isLoggedIn()) openAuthModal('login');
  }
}

function cancelReview(ratingId) {
  const wrap = document.getElementById(`reviewInputWrap-${ratingId}`);
  if (wrap) wrap.style.display = 'none';
  starRatingValue = 0;
  highlightStars(0);
}

/* ── TIME AGO HELPER ─────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 30) return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}

/* ── CLAUDE DESKTOP MODAL ────────────────────────── */
function openClaudeDesktopModal() {
  document.getElementById('claudeDesktopOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeClaudeDesktopModal() {
  document.getElementById('claudeDesktopOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function copyDesktopConfig() {
  const cfg = document.getElementById('desktopConfigBlock')?.textContent || '';
  navigator.clipboard.writeText(cfg).then(() => {
    toast('Config copied to clipboard!');
  }).catch(() => {
    toast('Copy failed — select and copy manually', true);
  });
}

function closeDetail() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── DOWNLOAD ────────────────────────────────────── */
async function handleDownload(id) {
  const s = getAllSkills().find(x => x.id === id);
  if (!s) return;
  const content = s.md || `---\nname: ${s.id}\ndescription: ${s.desc}\n---\n\n${s.desc}`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${s.id.replace(/-community-\w+$/, '')}.md`;
  a.click();
  toast(`Downloaded ${s.name}.md`);
  if (s._dbId) await logDownload(s._dbId);
}

/* ── UPVOTE ──────────────────────────────────────── */
async function handleUpvote(dbId) {
  try {
    const newCount = await upvoteSkill(dbId);
    const el = document.getElementById(`uv-${dbId}`);
    if (el) el.textContent = newCount;
    document.getElementById(`upvoteBtn-${dbId}`)?.classList.toggle('upvoted');
  } catch(e) { toast(e.message, true); }
}

/* ── SUBMIT MODAL ────────────────────────────────── */
function openSubmit() {
  if (!isLoggedIn()) { openAuthModal('login'); window.__afterLogin = openSubmit; return; }
  resetSubmitForm();
  document.getElementById('submitOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  switchTab('form');
}

function closeSubmit() {
  document.getElementById('submitOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function resetSubmitForm() {
  document.getElementById('submitForm')?.reset();
  document.getElementById('uploadPreview').innerHTML =
    '<span style="color:var(--text-ter);font-style:italic">File preview appears here…</span>';
  clearSubmitError();
  clearSubmitSuccess();
}

function switchTab(tab) {
  appState.submitTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
}

function setSubmitError(msg) {
  const el = document.getElementById('submitError');
  if (el) { el.innerHTML = msg.replace(/\n/g, '<br>'); el.style.display = 'block'; }
}
function clearSubmitError() {
  const el = document.getElementById('submitError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}
function clearSubmitSuccess() {
  const el = document.getElementById('submitSuccess');
  if (el) el.style.display = 'none';
}
function setSubmitLoading(loading) {
  const btn = document.getElementById('submitFormBtn');
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Submitting…' : 'Submit Skill'; }
}

/* Form submit handler */
async function handleFormSubmit() {
  clearSubmitError();
  clearSubmitSuccess();

  const get = id => document.getElementById(id)?.value?.trim() || '';

  const name      = get('f-name');
  const cat       = get('f-cat');
  const diff      = get('f-diff');
  const time      = get('f-time');
  const desc      = get('f-desc');
  const trigger   = get('f-trigger');
  const demand    = get('f-demand');
  const income    = get('f-income');
  const future    = get('f-future');
  const version   = get('f-version') || '1.0.0';
  const changelog = get('f-changelog');

  const skillsList = get('f-skills').split(',').map(s => s.trim()).filter(Boolean);
  const toolsList  = get('f-tools').split(',').map(s => s.trim()).filter(Boolean);
  const tagsList   = get('f-tags').split(',').map(s => s.trim()).filter(Boolean);

  const existingMd = document.getElementById('generatedMd')?.value;
  const md = existingMd || buildMarkdownFromForm({
    name, cat, diff, time, desc, trigger, tagsList, skillsList, toolsList
  });

  const formData = {
    name, cat, difficulty: diff, timeToMaster: time,
    description: desc, trigger, demand, income, future,
    tags: tagsList, skillsList, toolsList,
    md_content: md,
    icon: '◈',
    version, changelog,
  };

  setSubmitLoading(true);

  // AI validation step (non-blocking — runs in parallel with submit)
  const aiScoreEl = document.getElementById('aiScoreResult');
  if (aiScoreEl) aiScoreEl.style.display = 'none';
  let aiResult = null;

  try {
    // Run AI validation; falls back gracefully if endpoint not configured
    aiResult = await validateSkillWithAI(name, desc, md);
  } catch (_) { /* swallow — validation is optional */ }

  // Show AI score if configured
  if (aiResult?.configured && aiResult.score != null && aiScoreEl) {
    const scoreColor = aiResult.score >= 8 ? 'var(--teal)' : aiResult.score >= 6 ? '#8a6a1a' : 'var(--red)';
    aiScoreEl.innerHTML = `
      <div style="background:var(--cream-dark);border:1px solid var(--border-lt);border-radius:var(--r-sm);padding:10px 13px;font-size:.76rem;margin-bottom:10px">
        <strong style="color:${scoreColor}">AI Score: ${aiResult.score}/10</strong>
        ${aiResult.feedback ? `<span style="color:var(--text-sec);margin-left:8px">${esc(aiResult.feedback)}</span>` : ''}
        ${!aiResult.approved ? `<div style="color:var(--red);margin-top:4px;font-size:.72rem">⚠️ Score below threshold. Consider improving the skill before submitting.</div>` : ''}
      </div>`;
    aiScoreEl.style.display = 'block';
  }

  try {
    await submitSkill(formData);
    setSubmitLoading(false);

    const succ = document.getElementById('submitSuccess');
    if (succ) {
      succ.style.display = 'block';
      succ.innerHTML = `
        <div style="text-align:center;padding:16px">
          <div style="font-size:2rem;margin-bottom:8px">🎉</div>
          <div style="font-weight:600;color:var(--text-pri);margin-bottom:4px">Skill submitted!</div>
          <div style="font-size:.78rem;color:var(--text-sec)">
            Under review — usually live within 24hrs.
            ${aiResult?.score ? `<br>AI quality score: <strong>${aiResult.score}/10</strong>` : ''}
          </div>
        </div>`;
    }
    setTimeout(closeSubmit, 2500);
    toast(`"${name}" submitted for review!`);
    document.getElementById('submitForm')?.reset();

  } catch(e) {
    setSubmitLoading(false);
    setSubmitError(e.message);
  }
}

/* Auto-build markdown from form fields */
function buildMarkdownFromForm({ name, cat, diff, time, desc, trigger, tagsList, skillsList, toolsList }) {
  const id = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  return `---
name: ${id}
description: ${desc}. ${trigger ? 'Use when ' + trigger + '.' : ''}
tags: ${tagsList.join(', ')}
difficulty: ${diff}
time_to_master: ${time}
---

# ${name}

## Description
${desc}

${trigger ? `## When to Use\n${trigger}\n` : ''}
${skillsList.length ? `## Atomic Skills\n${skillsList.map(s => `- ${s}`).join('\n')}\n` : ''}
${toolsList.length  ? `## Essential Tools\n${toolsList.map(t => `- ${t}`).join('\n')}\n` : ''}`;
}

/* File upload handler */
async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.match(/\.(md|txt)$/i)) { toast('Please upload a .md or .txt file', true); return; }
  if (file.size > 100000)               { toast('File too large (max 100KB)', true); return; }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const fm   = parseFrontmatter(text);

    const preview = document.getElementById('uploadPreview');
    if (preview) preview.textContent = text.slice(0, 500) + (text.length > 500 ? '\n…' : '');

    const hiddenMd = document.getElementById('generatedMd') || (() => {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.id = 'generatedMd';
      document.getElementById('submitForm')?.appendChild(inp);
      return inp;
    })();
    hiddenMd.value = text;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('f-name', fm.name?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    setVal('f-desc', fm.description);
    setVal('f-diff', fm.difficulty);
    setVal('f-time', fm.time_to_master);
    setVal('f-tags', fm.tags);

    const errors = validateSkillForm({
      name: fm.name || 'uploaded',
      cat:  document.getElementById('f-cat')?.value || 'ai',
      description: fm.description || '',
      md_content: text
    });

    const validEl = document.getElementById('uploadValidation');
    if (validEl) {
      if (errors.length > 0) {
        validEl.innerHTML = `<div class="val-errors"><strong>⚠️ Issues:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
        validEl.style.display = 'block';
      } else {
        validEl.innerHTML = `<div class="val-ok">✅ Skill file looks good! Fill in remaining details and submit.</div>`;
        validEl.style.display = 'block';
      }
    }

    switchTab('form');
    toast(`File "${file.name}" loaded — fill in any missing details`);
  };
  reader.readAsText(file);
}

/* ── DROP ZONES ──────────────────────────────────── */
function initDropZone(zoneId, inputId) {
  const zone = document.getElementById(zoneId);
  const inp  = document.getElementById(inputId);
  if (!zone) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f);
  });
  inp?.addEventListener('change', e => {
    if (e.target.files[0]) handleFileUpload(e.target.files[0]);
    e.target.value = '';
  });
}

/* ── TOAST ───────────────────────────────────────── */
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  const m  = document.getElementById('toastMsg');
  if (!el || !m) return;
  m.textContent = msg;
  el.style.background = isError ? '#8a3a4e' : 'var(--text-pri)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

/* ── UTILS ───────────────────────────────────────── */
function esc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}