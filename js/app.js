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
  compare: [],   // skill IDs selected for comparison (max 3)
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

  initTheme();
  updateBookmarkCount();
  buildSidebar();
  renderGrid();
  updateTotalCount();

  // Skills are loaded exclusively from SKILLS_DB (skills/ folder).
  // No remote Supabase fetch for old skills.

  // Search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    appState.query = e.target.value;
    appState.page  = 1;
    renderGrid();
  });

  // Search history dropdown
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      const history = getSearchHistory();
      if (history.length > 0) {
        let dh = document.getElementById('searchHistoryDropdown');
        if (!dh) {
          dh = document.createElement('div');
          dh.id = 'searchHistoryDropdown';
          dh.className = 'search-history-dropdown';
          searchInput.parentNode.appendChild(dh);
        }
        renderSearchHistory();
        dh.style.display = 'block';
      }
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        const dh = document.getElementById('searchHistoryDropdown');
        if (dh) dh.style.display = 'none';
      }, 150);
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && appState.query.trim()) {
        addToSearchHistory(appState.query);
      }
    });
  }

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
  document.getElementById('compareOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('compareOverlay')) closeCompareModal();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetail(); closeAuthModal(); closeSubmit(); closeCompareModal(); }
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
      (appState.view === 'mine' && s.source === 'community' && s.submittedBy === getUserName(currentUser)) ||
      (appState.view === 'bookmarked' && isBookmarked(s.id));
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
        <button class="btn-compare ${appState.compare.includes(s.id) ? 'active' : ''}"
                onclick="toggleCompare('${esc(s.id)}', event)"
                title="${appState.compare.includes(s.id) ? 'Remove from compare' : 'Add to compare'}">
          ⇔
        </button>
        <button class="btn-bookmark ${isBookmarked(s.id) ? 'active' : ''}"
                onclick="toggleBookmark('${esc(s.id)}', event)"
                title="${isBookmarked(s.id) ? 'Remove from saved' : 'Save skill'}">
          ${isBookmarked(s.id) ? '★' : '☆'}
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
      <button class="btn-ghost" onclick="openExportModal('${esc(s.id)}')">📤 Export for…</button>
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

  // AI validation + Security scan — run in parallel, non-blocking
  const aiScoreEl = document.getElementById('aiScoreResult');
  if (aiScoreEl) aiScoreEl.style.display = 'none';
  let aiResult  = null;
  let scanResult = null;

  try {
    [aiResult, scanResult] = await Promise.all([
      validateSkillWithAI(name, desc, md).catch(() => null),
      runSecurityScan(md, name).catch(() => null),
    ]);
  } catch (_) { /* swallow — validation is optional */ }

  // Block on security issues (rule-based patterns only, not AI scan)
  if (scanResult && !scanResult.safe && scanResult.issues?.length > 0) {
    setSubmitLoading(false);
    setSubmitError('🛡️ Security scan failed:\n' + scanResult.issues.slice(0, 3).join('\n') + '\n\nPlease fix these issues before submitting.');
    return;
  }

  // Show AI score + security badge if configured
  if (aiScoreEl) {
    const parts = [];
    if (aiResult?.configured && aiResult.score != null) {
      const scoreColor = aiResult.score >= 8 ? 'var(--teal)' : aiResult.score >= 6 ? '#8a6a1a' : 'var(--red)';
      parts.push(`<strong style="color:${scoreColor}">AI Score: ${aiResult.score}/10</strong>
        ${aiResult.feedback ? `<span style="color:var(--text-sec);margin-left:8px">${esc(aiResult.feedback)}</span>` : ''}
        ${!aiResult.approved ? `<div style="color:var(--red);margin-top:4px;font-size:.72rem">⚠️ Score below threshold. Consider improving before submitting.</div>` : ''}`);
    }
    if (scanResult?.badge) {
      const badgeColor = scanResult.safe ? 'var(--teal)' : 'var(--red)';
      parts.push(`<span style="color:${badgeColor}">🛡️ ${esc(scanResult.badge)}</span>`);
    }
    if (parts.length) {
      aiScoreEl.innerHTML = `<div style="background:var(--cream-dark);border:1px solid var(--border-lt);border-radius:var(--r-sm);padding:10px 13px;font-size:.76rem;margin-bottom:10px">${parts.join('<span style="color:var(--border);margin:0 8px">·</span>')}</div>`;
      aiScoreEl.style.display = 'block';
    }
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
            ${scanResult?.safe ? `<br><span style="color:var(--teal)">🛡️ ${esc(scanResult.badge)}</span>` : ''}
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

/* ── THEME TOGGLE ─────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = saved || prefers;
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ── BOOKMARKS ─────────────────────────────────────── */
function getBookmarkedIds() {
  return JSON.parse(localStorage.getItem('bookmarkedSkills') || '[]');
}

function isBookmarked(skillId) {
  return getBookmarkedIds().includes(skillId);
}

function toggleBookmark(skillId, event) {
  event.stopPropagation();
  let bookmarks = getBookmarkedIds();
  if (bookmarks.includes(skillId)) {
    bookmarks = bookmarks.filter(id => id !== skillId);
  } else {
    bookmarks.push(skillId);
  }
  localStorage.setItem('bookmarkedSkills', JSON.stringify(bookmarks));
  renderGrid();
  updateBookmarkCount();
}

function showBookmarkedSkills() {
  appState.filter = 'bookmarked';
  appState.view = 'bookmarked';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  renderGrid();
}

function getBookmarkCount() {
  return getBookmarkedIds().length;
}

function updateBookmarkCount() {
  const el = document.getElementById('bookmarkCount');
  if (el) el.textContent = getBookmarkCount();
}

/* ── SEARCH HISTORY ─────────────────────────────────── */
function getSearchHistory() {
  return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

function addToSearchHistory(query) {
  if (!query.trim()) return;
  let history = getSearchHistory();
  history = history.filter(q => q !== query);
  history.unshift(query);
  history = history.slice(0, 10);
  localStorage.setItem('searchHistory', JSON.stringify(history));
}

function clearSearchHistory() {
  localStorage.removeItem('searchHistory');
  renderSearchHistory();
}

function renderSearchHistory() {
  const el = document.getElementById('searchHistoryList');
  if (!el) return;
  const history = getSearchHistory();
  if (history.length === 0) {
    el.innerHTML = '<div style="padding:12px;color:var(--text-ter);font-size:.75rem">No recent searches</div>';
    return;
  }
  el.innerHTML = history.map(q => `<div class="search-history-item" onclick="document.getElementById('searchInput').value='${esc(q)}';appState.query='${esc(q)}';renderGrid();closeSearchHistory()">${esc(q)}</div>`).join('');
  el.innerHTML += '<div onclick="clearSearchHistory()" style="padding:8px 12px;color:var(--copper);cursor:pointer;font-size:.7rem">Clear history</div>';
}

function closeSearchHistory() {
  const el = document.getElementById('searchHistoryDropdown');
  if (el) el.style.display = 'none';
}

/* ── BUNDLES VIEW ────────────────────────────────── */
function showBundlesView() {
  document.getElementById('bundlesSection').style.display  = 'block';
  document.getElementById('diffPills').style.display       = 'none';
  document.getElementById('skillsGrid').style.display      = 'none';
  const pw = document.getElementById('paginationWrap');
  if (pw) pw.style.display = 'none';
  if (typeof renderBundles === 'function') renderBundles('bundlesGrid');
}

function hideBundlesView() {
  document.getElementById('bundlesSection').style.display  = 'none';
  document.getElementById('diffPills').style.display       = 'flex';
  document.getElementById('skillsGrid').style.display      = 'grid';
  const pw = document.getElementById('paginationWrap');
  if (pw) pw.style.display = 'flex';
  renderGrid();
}

/* ── AI SEMANTIC SEARCH ──────────────────────────── */
function openAiSearch() {
  document.getElementById('aiSearchOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('aiSearchInput')?.focus(), 100);
}

function closeAiSearch() {
  document.getElementById('aiSearchOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function runAiSearch() {
  const query = document.getElementById('aiSearchInput')?.value?.trim();
  if (!query) return;

  const btn = document.getElementById('aiSearchSubmitBtn');
  const errEl = document.getElementById('aiSearchError');
  const resultEl = document.getElementById('aiSearchResultsModal');

  if (btn) { btn.disabled = true; btn.textContent = '✨ Finding…'; }
  if (errEl) errEl.style.display = 'none';
  if (resultEl) resultEl.style.display = 'none';

  // Build skill summaries (sample first 150 for prompt efficiency)
  const summaries = getAllSkills().slice(0, 150).map(s => ({
    id:   s.id,
    name: s.name,
    cat:  s.cat,
    desc: (s.desc || '').slice(0, 120),
    tags: (s.tags || []).slice(0, 5).join(', '),
  }));

  try {
    const res = await fetch('/api/recommend-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, skillSummaries: summaries }),
    });
    const data = await res.json();

    if (data?.configured === false) {
      if (errEl) {
        errEl.textContent = '⚙️ AI Search requires ANTHROPIC_API_KEY. Falling back to text search.';
        errEl.style.display = 'block';
      }
      // Fall back to regular search
      document.getElementById('searchInput').value = query;
      appState.query = query;
      appState.page  = 1;
      renderGrid();
      closeAiSearch();
      return;
    }

    const recs = data?.recommendations || [];
    if (!recs.length) {
      if (errEl) { errEl.textContent = 'No matching skills found. Try different keywords.'; errEl.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = '✨ Find Skills'; }
      return;
    }

    // Show results in modal
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `
        <div class="m-lbl" style="margin-bottom:8px">Best Matches</div>
        ${recs.map(r => {
          const s = getAllSkills().find(x => x.id === r.id || x.name.toLowerCase() === r.name.toLowerCase());
          return `
          <div class="ai-rec-card" onclick="${s ? `closeAiSearch();openDetail('${esc(s.id)}')` : ''}">
            <div class="ai-rec-name">${esc(r.name)}</div>
            <div class="ai-rec-reason">${esc(r.reason)}</div>
            ${s ? `<div style="font-size:.66rem;color:var(--teal);margin-top:2px">✓ Found in library → click to open</div>` : '<div style="font-size:.66rem;color:var(--text-ter)">Not in library yet</div>'}
          </div>`;
        }).join('')}`;
    }

    // Also show as dismissable chips on the main page
    const chips = document.getElementById('aiSuggestChips');
    if (chips) {
      chips.innerHTML = recs.map(r => {
        const s = getAllSkills().find(x => x.id === r.id || x.name.toLowerCase() === r.name.toLowerCase());
        return `<button class="ai-chip" onclick="${s ? `openDetail('${esc(s.id)}')` : ''}" title="${esc(r.reason)}">${esc(r.name)}</button>`;
      }).join('');
    }
    document.getElementById('aiSuggestResults').style.display = 'block';

  } catch (err) {
    if (errEl) { errEl.textContent = 'Search failed: ' + err.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Find Skills'; }
  }
}

function dismissAiSuggest() {
  document.getElementById('aiSuggestResults').style.display = 'none';
}

/* ── SKILLFORGE ──────────────────────────────────── */
let skillForgeGeneratedMd = '';

function openSkillForge() {
  document.getElementById('skillForgeOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  skillForgeGeneratedMd = '';
  document.getElementById('sf-result').style.display    = 'none';
  document.getElementById('sf-error').style.display     = 'none';
  document.getElementById('sf-submit-btn').style.display = 'none';
  document.getElementById('sf-download-btn').style.display = 'none';
  document.getElementById('sf-not-configured').style.display = 'none';
}

function closeSkillForge() {
  document.getElementById('skillForgeOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function runSkillForge() {
  const desc   = document.getElementById('sf-desc')?.value?.trim();
  const cat    = document.getElementById('sf-cat')?.value || 'ai';
  const diff   = document.getElementById('sf-diff')?.value || 'intermediate';
  const errEl  = document.getElementById('sf-error');
  const btn    = document.getElementById('sf-generate-btn');

  if (!desc || desc.length < 20) {
    if (errEl) { errEl.textContent = 'Please describe the skill in at least 20 characters.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = '✨ Generating…'; }
  document.getElementById('sf-result').style.display = 'none';

  try {
    const res  = await fetch('/api/skillforge', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, category: cat, difficulty: diff }),
    });
    const data = await res.json();

    if (data?.configured === false) {
      document.getElementById('sf-not-configured').style.display = 'block';
      return;
    }

    if (!data?.md) {
      if (errEl) { errEl.textContent = data?.error || 'Generation failed. Try again.'; errEl.style.display = 'block'; }
      return;
    }

    skillForgeGeneratedMd = data.md;

    const preview = document.getElementById('sf-preview');
    const badge   = document.getElementById('sf-badge');
    if (preview) preview.textContent = data.md.slice(0, 800) + (data.md.length > 800 ? '\n…' : '');

    // Run security scan on the generated file
    let secBadge = '';
    try {
      const scanRes  = await fetch('/api/scan-skill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ md_content: data.md, name: data.name }),
      });
      const scanData = await scanRes.json();
      secBadge = scanData.safe
        ? `<span style="color:var(--teal);font-weight:500">🛡️ ${esc(scanData.badge)}</span>`
        : `<span style="color:var(--red)">⚠️ Security: ${esc(scanData.issues[0] || 'Issues found')}</span>`;
    } catch (_) { secBadge = ''; }

    if (badge) badge.innerHTML = secBadge;
    document.getElementById('sf-result').style.display = 'block';
    document.getElementById('sf-submit-btn').style.display = 'inline-flex';
    document.getElementById('sf-download-btn').style.display = 'inline-flex';

  } catch (err) {
    if (errEl) { errEl.textContent = 'Error: ' + err.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Generate Skill'; }
  }
}

function skillForgeDownload() {
  if (!skillForgeGeneratedMd) return;
  const nameMatch = skillForgeGeneratedMd.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : 'generated-skill';
  const blob = new Blob([skillForgeGeneratedMd], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.md`;
  a.click();
  toast(`Downloaded ${name}.md`);
}

function skillForgeSubmit() {
  if (!skillForgeGeneratedMd) return;
  closeSkillForge();
  openSubmit();

  // Pre-fill the submit form from the generated skill
  setTimeout(() => {
    const hiddenMd = document.getElementById('generatedMd') || (() => {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.id = 'generatedMd';
      document.getElementById('submitForm')?.appendChild(inp);
      return inp;
    })();
    hiddenMd.value = skillForgeGeneratedMd;

    const fm = parseFrontmatter ? parseFrontmatter(skillForgeGeneratedMd) : {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('f-name', (fm.name || '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    setVal('f-desc', fm.description);
    setVal('f-diff', fm.difficulty);
    setVal('f-time', fm.time_to_master);
    setVal('f-tags', fm.tags || '');

    // Show preview
    const preview = document.getElementById('uploadPreview');
    if (preview) preview.textContent = skillForgeGeneratedMd.slice(0, 500);

    switchTab('form');
    toast('SkillForge output loaded into submit form!');
  }, 350);
}

/* ── SECURITY SCAN ───────────────────────────────── */
async function runSecurityScan(md_content, name) {
  try {
    const res  = await fetch('/api/scan-skill', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ md_content, name }),
    });
    return await res.json();
  } catch (_) {
    return { safe: null, score: null, issues: [], badge: null };
  }
}

/* ── CROSS-PLATFORM EXPORT ───────────────────────── */
let exportSkillData = null;

const EXPORT_FORMATS = [
  {
    id:   'claude',
    name: 'Claude Projects',
    ext:  '.md',
    icon: '🤖',
    desc: 'Original format for Claude Projects',
    transform: (s) => s.md || `---\nname: ${s.id}\ndescription: ${s.desc}\n---\n\n${s.desc}`,
  },
  {
    id:   'cursor',
    name: 'Cursor Rules',
    ext:  '.cursorrules',
    icon: '⚡',
    desc: 'Cursor AI .cursorrules format',
    transform: (s) => `# ${s.name}\n\n${s.desc}\n\n${s.trigger ? `## When to Activate\n${s.trigger}\n\n` : ''}## Instructions\n\n${(s.md || '').replace(/^---[\s\S]*?---\n/m, '').trim()}`,
  },
  {
    id:   'codex',
    name: 'Codex CLI',
    ext:  '.prompt.md',
    icon: '🔷',
    desc: 'OpenAI Codex CLI prompt format',
    transform: (s) => `# ${s.name}\n\n**Category**: ${s.cat} | **Difficulty**: ${s.difficulty || 'intermediate'}\n\n${s.desc}\n\n${s.trigger ? `> Activate when: ${s.trigger}\n\n` : ''}${(s.md || '').replace(/^---[\s\S]*?---\n/m, '').trim()}`,
  },
  {
    id:   'gemini',
    name: 'Gemini CLI',
    ext:  '.gemini.md',
    icon: '💎',
    desc: 'Google Gemini CLI system prompt format',
    transform: (s) => `## System: ${s.name}\n\n${s.desc}\n\n${s.trigger ? `**Use when**: ${s.trigger}\n\n` : ''}### Instructions\n\n${(s.md || '').replace(/^---[\s\S]*?---\n/m, '').trim()}`,
  },
];

let exportCurrentFormat = 'claude';

function openExportModal(skillId) {
  const s = getAllSkills().find(x => x.id === skillId);
  if (!s) return;
  exportSkillData = s;
  exportCurrentFormat = 'claude';

  document.getElementById('exportModalTitle').textContent = `Export: ${s.name}`;
  document.getElementById('exportOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Render format buttons
  const fmtsEl = document.getElementById('exportFormats');
  if (fmtsEl) {
    fmtsEl.innerHTML = EXPORT_FORMATS.map(f => `
      <div class="export-fmt${f.id === 'claude' ? ' active' : ''}"
           id="efmt-${f.id}"
           onclick="selectExportFormat('${f.id}')">
        <span class="export-fmt-icon">${f.icon}</span>
        <div>
          <div class="export-fmt-name">${esc(f.name)}</div>
          <div class="export-fmt-desc">${esc(f.desc)}</div>
        </div>
      </div>`).join('');
  }

  selectExportFormat('claude');
}

function selectExportFormat(fmtId) {
  exportCurrentFormat = fmtId;
  document.querySelectorAll('.export-fmt').forEach(el => el.classList.remove('active'));
  document.getElementById(`efmt-${fmtId}`)?.classList.add('active');

  const fmt = EXPORT_FORMATS.find(f => f.id === fmtId);
  if (!fmt || !exportSkillData) return;

  const content = fmt.transform(exportSkillData);
  const prev = document.getElementById('exportPreviewCode');
  const lbl  = document.getElementById('exportPreviewLabel');
  if (prev) prev.textContent = content.slice(0, 600) + (content.length > 600 ? '\n…' : '');
  if (lbl)  lbl.textContent  = `Preview (${fmt.name} · ${fmt.ext})`;
  document.getElementById('exportPreview').style.display = 'block';
}

function downloadExport() {
  const fmt = EXPORT_FORMATS.find(f => f.id === exportCurrentFormat);
  if (!fmt || !exportSkillData) return;
  const content = fmt.transform(exportSkillData);
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${exportSkillData.id.replace(/-community-\w+$/, '')}${fmt.ext}`;
  a.click();
  toast(`Exported for ${fmt.name}`);
}

function copyExport() {
  const fmt = EXPORT_FORMATS.find(f => f.id === exportCurrentFormat);
  if (!fmt || !exportSkillData) return;
  const content = fmt.transform(exportSkillData);
  navigator.clipboard.writeText(content)
    .then(() => toast('Copied!'))
    .catch(() => toast('Copy failed', true));
}

function closeExportModal() {
  document.getElementById('exportOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── SKILL COMPARISON ────────────────────────────── */
const COMPARE_MAX = 3;

function toggleCompare(skillId, event) {
  event.stopPropagation();
  const idx = appState.compare.indexOf(skillId);
  if (idx > -1) {
    appState.compare.splice(idx, 1);
  } else {
    if (appState.compare.length >= COMPARE_MAX) {
      toast(`Compare up to ${COMPARE_MAX} skills at a time`, true);
      return;
    }
    appState.compare.push(skillId);
  }
  renderGrid();
  updateCompareTray();
}

function removeFromCompare(skillId) {
  appState.compare = appState.compare.filter(id => id !== skillId);
  renderGrid();
  updateCompareTray();
}

function clearCompare() {
  appState.compare = [];
  renderGrid();
  updateCompareTray();
}

function updateCompareTray() {
  const tray = document.getElementById('compareTray');
  if (!tray) return;
  const ids = appState.compare;
  if (ids.length === 0) {
    tray.classList.remove('visible');
    return;
  }
  tray.classList.add('visible');

  const allSkills = getAllSkills();
  const selected = ids.map(id => allSkills.find(s => s.id === id)).filter(Boolean);

  const chipsHtml = selected.map(s => `
    <div class="compare-chip">
      <span class="compare-chip-name">${esc(s.name)}</span>
      <button class="compare-chip-remove" onclick="removeFromCompare('${esc(s.id)}')" title="Remove">✕</button>
    </div>`).join('');

  const slotsLeft = COMPARE_MAX - ids.length;
  const slotsHtml = slotsLeft > 0
    ? `<span class="compare-slots">${slotsLeft} more slot${slotsLeft > 1 ? 's' : ''}</span>`
    : '';

  document.getElementById('compareTrayChips').innerHTML = chipsHtml + slotsHtml;

  const cmpBtn = document.getElementById('compareTrayBtn');
  if (cmpBtn) {
    cmpBtn.disabled = ids.length < 2;
    cmpBtn.textContent = `⇔ Compare (${ids.length})`;
  }
  document.getElementById('compareCount').textContent = ids.length;

  // Update sidebar nav count
  const navCount = document.getElementById('compareNavCount');
  if (navCount) {
    navCount.textContent = ids.length;
    navCount.style.display = ids.length > 0 ? 'inline-flex' : 'none';
  }
}

function openCompareModal() {
  if (appState.compare.length < 2) {
    toast('Select at least 2 skills to compare', true);
    return;
  }

  const allSkills = getAllSkills();
  const selected = appState.compare.map(id => allSkills.find(s => s.id === id)).filter(Boolean);

  const colWidth = Math.floor(100 / selected.length);

  // Header row
  const headerHtml = selected.map(s => {
    const c = CATEGORIES[s.cat] || CATEGORIES.ai;
    const iconHtml = renderIcon(s, 28);
    const iconBg = (s.iconType === 'simpleicons' && getBrandColor(s))
      ? `${getBrandColor(s)}18`
      : c.tag;
    return `
    <div class="compare-col" style="width:${colWidth}%">
      <div class="compare-col-icon" style="background:${iconBg}">${iconHtml}</div>
      <div class="compare-col-name">${esc(s.name)}</div>
      <span class="card-tag" style="background:${c.tag};color:${c.tagText};font-size:.62rem">${esc(c.label)}</span>
    </div>`;
  }).join('');

  // Metric rows
  const metrics = [
    { label: 'Difficulty',      fn: s => `<span class="diff-badge ${esc(s.difficulty || '')}">${esc(s.difficulty || 'intermediate')}</span>` },
    { label: 'Demand Score',    fn: s => renderScoreBar(s.d, 'demand') },
    { label: 'Income Score',    fn: s => renderScoreBar(s.i, 'income') },
    { label: 'Future Score',    fn: s => renderScoreBar(s.f, 'future') },
    { label: 'Time to Master',  fn: s => `<span style="font-size:.78rem;color:var(--text-sec)">${esc(s.timeToMaster || '—')}</span>` },
    { label: 'Tags',            fn: s => (s.tags || []).slice(0, 5).map(t => `<span class="chip" style="font-size:.62rem;padding:2px 6px">${esc(t)}</span>`).join(' ') || '<span style="color:var(--text-ter)">—</span>' },
    { label: 'Tools',           fn: s => (s.tools || []).slice(0, 4).map(t => `<span class="tool-chip" style="font-size:.62rem;padding:2px 6px">${esc(t)}</span>`).join(' ') || '<span style="color:var(--text-ter)">—</span>' },
    { label: 'Atomic Skills',   fn: s => (s.skills || []).slice(0, 4).map(sk => `<span class="chip" style="font-size:.62rem;padding:2px 6px">${esc(sk)}</span>`).join(' ') || '<span style="color:var(--text-ter)">—</span>' },
  ];

  const rowsHtml = metrics.map(m => `
    <div class="compare-row">
      <div class="compare-row-label">${m.label}</div>
      <div class="compare-row-values">
        ${selected.map(s => `<div class="compare-col" style="width:${colWidth}%">${m.fn(s)}</div>`).join('')}
      </div>
    </div>`).join('');

  // Description row
  const descHtml = `
    <div class="compare-row">
      <div class="compare-row-label">Description</div>
      <div class="compare-row-values">
        ${selected.map(s => `<div class="compare-col" style="width:${colWidth}%"><div class="compare-desc">${esc((s.desc || '').slice(0, 150))}${(s.desc || '').length > 150 ? '…' : ''}</div></div>`).join('')}
      </div>
    </div>`;

  // Actions row
  const actionsHtml = `
    <div class="compare-row" style="border-bottom:none">
      <div class="compare-row-label"></div>
      <div class="compare-row-values">
        ${selected.map(s => `
          <div class="compare-col" style="width:${colWidth}%">
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button class="btn-main" style="padding:6px 12px;font-size:.72rem" onclick="closeCompareModal();openDetail('${esc(s.id)}')">View Details</button>
              <button class="btn-ghost" style="padding:6px 10px;font-size:.72rem" onclick="handleDownload('${esc(s.id)}')">↓ .md</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  document.getElementById('compareModalBody').innerHTML = `
    <div class="compare-header">
      <div class="compare-row-values">${headerHtml}</div>
    </div>
    ${descHtml}
    ${rowsHtml}
    ${actionsHtml}
  `;

  document.getElementById('compareOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderScoreBar(val, type) {
  const v = parseInt(val) || 0;
  const pct = v * 10;
  const colors = {
    demand: v >= 9 ? 'var(--teal)' : v >= 7 ? 'var(--copper)' : 'var(--text-ter)',
    income: v >= 9 ? 'var(--teal)' : v >= 7 ? 'var(--copper)' : 'var(--text-ter)',
    future: v >= 9 ? 'var(--teal)' : v >= 7 ? 'var(--copper)' : 'var(--text-ter)',
  };
  return `
    <div class="compare-score">
      <div class="compare-score-bar">
        <div class="compare-score-fill" style="width:${pct}%;background:${colors[type] || 'var(--copper)'}"></div>
      </div>
      <span class="compare-score-val">${v}/10</span>
    </div>`;
}

function closeCompareModal() {
  document.getElementById('compareOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── GitHub Star Counter ────────────────── */
(function loadGitHubStars() {
  const REPO = 'Sandeeprdy1729/skill_galaxy';
  const CACHE_KEY = 'sg-github-stars';
  const CACHE_TTL = 3600000;
  function updateStarUI(count) {
    const fmt = count >= 1000 ? (count/1000).toFixed(1)+'k' : String(count);
    ['heroStars','sidebarStars'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt;
    });
  }
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
    if (cached.count!=null && Date.now()-cached.ts<CACHE_TTL) { updateStarUI(cached.count); return; }
  } catch(e){}
  fetch('https://api.github.com/repos/'+REPO)
    .then(r=>r.json())
    .then(data=>{
      if(data.stargazers_count!=null){
        updateStarUI(data.stargazers_count);
        localStorage.setItem(CACHE_KEY, JSON.stringify({count:data.stargazers_count, ts:Date.now()}));
      }
    }).catch(()=>{});
})();
