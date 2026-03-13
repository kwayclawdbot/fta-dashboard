-- Trading Simulator tables
-- Run in Supabase SQL Editor

-- ============================================================
-- SIMULATOR TABLES
-- ============================================================

create table sim_portfolios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 100000.00,
  starting_balance numeric(12,2) not null default 100000.00,
  total_trades int not null default 0,
  winning_trades int not null default 0,
  total_pnl numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table sim_positions (
  id uuid primary key default uuid_generate_v4(),
  portfolio_id uuid not null references sim_portfolios(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  quantity int not null,
  entry_price numeric(10,2) not null,
  stop_loss numeric(10,2),
  take_profit numeric(10,2),
  opened_at timestamptz not null default now()
);

create table sim_trades (
  id uuid primary key default uuid_generate_v4(),
  portfolio_id uuid not null references sim_portfolios(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  quantity int not null,
  entry_price numeric(10,2) not null,
  exit_price numeric(10,2) not null,
  pnl numeric(10,2) not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz not null default now()
);

create table sim_scenario_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  scenario_id text not null,
  pattern_score int not null default 0,
  trade_score int not null default 0,
  total_score int not null default 0,
  passed boolean not null default false,
  decision text not null check (decision in ('buy', 'sell', 'wait')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_sim_portfolios_user on sim_portfolios(user_id);
create index idx_sim_positions_portfolio on sim_positions(portfolio_id);
create index idx_sim_trades_portfolio on sim_trades(portfolio_id);
create index idx_sim_scenario_scores_user on sim_scenario_scores(user_id);

-- ============================================================
-- RLS
-- ============================================================

alter table sim_portfolios enable row level security;
alter table sim_positions enable row level security;
alter table sim_trades enable row level security;
alter table sim_scenario_scores enable row level security;

-- Users manage own simulator data
create policy "Users manage own sim portfolio"
  on sim_portfolios for all using (auth.uid() = user_id);

create policy "Users manage own sim positions"
  on sim_positions for all using (
    portfolio_id in (select id from sim_portfolios where user_id = auth.uid())
  );

create policy "Users manage own sim trades"
  on sim_trades for all using (
    portfolio_id in (select id from sim_portfolios where user_id = auth.uid())
  );

create policy "Users manage own scenario scores"
  on sim_scenario_scores for all using (auth.uid() = user_id);

-- Family members can read each other's portfolios (for leaderboard)
create policy "Family members read sim portfolios"
  on sim_portfolios for select using (
    user_id in (
      select id from profiles
      where family_id = (select family_id from profiles where id = auth.uid())
    )
  );

-- Family members can read each other's scenario scores
create policy "Family members read scenario scores"
  on sim_scenario_scores for select using (
    user_id in (
      select id from profiles
      where family_id = (select family_id from profiles where id = auth.uid())
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

create trigger sim_portfolios_updated_at before update on sim_portfolios
  for each row execute function public.update_updated_at();
