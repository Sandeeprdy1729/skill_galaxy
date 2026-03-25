#!/usr/bin/env node

/**
 * SkillGalaxy MCP Server
 *
 * Connects Claude to the SkillGalaxy skills library via the
 * Model Context Protocol. Add one entry to claude_desktop_config.json
 * and Claude gains access to 200+ curated .md skill files.
 *
 * Tools exposed:
 *   - search_skills     Search skills by keyword, tag, or category
 *   - get_skill         Get a full skill file (markdown) by ID
 *   - list_categories   List all available skill categories
 *   - get_skill_summary Get a compact summary of a skill (no markdown)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATEGORIES, SKILLS_DB } from "./skills-data.js";

// ── helpers ──────────────────────────────────────────────────────────

/** Normalise a string for case-insensitive comparison. */
function norm(s) {
  return (s || "").toLowerCase().trim();
}

/** Search skills by a text query (matches name, desc, tags, category). */
function searchSkills(query, category, difficulty, limit) {
  const q = norm(query);
  let results = SKILLS_DB;

  if (category && category !== "all") {
    results = results.filter((s) => s.cat === category);
  }
  if (difficulty && difficulty !== "all") {
    results = results.filter((s) => norm(s.difficulty) === norm(difficulty));
  }
  if (q) {
    results = results.filter((s) => {
      const haystack = [
        s.name,
        s.desc,
        s.cat,
        ...(s.tags || []),
        ...(s.skills || []),
        ...(s.tools || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  // Sort by combined score (demand + income + future) descending
  results.sort((a, b) => (b.d + b.i + b.f) - (a.d + a.i + a.f));
  return results.slice(0, limit);
}

// ── MCP server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "skillgalaxy",
  version: "1.0.0",
});

// ─── Tool: search_skills ─────────────────────────────────────────────

server.tool(
  "search_skills",
  "Search the SkillGalaxy library of curated skill files. Returns matching skills with name, category, difficulty, scores, and description. Use this to find relevant skills for a user's needs.",
  {
    query: z
      .string()
      .optional()
      .describe(
        "Search keyword (matches name, description, tags, tools). Leave empty to browse."
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Filter by category key: ai, security, data, cloud, quantum, bio, spatial, blockchain, robotics, climate, product, creative, dev, writing, business, education"
      ),
    difficulty: z
      .string()
      .optional()
      .describe("Filter by difficulty: beginner, intermediate, advanced, expert"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Max results to return (default 10, max 50)"),
  },
  async ({ query, category, difficulty, limit }) => {
    const cap = Math.min(limit || 10, 50);
    const results = searchSkills(query || "", category, difficulty, cap);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No skills found matching your criteria. Try broadening your search.",
          },
        ],
      };
    }

    const lines = results.map((s, i) => {
      const cat = CATEGORIES[s.cat]?.label || s.cat;
      return [
        `${i + 1}. **${s.name}** (id: \`${s.id}\`)`,
        `   Category: ${cat} | Difficulty: ${s.difficulty} | Scores: D${s.d}/I${s.i}/F${s.f}`,
        `   ${s.desc}`,
      ].join("\n");
    });

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} skill(s):\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

// ─── Tool: get_skill ─────────────────────────────────────────────────

server.tool(
  "get_skill",
  "Retrieve the full markdown content of a skill file by its ID. The markdown can be used directly as a Claude Project instruction file. Use search_skills first to find the skill ID.",
  {
    skill_id: z
      .string()
      .describe("The unique skill ID (e.g. 'llm-engineering', 'cloud-security-architecture')"),
  },
  async ({ skill_id }) => {
    const skill = SKILLS_DB.find((s) => s.id === skill_id);
    if (!skill) {
      return {
        content: [
          {
            type: "text",
            text: `Skill '${skill_id}' not found. Use search_skills to find valid skill IDs.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: skill.md,
        },
      ],
    };
  }
);

// ─── Tool: get_skill_summary ─────────────────────────────────────────

server.tool(
  "get_skill_summary",
  "Get a structured summary of a skill (metadata, tools, micro-skills) without the full markdown. Useful for quick overviews.",
  {
    skill_id: z
      .string()
      .describe("The unique skill ID"),
  },
  async ({ skill_id }) => {
    const s = SKILLS_DB.find((sk) => sk.id === skill_id);
    if (!s) {
      return {
        content: [
          {
            type: "text",
            text: `Skill '${skill_id}' not found. Use search_skills to find valid skill IDs.`,
          },
        ],
        isError: true,
      };
    }

    const cat = CATEGORIES[s.cat]?.label || s.cat;
    const summary = [
      `# ${s.name}`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| ID | \`${s.id}\` |`,
      `| Category | ${cat} |`,
      `| Difficulty | ${s.difficulty} |`,
      `| Time to Master | ${s.timeToMaster || "N/A"} |`,
      `| Demand Score | ${s.d}/10 |`,
      `| Income Score | ${s.i}/10 |`,
      `| Future Score | ${s.f}/10 |`,
      ``,
      `## Description`,
      s.desc,
      ``,
      `## When to Use`,
      s.trigger || "N/A",
      ``,
      `## Core Skills`,
      ...(s.skills || []).map((sk) => `- ${sk}`),
      ``,
      `## Tools & Frameworks`,
      ...(s.tools || []).map((t) => `- ${t}`),
      ``,
      `## Tags`,
      (s.tags || []).join(", "),
    ];

    return {
      content: [
        {
          type: "text",
          text: summary.join("\n"),
        },
      ],
    };
  }
);

// ─── Tool: list_categories ───────────────────────────────────────────

server.tool(
  "list_categories",
  "List all available skill categories in SkillGalaxy with the number of skills in each. Use this to understand what domains are covered.",
  {},
  async () => {
    const counts = {};
    for (const s of SKILLS_DB) {
      counts[s.cat] = (counts[s.cat] || 0) + 1;
    }

    const lines = Object.entries(CATEGORIES).map(([key, val]) => {
      return `- **${val.label}** (\`${key}\`) — ${counts[key] || 0} skills`;
    });

    return {
      content: [
        {
          type: "text",
          text: `SkillGalaxy has ${SKILLS_DB.length} skills across ${Object.keys(CATEGORIES).length} categories:\n\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ── Start server ─────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with the JSON-RPC stdio transport
  console.error("SkillGalaxy MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
