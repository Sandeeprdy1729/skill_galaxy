# ✦ SkillGalaxy — Claude Skills Marketplace

> **The free, open marketplace of `.md` skill files for Claude Projects.**  
> Download once. Claude applies it automatically in every conversation. Forever.

[![Live Site](https://img.shields.io/badge/Live-skill--galaxy.vercel.app-black?style=flat-square)](https://skill-galaxy.vercel.app/)
[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-Launch%20Day-orange?style=flat-square)](https://www.producthunt.com/products/skillgalaxy-2?launch=skillgalaxy-2)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-109%2B-brightgreen?style=flat-square)](https://skill-galaxy.vercel.app/)
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
| 🧠 Skills | 109+ and growing |
| 🌐 Domains | 16 |
| 💰 Price | Free. Always. |
| 👥 Model | Community-built, reviewed within 24hrs |

---

## Domains Covered

`AI & ML` · `Cybersecurity` · `Data Engineering` · `Cloud & Infra` · `Quantum Computing` · `Computational Biology` · `Spatial Computing` · `Blockchain & Web3` · `Robotics & Automation` · `Climate Tech` · `Product & Strategy` · `Creative Technology` · `Development` · `Writing` · `Business` · `Design & Education`

---

## Project Structure

```
skill_galaxy/
├── index.html              # Main app shell
├── guide.html              # Skill creation guide
├── css/
│   └── styles.css          # All styles — Claude-inspired theme
├── js/
│   ├── db.js               # Skills database + Supabase community layer
│   └── app.js              # Frontend logic: render, filter, modals, download
├── SUPABASE_SETUP.sql      # Database schema for community skills
├── supabase-setup.sql      # Alternate setup script
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
---

## Skill Content

Your instructions for Claude go here.
```

**Attribution:** Your name + profile link appears on every skill card. Contributors retain full ownership — SkillGalaxy is a distribution platform, not a rights holder. You can remove your skill at any time.

---

## Adding Official Skills (via code)

Open `js/db.js` and push a new object into `SKILLS_DB`:

```js
{
  id: 'my-skill-name',           // kebab-case, unique
  name: 'My Skill Name',
  icon: '◎',                     // single character or emoji
  cat: 'ai',                     // must match a key in CATEGORIES
  d: 8,                          // demand score 1–10
  i: 8,                          // income score 1–10
  f: 9,                          // future score 1–10
  difficulty: 'intermediate',    // beginner | intermediate | advanced | expert
  timeToMaster: '3–6 months',
  tags: ['ai', 'my-tag'],
  desc: 'Short description shown on the card.',
  trigger: 'Use when…',
  skills: ['Skill 1', 'Skill 2'],
  tools: ['Tool A', 'Tool B'],
  source: 'official',
  md: `---\nname: my-skill-name\n---\n\nSkill content here.`
}
```

---

## Tech Stack

- **Frontend:** Pure HTML, CSS, JavaScript — no frameworks, no build tools
- **Backend:** [Supabase](https://supabase.com) (Postgres + REST API)
- **Hosting:** [Vercel](https://vercel.com)
- **Auth:** Supabase Auth (email + password)

---

## License

Apache 2.0 — free to use, fork, and modify with attribution.  
All skill files are free to use, share, and adapt.

---

## Built by Timps

[timps-website.vercel.app](https://timps-website.vercel.app/) · [Product Hunt](https://www.producthunt.com/products/skillgalaxy-2?launch=skillgalaxy-2)

If SkillGalaxy is useful to you, consider ⭐ starring the repo and upvoting on Product Hunt — it genuinely helps.