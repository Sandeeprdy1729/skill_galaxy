# SkillVault — Claude Skills Marketplace

> The free, open library of expert skill files for Claude Projects.

## Project Structure

```
skillvault/
├── index.html          # Main HTML shell — markup only, no logic
├── css/
│   └── styles.css      # All styles — Claude-inspired warm theme
├── js/
│   ├── db.js           # Skills database + localStorage community layer
│   └── app.js          # All frontend logic (render, filter, modals, download)
└── README.md
```

## File Responsibilities

| File | Purpose |
|------|---------|
| `index.html` | DOM structure, semantic HTML, script/style links |
| `css/styles.css` | All visual styling, CSS variables, responsive rules |
| `js/db.js` | `SKILLS_DB` array, `CATEGORIES` map, `getCommunitySkills()`, `saveCommunitySkill()`, `getAllSkills()` |
| `js/app.js` | `renderGrid()`, `openDetail()`, `openSubmit()`, `handleFormSubmit()`, `handleFileUpload()`, search, filter, download, toast |

## Adding New Skills (Official)

Open `js/db.js` and push a new object into `SKILLS_DB`:

```js
{
  id: 'my-skill-name',           // kebab-case, unique
  name: 'My Skill Name',
  icon: '◎',                     // single character/emoji
  cat: 'ai',                     // must match a key in CATEGORIES
  d: 8,                          // demand score 1-10
  i: 8,                          // income score 1-10
  f: 9,                          // future score 1-10
  difficulty: 'intermediate',    // beginner | intermediate | advanced | expert
  timeToMaster: '3-6 months',
  tags: ['ai', 'my-tag'],
  desc: 'Short description shown on the card.',
  trigger: 'Use when…',
  skills: ['Skill 1', 'Skill 2'],
  tools: ['Tool A', 'Tool B'],
  source: 'official',
  md: `---\nname: my-skill-name\n---\n\nSkill content here.`
}
```

## Community Skills

Community-submitted skills are stored in **`localStorage`** under the key `sv_community`.
They persist across page loads for the same browser.

For a production backend, replace `getCommunitySkills()` / `saveCommunitySkill()` in `db.js`
with API calls to your database.

## Deploy on Netlify / Vercel (static)

```bash
# Drag and drop the skillvault/ folder to Netlify Drop
# https://app.netlify.com/drop

# Or via Vercel CLI
npx vercel skillvault/
```

No build step required. Pure HTML/CSS/JS — zero dependencies.

## Deploy on GitHub Pages

1. Push the `skillvault/` contents to a GitHub repository root
2. Settings → Pages → Branch: `main` → Save
3. Live at `https://<username>.github.io/<repo>/`

## Backend Integration (optional)

To persist community submissions across users, replace the localStorage layer in `db.js`:

```js
// db.js — replace getCommunitySkills with an API call
async function getCommunitySkills() {
  const res = await fetch('/api/skills/community');
  return res.json();
}

async function saveCommunitySkill(skill) {
  await fetch('/api/skills/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill)
  });
}
```

Recommended backend stack:
- **Supabase** (Postgres + REST API, free tier)
- **PlanetScale** (MySQL, free tier)
- **Firebase Firestore** (real-time, free tier)

## Skills Count

- 34 skills from the Master Pack (AI/ML, Cybersecurity, Data Engineering, Cloud & Infra,
  Quantum Computing, Computational Biology, Spatial Computing, Blockchain & Web3,
  Robotics & Automation, Climate Tech, Product & Strategy, Creative Technology)
- 20 original SkillVault skills (Development, Writing, Business, Education)
- **54 total official skills**
- Unlimited community-contributed skills via Submit form or .md upload

## License

All skill files are free to use, share, and modify.
