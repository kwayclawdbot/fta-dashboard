-- 164 — Learning World P2: skill graph (the 15 skills under everything)
--
-- Skills (not courses) are what mastery is measured against (FIC-LEARNING-WORLD
-- §7). Each lesson teaches 1–3 skills; each interaction updates mastery. This is
-- the definition table + seed of the spec's 15 skills. Net-new; nothing existed.

create table if not exists skills (
  id text primary key,          -- stable slug, e.g. 'revenue'
  name text not null,           -- display: "Revenue"
  domain text not null,         -- grouping: business | markets | technical | risk | psychology
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table skills enable row level security;

drop policy if exists "Anyone can read skills" on skills;
create policy "Anyone can read skills" on skills for select using (true);

insert into skills (id, name, domain, sort) values
  ('stock_ownership',        'Stock Ownership',        'business',   1),
  ('market_basics',          'How Markets Work',       'markets',    2),
  ('revenue',                'Revenue',                'business',   3),
  ('profit',                 'Profit',                 'business',   4),
  ('margins',                'Margins',                'business',   5),
  ('growth',                 'Growth',                 'business',   6),
  ('competitive_advantage',  'Competitive Advantage',  'business',   7),
  ('financial_statements',   'Financial Statements',   'business',   8),
  ('valuation',              'Valuation',              'business',   9),
  ('diversification',        'Diversification',        'risk',      10),
  ('risk',                   'Risk',                   'risk',      11),
  ('portfolio_construction', 'Portfolio Construction', 'risk',      12),
  ('technical_analysis',     'Technical Analysis',     'technical', 13),
  ('market_psychology',      'Market Psychology',      'psychology',14),
  ('thesis_building',        'Thesis Building',        'business',  15)
on conflict (id) do nothing;
