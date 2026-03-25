# ✦ SkillGalaxy — Claude Skills Marketplace

> **The free, open marketplace of `.md` skill files for Claude Projects.**  
> Download once. Claude applies it automatically in every conversation. Forever.

[![Live Site](https://img.shields.io/badge/Live-skill--galaxy.vercel.app-black?style=flat-square)](https://skill-galaxy.vercel.app/)
[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-Launch%20Day-orange?style=flat-square)](https://www.producthunt.com/products/skillgalaxy-2?launch=skillgalaxy-2)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-9%2C872%2B-brightgreen?style=flat-square)](https://skill-galaxy.vercel.app/)
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
| 🧠 Skills | 9,872+ and growing |
| 🌐 Domains | 16 |
| 💰 Price | Free. Always. |
| 👥 Model | Community-built, reviewed within 24hrs |

---

## Domains Covered

`AI & ML` · `Cybersecurity` · `Data Engineering` · `Cloud & Infra` · `Quantum Computing` · `Computational Biology` · `Spatial Computing` · `Blockchain & Web3` · `Robotics & Automation` · `Climate Tech` · `Product & Strategy` · `Creative Technology` · `Development` · `Writing` · `Business` · `Design & Education`

---

## ✨ What's New

### ⭐ Skill Ratings & Reviews
Every skill now has a 1–5 star rating widget. Open any skill → scroll to **Rate this Skill** → leave a rating and optional review. Average scores and recent reviews load dynamically from Supabase.

### 🤖 AI-Powered Skill Validator
Community submissions are automatically scored by Claude (claude-haiku) on submit. Skills receive a quality score (1–10) with actionable feedback. Requires `ANTHROPIC_API_KEY` in your Vercel environment — see [AI Validator Setup](#ai-validator-setup).

### 🔌 One-Click "Connect Claude Desktop" Button
Click **🔌 Connect Claude Desktop** in the hero to get a ready-to-copy `claude_desktop_config.json` snippet that wires the SkillGalaxy MCP server directly into Claude Desktop.

### 📌 Skill Versioning
Skills now carry a `version` (semver) and `changelog` field. Contributors can bump the version when they update a skill — users see **"Updated X days ago"** and the version in the skill detail modal.

---

## 🔌 MCP Server — One-Toggle Claude Connection

**NEW:** Connect Claude directly to the entire SkillGalaxy library via [Model Context Protocol](https://modelcontextprotocol.io/). No manual downloads needed.

```bash
cd mcp-server && npm install && npm run build-skills
```

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

Restart Claude Desktop — done. Claude can now search, browse, and retrieve all 9,872+ skills on demand.

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
│   └── validate-skill.js   # Vercel serverless AI validator (Anthropic API)
├── mcp-server/             # MCP server for Claude Desktop integration
│   ├── index.js            # MCP server (4 tools: search, get, summary, categories)
│   ├── skills-data.js      # Auto-generated skills module
│   └── README.md           # MCP setup instructions
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