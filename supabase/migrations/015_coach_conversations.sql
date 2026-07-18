-- 015 — AI Coach conversation log (repo parity)
-- This table was applied to the live DB out-of-band; this file exists so the
-- repo migration history matches production. Written idempotently so it is
-- safe to (re)run against a fresh database.

create table if not exists coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  lesson_id text not null,
  section_id text,
  question text not null,
  answer text not null,
  audio_url text,
  created_at timestamptz default now()
);

create index if not exists idx_coach_conversations_user
  on coach_conversations(user_id, created_at desc);

alter table coach_conversations enable row level security;

drop policy if exists "Users read own coach history" on coach_conversations;
create policy "Users read own coach history"
  on coach_conversations for select using (user_id = auth.uid());

drop policy if exists "Users can insert own conversations" on coach_conversations;
create policy "Users can insert own conversations"
  on coach_conversations for insert with check (auth.uid() = user_id);

drop policy if exists "Service role full access coach_conversations" on coach_conversations;
create policy "Service role full access coach_conversations"
  on coach_conversations for all using (true) with check (true);
