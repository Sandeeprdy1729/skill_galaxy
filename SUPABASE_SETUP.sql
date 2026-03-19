-- =====================================================
-- SkillGalaxy — Supabase Schema
-- Run this entire file in Supabase > SQL Editor > New Query
-- =====================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  username    text,
  avatar_url  text,
  role        text default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. COMMUNITY SKILLS TABLE
create table if not exists public.community_skills (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  user_email    text not null,
  username      text,

  -- Core skill fields (mirrors db.js schema)
  skill_id      text not null,           -- kebab-case identifier
  name          text not null,
  icon          text default '◈',
  cat           text not null,
  difficulty    text default 'intermediate' check (difficulty in ('beginner','intermediate','advanced','expert')),
  time_to_master text,
  demand_score  integer default 7 check (demand_score between 1 and 10),
  income_score  integer default 7 check (income_score between 1 and 10),
  future_score  integer default 7 check (future_score between 1 and 10),
  tags          text[],
  description   text not null,
  trigger_text  text,
  skills_list   text[],
  tools_list    text[],
  md_content    text not null,           -- full markdown content

  -- Moderation
  status        text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,

  -- Meta
  upvotes       integer default 0,
  downloads     integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Unique: one skill_id per user
create unique index if not exists community_skills_user_skill
  on public.community_skills(user_id, skill_id);

-- 3. UPVOTES TABLE (prevent double-voting)
create table if not exists public.skill_upvotes (
  id         uuid default gen_random_uuid() primary key,
  skill_id   uuid references public.community_skills(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(skill_id, user_id)
);

-- 4. DOWNLOAD LOG
create table if not exists public.skill_downloads (
  id         uuid default gen_random_uuid() primary key,
  skill_id   uuid references public.community_skills(id) on delete cascade,
  user_id    uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────

alter table public.profiles enable row level security;
alter table public.community_skills enable row level security;
alter table public.skill_upvotes enable row level security;
alter table public.skill_downloads enable row level security;

-- Profiles: users see their own; everyone sees public fields
create policy "profiles_select_own"  on public.profiles for select using (true);
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- Community skills: approved skills visible to all; pending only to owner
create policy "skills_select_approved"
  on public.community_skills for select
  using (status = 'approved' or auth.uid() = user_id);

create policy "skills_insert_own"
  on public.community_skills for insert
  with check (auth.uid() = user_id);

create policy "skills_update_own"
  on public.community_skills for update
  using (auth.uid() = user_id and status = 'pending');

create policy "skills_delete_own"
  on public.community_skills for delete
  using (auth.uid() = user_id);

-- Upvotes
create policy "upvotes_select_all"   on public.skill_upvotes for select using (true);
create policy "upvotes_insert_own"   on public.skill_upvotes for insert with check (auth.uid() = user_id);
create policy "upvotes_delete_own"   on public.skill_upvotes for delete using (auth.uid() = user_id);

-- Downloads: anyone can log
create policy "downloads_insert_all" on public.skill_downloads for insert with check (true);

-- ── FUNCTIONS ────────────────────────────────────

-- Increment download count
create or replace function increment_downloads(p_skill_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.community_skills
  set downloads = downloads + 1
  where id = p_skill_id;
end;
$$;

-- Toggle upvote (returns new count)
create or replace function toggle_upvote(p_skill_id uuid)
returns integer language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  select exists(
    select 1 from public.skill_upvotes
    where skill_id = p_skill_id and user_id = v_user_id
  ) into v_exists;

  if v_exists then
    delete from public.skill_upvotes where skill_id = p_skill_id and user_id = v_user_id;
    update public.community_skills set upvotes = upvotes - 1 where id = p_skill_id;
  else
    insert into public.skill_upvotes(skill_id, user_id) values(p_skill_id, v_user_id);
    update public.community_skills set upvotes = upvotes + 1 where id = p_skill_id;
  end if;

  select upvotes into v_count from public.community_skills where id = p_skill_id;
  return v_count;
end;
$$;

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger set_updated_at before update on public.community_skills
  for each row execute procedure update_updated_at();

-- ── REALTIME ──────────────────────────────────────
-- Enable realtime for live updates across all browser tabs/devices
alter publication supabase_realtime add table public.community_skills;

-- =====================================================
-- DONE. Now go to Supabase > Authentication > Settings:
-- 1. Enable "Email" provider
-- 2. Set Site URL to: https://skill-galaxy.vercel.app
-- 3. Add redirect URL: https://skill-galaxy.vercel.app/
-- =====================================================
