export type Stance = "bullish" | "neutral" | "bearish";

export type TickerRank = {
  ticker: string;
  name: string;
  rank: number;
  movement: number;
  statistic: string;
  href?: string;
};

export type Reputation = {
  name: string;
  avatarUrl?: string | null;
  belt: string;
  opinionScore?: number | null;
  expertise?: string | null;
  weight?: number | null;
};

export type Opinion = {
  id: string;
  ticker: string;
  stance: Stance;
  conviction?: number | null;
  horizon?: string | null;
  thesis: string;
  risk?: string | null;
  author: Reputation;
};

export type CircleState = "forming" | "active" | "winding-down" | "archived";
export type KaiWatchState = "building" | "getting-close" | "triggered" | "cooled" | "invalidated";
