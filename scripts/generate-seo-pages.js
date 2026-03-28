#!/usr/bin/env node
/**
 * generate-seo-pages.js
 *
 * Generates individual SEO-optimized HTML pages for each skill.
 * Each page is a standalone file at /skills/<skill-id>.html
 * with proper meta tags, structured data, and content.
 *
 * Usage:
 *   node scripts/generate-seo-pages.js            # generates all pages
 *   node scripts/generate-seo-pages.js --limit 50  # generates first 50 for testing
 *
 * Output: skill-pages/<skill-id>.html files
 * Deploy: These are static files served by Vercel.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── Load SKILLS_DB from db.js ───────────────────────
const dbPath = path.resolve(__dirname, '..', 'js', 'db.js');
let src = fs.readFileSync(dbPath, 'utf-8');
src = src.replace(/^const /gm, 'var ');
const sandbox = {};
vm.runInNewContext(src, sandbox);
const CATEGORIES = sandbox.CATEGORIES;
const SKILLS_DB = sandbox.SKILLS_DB;

const limit = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10) || 50
  : SKILLS_DB.length;

const outDir = path.resolve(__dirname, '..', 'skill-pages');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating SEO pages for ${Math.min(limit, SKILLS_DB.length)} skills…`);

// ── HTML escape ─────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Convert markdown to basic HTML (lightweight) ────
function mdToHtml(md) {
  if (!md) return '';
  return md
    // Remove YAML frontmatter
    .replace(/^---[\s\S]*?---\s*/, '')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Tables (basic)
    .replace(/\|[-| ]+\|/g, '')
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split('|').map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hluoptd])((?!<).+)$/gm, '<p>$1</p>')
    // Wrap consecutive li in ul
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>')
    // Wrap consecutive tr in table
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, '<table class="seo-table">$&</table>')
    // Line breaks
    .replace(/\n{2,}/g, '\n');
}

// ── Generate page ───────────────────────────────────
function generatePage(skill) {
  const cat = CATEGORIES[skill.cat] || { label: skill.cat, dot: '#999' };
  const title = `${skill.name} — SkillGalaxy`;
  const desc = (skill.desc || '').slice(0, 160);
  const tags = Array.isArray(skill.tags) ? skill.tags : [];
  const difficulty = skill.difficulty || 'intermediate';
  const timeToMaster = skill.timeToMaster || '';
  const bodyHtml = mdToHtml(skill.md || '');

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: skill.name,
    description: desc,
    provider: {
      '@type': 'Organization',
      name: 'SkillGalaxy',
      url: 'https://skill-galaxy.vercel.app',
    },
    educationalLevel: difficulty,
    isAccessibleForFree: true,
    inLanguage: 'en',
    about: cat.label,
    keywords: tags.join(', '),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="${esc(tags.join(', '))}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://skill-galaxy.vercel.app/skill-pages/${esc(skill.id)}.html">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <link rel="canonical" href="https://skill-galaxy.vercel.app/skill-pages/${esc(skill.id)}.html">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#f9f7f4;color:#1a1814;line-height:1.7}
    .seo-container{max-width:780px;margin:0 auto;padding:32px 24px}
    .seo-nav{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #e0d9cf;margin-bottom:28px}
    .seo-nav a{color:#5c564e;text-decoration:none;font-size:.78rem}
    .seo-nav a:hover{color:#1a1814}
    .seo-breadcrumb{font-size:.72rem;color:#9c9389}
    .seo-breadcrumb a{color:#c07b4a;text-decoration:none}
    .seo-breadcrumb a:hover{text-decoration:underline}
    .seo-header{margin-bottom:28px}
    .seo-title{font-family:'Newsreader',Georgia,serif;font-size:2rem;font-weight:400;margin-bottom:8px;letter-spacing:-.5px}
    .seo-desc{font-size:.88rem;color:#5c564e;line-height:1.7;margin-bottom:14px}
    .seo-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
    .seo-tag{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.68rem;font-weight:500}
    .seo-cat{background:${cat.tag || 'rgba(192,123,74,0.12)'};color:${cat.tagText || '#c07b4a'}}
    .seo-diff{background:#f0e4d8;color:#c07b4a}
    .seo-time{background:#d8ede9;color:#3a7d6e}
    .seo-tags{display:flex;flex-wrap:wrap;gap:4px}
    .seo-tags span{background:#ece7e0;color:#5c564e;padding:2px 8px;border-radius:8px;font-size:.66rem}
    .seo-content{font-size:.86rem;color:#1a1814;line-height:1.8}
    .seo-content h1,.seo-content h2,.seo-content h3,.seo-content h4{font-family:'Newsreader',Georgia,serif;font-weight:400;margin:24px 0 8px;color:#1a1814}
    .seo-content h1{font-size:1.6rem}.seo-content h2{font-size:1.3rem}.seo-content h3{font-size:1.1rem}
    .seo-content p{margin-bottom:10px}
    .seo-content ul{margin:8px 0 12px 20px}
    .seo-content li{margin-bottom:4px}
    .seo-content code{background:#ece7e0;padding:1px 5px;border-radius:4px;font-size:.82em}
    .seo-content pre{background:#1a1814;color:#f2ede6;padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0;font-size:.78rem;line-height:1.5}
    .seo-content pre code{background:none;padding:0;color:inherit}
    .seo-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.78rem}
    .seo-table td{padding:6px 10px;border-bottom:1px solid #e0d9cf}
    .seo-cta{margin-top:32px;padding:20px;background:linear-gradient(135deg,#f2ede6,#fefcfa);border:1px solid #e0d9cf;border-radius:12px;text-align:center}
    .seo-cta h3{font-family:'Newsreader',Georgia,serif;font-size:1.1rem;font-weight:400;margin-bottom:6px}
    .seo-cta p{font-size:.8rem;color:#5c564e;margin-bottom:12px}
    .seo-cta a{display:inline-block;padding:10px 24px;background:#1a1814;color:#f9f7f4;border-radius:8px;text-decoration:none;font-size:.82rem;font-weight:600}
    .seo-cta a:hover{background:#2d2a25}
    .seo-footer{text-align:center;padding:24px;font-size:.72rem;color:#9c9389;border-top:1px solid #e0d9cf;margin-top:32px}
    .seo-footer a{color:#c07b4a;text-decoration:none}
    .seo-scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
    .seo-score{background:#fefcfa;border:1px solid #ece7e0;border-radius:8px;padding:10px;text-align:center}
    .seo-score-val{font-family:'Newsreader',serif;font-size:1.4rem;color:#c07b4a}
    .seo-score-lbl{font-size:.62rem;color:#9c9389;text-transform:uppercase;letter-spacing:.5px}
    @media(max-width:600px){.seo-container{padding:20px 16px}.seo-title{font-size:1.5rem}}
  </style>
</head>
<body>
  <div class="seo-container">
    <nav class="seo-nav">
      <a href="../index.html">← SkillGalaxy</a>
      <span style="color:#e0d9cf">|</span>
      <span class="seo-breadcrumb"><a href="../index.html">Home</a> / <a href="../index.html#${esc(skill.cat)}">${esc(cat.label)}</a> / ${esc(skill.name)}</span>
    </nav>

    <header class="seo-header">
      <h1 class="seo-title">${esc(skill.name)}</h1>
      <p class="seo-desc">${esc(desc)}</p>
      <div class="seo-meta">
        <span class="seo-tag seo-cat">${esc(cat.label)}</span>
        <span class="seo-tag seo-diff">${esc(difficulty)}</span>
        ${timeToMaster ? `<span class="seo-tag seo-time">⏱ ${esc(timeToMaster)}</span>` : ''}
      </div>
      ${tags.length > 0 ? `<div class="seo-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}

      <div class="seo-scores">
        <div class="seo-score"><div class="seo-score-val">${skill.d || '—'}</div><div class="seo-score-lbl">Demand</div></div>
        <div class="seo-score"><div class="seo-score-val">${skill.i || '—'}</div><div class="seo-score-lbl">Income</div></div>
        <div class="seo-score"><div class="seo-score-val">${skill.f || '—'}</div><div class="seo-score-lbl">Future</div></div>
      </div>
    </header>

    <article class="seo-content">
      ${bodyHtml}
    </article>

    <div class="seo-cta">
      <h3>Use this skill with Claude</h3>
      <p>Download the .md file and add it to your Claude Project for instant expertise.</p>
      <a href="../index.html">Browse all ${SKILLS_DB.length.toLocaleString()}+ skills on SkillGalaxy →</a>
    </div>

    <footer class="seo-footer">
      <a href="../index.html">SkillGalaxy</a> — ${SKILLS_DB.length.toLocaleString()}+ free AI skills ·
      <a href="https://github.com/Sandeeprdy1729/skill_galaxy">⭐ Star on GitHub</a>
    </footer>
  </div>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────
const skills = SKILLS_DB.slice(0, limit);
let written = 0;

for (const skill of skills) {
  try {
    const html = generatePage(skill);
    const filePath = path.join(outDir, `${skill.id}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');
    written++;
    if (written % 1000 === 0) console.log(`  ${written}/${skills.length} pages…`);
  } catch (err) {
    console.error(`  Error generating ${skill.id}: ${err.message}`);
  }
}

console.log(`✅ Generated ${written} SEO pages in ${outDir}/`);
console.log(`   Total size: ${(fs.readdirSync(outDir).reduce((acc, f) => acc + fs.statSync(path.join(outDir, f)).size, 0) / 1024 / 1024).toFixed(1)} MB`);

// Generate sitemap
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemapindex.org/schemas/sitemap/0.9">
  <url><loc>https://skill-galaxy.vercel.app/</loc><priority>1.0</priority></url>
  <url><loc>https://skill-galaxy.vercel.app/dashboard.html</loc><priority>0.7</priority></url>
  <url><loc>https://skill-galaxy.vercel.app/guide.html</loc><priority>0.6</priority></url>
${skills.map(s => `  <url><loc>https://skill-galaxy.vercel.app/skill-pages/${s.id}.html</loc><priority>0.5</priority></url>`).join('\n')}
</urlset>`;

const sitemapPath = path.resolve(__dirname, '..', 'sitemap.xml');
fs.writeFileSync(sitemapPath, sitemap, 'utf-8');
console.log(`✅ Generated sitemap.xml (${skills.length + 3} URLs)`);
