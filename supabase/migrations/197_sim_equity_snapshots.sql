-- ═══════════════════════════════════════════════════════════════════════════
-- 197 — PRACTICE PORTFOLIO: equity history
--
-- WHY: the canvas draws an equity curve inside the Practice Portfolio hero
-- (design-project v1 "Practice portfolio" L1018-1031, "1a/1b Portfolio"
-- L219-232 / L455-459). We had nowhere to draw it FROM: `sim_portfolios`
-- carries only the CURRENT balance and `sim_trades` only realised closes, so
-- any curve rendered before this migration would have been invented. Rather
-- than fabricate one, this table records what the account was actually worth,
-- when.
--
-- Equity = cash balance + the mark-to-market value of every open practice
-- position at capture time. It is the member's OWN paper record — never a
-- performance claim, never surfaced outside their own account or their family.
--
-- Cadence is enforced in the app (one capture per portfolio per minute at
-- most) rather than by a constraint, because the practice tape can tick many
-- times a second and a unique index on a truncated timestamp would just turn
-- those into swallowed errors.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sim_equity_snapshots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id  uuid NOT NULL REFERENCES sim_portfolios(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Total account value: cash + mark-to-market of open positions.
  equity        numeric(14,2) NOT NULL,
  -- The cash leg on its own, so the curve can be split later without a backfill.
  cash          numeric(14,2) NOT NULL,
  open_positions integer NOT NULL DEFAULT 0,
  captured_at   timestamptz NOT NULL DEFAULT now()
);

-- The only read pattern: one portfolio's curve, oldest → newest, windowed by time.
CREATE INDEX IF NOT EXISTS idx_sim_equity_portfolio_time
  ON sim_equity_snapshots (portfolio_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_sim_equity_user
  ON sim_equity_snapshots (user_id);

ALTER TABLE sim_equity_snapshots ENABLE ROW LEVEL SECURITY;

-- Own rows only — same shape as "Users manage own sim portfolio" (003).
DROP POLICY IF EXISTS "Users manage own sim equity" ON sim_equity_snapshots;
CREATE POLICY "Users manage own sim equity" ON sim_equity_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- Family read, mirroring "Family members read sim portfolios" (003 L94) so the
-- parent digest can show a child's practice curve without a service role.
DROP POLICY IF EXISTS "Family members read sim equity" ON sim_equity_snapshots;
CREATE POLICY "Family members read sim equity" ON sim_equity_snapshots
  FOR SELECT USING (
    user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.family_id IS NOT NULL
        AND p.family_id = (
          SELECT family_id FROM profiles WHERE id = auth.uid()
        )
    )
  );

COMMENT ON TABLE sim_equity_snapshots IS
  'Practice-account equity history. Paper money only — the member''s own record, never a performance claim.';
