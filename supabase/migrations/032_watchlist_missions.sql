-- ============================================================
-- 032 — Family Watchlist + Kid Missions (FIC dashboard)
--
-- RLS notes (following the 018/019/020 scars):
--   * Every policy here is SIMPLE and NON-recursive. Family reads subquery the
--     `profiles` table (a DIFFERENT table) exactly like 020's game_scores /
--     report_notes policies — safe because none of these tables are consumed
--     via Realtime and no policy is self-referential.
--   * watchlist_notes is family-scoped through its parent row (family_watchlist)
--     via a nested subquery to a DIFFERENT table — still non-recursive, not
--     realtime, so no delivery hazard.
--
-- STATUS-LADDER ENFORCEMENT (the teaching mechanic):
--   Everything enters `watch`. `study` opens the research card. A verdict
--   (`favorite`/`avoid`) is LOCKED at the DATABASE level until the research card
--   is complete — the CHECK constraint `watchlist_verdict_needs_research`
--   rejects any INSERT/UPDATE that sets favorite/avoid without the four research
--   fields (how_they_make_money, strength, risk, trend) all filled in. This is
--   belt-and-suspenders with the UI gating so no verdict can exist without
--   homework, even via direct SQL.
-- ============================================================

-- 1. Family watchlist --------------------------------------------------------
create table if not exists family_watchlist (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references families(id) on delete cascade,
  company_name text not null,
  ticker text not null,
  status text not null default 'watch'
    check (status in ('watch', 'study', 'favorite', 'avoid')),
  champion_id uuid references profiles(id) on delete set null,
  trend text,
  what_they_sell text,
  how_they_make_money text,
  strength text,
  risk text,
  bull_case text,
  bear_case text,
  why_we_picked text,
  in_big_book boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No verdict without homework. Research card = how they make money +
  -- one strength + one risk + a trend read.
  constraint watchlist_verdict_needs_research check (
    status in ('watch', 'study')
    or (
      coalesce(btrim(how_they_make_money), '') <> ''
      and coalesce(btrim(strength), '') <> ''
      and coalesce(btrim(risk), '') <> ''
      and coalesce(btrim(trend), '') <> ''
    )
  )
);
create index if not exists idx_family_watchlist_family on family_watchlist(family_id);
create index if not exists idx_family_watchlist_champion on family_watchlist(champion_id);

-- Auto-touch updated_at on edit (table-scoped fn to avoid name collisions).
create or replace function fic_watchlist_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_family_watchlist_touch on family_watchlist;
create trigger trg_family_watchlist_touch
  before update on family_watchlist
  for each row execute function fic_watchlist_touch_updated_at();

alter table family_watchlist enable row level security;
-- Family members read their family's board.
drop policy if exists "Family members read watchlist" on family_watchlist;
create policy "Family members read watchlist" on family_watchlist for select to authenticated
  using (family_id = (select family_id from profiles where id = auth.uid()));
-- Anyone in the family can add a company (adder becomes champion in app).
drop policy if exists "Family members add watchlist" on family_watchlist;
create policy "Family members add watchlist" on family_watchlist for insert to authenticated
  with check (family_id = (select family_id from profiles where id = auth.uid()));
-- Anyone in the family can annotate/advance a company (research, status, notes).
drop policy if exists "Family members update watchlist" on family_watchlist;
create policy "Family members update watchlist" on family_watchlist for update to authenticated
  using (family_id = (select family_id from profiles where id = auth.uid()))
  with check (family_id = (select family_id from profiles where id = auth.uid()));
-- Delete stays in the family (UI limits the button to champion + parents).
drop policy if exists "Family members delete watchlist" on family_watchlist;
create policy "Family members delete watchlist" on family_watchlist for delete to authenticated
  using (family_id = (select family_id from profiles where id = auth.uid()));

-- 2. Watchlist notes stream --------------------------------------------------
create table if not exists watchlist_notes (
  id uuid primary key default uuid_generate_v4(),
  watchlist_id uuid not null references family_watchlist(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_watchlist_notes_watchlist on watchlist_notes(watchlist_id, created_at);

alter table watchlist_notes enable row level security;
-- Notes are visible to the family that owns the parent company row.
drop policy if exists "Family reads watchlist notes" on watchlist_notes;
create policy "Family reads watchlist notes" on watchlist_notes for select to authenticated
  using (watchlist_id in (
    select id from family_watchlist
    where family_id = (select family_id from profiles where id = auth.uid())
  ));
-- Anyone in the family can add a note (author must be self).
drop policy if exists "Family adds watchlist notes" on watchlist_notes;
create policy "Family adds watchlist notes" on watchlist_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and watchlist_id in (
      select id from family_watchlist
      where family_id = (select family_id from profiles where id = auth.uid())
    )
  );
-- Authors can delete their own notes.
drop policy if exists "Authors delete own watchlist notes" on watchlist_notes;
create policy "Authors delete own watchlist notes" on watchlist_notes for delete to authenticated
  using (author_id = auth.uid());

-- 3. FIC missions (seeded catalog) -------------------------------------------
create table if not exists fic_missions (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text,
  kid_prompt text,
  xp_reward int not null default 25,
  sort int not null default 0
);

alter table fic_missions enable row level security;
drop policy if exists "Read missions" on fic_missions;
create policy "Read missions" on fic_missions for select to authenticated using (true);

-- 4. Mission completions (per-user) ------------------------------------------
create table if not exists mission_completions (
  id uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references fic_missions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  family_id uuid references families(id) on delete set null,
  evidence text,
  completed_at timestamptz not null default now(),
  unique (mission_id, user_id)
);
create index if not exists idx_mission_completions_user on mission_completions(user_id);
create index if not exists idx_mission_completions_family on mission_completions(family_id);

alter table mission_completions enable row level security;
-- Family members see who has completed what (parents cheer kids on).
drop policy if exists "Family reads mission completions" on mission_completions;
create policy "Family reads mission completions" on mission_completions for select to authenticated
  using (family_id = (select family_id from profiles where id = auth.uid()));
-- You can only complete a mission for yourself.
drop policy if exists "Own insert mission completion" on mission_completions;
create policy "Own insert mission completion" on mission_completions for insert to authenticated
  with check (user_id = auth.uid());
-- And update your own evidence.
drop policy if exists "Own update mission completion" on mission_completions;
create policy "Own update mission completion" on mission_completions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Seed the 5 owner missions (kid-voiced prompts) --------------------------
insert into fic_missions (slug, title, description, kid_prompt, xp_reward, sort) values
  (
    'brand-detective',
    'Brand Detective',
    'Spot the companies you already live with. Auto-completes when you add 5 companies you champion to the Family Watchlist.',
    'Look around your house! Find 5 companies you already use every day — the cereal, the sneakers, the phone, the game, the streaming app. Add all 5 to your Family Watchlist and become a Brand Detective.',
    50,
    1
  ),
  (
    'snack-stock',
    'Snack Stock',
    'Connect a favorite snack to the company that makes it — the first "aha, a real business made this" moment.',
    'Pick your favorite snack. Who actually makes it? Find that company, add it to the watchlist, and tell us: why do YOU keep buying it?',
    25,
    2
  ),
  (
    'money-machine',
    'Money Machine',
    'Figure out how a company actually earns money and write it in plain words on its research card.',
    'Pick any company you like. Be a money detective: how does it REALLY make money — what do people pay for? Open its research card and write it in your own words.',
    30,
    3
  ),
  (
    'stock-vs-product',
    'Stock vs Product',
    'Nail the big idea: a product is the thing you buy, a stock is a tiny slice of the whole company.',
    'A product is the thing you buy. A stock is a tiny piece of the WHOLE company. Pick one company, explain the difference to a grown-up, then tell us what you said.',
    25,
    4
  ),
  (
    'family-ceo',
    'Family CEO',
    'Lead the family: choose the one company to study this week and make the case for it.',
    'You are the Family CEO for a day! Pick the ONE company your family should study this week, champion it on the watchlist, and tell everyone WHY you chose it.',
    40,
    5
  )
on conflict (slug) do nothing;
