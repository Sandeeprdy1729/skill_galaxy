/**
 * Convert the browser-based db.js into an ES module for the MCP server.
 * 
 * Usage: node scripts/convert-skills.js
 * 
 * Reads ../js/db.js (which defines `const CATEGORIES` and `const SKILLS_DB`)
 * and writes skills-data.js as an ES module with `export { CATEGORIES, SKILLS_DB }`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '../../js/db.js');
const outPath = resolve(__dirname, '../skills-data.js');

const src = readFileSync(dbPath, 'utf-8');

// Wrap the browser globals in an ES module
const moduleCode = `// Auto-generated from js/db.js — do not edit manually.
// Run: npm run build-skills
${src}

export { CATEGORIES, SKILLS_DB };
`;

writeFileSync(outPath, moduleCode, 'utf-8');
console.log(`✅ Wrote ${outPath} (${(moduleCode.length / 1024).toFixed(0)} KB)`);
