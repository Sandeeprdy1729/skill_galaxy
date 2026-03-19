-- ════════════════════════════════════════════════
-- SkillGalaxy — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text unique not null,
  username    text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. COMMUNITY SKILLS TABLE
create table if not exists public.community_skills (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  user_email    text not null,

  -- Core skill fields
  name          text not null,
  slug          text not null unique,   -- kebab-case id
  icon          text default '◈',
  cat           text not null default 'ai',
  difficulty    text not null default 'intermediate',
  time_to_master text default '',
  desc          text not null,
  trigger_text  text default '',
  tags          text[] default '{}',
  skills_list   text[] default '{}',
  tools_list    text[] default '{}',
  score_d       int default 7 check (score_d between 1 and 10),
  score_i       int default 7 check (score_i between 1 and 10),
  score_f       int default 7 check (score_f between 1 and 10),
  md_content    text not null,          -- full markdown file content

  -- Moderation
  status        text default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  validated_at  timestamptz,
  validated_by  uuid references auth.users(id),

  -- Meta
  downloads     int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index for fast queries
create index if not exists idx_community_skills_status on public.community_skills(status);
create index if not exists idx_community_skills_cat    on public.community_skills(cat);
create index if not exists idx_community_skills_user   on public.community_skills(user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.community_skills;
create trigger set_updated_at
  before update on public.community_skills
  for each row execute procedure public.update_updated_at();


-- 3. ROW LEVEL SECURITY (RLS)
alter table public.profiles         enable row level security;
alter table public.community_skills enable row level security;

-- Profiles: users see their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Community skills: ANYONE can read approved skills
create policy "Anyone can view approved skills"
  on public.community_skills for select
  using (status = 'approved');

-- Logged-in users can see their own pending/rejected skills
create policy "Users see own skills regardless of status"
  on public.community_skills for select
  using (auth.uid() = user_id);

-- Logged-in users can insert skills
create policy "Authenticated users can submit skills"
  on public.community_skills for insert
  with check (auth.uid() = user_id and auth.uid() is not null);

-- Users can update their own pending skills
create policy "Users can update own pending skills"
  on public.community_skills for update
  using (auth.uid() = user_id and status = 'pending');


-- 4. INCREMENT DOWNLOADS (callable from frontend)
create or replace function public.increment_downloads(skill_id uuid)
returns void as $$
begin
  update public.community_skills
  set downloads = downloads + 1
  where id = skill_id;
end;
$$ language plpgsql security definer;


-- 5. SAMPLE QUERY — verify setup works
select count(*) as total_skills from public.community_skills;
