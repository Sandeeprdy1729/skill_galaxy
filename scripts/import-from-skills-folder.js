#!/usr/bin/env node
/**
 * import-from-skills-folder.js
 *
 * Reads every SKILL.md from the skills/ directory tree and generates
 * js/db.js (the single source of truth for the front-end).
 *
 * Usage:
 *   node scripts/import-from-skills-folder.js
 *
 * Folder layout expected:
 *   skills/<category>/<skill-id>/SKILL.md
 *
 * Each SKILL.md has YAML front-matter (--- delimited) and markdown body.
 */

const fs   = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
//  1. CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SKILLS_DIR  = path.resolve(__dirname, '..', 'skills');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'js', 'db.js');

/** Map skills/ subfolder names → CATEGORIES keys used in db.js */
const FOLDER_TO_CAT = {
  'ai-ml':       'ai',
  'bio':         'bio',
  'blockchain':  'blockchain',
  'business':    'business',
  'climate':     'climate',
  'cloud':       'cloud',
  'creative':    'creative',
  'data':        'data',
  'dev':         'dev',
  'education':   'education',
  'product':     'product',
  'quantum':     'quantum',
  'robotics':    'robotics',
  'security':    'security',
  'spatial':     'spatial',
  'writing':     'writing',
};

/** CATEGORIES definition — same as the current db.js. */
const CATEGORIES = {
  ai:        { label: 'AI & ML',              icon: '◎', dot: '#7c5cfc', tag: 'rgba(124,92,252,0.12)', tagText: '#6a4ee0' },
  security:  { label: 'Cybersecurity',        icon: '◬', dot: '#8a3a4e', tag: 'rgba(138,58,78,0.12)',  tagText: '#8a3a4e' },
  data:      { label: 'Data Engineering',     icon: '◷', dot: '#8a6a1a', tag: 'rgba(138,106,26,0.12)',tagText: '#8a6a1a' },
  cloud:     { label: 'Cloud & Infra',        icon: '◫', dot: '#3a5f8a', tag: 'rgba(58,95,138,0.12)', tagText: '#3a5f8a' },
  quantum:   { label: 'Quantum Computing',    icon: '◈', dot: '#5a3a8a', tag: 'rgba(90,58,138,0.12)', tagText: '#5a3a8a' },
  bio:       { label: 'Computational Bio',    icon: '◑', dot: '#5a7a5a', tag: 'rgba(90,122,90,0.12)', tagText: '#5a7a5a' },
  spatial:   { label: 'Spatial Computing',    icon: '◉', dot: '#3a7d6e', tag: 'rgba(58,125,110,0.12)',tagText: '#3a7d6e' },
  blockchain:{ label: 'Blockchain & Web3',    icon: '◐', dot: '#8a5a1a', tag: 'rgba(138,90,26,0.12)', tagText: '#8a5a1a' },
  robotics:  { label: 'Robotics & Automation',icon: '◍', dot: '#4a6a8a', tag: 'rgba(74,106,138,0.12)',tagText: '#4a6a8a' },
  climate:   { label: 'Climate Tech',         icon: '◌', dot: '#3a7a3a', tag: 'rgba(58,122,58,0.12)', tagText: '#3a7a3a' },
  product:   { label: 'Product & Strategy',   icon: '◻', dot: '#c07b4a', tag: 'rgba(192,123,74,0.12)',tagText: '#c07b4a' },
  creative:  { label: 'Creative Technology',  icon: '◪', dot: '#8a3a6a', tag: 'rgba(138,58,106,0.12)',tagText: '#8a3a6a' },
  dev:       { label: 'Development',          icon: '⬡', dot: '#3a7d6e', tag: 'rgba(58,125,110,0.12)',tagText: '#3a7d6e' },
  writing:   { label: 'Writing',              icon: '◧', dot: '#7a5a1a', tag: 'rgba(122,90,26,0.12)', tagText: '#7a5a1a' },
  business:  { label: 'Business',             icon: '◨', dot: '#1a5a7a', tag: 'rgba(26,90,122,0.12)', tagText: '#1a5a7a' },
  education: { label: 'Design & Education',   icon: '◦', dot: '#7a5a8a', tag: 'rgba(122,90,138,0.12)',tagText: '#7a5a8a' },
};

/** Category-level default icons (fallback when no tool icon matched). */
const CAT_ICONS = {};
for (const [k, v] of Object.entries(CATEGORIES)) {
  CAT_ICONS[k] = v.icon;
}

/**
 * Tool → SimpleIcons mapping.  Copied from generate-skills.js so
 * brand icons are assigned whenever we recognise a tool in the SKILL.md.
 */
const TOOL_ICONS = {
  // Languages
  'python':       { slug: 'python',        color: '#3776AB' },
  'javascript':   { slug: 'javascript',    color: '#F7DF1E' },
  'typescript':   { slug: 'typescript',    color: '#3178C6' },
  'rust':         { slug: 'rust',          color: '#000000' },
  'go':           { slug: 'go',            color: '#00ADD8' },
  'java':         { slug: 'java',          color: '#007396' },
  'kotlin':       { slug: 'kotlin',        color: '#7F52FF' },
  'swift':        { slug: 'swift',         color: '#F05138' },
  'ruby':         { slug: 'ruby',          color: '#CC342D' },
  'php':          { slug: 'php',           color: '#777BB4' },
  'c++':          { slug: 'cplusplus',     color: '#00599C' },
  'c#':           { slug: 'csharp',        color: '#239120' },
  'r':            { slug: 'r',             color: '#276DC3' },
  'julia':        { slug: 'julia',         color: '#9558B2' },
  'scala':        { slug: 'scala',         color: '#DC322F' },
  'elixir':       { slug: 'elixir',        color: '#4B275F' },
  'haskell':      { slug: 'haskell',       color: '#5D4F85' },
  'solidity':     { slug: 'solidity',      color: '#363636' },
  'dart':         { slug: 'dart',          color: '#0175C2' },
  'lua':          { slug: 'lua',           color: '#2C2D72' },
  'perl':         { slug: 'perl',          color: '#39457E' },
  'zig':          { slug: 'zig',           color: '#F7A41D' },
  // Frameworks – Frontend
  'react':        { slug: 'react',         color: '#61DAFB' },
  'vue':          { slug: 'vuedotjs',      color: '#4FC08D' },
  'vue.js':       { slug: 'vuedotjs',      color: '#4FC08D' },
  'angular':      { slug: 'angular',       color: '#DD0031' },
  'svelte':       { slug: 'svelte',        color: '#FF3E00' },
  'next.js':      { slug: 'nextdotjs',     color: '#000000' },
  'nextjs':       { slug: 'nextdotjs',     color: '#000000' },
  'nuxt':         { slug: 'nuxtdotjs',     color: '#00DC82' },
  'tailwind':     { slug: 'tailwindcss',   color: '#06B6D4' },
  'bootstrap':    { slug: 'bootstrap',     color: '#7952B3' },
  'sass':         { slug: 'sass',          color: '#CC6699' },
  // Frameworks – Backend
  'node.js':      { slug: 'nodedotjs',     color: '#339933' },
  'nodejs':       { slug: 'nodedotjs',     color: '#339933' },
  'express':      { slug: 'express',       color: '#000000' },
  'django':       { slug: 'django',        color: '#092E20' },
  'flask':        { slug: 'flask',         color: '#000000' },
  'fastapi':      { slug: 'fastapi',       color: '#009688' },
  'spring':       { slug: 'spring',        color: '#6DB33F' },
  'rails':        { slug: 'rubyonrails',   color: '#CC0000' },
  'laravel':      { slug: 'laravel',       color: '#FF2D20' },
  '.net':         { slug: 'dotnet',        color: '#512BD4' },
  // Mobile
  'flutter':      { slug: 'flutter',       color: '#02569B' },
  'react native': { slug: 'react',         color: '#61DAFB' },
  'android':      { slug: 'android',       color: '#3DDC84' },
  'ios':          { slug: 'apple',         color: '#000000' },
  // DevOps & Cloud
  'docker':       { slug: 'docker',        color: '#2496ED' },
  'kubernetes':   { slug: 'kubernetes',    color: '#326CE5' },
  'aws':          { slug: 'amazonaws',     color: '#232F3E' },
  'azure':        { slug: 'microsoftazure',color: '#0078D4' },
  'gcp':          { slug: 'googlecloud',   color: '#4285F4' },
  'google cloud': { slug: 'googlecloud',   color: '#4285F4' },
  'terraform':    { slug: 'terraform',     color: '#7B42BC' },
  'ansible':      { slug: 'ansible',       color: '#EE0000' },
  'jenkins':      { slug: 'jenkins',       color: '#D24939' },
  'github actions':{ slug: 'githubactions',color: '#2088FF' },
  'nginx':        { slug: 'nginx',         color: '#009639' },
  'linux':        { slug: 'linux',         color: '#FCC624' },
  'prometheus':   { slug: 'prometheus',    color: '#E6522C' },
  'grafana':      { slug: 'grafana',       color: '#F46800' },
  'vercel':       { slug: 'vercel',        color: '#000000' },
  // Databases
  'postgresql':   { slug: 'postgresql',    color: '#4169E1' },
  'postgres':     { slug: 'postgresql',    color: '#4169E1' },
  'mysql':        { slug: 'mysql',         color: '#4479A1' },
  'mongodb':      { slug: 'mongodb',       color: '#47A248' },
  'redis':        { slug: 'redis',         color: '#DC382D' },
  'sqlite':       { slug: 'sqlite',        color: '#003B57' },
  'elasticsearch':{ slug: 'elasticsearch', color: '#005571' },
  'neo4j':        { slug: 'neo4j',         color: '#4581C3' },
  'supabase':     { slug: 'supabase',      color: '#3FCF8E' },
  'firebase':     { slug: 'firebase',      color: '#FFCA28' },
  // Data & ML
  'tensorflow':   { slug: 'tensorflow',    color: '#FF6F00' },
  'pytorch':      { slug: 'pytorch',       color: '#EE4C2C' },
  'scikit-learn': { slug: 'scikitlearn',   color: '#F7931E' },
  'pandas':       { slug: 'pandas',        color: '#150458' },
  'numpy':        { slug: 'numpy',         color: '#013243' },
  'jupyter':      { slug: 'jupyter',       color: '#F37626' },
  'apache spark': { slug: 'apachespark',   color: '#E25A1C' },
  'spark':        { slug: 'apachespark',   color: '#E25A1C' },
  'apache kafka': { slug: 'apachekafka',   color: '#231F20' },
  'kafka':        { slug: 'apachekafka',   color: '#231F20' },
  'dbt':          { slug: 'dbt',           color: '#FF694B' },
  'snowflake':    { slug: 'snowflake',     color: '#29B5E8' },
  'airflow':      { slug: 'apacheairflow', color: '#017CEE' },
  'mlflow':       { slug: 'mlflow',        color: '#0194E2' },
  'huggingface':  { slug: 'huggingface',   color: '#FFD21E' },
  'opencv':       { slug: 'opencv',        color: '#5C3EE8' },
  'tableau':      { slug: 'tableau',       color: '#E97627' },
  // AI Services
  'openai':       { slug: 'openai',        color: '#412991' },
  'anthropic':    { slug: 'anthropic',     color: '#191919' },
  'langchain':    { slug: 'langchain',     color: '#1C3C3C' },
  // Testing
  'jest':         { slug: 'jest',          color: '#C21325' },
  'cypress':      { slug: 'cypress',       color: '#69D3A7' },
  'playwright':   { slug: 'playwright',    color: '#2EAD33' },
  'selenium':     { slug: 'selenium',      color: '#43B02A' },
  'pytest':       { slug: 'pytest',        color: '#0A9EDC' },
  // Build / Version Control
  'webpack':      { slug: 'webpack',       color: '#8DD6F9' },
  'vite':         { slug: 'vite',          color: '#646CFF' },
  'git':          { slug: 'git',           color: '#F05032' },
  'github':       { slug: 'github',        color: '#181717' },
  // Design
  'figma':        { slug: 'figma',         color: '#F24E1E' },
  'blender':      { slug: 'blender',       color: '#E87D0D' },
  'unity':        { slug: 'unity',         color: '#000000' },
  'unreal engine':{ slug: 'unrealengine',  color: '#0E1128' },
  // Security
  'wireshark':    { slug: 'wireshark',     color: '#1679A7' },
  // Blockchain
  'ethereum':     { slug: 'ethereum',      color: '#3C3C3D' },
  'solana':       { slug: 'solana',        color: '#9945FF' },
  // Misc
  'arduino':      { slug: 'arduino',       color: '#00979D' },
  'raspberry pi': { slug: 'raspberrypi',   color: '#A22846' },
  'ros':          { slug: 'ros',           color: '#22314E' },
  'qiskit':       { slug: 'qiskit',        color: '#6929C4' },
  'godot':        { slug: 'godotengine',   color: '#478CBF' },
  'three.js':     { slug: 'threedotjs',    color: '#000000' },
  'electron':     { slug: 'electron',      color: '#47848F' },
  'graphql':      { slug: 'graphql',       color: '#E10098' },
  'stripe':       { slug: 'stripe',        color: '#635BFF' },
  'shopify':      { slug: 'shopify',       color: '#7AB55C' },
  'wordpress':    { slug: 'wordpress',     color: '#21759B' },
};

// Sorted keys by length descending (prefer longer, more specific matches)
const SORTED_ICON_KEYS = Object.keys(TOOL_ICONS).sort((a, b) => b.length - a.length);

// ═══════════════════════════════════════════════════════════════
//  2. HELPERS
// ═══════════════════════════════════════════════════════════════

/** Parse YAML-ish front-matter from a SKILL.md string. */
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return { meta: {}, body: text };
  const yamlBlock = m[1];
  const body = text.slice(m[0].length).trim();
  const meta = {};
  for (const line of yamlBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Try to parse JSON arrays (tags field)
    if (val.startsWith('[')) {
      try { val = JSON.parse(val); } catch (_e) { /* keep as string */ }
    }
    meta[key] = val;
  }
  return { meta, body };
}

/** Convert kebab-case to Title Case */
function toTitleCase(str) {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    // Uppercase well-known abbreviations
    .replace(/\b(Ml|Ai|Api|Ci|Cd|Ui|Ux|Ar|Vr|Iot|Devops|Llm|Nlp|Sql|Nosql|Css|Html|Seo|Crm|Erp|Saas|Paas|Hpc|Grpc|Tcp|Ip|Dns|Cdn|Sdk|Jwt|Oauth|Sdlc|Siem|Xdr|Soar|Devsecops|Osint|Xss|Csrf|Aws|Gcp|Dbt|Gpu|Tpu|Fpga|Soc|Qa|Rag|Gan|Cnn|Rnn|Lstm|Bert|Gpt|Abac|Rbac)\b/gi,
      m => m.toUpperCase())
    // Fix numeric prefixes like "3d" → "3D"
    .replace(/\b(\d+)([a-z])\b/gi, (_, n, letter) => n + letter.toUpperCase());
}

/** Deterministic hash for varied but stable scores */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Map difficulty string to a base score multiplier */
function difficultyMultiplier(diff) {
  switch (diff) {
    case 'beginner':     return 0;
    case 'intermediate': return 1;
    case 'advanced':     return 2;
    case 'expert':       return 3;
    default:             return 1;
  }
}

/** Derive demand / income / future scores (1-10) deterministically. */
function deriveScores(id, cat, difficulty) {
  const h = hashCode(id);
  const dm = difficultyMultiplier(difficulty);
  // Base ranges per category (some categories naturally score higher)
  const catBase = {
    ai: 9, security: 8, data: 8, cloud: 8, quantum: 7,
    bio: 7, spatial: 7, blockchain: 6, robotics: 7, climate: 7,
    product: 7, creative: 6, dev: 8, writing: 6, business: 7, education: 6,
  };
  const base = catBase[cat] || 7;
  // Small deterministic jitter ±2
  const jitter = (n) => {
    const j = ((h + n) % 5) - 2; // yields -2..+2
    return Math.max(1, Math.min(10, base + dm + j));
  };
  return { d: jitter(0), i: jitter(17), f: jitter(37) };
}

/** Extract tools from the "Tools and Technologies" table in the markdown. */
function extractTools(body) {
  const tools = [];
  const tableRe = /\|\s*Tool\s*\|.*\n\|[-| ]+\n((?:\|.*\n)*)/i;
  const m = body.match(tableRe);
  if (m) {
    for (const row of m[1].trim().split('\n')) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols[0]) tools.push(cols[0]);
    }
  }
  return tools;
}

/** Extract skills from the "Skills Breakdown" table in the markdown. */
function extractSkills(body) {
  const skills = [];
  const tableRe = /\|\s*Skill\s*\|.*\n\|[-| ]+\n((?:\|.*\n)*)/i;
  const m = body.match(tableRe);
  if (m) {
    for (const row of m[1].trim().split('\n')) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols[0]) skills.push(cols[0]);
    }
  }
  return skills;
}

/** Extract a trigger sentence from "When to Use This Skill" section. */
function extractTrigger(body, name) {
  // Look for "### Trigger Phrases" or "## When to Use" bullet list
  const triggerSection = body.match(/##\s*When to Use.*?\n([\s\S]*?)(?=\n##\s|$)/i);
  if (triggerSection) {
    const bullets = triggerSection[1].match(/^[-*]\s+"?(.+?)"?\s*$/gm);
    if (bullets && bullets.length > 0) {
      const first = bullets[0].replace(/^[-*]\s+"?/, '').replace(/"?\s*$/, '');
      return `Use when you need to ${first.charAt(0).toLowerCase() + first.slice(1)}`;
    }
    // Fallback: collect all bullet items
    const items = triggerSection[1].match(/^[-*]\s+(.+)$/gm);
    if (items && items.length > 0) {
      const cleaned = items[0].replace(/^[-*]\s+/, '');
      return `Use when ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`;
    }
  }
  return `Use when ${name.toLowerCase()} knowledge is needed to solve technical challenges or build production systems.`;
}

/** Try to match a SimpleIcons brand icon from skill name, id, tags, and tools. */
function findIcon(id, name, tags, tools) {
  const nameLower = name.toLowerCase();
  const idNorm = id.replace(/[-_]/g, ' ');

  function wordMatch(text, key) {
    if (key.length < 2) return text === key;
    const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(text)) return true;
    if (text.startsWith(key) || text === key) return true;
    if (key.length >= 4 && text.includes(key)) return true;
    return false;
  }

  // 1. Match skill name
  for (const key of SORTED_ICON_KEYS) {
    if (wordMatch(nameLower, key)) return TOOL_ICONS[key];
  }
  // 2. Match skill id
  for (const key of SORTED_ICON_KEYS) {
    if (wordMatch(idNorm, key)) return TOOL_ICONS[key];
  }
  // 3. Match tools (exact)
  for (const t of tools) {
    const tl = t.toLowerCase();
    if (TOOL_ICONS[tl]) return TOOL_ICONS[tl];
  }
  // 4. Match tools (word boundary)
  for (const t of tools) {
    const tl = t.toLowerCase();
    for (const key of SORTED_ICON_KEYS) {
      if (key.length >= 3 && wordMatch(tl, key)) return TOOL_ICONS[key];
    }
  }
  // 5. Match tags (exact)
  for (const tag of tags) {
    const tl = tag.toLowerCase();
    if (TOOL_ICONS[tl]) return TOOL_ICONS[tl];
  }
  return null;
}

/** Escape a string for embedding in a JS template-literal (backtick string). */
function escBacktick(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/** Escape a string for a single-quoted JS literal. */
function escSingle(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ═══════════════════════════════════════════════════════════════
//  3. MAIN — scan, parse, generate
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('Scanning skills/ folder …');
  const allSkills = [];
  const catFolders = fs.readdirSync(SKILLS_DIR).filter(f => {
    const full = path.join(SKILLS_DIR, f);
    return fs.statSync(full).isDirectory() && FOLDER_TO_CAT[f];
  });

  for (const catFolder of catFolders) {
    const cat = FOLDER_TO_CAT[catFolder];
    const catPath = path.join(SKILLS_DIR, catFolder);
    const skillDirs = fs.readdirSync(catPath).filter(f =>
      fs.statSync(path.join(catPath, f)).isDirectory()
    );

    for (const skillDir of skillDirs) {
      const mdPath = path.join(catPath, skillDir, 'SKILL.md');
      if (!fs.existsSync(mdPath)) continue;

      const raw = fs.readFileSync(mdPath, 'utf-8');
      const { meta, body } = parseFrontmatter(raw);

      const id   = meta.name || skillDir;
      const name = toTitleCase(id);
      const desc = meta.description || `${name} skill.`;
      const difficulty = meta.difficulty || 'intermediate';
      const timeToMaster = meta.time_to_master || '3-6 months';
      const tags = Array.isArray(meta.tags)
        ? meta.tags
        : (typeof meta.tags === 'string' ? meta.tags.split(',').map(t => t.trim()) : []);

      const tools  = extractTools(body);
      const skills = extractSkills(body);
      const trigger = extractTrigger(body, name);

      const { d, i, f } = deriveScores(id, cat, difficulty);
      const iconMatch = findIcon(id, name, tags, tools);

      allSkills.push({
        id, name, cat, desc, difficulty, timeToMaster,
        tags, tools, skills, trigger, d, i, f,
        icon: iconMatch ? iconMatch.slug : null,
        iconType: iconMatch ? 'simpleicons' : null,
        brandColor: iconMatch ? iconMatch.color : null,
        catIcon: CAT_ICONS[cat],
        md: raw, // Full SKILL.md content as-is
      });
    }
  }

  // Deduplicate IDs: if the same id appears in multiple categories,
  // prefix with the category folder name to make it unique.
  const idCount = {};
  allSkills.forEach(s => { idCount[s.id] = (idCount[s.id] || 0) + 1; });
  const dupeIds = new Set(Object.keys(idCount).filter(k => idCount[k] > 1));
  if (dupeIds.size > 0) {
    console.log(`\nResolving ${dupeIds.size} duplicate IDs by prefixing with category …`);
    const allIds = new Set(allSkills.map(s => s.id));
    for (const s of allSkills) {
      if (dupeIds.has(s.id)) {
        let newId = `${s.cat}-${s.id}`;
        // If the prefixed id also collides, add a numeric suffix
        let suffix = 2;
        while (allIds.has(newId)) {
          newId = `${s.cat}-${s.id}-${suffix}`;
          suffix++;
        }
        allIds.add(newId);
        s.id = newId;
      }
    }
  }

  // Sort for deterministic output (by category then id)
  allSkills.sort((a, b) => a.cat.localeCompare(b.cat) || a.id.localeCompare(b.id));

  console.log(`Parsed ${allSkills.length} skills from ${catFolders.length} categories`);
  const catCount = {};
  allSkills.forEach(s => { catCount[s.cat] = (catCount[s.cat] || 0) + 1; });
  for (const [c, n] of Object.entries(catCount).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${CATEGORIES[c]?.label || c}: ${n}`);
  }
  const withIcons = allSkills.filter(s => s.iconType).length;
  console.log(`SimpleIcons assigned: ${withIcons}/${allSkills.length} (${Math.round(withIcons/allSkills.length*100)}%)`);

  // ── Write db.js ──────────────────────────────────────────────
  console.log(`\nWriting ${OUTPUT_PATH} …`);
  const out = fs.createWriteStream(OUTPUT_PATH);

  out.write(`/**
 * SkillVault — Skills Database
 * db.js
 *
 * Single source of truth for all skills.
 * Auto-generated by scripts/import-from-skills-folder.js — ${new Date().toISOString().slice(0,10)}
 * Total skills: ${allSkills.length}
 *
 * Schema:
 * {
 *   id:       string   — kebab-case unique identifier
 *   name:     string   — display name
 *   icon:     string   — single emoji OR simpleicons slug
 *   iconType: string   — 'simpleicons' if icon is a brand icon slug
 *   brandColor: string — hex color for simpleicons
 *   cat:      string   — category key (must exist in CATEGORIES)
 *   d:        number   — demand score  1-10
 *   i:        number   — income score  1-10
 *   f:        number   — future score  1-10
 *   difficulty: string — beginner | intermediate | advanced | expert
 *   timeToMaster: string — e.g. "3-6 months"
 *   tags:     string[] — searchable tags
 *   desc:     string   — short description (shown on card)
 *   trigger:  string   — when to use this skill
 *   skills:   string[] — atomic micro-skills
 *   tools:    string[] — essential tools/frameworks
 *   md:       string   — full markdown content of the skill file
 *   source:   string   — "official" | "community"
 * }
 */

`);

  // Categories
  out.write('const CATEGORIES = ');
  out.write(JSON.stringify(CATEGORIES, null, 2));
  out.write(';\n\n');

  // Skills array
  out.write(`/* ─────────────────────────────────────────────
   SKILLS DATABASE — ${allSkills.length} skills
   Generated from skills/ folder SKILL.md files
───────────────────────────────────────────── */\n`);
  out.write('const SKILLS_DB = [\n');

  for (let idx = 0; idx < allSkills.length; idx++) {
    const s = allSkills[idx];
    out.write('  {\n');

    // Core identity
    const iconPart = s.iconType
      ? `icon: '${escSingle(s.icon)}', iconType: '${s.iconType}', brandColor: '${s.brandColor}',`
      : `icon: '${escSingle(s.catIcon)}',`;
    out.write(`    id: '${escSingle(s.id)}', name: ${JSON.stringify(s.name)}, ${iconPart} cat: '${s.cat}',\n`);

    // Scores
    out.write(`    d: ${s.d}, i: ${s.i}, f: ${s.f}, difficulty: '${s.difficulty}', timeToMaster: '${escSingle(s.timeToMaster)}',\n`);

    // Tags
    const tagsStr = s.tags.map(t => `'${escSingle(String(t))}'`).join(',');
    out.write(`    tags: [${tagsStr}],\n`);

    // Desc & trigger
    out.write(`    desc: ${JSON.stringify(s.desc)},\n`);
    out.write(`    trigger: ${JSON.stringify(s.trigger)},\n`);

    // Skills & tools
    const skillsStr = s.skills.map(x => JSON.stringify(x)).join(', ');
    out.write(`    skills: [${skillsStr}],\n`);
    const toolsStr = s.tools.map(x => JSON.stringify(x)).join(', ');
    out.write(`    tools: [${toolsStr}],\n`);

    // Source
    out.write(`    source: 'official',\n`);

    // Markdown (full SKILL.md content)
    out.write(`    md: \`${escBacktick(s.md)}\`\n`);

    out.write(idx < allSkills.length - 1 ? '  },\n' : '  }\n');
  }

  out.write('];\n');
  out.end();

  out.on('finish', () => {
    const bytes = fs.statSync(OUTPUT_PATH).size;
    console.log(`✅ Wrote ${OUTPUT_PATH} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`   ${allSkills.length} skills across ${Object.keys(catCount).length} categories`);
  });
}

main();
