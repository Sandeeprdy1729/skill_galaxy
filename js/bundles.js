/**
 * SkillGalaxy — bundles.js
 * Curated Skill Bundles / Skill Trees.
 * Hardcoded for zero-infrastructure MVP; upgrade to Supabase table via supabase-migrations.sql.
 */

/* ── BUNDLE DEFINITIONS ──────────────────────────── */
const SKILL_BUNDLES = [
  {
    id:       'full-stack-2026',
    name:     'Full-Stack Engineer 2026',
    icon:     '🏗️',
    tagline:  'Everything you need to ship production apps end-to-end in 2026.',
    desc:     'A curated bundle of 10 complementary skills covering modern full-stack development: system design, API building, front-end, database, CI/CD, and cloud deployment.',
    skillIds: [
      'system-design', 'api-design', 'react-developer', 'typescript-expert',
      'database-engineer', 'devops-engineer', 'code-reviewer', 'security-engineer',
      'technical-writer', 'performance-engineer'
    ],
    cat:     'dev',
    diff:    'advanced',
    featured: true,
  },
  {
    id:      'indie-hacker-kit',
    name:    'Indie Hacker Launch Kit',
    icon:    '🚀',
    tagline: 'Go from idea to paying customers — solo.',
    desc:    'Launch faster with skills for landing pages, marketing copy, SEO, user research, growth hacking, analytics, and pricing strategy — the complete indie founder toolkit.',
    skillIds: [
      'copywriter', 'seo-specialist', 'growth-hacker', 'user-researcher',
      'product-manager', 'pricing-strategist', 'email-marketer', 'analytics-expert'
    ],
    cat:     'product',
    diff:    'intermediate',
    featured: true,
  },
  {
    id:      'ai-researcher',
    name:    'Scientific Research Co-Scientist',
    icon:    '🔬',
    tagline: 'Accelerate research with AI-powered scientific reasoning.',
    desc:    'Inspired by Anthropic\'s research skill library. Covers literature review, experiment design, statistical analysis, paper writing, peer review, and hypothesis generation.',
    skillIds: [
      'literature-reviewer', 'data-scientist', 'statistical-analyst', 'research-writer',
      'hypothesis-generator', 'peer-reviewer', 'bioinformatics-engineer', 'ml-researcher'
    ],
    cat:     'ai',
    diff:    'expert',
    featured: true,
  },
  {
    id:      'security-pro',
    name:    'Security & Compliance Bundle',
    icon:    '🛡️',
    tagline: 'Ship secure code and stay compliant by default.',
    desc:    'A complete security toolkit: threat modeling, penetration testing, code auditing, GDPR/SOC2 compliance, incident response, and secure architecture review.',
    skillIds: [
      'security-engineer', 'penetration-tester', 'compliance-officer', 'threat-modeler',
      'incident-responder', 'devsecops-engineer', 'cryptography-expert', 'security-auditor'
    ],
    cat:     'security',
    diff:    'advanced',
    featured: false,
  },
];

/* ── BUNDLE CATEGORY COLORS (re-use CATEGORIES from db.js) ─── */
function getBundleCatStyle(cat) {
  const c = (typeof CATEGORIES !== 'undefined' && CATEGORIES[cat]) || { tag: '#f0e4d8', tagText: '#c07b4a', dot: '#c07b4a' };
  return c;
}

/* ── RENDER BUNDLE GRID ──────────────────────────── */
function renderBundles(containerId = 'bundlesGrid') {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  grid.innerHTML = SKILL_BUNDLES.map(b => {
    const c = getBundleCatStyle(b.cat);
    const skillCount = b.skillIds.length;
    return `
    <div class="bundle-card${b.featured ? ' bundle-featured' : ''}"
         onclick="openBundleModal('${b.id}')">
      <div class="bundle-icon">${b.icon}</div>
      <div class="bundle-content">
        <div class="bundle-name">${esc(b.name)}</div>
        <div class="bundle-tagline">${esc(b.tagline)}</div>
        <div class="bundle-meta">
          <span class="card-tag" style="background:${c.tag};color:${c.tagText}">${esc(getBundleCatStyle(b.cat) ? (typeof CATEGORIES !== 'undefined' ? (CATEGORIES[b.cat]?.label || b.cat) : b.cat) : b.cat)}</span>
          <span class="diff-badge ${esc(b.diff)}">${esc(b.diff)}</span>
        </div>
      </div>
      <div class="bundle-foot">
        <span class="bundle-count">📦 ${skillCount} skills</span>
        <button class="btn-dl" onclick="event.stopPropagation();downloadBundle('${b.id}')">↓ Bundle</button>
      </div>
    </div>`;
  }).join('');
}

/* ── BUNDLE DETAIL MODAL ─────────────────────────── */
function openBundleModal(bundleId) {
  const b = SKILL_BUNDLES.find(x => x.id === bundleId);
  if (!b) return;

  const c = getBundleCatStyle(b.cat);
  const catLabel = (typeof CATEGORIES !== 'undefined' && CATEGORIES[b.cat]?.label) || b.cat;

  // Find matching skills from the loaded skill list
  const allSkills  = (typeof getAllSkills === 'function') ? getAllSkills() : [];
  const foundSkills = b.skillIds.map(sid => allSkills.find(s => s.id === sid || s.id.startsWith(sid))).filter(Boolean);

  document.getElementById('bundleModalTitle').textContent  = b.name;
  document.getElementById('bundleModalTagline').textContent = b.tagline;

  document.getElementById('bundleModalBody').innerHTML = `
    <p class="modal-desc">${esc(b.desc)}</p>

    <div class="m-lbl">Included Skills (${b.skillIds.length})</div>
    <div class="bundle-skills-list">
      ${b.skillIds.map((sid, i) => {
        const s = foundSkills.find(x => x?.id === sid || x?.id?.startsWith(sid));
        return `
        <div class="bundle-skill-row${s ? ' has-match' : ''}" onclick="${s ? `openDetail('${esc(s.id)}')` : ''}">
          <span class="bundle-skill-num">${i + 1}</span>
          <div class="bundle-skill-info">
            <div class="bundle-skill-name">${s ? esc(s.name) : esc(sid.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase()))}</div>
            ${s ? `<div class="bundle-skill-desc">${esc((s.desc || '').slice(0, 80))}…</div>` : '<div class="bundle-skill-desc" style="color:var(--text-ter)">Not yet in library</div>'}
          </div>
          ${s ? `<span style="color:var(--text-ter);font-size:.68rem">↗</span>` : ''}
        </div>`;
      }).join('')}
    </div>

    <div class="m-lbl" style="margin-top:18px">One-Download Bundle</div>
    <div class="how-to">
      <div class="ht-step"><div class="step-n">1</div><div>Click <strong>Download Bundle</strong> — get a <code>.zip</code> with all ${foundSkills.length} skill files + a master activator</div></div>
      <div class="ht-step"><div class="step-n">2</div><div>Open Claude → <strong>Projects</strong> → create a new project for this bundle</div></div>
      <div class="ht-step"><div class="step-n">3</div><div>Upload the <code>_bundle-activator.md</code> file as your Project Instructions</div></div>
      <div class="ht-step"><div class="step-n">4</div><div>Claude activates the right skill automatically based on what you ask</div></div>
    </div>

    <div class="modal-actions">
      <button class="btn-main" onclick="downloadBundle('${b.id}')">↓ Download Bundle (.zip)</button>
      <button class="btn-ghost" onclick="closeBundleModal()">Close</button>
    </div>`;

  document.getElementById('bundleOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBundleModal() {
  document.getElementById('bundleOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── BUNDLE ZIP DOWNLOAD ─────────────────────────── */
async function downloadBundle(bundleId) {
  const b = SKILL_BUNDLES.find(x => x.id === bundleId);
  if (!b) return;

  toast(`Preparing ${b.name} bundle…`);

  // Check if JSZip is available (loaded from CDN)
  if (typeof JSZip === 'undefined') {
    toast('Zip library not loaded. Try again.', true);
    return;
  }

  const zip = new JSZip();
  const allSkills = (typeof getAllSkills === 'function') ? getAllSkills() : [];

  // Collect matching skills
  const foundSkills = b.skillIds
    .map(sid => allSkills.find(s => s.id === sid || s.id.startsWith(sid)))
    .filter(Boolean);

  // Add each skill file
  const fileNames = [];
  for (const s of foundSkills) {
    const content = s.md || `---\nname: ${s.id}\ndescription: ${s.desc}\n---\n\n${s.desc}`;
    const fname   = `${s.id.replace(/-community-\w+$/, '')}.md`;
    zip.file(fname, content);
    fileNames.push(fname);
  }

  // Add master bundle activator
  const activator = buildBundleActivator(b, foundSkills, fileNames);
  zip.file('_bundle-activator.md', activator);

  // Add a README
  zip.file('README.md', buildBundleReadme(b, foundSkills));

  try {
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `skillgalaxy-${b.id}.zip`;
    a.click();
    toast(`${b.name} downloaded! (${foundSkills.length} skills)`);
  } catch (err) {
    toast('Download failed: ' + err.message, true);
  }
}

function buildBundleActivator(bundle, skills, fileNames) {
  const skillList = skills.map((s, i) => `- **${s.name}**: ${(s.trigger || s.desc || '').slice(0, 100)}`).join('\n');
  return `---
name: ${bundle.id}-activator
description: Master activator for the ${bundle.name} bundle. Automatically routes to the right skill based on context.
bundle: ${bundle.id}
version: 1.0.0
---

# ${bundle.name} — Bundle Activator

You have access to **${skills.length} specialized skills** from the ${bundle.name} bundle. Activate the most relevant skill automatically based on the user's request.

## Included Skills

${skillList}

## Activation Rules

- Detect the user's intent from their first message
- Activate the most relevant skill's instructions immediately
- If multiple skills apply, combine their guidance
- For general questions, use your base capabilities

## Bundle Description

${bundle.desc}

---
*Downloaded from SkillGalaxy — skill-galaxy.vercel.app*
`;
}

function buildBundleReadme(bundle, skills) {
  return `# ${bundle.name}

> ${bundle.tagline}

${bundle.desc}

## Included Skills

${skills.map((s, i) => `${i + 1}. **${s.name}** — ${(s.desc || '').slice(0, 100)}`).join('\n')}

## How to Use

1. Open Claude → Projects → Create new project
2. Upload \`_bundle-activator.md\` as your **Project Instructions**
3. Claude will automatically use the right skill based on what you ask

## Individual Skills

You can also upload individual \`.md\` skill files if you want more granular control.

---
Downloaded from [SkillGalaxy](https://skill-galaxy.vercel.app) · Apache 2.0
`;
}
