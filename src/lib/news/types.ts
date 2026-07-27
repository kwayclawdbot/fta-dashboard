/**
 * Club Newsroom — shared types (LANE 10). Client- and server-safe (no server
 * imports). The block model is the render contract between the generation lib
 * and the article page: the model writes PROSE, the generation lib assembles
 * data-driven blocks (movers with exact numbers) so figures are never
 * hallucinated. Every article footer is AI-generated + not-advice (UI-enforced).
 */

export type NewsKind = "market_wrap" | "ticker_event" | "sector_spotlight";

/** A mover row rendered from screener data — chg is the exact % day change. */
export interface MoverItem {
  ticker: string;
  name: string | null;
  chg: number | null;
  /** One-line WHY, from a matching Polygon headline when derivable. */
  why?: string | null;
}

export type NewsBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "movers"; items: MoverItem[] }
  | {
      // Attribution-only external link (title + source + timestamp), never
      // scraped body text — copyright-safe. Used by ticker-event notes that
      // reference a real headline.
      type: "source";
      title: string;
      url: string;
      publisher: string | null;
      published: string | null;
      /** Publisher artwork for that story. Optional: articles generated before
          the field was wired have none, and the feed's house OG placeholders
          are rejected upstream (polygon.isGenericNewsImage), so this is either
          a real picture of the story or absent. */
      image?: string | null;
    };

export interface NewsSections {
  blocks: NewsBlock[];
}

export interface NewsArticle {
  id: string;
  slug: string;
  kind: NewsKind;
  title: string;
  dek: string | null;
  sections: NewsSections;
  tickers: string[];
  model: string | null;
  published: boolean;
  generated_at: string;
}

/** Feed-card shape (list query omits full sections for lightness). */
export interface NewsCardData {
  slug: string;
  kind: NewsKind;
  title: string;
  dek: string | null;
  tickers: string[];
  generated_at: string;
}

export const KIND_META: Record<
  NewsKind,
  { label: string; blurb: string; accent: string }
> = {
  market_wrap: {
    label: "Market Wrap",
    blurb: "The day in the market, in plain English.",
    accent: "bg-chip-sky text-ink",
  },
  ticker_event: {
    label: "Ticker Note",
    blurb: "Why one stock moved today.",
    accent: "bg-chip-amber text-ink",
  },
  sector_spotlight: {
    label: "Sector Spotlight",
    blurb: "A closer look at one corner of the market.",
    accent: "bg-chip-green text-ink",
  },
};

export function kindLabel(kind: NewsKind): string {
  return KIND_META[kind]?.label ?? "Note";
}

/** Permanent compliance line shown in every article footer. */
export const NEWS_DISCLAIMER =
  "This is an AI-generated educational recap for the Cheat Code Club — it narrates publicly available market data to teach how to read the market, and is NOT investment advice, a recommendation, or a prediction. Market data is delayed and figures can change. Always do your own research and talk to a licensed professional before making any financial decision.";

/** Short AI-generated tag shown on cards + article header. */
export const AI_GENERATED_TAG = "AI-generated · educational";

/** Compact "x days/hours ago" for card + article timestamps. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Signed percent for mover chips, e.g. "+12.4%". */
export function signedPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
