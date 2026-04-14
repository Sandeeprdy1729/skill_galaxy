/**
 * SkillGalaxy — config.js
 * ─────────────────────────────────────────────────────────────
 * SETUP: Replace these two values with your Supabase project.
 *
 * 1. Go to https://supabase.com → your project
 * 2. Settings → API
 * 3. Copy "Project URL" and "anon public" key below
 * ─────────────────────────────────────────────────────────────
 */
const SUPABASE_URL  = 'https://sfghavrkypxqvhzorlta.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZ2hhdnJreXB4cXZoem9ybHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODY5NTQsImV4cCI6MjA4OTQ2Mjk1NH0.bhONJ44nwG6loKF7eAnysB971_RgP0G_5q5KBiRGEuc';

/* Skill validation rules */
const VALIDATION = {
  nameMinLen:   3,
  nameMaxLen:   80,
  descMinLen:   30,
  descMaxLen:   500,
  mdMinLen:     100,
  mdMaxLen:     20000,
  maxTagCount:  10,
  allowedCats:  ['ai','security','data','cloud','quantum','bio','spatial','blockchain',
                 'robotics','climate','product','creative','dev','writing','business','education','others'],
  allowedDiffs: ['beginner','intermediate','advanced','expert'],
  forbiddenPatterns: [
    /<script/i,    // no script injection
    /javascript:/i,
    /on\w+\s*=/i,  // no inline event handlers
  ]
};

/* App site URL */
const SITE_URL = 'https://skill-galaxy.vercel.app';

/* Feature flags */
const FEATURES = {
  skillforge: true,
  skillforgeLattice: false,
  nexusRecommendations: true,
};
