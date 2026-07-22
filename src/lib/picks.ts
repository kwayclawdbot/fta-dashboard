/**
 * Team Picks — shared types + pure render helpers (no Supabase here).
 *
 * fic_picks (migration 055) is the FIC team's education-first pick board. Each
 * pick carries a "why we study this" thesis, an optional video (upload / youtube
 * / external), article links, and member likes + comments. Company data on every
 * surface is LIVE via the Polygon delayed layer (/api/market/*).
 */

export type PickStatus = "draft" | "active" | "watching" | "closed";
export type PickVideoKind = "upload" | "youtube" | "external";

export interface ArticleLink {
  title: string;
  url: string;
}

export interface PickAuthor {
  id: string;
  display_name: string | null;
  role: string | null;
  age_group: string | null;
  avatar_url: string | null;
  username?: string | null;
}

export interface Pick {
  id: string;
  ticker: string;
  company_name: string;
  status: PickStatus;
  headline: string | null;
  thesis_short: string | null;
  thesis_long: string | null;
  picked_at: string; // date
  picked_price: number | null;
  video_path: string | null;
  video_kind: PickVideoKind | null;
  article_links: ArticleLink[];
  tags: string[];
  created_by: string | null;
  closed_note: string | null;
  created_at: string;
  updated_at: string;
  /** Free sampler pick — the one pick free members read in full. */
  is_free?: boolean;
  /** Set by the pick_detail RPC: guidance fields were withheld for this viewer. */
  locked?: boolean;
}

export interface PickComment {
  id: string;
  pick_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  author: PickAuthor | null;
}

/** Status chip styling — Active gold / Watching sand / Closed muted. */
export const STATUS_META: Record<
  Exclude<PickStatus, "draft"> | "draft",
  { label: string; chip: string; dot: string }
> = {
  active: {
    label: "Active",
    chip: "bg-chip-amber text-gold-800",
    dot: "bg-gold-500",
  },
  watching: {
    label: "Watching",
    chip: "bg-sand text-soft",
    dot: "bg-soft",
  },
  closed: {
    label: "Closed",
    chip: "bg-paper text-midnight-500 ring-1 ring-sand",
    dot: "bg-midnight-500",
  },
  draft: {
    label: "Draft",
    chip: "bg-paper text-midnight-400 ring-1 ring-dashed ring-sand",
    dot: "bg-midnight-400",
  },
};

export function statusMeta(status: PickStatus) {
  return STATUS_META[status] ?? STATUS_META.watching;
}

/** Percent change of a live price vs. the price when the pick was made. */
export function sincePickPercent(
  price: number | null | undefined,
  pickedPrice: number | null | undefined
): number | null {
  if (price == null || pickedPrice == null || pickedPrice <= 0) return null;
  return ((price - pickedPrice) / pickedPrice) * 100;
}

export function formatSincePct(v: number | null): string {
  if (v == null) return "";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Split thesis_long into paragraphs for rendering. */
export function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatPickedDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ---------- video helpers (reuse the recordings player model) ---------- */

const YOUTUBE_HOST_RE = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;

export function isYoutubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Kind for a pasted video link (upload is chosen explicitly on the file path). */
export function detectVideoUrlKind(url: string): PickVideoKind {
  return isYoutubeUrl(url) ? "youtube" : "external";
}

/** Privacy-enhanced YouTube embed URL (nocookie). */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!YOUTUBE_HOST_RE.test(u.hostname)) return null;
    let id = "";
    if (u.hostname.replace(/^www\./, "") === "youtu.be") {
      id = u.pathname.split("/").filter(Boolean)[0] || "";
    } else if (u.searchParams.get("v")) {
      id = u.searchParams.get("v") || "";
    } else {
      const m = u.pathname.match(/\/(?:live|shorts|embed)\/([^/?#]+)/);
      if (m) id = m[1];
    }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

export const PICKS_MEDIA_BUCKET = "community-media";

/** Normalize a possibly array-wrapped embedded author (PostgREST). */
export function normPickAuthor(
  a: PickAuthor | PickAuthor[] | null | undefined
): PickAuthor | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

/** Coerce the jsonb article_links into a clean ArticleLink[]. */
export function normArticleLinks(raw: unknown): ArticleLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = r as { title?: unknown; url?: unknown };
      const url = typeof o?.url === "string" ? o.url.trim() : "";
      const title = typeof o?.title === "string" ? o.title.trim() : "";
      if (!url) return null;
      return { url, title: title || url };
    })
    .filter((x): x is ArticleLink => !!x);
}

export const PICKS_DISCLAIMER =
  "The Family Investing Club studies real companies to learn how investing works. " +
  "Nothing here is investment advice or a recommendation to buy or sell any security. " +
  "Prices are delayed ~15 minutes. Always do your own research.";

export const PICKS_EDUCATION_LINE =
  "Why we study this company — a look at how the FIC team thinks. Not investment advice.";
