#!/usr/bin/env node

/**
 * SkillGalaxy MCP Server — Streamable HTTP Transport
 *
 * Run this instead of `index.js` when you need HTTP-based transport instead
 * of stdio. This is required for:
 *   - Remote MCP clients (not launched as a subprocess)
 *   - Web-based agents calling the server over HTTP
 *   - Multi-tenant deployments behind a load balancer
 *   - OAuth 2.1-protected access
 *
 * Usage:
 *   npm run start:http                      # localhost:3100
 *   PORT=8080 npm run start:http            # custom port
 *   MCP_API_KEY=secret npm run start:http   # enable bearer auth
 *
 * The server uses the MCP Streamable HTTP transport (SSE + POST), which is
 * the spec successor to the SSE-only transport.
 */

import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { CATEGORIES, SKILLS_DB } from "./skills-data.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";

// ── Config ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3100", 10);
const API_KEY = process.env.MCP_API_KEY || "";
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || "").split(",").filter(Boolean);

// ── Security helpers (shared with index.js) ──────────────────────────

const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /[;&|`$]|\bsudo\b|\brm\s+-rf\b/i,
];

function sanitiseInput(input) {
  if (typeof input !== "string") return input;
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(input)) throw new Error("Input contains sensitive or potentially dangerous content.");
  }
  return input;
}

function sanitiseParams(params) {
  for (const [, v] of Object.entries(params)) {
    if (typeof v === "string") sanitiseInput(v);
  }
  return params;
}

// ── Rate limiting ────────────────────────────────────────────────────

const rateLimiter = {
  calls: [],
  maxPerMinute: 120,
  check() {
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < 60000);
    if (this.calls.length >= this.maxPerMinute) {
      throw new Error(`Rate limit exceeded: ${this.maxPerMinute} calls/minute.`);
    }
    this.calls.push(now);
  },
};

// ── Audit logging ────────────────────────────────────────────────────

const auditLog = [];

function logAudit(tool, params, resultSize) {
  const entry = {
    timestamp: new Date().toISOString(),
    tool,
    params: Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, typeof v === "string" && v.length > 100 ? v.slice(0, 100) + "…" : v])
    ),
    resultSize,
  };
  auditLog.push(entry);
  if (auditLog.length > 1000) auditLog.shift();
  console.log(`[audit] ${entry.timestamp} ${tool}(${JSON.stringify(entry.params)})`);
}

// ── Helpers ──────────────────────────────────────────────────────────

function norm(s) { return (s || "").toLowerCase().trim(); }

function searchSkills(query, category, difficulty, limit) {
  const q = norm(query);
  let results = SKILLS_DB;
  if (category && category !== "all") results = results.filter((s) => s.cat === category);
  if (difficulty && difficulty !== "all") results = results.filter((s) => norm(s.difficulty) === norm(difficulty));
  if (q) {
    results = results.filter((s) => {
      const h = [s.name, s.desc, s.cat, ...(s.tags || []), ...(s.skills || []), ...(s.tools || [])].join(" ").toLowerCase();
      return h.includes(q);
    });
  }
  results.sort((a, b) => (b.d + b.i + b.f) - (a.d + a.i + a.f));
  return results.slice(0, limit);
}

function findRelatedSkills(skillId, limit = 5) {
  const skill = SKILLS_DB.find((s) => s.id === skillId);
  if (!skill) return [];
  const skillTags = new Set((skill.tags || []).map(norm));
  return SKILLS_DB
    .filter((s) => s.id !== skillId)
    .map((s) => { let sc = 0; if (s.cat === skill.cat) sc += 2; for (const t of s.tags || []) if (skillTags.has(norm(t))) sc += 1; return { ...s, relevance: sc }; })
    .filter((s) => s.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

// ── Code Mode API ────────────────────────────────────────────────────

const CODE_MODE_API = {
  search(query, options = {}) {
    return searchSkills(query || "", options.category, options.difficulty, options.limit || 20)
      .map((s) => ({ id: s.id, name: s.name, category: s.cat, difficulty: s.difficulty, scores: { demand: s.d, income: s.i, future: s.f }, tags: s.tags || [], description: s.desc, trigger: s.trigger }));
  },
  getSkill(id) {
    const s = SKILLS_DB.find((sk) => sk.id === id);
    if (!s) return null;
    return { id: s.id, name: s.name, category: s.cat, difficulty: s.difficulty, scores: { demand: s.d, income: s.i, future: s.f }, tags: s.tags || [], markdown: s.md, tools: s.tools || [], skills: s.skills || [] };
  },
  getSkills(ids) { return ids.map((id) => this.getSkill(id)).filter(Boolean); },
  categories() {
    const counts = {};
    for (const s of SKILLS_DB) counts[s.cat] = (counts[s.cat] || 0) + 1;
    return Object.entries(CATEGORIES).map(([key, val]) => ({ key, label: val.label, count: counts[key] || 0 }));
  },
  related(id, limit = 5) {
    return findRelatedSkills(id, limit).map((s) => ({ id: s.id, name: s.name, category: s.cat, relevance: s.relevance, description: s.desc }));
  },
  countBy(field) { const c = {}; for (const s of SKILLS_DB) { const v = s[field] || "unknown"; c[v] = (c[v] || 0) + 1; } return c; },
  query(filterFn, mapFn) { let r = SKILLS_DB; if (typeof filterFn === "function") r = r.filter(filterFn); if (typeof mapFn === "function") r = r.map(mapFn); return r; },
};

// ── File processor ───────────────────────────────────────────────────

async function processFile(filePath) {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);
  const ext = extname(absPath).toLowerCase();
  const stats = { path: absPath, extension: ext, sizeBytes: 0 };
  const buffer = readFileSync(absPath);
  stats.sizeBytes = buffer.length;
  if (buffer.length > 10 * 1024 * 1024) throw new Error("File exceeds 10MB limit.");

  switch (ext) {
    case ".pdf": {
      try { const pdfParse = (await import("pdf-parse")).default; const data = await pdfParse(buffer); return { ...stats, type: "pdf", pages: data.numpages, text: data.text.slice(0, 30000), metadata: data.info }; }
      catch { return { ...stats, type: "pdf", error: "pdf-parse not installed" }; }
    }
    case ".csv": case ".tsv": {
      const text = buffer.toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim());
      const delim = ext === ".tsv" ? "\t" : ",";
      const headers = lines[0]?.split(delim).map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1, 101).map((line) => { const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")); const obj = {}; headers.forEach((h, i) => { obj[h] = cells[i] || ""; }); return obj; });
      return { ...stats, type: "tabular", headers, totalRows: lines.length - 1, previewRows: rows.length, rows };
    }
    case ".xlsx": case ".xls": {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buffer);
        const sheets = {};
        for (const name of wb.SheetNames.slice(0, 5)) { const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }); const h = data[0] || []; const r = data.slice(1, 101).map((row) => { const obj = {}; h.forEach((hh, i) => { obj[hh] = row[i] ?? ""; }); return obj; }); sheets[name] = { headers: h, totalRows: data.length - 1, previewRows: r.length, rows: r }; }
        return { ...stats, type: "spreadsheet", sheetCount: wb.SheetNames.length, sheets };
      } catch { return { ...stats, type: "spreadsheet", error: "xlsx not installed" }; }
    }
    case ".png": case ".jpg": case ".jpeg": case ".gif": case ".webp": {
      const b64 = buffer.toString("base64");
      const mimes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
      return { ...stats, type: "image", mimeType: mimes[ext], base64: b64.length > 100000 ? b64.slice(0, 100000) + "..." : b64 };
    }
    case ".json": { const data = JSON.parse(buffer.toString("utf-8")); return { ...stats, type: "json", preview: JSON.stringify(data, null, 2).slice(0, 30000), isArray: Array.isArray(data), length: Array.isArray(data) ? data.length : null }; }
    case ".md": case ".txt": case ".log": case ".yaml": case ".yml": case ".xml": case ".html":
      return { ...stats, type: "text", content: buffer.toString("utf-8").slice(0, 30000) };
    default:
      return { ...stats, type: "unknown", error: `Unsupported file type: ${ext}` };
  }
}

// ── Build MCP server (same tools as index.js) ────────────────────────

function createMcpServer() {
  const server = new McpServer({ name: "skillgalaxy", version: "2.0.0" });

  // ── search_skills (L1) ─────────────────────────────────────────────
  server.tool(
    "search_skills",
    "Level 1 (Progressive Disclosure): Search skills returning ONLY metadata. Use get_skill for the full body.",
    {
      query: z.string().optional().describe("Search keyword"),
      category: z.string().optional().describe("Category key"),
      difficulty: z.string().optional().describe("beginner|intermediate|advanced|expert"),
      limit: z.number().optional().default(10).describe("Max results (default 10, max 50)"),
    },
    async ({ query, category, difficulty, limit }) => {
      rateLimiter.check();
      sanitiseParams({ query, category, difficulty });
      const cap = Math.min(limit || 10, 50);
      const results = searchSkills(query || "", category, difficulty, cap);
      logAudit("search_skills", { query, category, difficulty, limit: cap }, results.length);
      if (results.length === 0) return { content: [{ type: "text", text: "No skills found. Try broadening your search." }] };
      const lines = results.map((s, i) => {
        const cat = CATEGORIES[s.cat]?.label || s.cat;
        return `${i + 1}. **${s.name}** (id: \`${s.id}\`)\n   Category: ${cat} | Difficulty: ${s.difficulty} | Scores: D${s.d}/I${s.i}/F${s.f}\n   Trigger: ${s.trigger || s.desc}`;
      });
      return { content: [{ type: "text", text: `Found ${results.length} skill(s) (L1 metadata):\n\n${lines.join("\n\n")}` }] };
    }
  );

  // ── get_skill (L2) ─────────────────────────────────────────────────
  server.tool("get_skill", "Level 2: Load the full markdown body of a skill.",
    { skill_id: z.string().describe("Skill ID") },
    async ({ skill_id }) => {
      rateLimiter.check(); sanitiseInput(skill_id);
      const skill = SKILLS_DB.find((s) => s.id === skill_id);
      logAudit("get_skill", { skill_id }, skill ? skill.md?.length || 0 : 0);
      if (!skill) return { content: [{ type: "text", text: `Skill '${skill_id}' not found.` }], isError: true };
      return { content: [{ type: "text", text: skill.md }] };
    }
  );

  // ── get_skill_deep (L3) ────────────────────────────────────────────
  server.tool("get_skill_deep", "Level 3: Full body + related skills + cross-references.",
    { skill_id: z.string(), include_related: z.boolean().optional().default(true), related_limit: z.number().optional().default(5) },
    async ({ skill_id, include_related, related_limit }) => {
      rateLimiter.check(); sanitiseInput(skill_id);
      const skill = SKILLS_DB.find((s) => s.id === skill_id);
      logAudit("get_skill_deep", { skill_id }, 0);
      if (!skill) return { content: [{ type: "text", text: `Skill '${skill_id}' not found.` }], isError: true };
      const sections = [skill.md];
      if (include_related) {
        const related = findRelatedSkills(skill_id, related_limit);
        if (related.length > 0) {
          sections.push("\n\n---\n\n## Related Skills\n");
          for (const r of related) sections.push(`### ${r.name} (\`${r.id}\`)\nCategory: ${CATEGORIES[r.cat]?.label || r.cat} | Relevance: ${r.relevance}\n\n${r.desc}\n`);
        }
      }
      const crossRefs = SKILLS_DB.filter((s) => s.id !== skill_id && skill.md?.toLowerCase().includes(s.id)).slice(0, 10);
      if (crossRefs.length > 0) { sections.push("\n## Cross-Referenced Skills\n"); sections.push(crossRefs.map((s) => `- **${s.name}** (\`${s.id}\`): ${s.desc}`).join("\n")); }
      return { content: [{ type: "text", text: sections.join("\n") }] };
    }
  );

  // ── get_skill_summary ──────────────────────────────────────────────
  server.tool("get_skill_summary", "Structured summary without full markdown.",
    { skill_id: z.string() },
    async ({ skill_id }) => {
      rateLimiter.check(); sanitiseInput(skill_id);
      const s = SKILLS_DB.find((sk) => sk.id === skill_id);
      logAudit("get_skill_summary", { skill_id }, 0);
      if (!s) return { content: [{ type: "text", text: `Skill '${skill_id}' not found.` }], isError: true };
      const cat = CATEGORIES[s.cat]?.label || s.cat;
      const summary = [
        `# ${s.name}`, "", `| Field | Value |`, `|-------|-------|`,
        `| ID | \`${s.id}\` |`, `| Category | ${cat} |`, `| Difficulty | ${s.difficulty} |`,
        `| Time to Master | ${s.timeToMaster || "N/A"} |`,
        `| Demand | ${s.d}/10 |`, `| Income | ${s.i}/10 |`, `| Future | ${s.f}/10 |`,
        "", `## Description`, s.desc, "", `## When to Use`, s.trigger || "N/A",
        "", `## Core Skills`, ...(s.skills || []).map((sk) => `- ${sk}`),
        "", `## Tools & Frameworks`, ...(s.tools || []).map((t) => `- ${t}`),
        "", `## Tags`, (s.tags || []).join(", "),
      ];
      return { content: [{ type: "text", text: summary.join("\n") }] };
    }
  );

  // ── list_categories ────────────────────────────────────────────────
  server.tool("list_categories", "List all categories with skill counts.", {},
    async () => {
      rateLimiter.check(); logAudit("list_categories", {}, Object.keys(CATEGORIES).length);
      const counts = {}; for (const s of SKILLS_DB) counts[s.cat] = (counts[s.cat] || 0) + 1;
      const lines = Object.entries(CATEGORIES).map(([key, val]) => `- **${val.label}** (\`${key}\`) — ${counts[key] || 0} skills`);
      return { content: [{ type: "text", text: `SkillGalaxy: ${SKILLS_DB.length} skills, ${Object.keys(CATEGORIES).length} categories:\n\n${lines.join("\n")}` }] };
    }
  );

  // ── execute_skill_code (Code Mode) ─────────────────────────────────
  server.tool("execute_skill_code",
    `Code Mode: Execute JS server-side with api.* calls. Available: api.search(), api.getSkill(), api.getSkills(), api.categories(), api.related(), api.countBy(), api.query()`,
    { code: z.string().describe("JS code using api.* calls, must return a value") },
    async ({ code }) => {
      rateLimiter.check();
      const forbidden = [/\bimport\b/, /\brequire\b/, /\bprocess\b/, /\bglobal\b/, /\beval\b/, /\bFunction\b/, /\bfetch\b/, /\bXMLHttpRequest\b/, /\b__proto__\b/, /\bconstructor\b/, /\bprototype\b/];
      for (const p of forbidden) if (p.test(code)) return { content: [{ type: "text", text: `Code blocked: forbidden pattern (${p}).` }], isError: true };
      logAudit("execute_skill_code", { code: code.slice(0, 200) }, 0);
      try {
        const fn = new Function("api", `"use strict"; ${code}`);
        const result = fn(CODE_MODE_API);
        const output = JSON.stringify(result, null, 2);
        const truncated = output.length > 50000 ? output.slice(0, 50000) + `\n... (${output.length} chars total)` : output;
        return { content: [{ type: "text", text: truncated }] };
      } catch (err) { return { content: [{ type: "text", text: `Code error: ${err.message}` }], isError: true }; }
    }
  );

  // ── compose_skills ─────────────────────────────────────────────────
  server.tool("compose_skills", "Chain skills into a workflow with reflection.",
    {
      steps: z.array(z.object({
        skill_id: z.string(),
        action: z.enum(["summarise", "extract_tools", "extract_patterns", "compare", "custom"]),
        instruction: z.string().optional(),
        depends_on: z.array(z.number()).optional(),
      })),
      enable_reflection: z.boolean().optional().default(false),
    },
    async ({ steps, enable_reflection }) => {
      rateLimiter.check(); logAudit("compose_skills", { stepCount: steps.length }, 0);
      const outputs = []; const errors = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]; sanitiseInput(step.skill_id);
        const skill = SKILLS_DB.find((s) => s.id === step.skill_id);
        if (!skill) { errors.push(`Step ${i + 1}: '${step.skill_id}' not found.`); outputs.push(null); continue; }
        const md = skill.md || "";
        let result;
        switch (step.action) {
          case "summarise": result = { skill: skill.name, category: CATEGORIES[skill.cat]?.label || skill.cat, difficulty: skill.difficulty, description: skill.desc, trigger: skill.trigger, keySkills: (skill.skills || []).slice(0, 10), tools: (skill.tools || []).slice(0, 10), tags: skill.tags || [] }; break;
          case "extract_tools": { const m = md.match(/(?:tools?|frameworks?|libraries?|platforms?)[:\s]*([^\n]+)/gi) || []; result = { skill: skill.name, tools: skill.tools || [], mentionedInContent: m.slice(0, 20).map((x) => x.trim()) }; break; }
          case "extract_patterns": { const p = md.match(/#{2,3}\s+(.+)/g) || []; const cb = (md.match(/```(\w+)/g) || []).map((m) => m.replace("```", "")); result = { skill: skill.name, sections: p.map((x) => x.replace(/^#+\s*/, "")), languages: [...new Set(cb)] }; break; }
          case "compare": { const deps = (step.depends_on || []).map((idx) => outputs[idx]).filter(Boolean); result = { skill: skill.name, comparedWith: deps.map((d) => d.skill || "prev"), difficulty: skill.difficulty, tools: skill.tools || [], sharedTags: deps.length > 0 ? (skill.tags || []).filter((t) => deps.some((d) => (d.tags || []).includes(t))) : [] }; break; }
          case "custom": result = { skill: skill.name, id: skill.id, instruction: step.instruction || "N/A", category: skill.cat, difficulty: skill.difficulty, description: skill.desc, markdownLength: md.length, sections: (md.match(/#{2,3}\s+(.+)/g) || []).map((p) => p.replace(/^#+\s*/, "")), tools: skill.tools || [], tags: skill.tags || [] }; break;
        }
        outputs.push(result);
      }
      const sections = [`# Workflow Results (${steps.length} steps)\n`];
      for (let i = 0; i < outputs.length; i++) {
        sections.push(`## Step ${i + 1}: ${steps[i].action} → \`${steps[i].skill_id}\``);
        if (outputs[i]) sections.push("```json\n" + JSON.stringify(outputs[i], null, 2) + "\n```");
        else sections.push(`⚠️ ${errors.find((e) => e.startsWith(`Step ${i + 1}`)) || "Error"}`);
      }
      if (enable_reflection) {
        const ok = outputs.filter(Boolean).length;
        const allTools = outputs.filter(Boolean).flatMap((o) => o.tools || []);
        const tf = {}; for (const t of allTools) tf[t] = (tf[t] || 0) + 1;
        sections.push("\n## 🔍 Reflection\n", `- Success: ${ok}/${steps.length}`, `- Top tools: ${Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t}(${c})`).join(", ") || "N/A"}`, `- Errors: ${errors.length > 0 ? errors.join("; ") : "None"}`);
      }
      return { content: [{ type: "text", text: sections.join("\n") }] };
    }
  );

  // ── generate_visual ────────────────────────────────────────────────
  server.tool("generate_visual", "Generate Mermaid diagrams, comparison tables, learning paths, dashboards.",
    {
      type: z.enum(["skill_map", "comparison_table", "learning_path", "category_dashboard", "dependency_graph"]),
      params: z.object({ category: z.string().optional(), skill_ids: z.array(z.string()).optional(), limit: z.number().optional().default(15) }),
    },
    async ({ type, params }) => {
      rateLimiter.check(); logAudit("generate_visual", { type }, 0);
      // Import the same visualization logic via closures
      switch (type) {
        case "skill_map": {
          const cat = params.category || "ai";
          const skills = SKILLS_DB.filter((s) => s.cat === cat).slice(0, params.limit || 15);
          const catLabel = CATEGORIES[cat]?.label || cat;
          const lines = ["```mermaid", "mindmap", `  root((${catLabel}))`, ...skills.map((s) => `    ${s.name}`), "```", "", "| Skill | Difficulty | D | I | F |", "|-------|-----------|---|---|---|", ...skills.map((s) => `| ${s.name} | ${s.difficulty} | ${s.d} | ${s.i} | ${s.f} |`)];
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }
        case "comparison_table": {
          const ids = params.skill_ids || [];
          const skills = ids.map((id) => SKILLS_DB.find((s) => s.id === id)).filter(Boolean);
          if (!skills.length) return { content: [{ type: "text", text: "No valid skill IDs." }], isError: true };
          const h = ["Feature", ...skills.map((s) => s.name)];
          const rows = [["Difficulty", ...skills.map((s) => s.difficulty)], ["Category", ...skills.map((s) => CATEGORIES[s.cat]?.label || s.cat)], ["Demand", ...skills.map((s) => `${s.d}/10`)], ["Income", ...skills.map((s) => `${s.i}/10`)], ["Future", ...skills.map((s) => `${s.f}/10`)]];
          const table = [`| ${h.join(" | ")} |`, `| ${h.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
          return { content: [{ type: "text", text: `## Comparison\n\n${table.join("\n")}` }] };
        }
        case "learning_path": {
          const cat = params.category || "ai";
          const skills = SKILLS_DB.filter((s) => s.cat === cat);
          const catLabel = CATEGORIES[cat]?.label || cat;
          const levels = ["beginner", "intermediate", "advanced", "expert"];
          const byDiff = {}; for (const l of levels) byDiff[l] = skills.filter((s) => norm(s.difficulty) === l).slice(0, 4);
          const mermaid = ["```mermaid", `flowchart TD`];
          let nid = 0;
          const levelIds = {};
          for (const l of levels) { if (!byDiff[l].length) continue; levelIds[l] = []; for (const s of byDiff[l]) { const id = `N${nid++}`; levelIds[l].push(id); mermaid.push(`  ${id}["${s.name}"]`); } }
          const lvlOrder = levels.filter((l) => levelIds[l]);
          for (let i = 0; i < lvlOrder.length - 1; i++) { const f = levelIds[lvlOrder[i]]; const t = levelIds[lvlOrder[i + 1]]; if (f.length && t.length) mermaid.push(`  ${f[f.length - 1]} --> ${t[0]}`); }
          mermaid.push("```");
          mermaid.push(`\n### ${catLabel} Learning Path`);
          for (const l of levels) if (byDiff[l].length) mermaid.push(`**${l[0].toUpperCase() + l.slice(1)}:** ${byDiff[l].map((s) => s.name).join(", ")}`);
          return { content: [{ type: "text", text: mermaid.join("\n") }] };
        }
        case "category_dashboard": {
          const cat = params.category || "ai";
          const skills = SKILLS_DB.filter((s) => s.cat === cat);
          const catLabel = CATEGORIES[cat]?.label || cat;
          if (!skills.length) return { content: [{ type: "text", text: `No skills in '${cat}'.` }] };
          const avg = (arr, k) => (arr.reduce((s, x) => s + (x[k] || 0), 0) / arr.length).toFixed(1);
          const dc = {}; for (const s of skills) dc[s.difficulty] = (dc[s.difficulty] || 0) + 1;
          const topD = [...skills].sort((a, b) => b.d - a.d).slice(0, 5);
          const topF = [...skills].sort((a, b) => b.f - a.f).slice(0, 5);
          const d = [`# ${catLabel} Dashboard`, "", "| Metric | Value |", "|--------|-------|", `| Total | ${skills.length} |`, `| Avg Demand | ${avg(skills, "d")} |`, `| Avg Income | ${avg(skills, "i")} |`, `| Avg Future | ${avg(skills, "f")} |`, "", "## Difficulty", ...Object.entries(dc).map(([k, c]) => `- **${k}:** ${c} (${(c / skills.length * 100).toFixed(0)}%)`), "", "## Top by Demand", ...topD.map((s, i) => `${i + 1}. ${s.name} — D${s.d}`), "", "## Top by Future", ...topF.map((s, i) => `${i + 1}. ${s.name} — F${s.f}`)];
          return { content: [{ type: "text", text: d.join("\n") }] };
        }
        case "dependency_graph": {
          const ids = params.skill_ids || [];
          let skills = ids.length > 0 ? ids.map((id) => SKILLS_DB.find((s) => s.id === id)).filter(Boolean) : SKILLS_DB.filter((s) => s.cat === (params.category || "ai")).slice(0, params.limit || 10);
          if (!skills.length) return { content: [{ type: "text", text: "No skills found." }], isError: true };
          const m = ["```mermaid", "graph LR"];
          for (const s of skills) { m.push(`  ${s.id}["${s.name.replace(/"/g, "'")}"]`); for (const o of skills) { if (o.id === s.id) continue; const shared = (s.tags || []).filter((t) => (o.tags || []).includes(t)); if (shared.length >= 2) m.push(`  ${s.id} --"${shared[0]}"--- ${o.id}`); } }
          m.push("```");
          return { content: [{ type: "text", text: m.join("\n") }] };
        }
        default: return { content: [{ type: "text", text: `Unknown type: ${type}` }], isError: true };
      }
    }
  );

  // ── ingest_file ────────────────────────────────────────────────────
  server.tool("ingest_file", "Process binary/structured files (PDF, CSV, XLSX, images, JSON, text). Max 10MB.",
    { file_path: z.string(), extract_only: z.enum(["text", "metadata", "rows", "all"]).optional().default("all") },
    async ({ file_path, extract_only }) => {
      rateLimiter.check(); sanitiseInput(file_path); logAudit("ingest_file", { file_path, extract_only }, 0);
      try {
        const result = await processFile(file_path);
        if (result.error) return { content: [{ type: "text", text: `Ingestion error: ${result.error}` }], isError: true };
        let output = result;
        if (extract_only === "text") output = { type: result.type, text: result.text || result.content || JSON.stringify(result.rows?.slice(0, 10)) || "No text content" };
        else if (extract_only === "metadata") { const { text, content, rows, sheets, base64, preview, ...meta } = result; output = meta; }
        else if (extract_only === "rows" && result.rows) output = { headers: result.headers, totalRows: result.totalRows, rows: result.rows };
        const text = JSON.stringify(output, null, 2);
        return { content: [{ type: "text", text: text.length > 50000 ? text.slice(0, 50000) + `\n... (${text.length} total)` : text }] };
      } catch (err) { return { content: [{ type: "text", text: `Ingestion failed: ${err.message}` }], isError: true }; }
    }
  );

  return server;
}

// ── Express app with security middleware ─────────────────────────────

const app = express();

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Bearer auth (optional — enabled when MCP_API_KEY is set)
if (API_KEY) {
  app.use("/mcp", (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token", error_description="Missing Authorization header"');
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const [type, token] = authHeader.split(" ");
    if (type?.toLowerCase() !== "bearer" || token !== API_KEY) {
      res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token", error_description="Invalid token"');
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    next();
  });
  console.log("🔒 Bearer auth enabled — set MCP_API_KEY env var");
}

// Session management: map sessionId → { transport, server }
const sessions = new Map();

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "2.0.0",
    skills: SKILLS_DB.length,
    categories: Object.keys(CATEGORIES).length,
    activeSessions: sessions.size,
    authEnabled: !!API_KEY,
  });
});

// Audit log endpoint
app.get("/audit", (_req, res) => {
  res.json({ entries: auditLog.slice(-100) });
});

// ── MCP endpoint ─────────────────────────────────────────────────────

async function handleMcpRequest(req, res) {
  const sessionId = req.headers["mcp-session-id"];

  // Existing session?
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — create transport + server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);

  // The transport assigns its sessionId after the first message is handled
  // We delegate immediately — the response headers will contain the session ID
  await transport.handleRequest(req, res, req.body);

  // After handling, the transport should now have its session ID
  const newId = transport.sessionId;
  if (newId) {
    sessions.set(newId, { transport, server: mcpServer });
    console.log(`[session] Created: ${newId} (${sessions.size} active)`);

    transport.onclose = () => {
      sessions.delete(newId);
      console.log(`[session] Closed: ${newId} (${sessions.size} active)`);
    };
  }
}

// Handle POST /mcp — client messages
app.post("/mcp", express.json(), async (req, res) => {
  try {
    await handleMcpRequest(req, res);
  } catch (err) {
    console.error("[mcp] Error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Handle GET /mcp — SSE stream for server-initiated messages
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) return res.status(400).json({ error: "No active session. POST /mcp first." });
  await session.transport.handleRequest(req, res);
});

// Handle DELETE /mcp — close a session
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) return res.status(404).json({ error: "Session not found." });
  await session.transport.close();
  sessions.delete(sessionId);
  console.log(`[session] Deleted: ${sessionId} (${sessions.size} active)`);
  res.json({ status: "session closed" });
});

// ── Start ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 SkillGalaxy MCP Server v2.0 — Streamable HTTP`);
  console.log(`   Endpoint:   http://localhost:${PORT}/mcp`);
  console.log(`   Health:     http://localhost:${PORT}/health`);
  console.log(`   Audit log:  http://localhost:${PORT}/audit`);
  console.log(`   Auth:       ${API_KEY ? "🔒 Bearer token required" : "🔓 Open (set MCP_API_KEY to enable)"}`);
  console.log(`   Skills:     ${SKILLS_DB.length} across ${Object.keys(CATEGORIES).length} categories`);
  console.log(`   Sessions:   Stateful (Mcp-Session-Id header)\n`);
});
