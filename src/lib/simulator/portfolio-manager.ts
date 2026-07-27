import { createClient } from "@/lib/supabase/client";

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
  currentPrice?: number;
  unrealizedPnl?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: string;
  closedAt: string;
}

export interface PortfolioState {
  portfolioId: string | null;
  balance: number;
  startingBalance: number;
  positions: Position[];
  trades: Trade[];
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
}

export type PortfolioAction =
  | { type: "SET_STATE"; state: PortfolioState }
  | { type: "OPEN_POSITION"; position: Position; cost: number }
  | { type: "CLOSE_POSITION"; positionId: string; exitPrice: number }
  | { type: "UPDATE_PRICES"; prices: Record<string, number> }
  | { type: "RESET" };

const INITIAL_BALANCE = 100000;

export const initialPortfolioState: PortfolioState = {
  portfolioId: null,
  balance: INITIAL_BALANCE,
  startingBalance: INITIAL_BALANCE,
  positions: [],
  trades: [],
  totalPnl: 0,
  totalTrades: 0,
  winningTrades: 0,
};

export function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case "SET_STATE":
      return action.state;

    case "OPEN_POSITION": {
      return {
        ...state,
        balance: state.balance - action.cost,
        positions: [...state.positions, action.position],
      };
    }

    case "CLOSE_POSITION": {
      const pos = state.positions.find((p) => p.id === action.positionId);
      if (!pos) return state;

      const pnl =
        pos.side === "long"
          ? (action.exitPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - action.exitPrice) * pos.quantity;
      const pnlRounded = Math.round(pnl * 100) / 100;
      const proceeds = pos.entryPrice * pos.quantity + pnlRounded;

      const trade: Trade = {
        id: crypto.randomUUID(),
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        exitPrice: action.exitPrice,
        pnl: pnlRounded,
        openedAt: pos.openedAt,
        closedAt: new Date().toISOString(),
      };

      return {
        ...state,
        balance: state.balance + proceeds,
        positions: state.positions.filter((p) => p.id !== action.positionId),
        trades: [trade, ...state.trades],
        totalPnl: Math.round((state.totalPnl + pnlRounded) * 100) / 100,
        totalTrades: state.totalTrades + 1,
        winningTrades: pnlRounded > 0 ? state.winningTrades + 1 : state.winningTrades,
      };
    }

    case "UPDATE_PRICES": {
      const positions = state.positions.map((pos) => {
        const price = action.prices[pos.symbol];
        if (price == null) return pos;
        const pnl =
          pos.side === "long"
            ? (price - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - price) * pos.quantity;
        return { ...pos, currentPrice: price, unrealizedPnl: Math.round(pnl * 100) / 100 };
      });
      return { ...state, positions };
    }

    case "RESET":
      return { ...initialPortfolioState };

    default:
      return state;
  }
}

// Equity = balance + sum of position market values
export function getEquity(state: PortfolioState): number {
  const positionValue = state.positions.reduce((sum, pos) => {
    const price = pos.currentPrice ?? pos.entryPrice;
    return sum + price * pos.quantity;
  }, 0);
  return Math.round((state.balance + positionValue) * 100) / 100;
}

export function getWinRate(state: PortfolioState): number {
  if (state.totalTrades === 0) return 0;
  return Math.round((state.winningTrades / state.totalTrades) * 100);
}

export function getReturnPct(state: PortfolioState): number {
  const equity = getEquity(state);
  return Math.round(((equity - state.startingBalance) / state.startingBalance) * 10000) / 100;
}

// Supabase persistence helpers
export async function loadPortfolio(): Promise<PortfolioState | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: portfolio } = await supabase
    .from("sim_portfolios")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!portfolio) return null;

  const { data: positions } = await supabase
    .from("sim_positions")
    .select("*")
    .eq("portfolio_id", portfolio.id);

  const { data: trades } = await supabase
    .from("sim_trades")
    .select("*")
    .eq("portfolio_id", portfolio.id)
    .order("closed_at", { ascending: false })
    .limit(50);

  return {
    portfolioId: portfolio.id,
    balance: Number(portfolio.balance),
    startingBalance: Number(portfolio.starting_balance),
    positions: (positions || []).map((p) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: Number(p.entry_price),
      stopLoss: p.stop_loss ? Number(p.stop_loss) : undefined,
      takeProfit: p.take_profit ? Number(p.take_profit) : undefined,
      openedAt: p.opened_at,
    })),
    trades: (trades || []).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      entryPrice: Number(t.entry_price),
      exitPrice: Number(t.exit_price),
      pnl: Number(t.pnl),
      openedAt: t.opened_at,
      closedAt: t.closed_at,
    })),
    totalPnl: Number(portfolio.total_pnl),
    totalTrades: portfolio.total_trades,
    winningTrades: portfolio.winning_trades,
  };
}

export async function ensurePortfolio(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("sim_portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("sim_portfolios")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error) throw error;
  return created!.id;
}

export async function savePortfolioState(state: PortfolioState): Promise<void> {
  if (!state.portfolioId) return;
  const supabase = createClient();

  await supabase.from("sim_portfolios").update({
    balance: state.balance,
    total_pnl: state.totalPnl,
    total_trades: state.totalTrades,
    winning_trades: state.winningTrades,
  }).eq("id", state.portfolioId);
}

export async function saveTradeToSupabase(
  portfolioId: string,
  trade: Trade
): Promise<void> {
  const supabase = createClient();
  await supabase.from("sim_trades").insert({
    portfolio_id: portfolioId,
    symbol: trade.symbol,
    side: trade.side,
    quantity: trade.quantity,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    pnl: trade.pnl,
    opened_at: trade.openedAt,
    closed_at: trade.closedAt,
  });
}

export async function savePositionToSupabase(
  portfolioId: string,
  position: Position
): Promise<void> {
  const supabase = createClient();
  await supabase.from("sim_positions").insert({
    id: position.id,
    portfolio_id: portfolioId,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity,
    entry_price: position.entryPrice,
    stop_loss: position.stopLoss,
    take_profit: position.takeProfit,
    opened_at: position.openedAt,
  });
}

export async function removePositionFromSupabase(positionId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("sim_positions").delete().eq("id", positionId);
}

export async function resetPortfolio(portfolioId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("sim_positions").delete().eq("portfolio_id", portfolioId);
  await supabase.from("sim_trades").delete().eq("portfolio_id", portfolioId);
  await supabase.from("sim_equity_snapshots").delete().eq("portfolio_id", portfolioId);
  await supabase.from("sim_portfolios").update({
    balance: INITIAL_BALANCE,
    total_pnl: 0,
    total_trades: 0,
    winning_trades: 0,
  }).eq("id", portfolioId);
}

/* ── EQUITY HISTORY (migration 197) ───────────────────────────────────────
   The Practice Portfolio hero draws a real equity curve. It is drawn from
   `sim_equity_snapshots` — what the account was actually worth, when — and
   NEVER interpolated or back-filled, so a brand-new account shows a founding
   state rather than a fabricated flat line.

   Paper money only: this is the member's own practice record, not a track
   record and not a performance claim. */

export interface EquityPoint {
  /** epoch ms — the shape `PriceChart` and the sparkline already speak. */
  t: number;
  /** total account value at capture: cash + mark-to-market of open positions. */
  equity: number;
}

/** At most one capture per portfolio per minute — the tape ticks far faster. */
const SNAPSHOT_MIN_GAP_MS = 60_000;
let lastSnapshotAt = 0;

/**
 * Record what the practice account is worth right now. Best-effort and
 * rate-limited: a dropped snapshot leaves a gap in the curve, which is honest,
 * where a retry storm would not be. Returns true only if a row was written.
 */
export async function saveEquitySnapshot(
  state: PortfolioState,
  opts: { force?: boolean } = {}
): Promise<boolean> {
  if (!state.portfolioId) return false;
  const now = Date.now();
  if (!opts.force && now - lastSnapshotAt < SNAPSHOT_MIN_GAP_MS) return false;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("sim_equity_snapshots").insert({
    portfolio_id: state.portfolioId,
    user_id: user.id,
    equity: getEquity(state),
    cash: Math.round(state.balance * 100) / 100,
    open_positions: state.positions.length,
  });
  if (error) return false;

  lastSnapshotAt = now;
  return true;
}

/**
 * The curve, oldest → newest, for a trailing window. `days = 0` means "all of
 * it". Fails soft to an empty array — the caller renders the founding state,
 * which is the truthful reading of "there is no history yet".
 */
export async function loadEquityHistory(
  portfolioId: string,
  days = 0
): Promise<EquityPoint[]> {
  const supabase = createClient();
  let q = supabase
    .from("sim_equity_snapshots")
    .select("equity, captured_at")
    .eq("portfolio_id", portfolioId)
    .order("captured_at", { ascending: true })
    .limit(500);

  if (days > 0) {
    q = q.gte(
      "captured_at",
      new Date(Date.now() - days * 86_400_000).toISOString()
    );
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data
    .map((r) => ({
      t: new Date(r.captured_at as string).getTime(),
      equity: Number(r.equity),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.equity));
}
