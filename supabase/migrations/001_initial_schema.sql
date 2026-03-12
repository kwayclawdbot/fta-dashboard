-- Family Trading Academy — Initial Schema
-- Run in Supabase SQL Editor after creating project

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- CORE
-- ============================================================

create table families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan_tier text not null default 'challenge' check (plan_tier in ('challenge', 'academy')),
  stripe_customer_id text,
  stripe_subscription_id text,
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references families(id) on delete set null,
  role text not null default 'parent' check (role in ('parent', 'child', 'coach', 'admin')),
  display_name text not null,
  avatar_url text,
  email text,
  age_group text check (age_group in ('kids', 'teens', 'adults')),
  track text check (track in ('kids', 'adults')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_invites (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references families(id) on delete cascade,
  code text not null unique,
  role text not null default 'child' check (role in ('parent', 'child')),
  email text,
  used_by uuid references profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ============================================================
-- LMS
-- ============================================================

create table courses (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text,
  thumbnail_url text,
  min_tier text not null default 'challenge' check (min_tier in ('challenge', 'academy')),
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table modules (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  track text check (track in ('kids', 'adults')),
  title text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default uuid_generate_v4(),
  module_id uuid not null references modules(id) on delete cascade,
  title text not null,
  description text,
  video_provider text check (video_provider in ('mux', 'youtube', 'bunny')),
  video_id text,
  video_duration_sec int,
  drip_week int not null default 0,
  has_quiz boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table drip_schedules (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references families(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  start_date date not null default current_date,
  weeks_per_release int not null default 1,
  created_at timestamptz not null default now(),
  unique (family_id, course_id)
);

create table lesson_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  completed_at timestamptz,
  time_spent_sec int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table quizzes (
  id uuid primary key default uuid_generate_v4(),
  lesson_id uuid not null references lessons(id) on delete cascade unique,
  questions jsonb not null default '[]',
  passing_score int not null default 70,
  created_at timestamptz not null default now()
);

create table quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  score int not null,
  answers jsonb not null default '[]',
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================

create table badges (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text,
  icon_url text,
  criteria jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- ============================================================
-- LIVE SESSIONS
-- ============================================================

create table live_sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  duration_min int not null default 60,
  zoom_join_url text,
  zoom_meeting_id text,
  recording_url text,
  recording_video_id text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  track text check (track in ('kids', 'adults', 'all')),
  min_tier text not null default 'academy' check (min_tier in ('challenge', 'academy')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- AI COACH
-- ============================================================

create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  context jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ai_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_used int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COMMUNITY / CHAT
-- ============================================================

create table chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('family', 'cohort', 'general', 'lesson', 'dm', 'coach_dm')),
  name text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table chat_room_members (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  reply_to_id uuid references chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  content text not null,
  target text not null default 'all' check (target in ('all', 'challenge', 'academy', 'kids', 'adults')),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_profiles_family on profiles(family_id);
create index idx_modules_course on modules(course_id);
create index idx_lessons_module on lessons(module_id);
create index idx_lesson_progress_user on lesson_progress(user_id);
create index idx_lesson_progress_lesson on lesson_progress(lesson_id);
create index idx_quiz_attempts_user on quiz_attempts(user_id);
create index idx_ai_conversations_user on ai_conversations(user_id);
create index idx_ai_messages_conversation on ai_messages(conversation_id);
create index idx_chat_messages_room on chat_messages(room_id);
create index idx_chat_room_members_room on chat_room_members(room_id);
create index idx_chat_room_members_user on chat_room_members(user_id);
create index idx_family_invites_code on family_invites(code);
create index idx_drip_schedules_family on drip_schedules(family_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table families enable row level security;
alter table profiles enable row level security;
alter table family_invites enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table drip_schedules enable row level security;
alter table lesson_progress enable row level security;
alter table quizzes enable row level security;
alter table quiz_attempts enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table live_sessions enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table chat_rooms enable row level security;
alter table chat_room_members enable row level security;
alter table chat_messages enable row level security;
alter table announcements enable row level security;

-- Profiles: users can read own + family members, update own
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can read family member profiles"
  on profiles for select using (
    family_id in (select family_id from profiles where id = auth.uid())
  );

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Families: members can read own family
create policy "Members can read own family"
  on families for select using (
    id in (select family_id from profiles where id = auth.uid())
  );

-- Courses: anyone authenticated can read published courses
create policy "Authenticated users can read published courses"
  on courses for select using (published = true);

create policy "Read modules of visible courses"
  on modules for select using (
    course_id in (select id from courses where published = true)
  );

create policy "Read lessons of visible courses"
  on lessons for select using (
    module_id in (select id from modules where course_id in (select id from courses where published = true))
  );

-- Lesson progress: own data only
create policy "Users manage own progress"
  on lesson_progress for all using (auth.uid() = user_id);

-- Parents can read children's progress
create policy "Parents read family progress"
  on lesson_progress for select using (
    user_id in (
      select id from profiles
      where family_id = (select family_id from profiles where id = auth.uid())
    )
    and exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

-- Quiz attempts: own data
create policy "Users manage own quiz attempts"
  on quiz_attempts for all using (auth.uid() = user_id);

-- Quizzes: read if lesson is visible
create policy "Read quizzes"
  on quizzes for select using (true);

-- Badges: public read
create policy "Anyone can read badges"
  on badges for select using (true);

create policy "Users read own badges"
  on user_badges for select using (auth.uid() = user_id);

-- Live sessions: authenticated read
create policy "Read live sessions"
  on live_sessions for select using (true);

-- AI conversations: own data
create policy "Users manage own AI conversations"
  on ai_conversations for all using (auth.uid() = user_id);

create policy "Users manage own AI messages"
  on ai_messages for all using (
    conversation_id in (select id from ai_conversations where user_id = auth.uid())
  );

-- Chat: members can read rooms they belong to
create policy "Read joined chat rooms"
  on chat_rooms for select using (
    id in (select room_id from chat_room_members where user_id = auth.uid())
  );

create policy "Read chat room membership"
  on chat_room_members for select using (
    room_id in (select room_id from chat_room_members where user_id = auth.uid())
  );

create policy "Read messages in joined rooms"
  on chat_messages for select using (
    room_id in (select room_id from chat_room_members where user_id = auth.uid())
  );

create policy "Send messages in joined rooms"
  on chat_messages for insert with check (
    auth.uid() = user_id
    and room_id in (select room_id from chat_room_members where user_id = auth.uid())
  );

-- Announcements: authenticated read
create policy "Read announcements"
  on announcements for select using (true);

-- Drip schedules: family members can read
create policy "Read own family drip schedules"
  on drip_schedules for select using (
    family_id in (select family_id from profiles where id = auth.uid())
  );

-- Family invites: family parents can manage
create policy "Parents manage family invites"
  on family_invites for all using (
    family_id in (select family_id from profiles where id = auth.uid() and role in ('parent', 'admin'))
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'parent')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger families_updated_at before update on families
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at before update on profiles
  for each row execute function public.update_updated_at();

create trigger lesson_progress_updated_at before update on lesson_progress
  for each row execute function public.update_updated_at();

create trigger ai_conversations_updated_at before update on ai_conversations
  for each row execute function public.update_updated_at();

-- Seed general chat room
insert into chat_rooms (type, name) values ('general', 'General Chat');

-- Seed courses
insert into courses (slug, title, description, min_tier, sort_order, published) values
  ('stocks-options', 'Stocks & Options Mastery', 'Master the foundations of stock trading and options strategies.', 'challenge', 1, true),
  ('forex', 'Forex Trading', 'Navigate the global currency markets with confidence.', 'academy', 2, true),
  ('futures', 'Futures & Commodities', 'Trade futures contracts across commodities and indices.', 'academy', 3, true),
  ('crypto', 'Crypto & Digital Assets', 'Understand blockchain technology and crypto trading strategies.', 'academy', 4, true);
