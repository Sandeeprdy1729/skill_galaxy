# SkillGalaxy — Complete Setup Guide
## From zero to live in ~20 minutes

---

## WHY THIS UPGRADE EXISTS

The old site used `localStorage` — skills uploaded on one device
were trapped in that browser forever. Nobody else could see them.

This version uses **Supabase** as the real-time database backend.
When any user uploads a skill, it saves to Supabase, gets reviewed,
then appears **live on every device** within seconds.

---

## ARCHITECTURE

```
Browser (static files on Vercel)
    ↕ HTTPS
Supabase (PostgreSQL + Auth + Realtime)
    ├── auth.users          (email login)
    ├── profiles            (username, role)
    └── community_skills    (submitted skills)
```

No server code. No Node.js. No Docker. Fully serverless.

---

## STEP 1 — Create Supabase Project (free)

1. Go to **https://supabase.com** → Sign up (free)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `skillgalaxy`
   - **Database Password**: something strong (save it)
   - **Region**: pick closest to your users
4. Click **"Create new project"** — takes ~2 minutes

---

## STEP 2 — Run the Database Schema

1. In Supabase sidebar: **SQL Editor** → **New Query**
2. Open `SUPABASE_SETUP.sql` from this folder
3. **Paste the entire file** into the editor
4. Click **Run** (green button)
5. You should see: "Success. No rows returned"

---

## STEP 3 — Configure Authentication

In Supabase sidebar: **Authentication** → **Providers**

1. **Email** provider: should already be enabled ✅
2. Click **URL Configuration** tab
3. Set **Site URL**: `https://skill-galaxy.vercel.app`
4. Under **Redirect URLs**, add: `https://skill-galaxy.vercel.app/`
5. Click **Save**

Optional (for email confirmation):
- Authentication → Email Templates → customize if you want branded emails

---

## STEP 4 — Get Your API Keys

1. Supabase sidebar: **Settings** → **API**
2. Copy two values:
   - **Project URL**: looks like `https://abcdefgh.supabase.co`
   - **anon public** key: long JWT string starting with `eyJ...`

---

## STEP 5 — Add Keys to config.js

Open `js/config.js` and replace the placeholder values:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
```

Becomes (example):
```javascript
const SUPABASE_URL  = 'https://abcdefghijkl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**IMPORTANT**: The `anon` key is safe to expose in frontend code.
It has Row Level Security (RLS) protecting your data.
Never use the `service_role` key in frontend code.

---

## STEP 6 — Deploy to Vercel

### Option A: Vercel Dashboard (easiest)

1. Zip the entire `skillgalaxy/` folder
2. Go to **https://vercel.com** → **New Project**
3. Choose **"Upload"** tab
4. Drop the zip file
5. Click **Deploy**
6. Your site is live at `https://skillgalaxy-xxxx.vercel.app`

### Option B: GitHub + Vercel (recommended for updates)

```bash
# From the skillgalaxy/ folder:
git init
git add .
git commit -m "Initial deployment"
git remote add origin https://github.com/YOURNAME/skillgalaxy
git push -u origin main
```

Then in Vercel:
1. New Project → Import from GitHub
2. Select your repo
3. Deploy

Future updates: just `git push` — Vercel auto-deploys.

### Option C: Vercel CLI

```bash
npm install -g vercel
cd skillgalaxy/
vercel --prod
```

---

## STEP 7 — Set Custom Domain (optional)

If you want `skill-galaxy.vercel.app` to stay (it already works):
- Nothing needed — Vercel gives you this free subdomain

If you have a custom domain:
1. Vercel → your project → **Settings** → **Domains**
2. Add your domain, follow DNS instructions

---

## STEP 8 — Test Everything

1. **Open your live URL**
2. Click **"Sign In"** → Create an account → Check email for confirmation
3. Sign in
4. Click **"+ Submit Skill"**
5. Fill in the form → Submit
6. **Open Supabase → Table Editor → community_skills**
   - You should see your submission with `status: pending`

---

## STEP 9 — Approve Skills (Admin)

Skills start as `pending` — they need approval before going live.

### Quick approval in Supabase:
1. Supabase → **Table Editor** → `community_skills`
2. Find the row with your skill
3. Click the `status` cell → change to `approved`
4. Press Enter

The skill will appear **live on all browsers within seconds** (realtime subscription).

### To make yourself an admin:
1. Supabase → Table Editor → `profiles`
2. Find your row
3. Change `role` to `admin`

---

## HOW IT WORKS FOR USERS

```
User signs up → confirms email → signs in
    ↓
Uploads .md file OR fills form → validation runs
    ↓
Skill saved to Supabase with status: "pending"
    ↓
Admin approves in Supabase dashboard
    ↓
Realtime subscription fires → ALL browsers update instantly
    ↓
Skill appears in library for everyone worldwide
```

---

## VALIDATION RULES (automatic)

Skills are checked before saving:
- ✅ Name: 3-80 characters
- ✅ Description: 30-500 characters
- ✅ Markdown content: 100-20,000 characters
- ✅ Must start with `---` frontmatter
- ✅ Must contain `name:` field
- ✅ Must contain `description:` field
- ✅ No `<script>` tags or JavaScript injection
- ✅ Category must be valid
- ✅ Scores must be 1-10

---

## FILE STRUCTURE

```
skillgalaxy/
├── index.html              ← Main app (all HTML/modals)
├── css/
│   └── styles.css          ← All styles
├── js/
│   ├── config.js           ← ⚠️  PUT YOUR SUPABASE KEYS HERE
│   ├── db.js               ← Static skills database (109 skills)
│   ├── auth.js             ← Login/signup/session management
│   ├── skills-api.js       ← Supabase fetch/submit/upvote/download
│   └── app.js              ← UI rendering, modals, grid
├── SUPABASE_SETUP.sql      ← Run once in Supabase SQL Editor
└── SETUP_GUIDE.md          ← This file
```

---

## TROUBLESHOOTING

### "Skills not loading"
- Check browser console for errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON` in `config.js` are correct
- Check Supabase → Logs → API to see if requests are coming in

### "Submitted skill not appearing"
- Skills need approval: Supabase → community_skills → change status to `approved`
- Check RLS policies ran successfully in the SQL setup

### "Can't sign in"
- Check Authentication → URL Configuration has your site URL set
- Email confirmation may be required — check inbox/spam

### "Realtime not working"
- Verify you ran `alter publication supabase_realtime add table` in the SQL
- Check Supabase → Database → Replication

### CORS errors
- Supabase handles CORS automatically for `anon` key requests
- Make sure you're using the correct project URL

---

## SECURITY NOTES

- **Row Level Security (RLS)** is enabled on all tables
- Users can only edit/delete their OWN submissions
- `status` can only be changed by the database (admin does it directly)
- The `anon` key only has the permissions defined in RLS policies
- Skill content is sanitized: no scripts, no event handlers allowed
- All uploads are validated server-side by Supabase constraints

---

## QUESTIONS?

Open an issue on GitHub or reach out via the SkillGalaxy community.
