# ✦ SkillGalaxy — Claude Skills Marketplace

> **The free, open marketplace of `.md` skill files for Claude Projects.**  
> Download once. Claude applies it automatically in every conversation. Forever.

[![Live Site](https://img.shields.io/badge/Live-skill--galaxy.vercel.app-black?style=flat-square)](https://skill-galaxy.vercel.app/)
[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-Launch%20Day-orange?style=flat-square)](https://www.producthunt.com/products/skillgalaxy-2?launch=skillgalaxy-2)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-10%2C171%2B-brightgreen?style=flat-square)](https://skill-galaxy.vercel.app/)
[![Built by Timps](https://img.shields.io/badge/Built%20by-Timps-purple?style=flat-square)](https://timps-website.vercel.app/)

---

## What is SkillGalaxy?

Every time you start a new Claude conversation, you re-explain the same instructions. Copy-paste. Again and again.

**SkillGalaxy fixes that.**

It's a community-powered library of `.md` skill files designed for **Claude Projects**. Add a skill once to your project instructions — Claude applies it automatically in every conversation from that point forward.

No repeated prompts. No wasted tokens. Just results.

---

## How It Works

```
1. Browse SkillGalaxy → find a skill
2. Click Download .md
3. Open Claude → go to a Project → paste into Project Instructions
4. Done. Claude applies the skill in every conversation automatically.
```

No account needed to download. No friction.

---

## Stats

| | |
|---|---|
|  Skills | 10,171+ and growing |
|  Domains | 16 |
|  Price | Free. Always. |
|  Model | Community-built, reviewed within 24hrs |

---

## Domains Covered

`AI & ML` · `Cybersecurity` · `Data Engineering` · `Cloud & Infra` · `Quantum Computing` · `Computational Biology` · `Spatial Computing` · `Blockchain & Web3` · `Robotics & Automation` · `Climate Tech` · `Product & Strategy` · `Creative Technology` · `Development` · `Writing` · `Business` · `Design & Education`

---

##  What's New

### 🔮 SkillForge — Dynamic Meta-Skill Composer & Token-Optimal Recommender
A new algorithmic recommendation engine that treats skills as composable primitives. Instead of naive top-k vector search, SkillForge uses a **greedy weighted set-cover** algorithm to find the smallest set of skills that covers your workflow with minimal token cost.

- **Token Savings:** 30–40% reduction on composite queries via shared-context meta-skill synthesis
- **Co-Usage Graph:** Builds a skill composition graph from usage traces to boost recommendations with real-world co-usage signals
- **Meta-Skill Synthesis:** Auto-generates composite `.skill.md` bundles combining multiple sub-skills with shared context
- **Pattern Detection:** Identifies recurring skill combinations from usage traces
- **No API Key Required:** Pure algorithmic — works without external AI services
- **MCP Integration:** New `forge_meta_skill` tool in the MCP server (10 tools total)

Access via: sidebar → **Forge Bundle**, or MCP tool `forge_meta_skill`.

###  Skill Ratings & Reviews
Every skill now has a 1–5 star rating widget. Open any skill → scroll to **Rate this Skill** → leave a rating and optional review. Average scores and recent reviews load dynamically from Supabase.

###  AI-Powered Skill Validator
Community submissions are automatically scored by Claude (claude-haiku) on submit. Skills receive a quality score (1–10) with actionable feedback. Requires `ANTHROPIC_API_KEY` in your Vercel environment — see [AI Validator Setup](#ai-validator-setup).

###  One-Click "Connect Claude Desktop" Button
Click ** Connect Claude Desktop** in the hero to get a ready-to-copy `claude_desktop_config.json` snippet that wires the SkillGalaxy MCP server directly into Claude Desktop.

###  Skill Versioning
Skills now carry a `version` (semver) and `changelog` field. Contributors can bump the version when they update a skill — users see **"Updated X days ago"** and the version in the skill detail modal.

---

##  MCP Server v2.0 — One-Toggle Claude Connection

Connect Claude directly to the entire SkillGalaxy library via [Model Context Protocol](https://modelcontextprotocol.io/). No manual downloads needed.

```bash
cd mcp-server && npm install && npm run build-skills
```

### Claude Desktop (stdio)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "skillgalaxy": {
      "command": "node",
      "args": ["/path/to/skill_galaxy/mcp-server/index.js"]
    }
  }
}
```

Restart Claude Desktop — done. Claude can now search, compose, visualise, and orchestrate all 10,171+ skills.

### Remote Clients (Streamable HTTP)

```bash
npm run start:http                          # http://localhost:3100/mcp
MCP_API_KEY=secret npm run start:http       # with bearer auth
```

### 10 Tools Available

| Tool | Description |
|------|-------------|
| `search_skills` | Search by keyword/category/difficulty (L1 metadata only) |
| `get_skill` | Load full markdown body (L2) |
| `get_skill_deep` | Full body + related skills + cross-references (L3) |
| `get_skill_summary` | Compact metadata table |
| `list_categories` | Browse all 16 categories |
| `execute_skill_code` | **Code Mode** — run JS pipelines server-side (~37% token savings) |
| `compose_skills` | Chain skills into workflows with reflection |
| `generate_visual` | Mermaid diagrams, comparison tables, dashboards |
| `ingest_file` | Process PDFs, CSVs, XLSX, images natively |
| `forge_meta_skill` | **SkillForge** — token-optimal recommender + meta-skill composer |

### v2.0 Features

- **Progressive Disclosure** — 3-level loading keeps context minimal
- **Code Mode** — orchestrate multiple tools in one call, reducing token usage
- **Composable Workflows** — chain skills with optional self-reflection
- **Generative UI** — Mermaid diagrams, learning paths, category dashboards
- **Security** — input sanitisation, rate limiting, audit logging
- **Binary Ingestion** — PDF, CSV, XLSX, image processing
- **Streamable HTTP** — remote access with bearer auth

👉 **[Full MCP setup guide →](mcp-server/README.md)**

---

## AI Validator Setup

The AI validator scores submitted skills automatically using Claude Haiku.

1. Get an [Anthropic API key](https://console.anthropic.com/)
2. In your Vercel project → Settings → Environment Variables → add:
   ```
   ANTHROPIC_API_KEY = sk-ant-...
   ```
3. Redeploy. Done. The `/api/validate-skill` endpoint becomes active.

Without the key the validator is silently skipped — submissions still work normally.

---

## Database Migrations

After cloning and running `supabase-setup.sql`, run the migration to enable ratings, reviews, and versioning:

```sql
-- In Supabase Dashboard → SQL Editor:
-- Run: supabase-migrations.sql
```

This adds:
- `skill_reviews` table (1 review per user per skill, star rating + text)
- `version` + `changelog` columns on both `skills` and `community_skills`
- `upsert_skill_review()`, `get_skill_reviews()`, `get_skill_rating()` RPC functions
- `skill_traces` table (usage trace logging for SkillForge graph)
- `skill_co_usage` materialised view (pairwise co-usage frequencies)
- `log_skill_trace()`, `get_co_used_skills()` RPC functions

---

## Project Structure

```
skill_galaxy/
├── index.html              # Main app shell
├── guide.html              # Skill creation guide
├── css/
│   └── styles.css          # All styles — Claude-inspired theme
├── js/
│   ├── config.js           # Supabase client config + environment setup
│   ├── db.js               # Skills database (208 hardcoded + 9,872 from Supabase)
│   ├── skills-api.js       # Supabase CRUD: community skills, ratings, reviews
│   ├── auth.js             # Supabase Auth (login, signup, session)
│   ├── app.js              # Frontend logic: render, filter, modals, download, ratings
│   └── icon_renderer.js    # Simple Icons + emoji icon rendering
├── api/
│   ├── validate-skill.js   # Vercel serverless AI validator (Anthropic API)
│   ├── recommend-skills.js # AI semantic skill search
│   ├── skillforge.js       # AI skill file generator
│   ├── skillforge-recommend.js # SkillForge token-optimal recommender
│   └── scan-skill.js       # Security scanner
├── lib/
│   └── skillforge-engine.js # SkillForge core: graph, set-cover, meta-skill synthesis
├── mcp-server/             # MCP server v2.1 for Claude integration
│   ├── index.js            # Stdio transport (10 tools, Code Mode, SkillForge)
│   ├── server-http.js      # Streamable HTTP transport (Express, bearer auth, sessions)
│   ├── skills-data.js      # Auto-generated skills module (10,171 skills)
│   └── README.md           # MCP v2.0 setup instructions
├── supabase-setup.sql      # Base database schema
├── supabase-migrations.sql # Ratings, reviews, versioning migration
├── SETUP_GUIDE.md          # Full local setup instructions
└── README.md
```

---

## Contributing a Skill

1. Go to [skill-galaxy.vercel.app](https://skill-galaxy.vercel.app/)
2. Sign in → click **Submit a Skill**
3. Fill in the form or upload a `.md` file following the [Skill Format Guide](https://skill-galaxy.vercel.app/guide.html)
4. Your skill goes live within **24 hours** after review

**Skill `.md` format (minimum required frontmatter):**

```markdown
---
name: my-skill-name
description: What this skill does and when Claude should apply it.
version: 1.0.0
---

## Skill Content

Your instructions for Claude go here.
```

**Attribution:** Your name + profile link appears on every skill card. Contributors retain full ownership — SkillGalaxy is a distribution platform, not a rights holder. You can remove your skill at any time.

---

## Tech Stack

- **Frontend:** Pure HTML, CSS, JavaScript — no frameworks, no build tools
- **Backend:** [Supabase](https://supabase.com) (Postgres + REST API + RLS)
- **Hosting:** [Vercel](https://vercel.com) (static files + serverless API routes)
- **Auth:** Supabase Auth (email + password)
- **AI:** Anthropic claude-haiku (optional skill validator)

---

## License

Apache 2.0 — free to use, fork, and modify with attribution.  
All skill files are free to use, share, and adapt.

---

## Built by Timps

[timps-website.vercel.app](https://timps-website.vercel.app/) · [Product Hunt](https://www.producthunt.com/products/skillgalaxy-2?launch=skillgalaxy-2)

If SkillGalaxy is useful to you, consider ⭐ starring the repo and upvoting on Product Hunt — it genuinely helps.
