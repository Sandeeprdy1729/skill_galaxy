/*
 * SkillGalaxy — AI Career Pathfinder
 * Interactive career journey generator with animated visual roadmap.
 * Depends on: skills-api.js (getAllSkills), app.js (esc, toast, showSkillDetail)
 */

/* ── CAREER PATHFINDER STATE ─────────────────────── */
let cpPath = null;
let cpAnimFrame = null;

const CP_STORAGE_COUNT = 'sg-pathfinder-count';
const CP_STORAGE_TS    = 'sg-pathfinder-ts';
const CP_DAY_MS        = 86400000;
const CP_MAX_DAILY     = 3;

/* ── OPEN / CLOSE ────────────────────────────────── */
function openCareerPathfinder() {
  const overlay = document.getElementById('careerPathfinderOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset to input view
  document.getElementById('cpInputView').style.display = '';
  document.getElementById('cpResultView').style.display = 'none';
  document.getElementById('cpCurrentRole').value = '';
  document.getElementById('cpDreamRole').value = '';
  document.getElementById('cpGenerateBtn').disabled = false;
  document.getElementById('cpGenerateBtn').innerHTML = '🚀 Generate My Path';
  cpPath = null;
}

function closeCareerPathfinder() {
  const overlay = document.getElementById('careerPathfinderOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (cpAnimFrame) { cancelAnimationFrame(cpAnimFrame); cpAnimFrame = null; }
}

/* ── GENERATE PATH ───────────────────────────────── */
async function generateCareerPath() {
  const currentRole = (document.getElementById('cpCurrentRole')?.value || '').trim();
  const dreamRole   = (document.getElementById('cpDreamRole')?.value || '').trim();

  if (!currentRole || !dreamRole) {
    toast('Please fill in both roles', true);
    return;
  }

  // Check daily limit
  const storedTs = localStorage.getItem(CP_STORAGE_TS);
  if (!storedTs || Date.now() - parseInt(storedTs, 10) > CP_DAY_MS) {
    localStorage.setItem(CP_STORAGE_COUNT, '0');
    localStorage.setItem(CP_STORAGE_TS, String(Date.now()));
  }
  const count = parseInt(localStorage.getItem(CP_STORAGE_COUNT) || '0', 10);
  if (count >= CP_MAX_DAILY) {
    toast('Daily limit reached (3/day). Try again tomorrow!', true);
    return;
  }

  const btn = document.getElementById('cpGenerateBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="cp-loading-spinner"></span> Mapping your journey…';

  try {
    const resp = await fetch('/api/career-pathfinder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentRole, dreamRole }),
    });

    const data = await resp.json();

    if (!data.path) {
      toast('Could not generate path. Try again.', true);
      btn.disabled = false;
      btn.innerHTML = '🚀 Generate My Path';
      return;
    }

    cpPath = data.path;
    localStorage.setItem(CP_STORAGE_COUNT, String(count + 1));
    renderCareerPath(data.path, !data.configured);
  } catch {
    toast('Network error. Please try again.', true);
    btn.disabled = false;
    btn.innerHTML = '🚀 Generate My Path';
  }
}

/* ── RENDER THE JOURNEY ──────────────────────────── */
function renderCareerPath(path, isOffline) {
  document.getElementById('cpInputView').style.display = 'none';
  const resultView = document.getElementById('cpResultView');
  resultView.style.display = '';

  const offlineBadge = isOffline
    ? '<span class="cp-badge-offline">📡 Template Path (AI unavailable)</span>'
    : '<span class="cp-badge-ai">✨ AI-Generated</span>';

  // Count total skills
  const totalSkills = path.phases.reduce((sum, p) => sum + (p.skills?.length || 0), 0);

  let html = `
    <div class="cp-journey-header">
      <div class="cp-journey-title-row">
        <h2 class="cp-journey-title">${esc(path.title)}</h2>
        ${offlineBadge}
      </div>
      <p class="cp-journey-summary">${esc(path.summary)}</p>
      <div class="cp-journey-stats">
        <div class="cp-stat">
          <span class="cp-stat-value">${path.totalMonths || path.phases.length * 1.5}</span>
          <span class="cp-stat-label">Months</span>
        </div>
        <div class="cp-stat">
          <span class="cp-stat-value">${path.phases.length}</span>
          <span class="cp-stat-label">Phases</span>
        </div>
        <div class="cp-stat">
          <span class="cp-stat-value">${totalSkills}</span>
          <span class="cp-stat-label">Skills</span>
        </div>
      </div>
    </div>

    <div class="cp-timeline">
  `;

  path.phases.forEach((phase, i) => {
    const skillCards = (phase.skills || []).map(skill => {
      // Try to find matching skill in database
      const matchedSkill = findMatchingSkill(skill.name, skill.category);
      const clickAction = matchedSkill
        ? `data-skill-id="${esc(matchedSkill.id)}" onclick="closeCareerPathfinder();showSkillDetail(this.dataset.skillId)"`
        : '';
      const linkClass = matchedSkill ? 'cp-skill-linked' : '';
      const linkBadge = matchedSkill ? '<span class="cp-skill-in-db">● In Library</span>' : '';

      return `
        <div class="cp-skill-card ${linkClass}" ${clickAction}>
          <div class="cp-skill-top">
            <span class="cp-skill-name">${esc(skill.name)}</span>
            <span class="cp-skill-diff cp-diff-${skill.difficulty || 'intermediate'}">${esc(skill.difficulty || 'intermediate')}</span>
          </div>
          <div class="cp-skill-reason">${esc(skill.reason)}</div>
          ${linkBadge}
        </div>
      `;
    }).join('');

    html += `
      <div class="cp-phase" style="--phase-index:${i}">
        <div class="cp-phase-connector">
          <div class="cp-phase-node">
            <span class="cp-phase-icon">${phase.icon || '📍'}</span>
          </div>
          ${i < path.phases.length - 1 ? '<div class="cp-phase-line"></div>' : ''}
        </div>
        <div class="cp-phase-content">
          <div class="cp-phase-header">
            <span class="cp-phase-label">${esc(phase.month || `Phase ${i + 1}`)}</span>
            <span class="cp-phase-duration">${esc(phase.duration)}</span>
          </div>
          <h3 class="cp-phase-name">${esc(phase.name)}</h3>
          <p class="cp-phase-desc">${esc(phase.description)}</p>
          <div class="cp-skills-grid">${skillCards}</div>
          <div class="cp-milestone">
            <span class="cp-milestone-icon">🏁</span>
            <span class="cp-milestone-text">${esc(phase.milestone)}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>'; // close timeline

  if (path.finalAdvice) {
    html += `
      <div class="cp-final-advice">
        <div class="cp-advice-glow"></div>
        <div class="cp-advice-content">
          <span class="cp-advice-icon">💡</span>
          <p>${esc(path.finalAdvice)}</p>
        </div>
      </div>
    `;
  }

  html += `
    <div class="cp-actions">
      <button class="btn-main cp-btn-new" onclick="openCareerPathfinder()">
        ↻ New Journey
      </button>
      <button class="btn-ghost" onclick="closeCareerPathfinder()">Close</button>
    </div>
  `;

  resultView.innerHTML = html;

  // Trigger entrance animations
  requestAnimationFrame(() => {
    const phases = resultView.querySelectorAll('.cp-phase');
    phases.forEach((el, i) => {
      setTimeout(() => el.classList.add('cp-phase-visible'), 150 * i);
    });
  });

  // Animate the particle canvas
  initPathfinderParticles();
}

/* ── SKILL MATCHING ──────────────────────────────── */
function normalizeSkillName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMatchingSkill(skillName, category) {
  const allSkills = getAllSkills();
  const normalizedName = normalizeSkillName(skillName);

  // Try exact name match first
  let match = allSkills.find(s =>
    s.name && normalizeSkillName(s.name) === normalizedName
  );
  if (match) return match;

  // Try partial match in same category
  match = allSkills.find(s => {
    const sName = (s.name || '').toLowerCase();
    return sName.includes(skillName.toLowerCase()) ||
           skillName.toLowerCase().includes(sName);
  });
  if (match) return match;

  // Try ID-based match
  const idGuess = skillName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  match = allSkills.find(s => s.id === idGuess);

  return match || null;
}

/* ── PARTICLE ANIMATION ──────────────────────────── */
function initPathfinderParticles() {
  const canvas = document.getElementById('cpParticleCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;

  const particles = [];
  const PARTICLE_COUNT = 40;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = isDark ? '255,255,255' : '58,125,110';

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
      ctx.fill();
    }

    // Draw faint connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${color}, ${0.06 * (1 - dist / 100)})`;
          ctx.stroke();
        }
      }
    }

    cpAnimFrame = requestAnimationFrame(animate);
  }

  animate();
}

/* ── POPULAR PATH QUICK-FILLS ────────────────────── */
function cpQuickFill(current, dream) {
  document.getElementById('cpCurrentRole').value = current;
  document.getElementById('cpDreamRole').value = dream;
  // Visual feedback
  const btn = document.getElementById('cpGenerateBtn');
  btn.classList.add('cp-btn-pulse');
  setTimeout(() => btn.classList.remove('cp-btn-pulse'), 600);
}
