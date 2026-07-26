-- 165 — Learning World P2: lesson → skill mapping
--
-- Each lesson teaches 1–3 skills (FIC-LEARNING-WORLD §7 / proposal §5). Seeded
-- onto the real 014 dual-program curriculum (adult / teen / kids foundations).
-- weight 2 = primary skill taught, weight 1 = secondary. Teen + kids mirror the
-- adult skills at register depth (one backend, four registers). Additive only.

create table if not exists lesson_skills (
  lesson_id uuid not null references lessons(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  weight int not null default 1 check (weight between 1 and 3),
  primary key (lesson_id, skill_id)
);

create index if not exists idx_lesson_skills_skill on lesson_skills (skill_id);

alter table lesson_skills enable row level security;
drop policy if exists "Anyone can read lesson_skills" on lesson_skills;
create policy "Anyone can read lesson_skills" on lesson_skills for select using (true);

insert into lesson_skills (lesson_id, skill_id, weight) values
  -- ── FIC Adult Foundations ──
  ('f1c00000-0001-0001-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0001-0001-0001-000000000001', 'growth', 1),
  ('f1c00000-0001-0001-0002-000000000001', 'stock_ownership', 2),
  ('f1c00000-0001-0001-0002-000000000001', 'market_basics', 1),
  ('f1c00000-0001-0002-0001-000000000001', 'technical_analysis', 2),
  ('f1c00000-0001-0002-0002-000000000001', 'technical_analysis', 2),
  ('f1c00000-0001-0003-0001-000000000001', 'technical_analysis', 2),
  ('f1c00000-0001-0003-0002-000000000001', 'financial_statements', 2),
  ('f1c00000-0001-0003-0002-000000000001', 'valuation', 1),
  ('f1c00000-0001-0004-0001-000000000001', 'risk', 2),
  ('f1c00000-0001-0004-0002-000000000001', 'risk', 2),
  ('f1c00000-0001-0004-0002-000000000001', 'market_psychology', 1),
  ('f1c00000-0001-0005-0001-000000000001', 'risk', 2),
  ('f1c00000-0001-0005-0001-000000000001', 'portfolio_construction', 1),
  ('f1c00000-0001-0005-0002-000000000001', 'market_psychology', 2),
  ('f1c00000-0001-0006-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0001-0006-0002-000000000001', 'market_basics', 2),
  ('f1c00000-0001-0006-0002-000000000001', 'risk', 1),
  -- ── FIC Teen Foundations (mirror) ──
  ('f1c00000-0002-0001-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0002-0001-0001-000000000001', 'growth', 1),
  ('f1c00000-0002-0001-0002-000000000001', 'stock_ownership', 2),
  ('f1c00000-0002-0001-0002-000000000001', 'market_basics', 1),
  ('f1c00000-0002-0002-0001-000000000001', 'technical_analysis', 2),
  ('f1c00000-0002-0002-0002-000000000001', 'technical_analysis', 2),
  ('f1c00000-0002-0003-0001-000000000001', 'technical_analysis', 2),
  ('f1c00000-0002-0003-0002-000000000001', 'financial_statements', 2),
  ('f1c00000-0002-0003-0002-000000000001', 'valuation', 1),
  ('f1c00000-0002-0004-0001-000000000001', 'risk', 2),
  ('f1c00000-0002-0004-0002-000000000001', 'risk', 2),
  ('f1c00000-0002-0004-0002-000000000001', 'market_psychology', 1),
  ('f1c00000-0002-0005-0001-000000000001', 'risk', 2),
  ('f1c00000-0002-0005-0001-000000000001', 'portfolio_construction', 1),
  ('f1c00000-0002-0005-0002-000000000001', 'market_psychology', 2),
  ('f1c00000-0002-0006-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0002-0006-0002-000000000001', 'market_basics', 2),
  ('f1c00000-0002-0006-0002-000000000001', 'risk', 1),
  -- ── FIC Kids Corner (mirror) ──
  ('f1c00000-0003-0001-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0003-0001-0002-000000000001', 'market_basics', 2),
  ('f1c00000-0003-0002-0001-000000000001', 'stock_ownership', 2),
  ('f1c00000-0003-0002-0002-000000000001', 'stock_ownership', 2),
  ('f1c00000-0003-0002-0002-000000000001', 'market_basics', 1),
  ('f1c00000-0003-0003-0001-000000000001', 'technical_analysis', 2),
  ('f1c00000-0003-0003-0002-000000000001', 'technical_analysis', 2),
  ('f1c00000-0003-0004-0001-000000000001', 'competitive_advantage', 2),
  ('f1c00000-0003-0004-0002-000000000001', 'competitive_advantage', 2),
  ('f1c00000-0003-0004-0002-000000000001', 'growth', 1),
  ('f1c00000-0003-0005-0001-000000000001', 'risk', 2),
  ('f1c00000-0003-0005-0002-000000000001', 'risk', 2),
  ('f1c00000-0003-0005-0002-000000000001', 'market_psychology', 1),
  ('f1c00000-0003-0006-0001-000000000001', 'market_basics', 2),
  ('f1c00000-0003-0006-0002-000000000001', 'thesis_building', 2)
on conflict (lesson_id, skill_id) do nothing;
