/**
 * Clubhouse feed — shared types + pure render helpers (no Supabase here).
 *
 * feed_posts (migration 034) carries three kinds:
 *   'post'     — a human post (text + optional photo/video).
 *   'activity' — a system-authored activity card built from learning-event
 *                exhaust (badges, watchlist, missions, RSVPs, level-ups). Its
 *                `activity_payload` holds actor identity + target for a rich card.
 *   'anchor'   — the pinned "This Week" card, `activity_payload` mirrors the
 *                current fic_weeks row.
 */

export type FeedKind = "post" | "activity" | "anchor";
export type AgeGroup = "kids" | "teens" | "adults";
export type Role = "parent" | "child" | "coach" | "admin";

export interface AttachmentMeta {
  width?: number;
  height?: number;
  size?: number;
  name?: string;
}

export interface FeedAuthor {
  id: string;
  display_name: string | null;
  role: Role | null;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
}

export interface ActivityPayload {
  type:
    | "badge_earned"
    | "watchlist_add"
    | "watchlist_verdict"
    | "mission_complete"
    | "session_rsvp"
    | "level_up"
    | "referral_welcome";
  icon: string;
  actor_name: string;
  actor_avatar: string | null;
  actor_role: Role | null;
  actor_age_group: string | null;
  family_name: string | null;
  target: string | null;
  detail: string | null;
  ticker?: string;
  company_name?: string;
  verdict?: string;
  level?: number;
  level_name?: string;
  session_id?: string;
  scheduled_at?: string;
}

/** A member sharing one of their family's watchlist picks as a rich card. */
export interface WatchlistSharePayload {
  type: "watchlist_share";
  ticker: string;
  company_name: string;
  status: "watch" | "study" | "favorite" | "avoid";
  why_we_picked: string | null;
  bull_case: string | null;
  bear_case: string | null;
  champion_name: string | null;
  family_name: string | null;
}

export function isWatchlistShare(
  p: FeedPost["activity_payload"]
): p is WatchlistSharePayload {
  return !!p && (p as WatchlistSharePayload).type === "watchlist_share";
}

export interface AnchorPayload {
  week_start: string | null;
  class_title: string | null;
  company_name: string | null;
  company_ticker: string | null;
  discussion_question: string | null;
  family_assignment: string | null;
  kid_challenge: string | null;
}

export interface FeedPost {
  id: string;
  author_id: string | null;
  family_id: string | null;
  kind: FeedKind;
  body: string;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
  attachment_meta: AttachmentMeta | null;
  activity_payload: ActivityPayload | AnchorPayload | WatchlistSharePayload | null;
  anchor_week_id: string | null;
  pinned: boolean;
  created_at: string;
  author: FeedAuthor | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author: FeedAuthor | null;
}

// ── Age group ────────────────────────────────────────────────────────────────
// Owner decision: a small kid/teen/adult indicator sits next to every member's
// name in the community. age_group is authoritative; fall back to role.
export function ageGroupOf(
  role: string | null | undefined,
  ageGroup: string | null | undefined
): AgeGroup {
  if (ageGroup === "kids" || ageGroup === "teens" || ageGroup === "adults") {
    return ageGroup;
  }
  return role === "child" ? "teens" : "adults";
}

export const AGE_META: Record<AgeGroup, { label: string; chip: string }> = {
  kids: { label: "Kid", chip: "bg-chip-green text-green-700" },
  teens: { label: "Teen", chip: "bg-chip-sky text-sky-800" },
  adults: { label: "Adult", chip: "bg-sand text-soft" },
};

// ── Activity card copy ───────────────────────────────────────────────────────
export interface ActivityLine {
  iconKey: string;
  subject: string;
  verb: string;
  target: string;
  accent: string; // chip classes for the icon bubble
}

export function activityLine(p: ActivityPayload): ActivityLine {
  const subject = p.actor_name || p.family_name || "A member";
  const company = p.company_name || p.ticker || p.target || "a company";
  switch (p.type) {
    case "badge_earned":
      return {
        iconKey: "award", subject, verb: "earned the",
        target: `${p.target} credential`,
        accent: "bg-chip-amber text-gold-800",
      };
    case "watchlist_add":
      return {
        iconKey: "eye", subject, verb: "is now researching",
        target: company,
        accent: "bg-chip-sky text-sky-800",
      };
    case "watchlist_verdict":
      return {
        iconKey: "check", subject,
        verb: p.verdict === "favorite" ? "made a family favorite of" : "decided to avoid",
        target: company,
        accent: "bg-chip-green text-green-700",
      };
    case "mission_complete":
      return {
        iconKey: "target", subject, verb: "completed the",
        target: `${p.target} mission`,
        accent: "bg-chip-green text-green-700",
      };
    case "session_rsvp":
      return {
        iconKey: "calendar", subject, verb: "is going to",
        target: p.target || "a live class",
        accent: "bg-chip-sky text-sky-800",
      };
    case "level_up":
      return {
        iconKey: "trophy", subject, verb: "leveled up to",
        target: p.level ? `${p.level_name} (Level ${p.level})` : p.level_name || "a new level",
        accent: "bg-chip-amber text-gold-800",
      };
    case "referral_welcome":
      return {
        iconKey: "sparkles", subject, verb: "welcomed",
        target: "a new family to the club",
        accent: "bg-chip-amber text-gold-800",
      };
    default:
      return { iconKey: "sparkles", subject, verb: "", target: "", accent: "bg-sand text-soft" };
  }
}

// ── Misc ─────────────────────────────────────────────────────────────────────
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Split text into segments so URLs render as links (composer "optional link"). */
export interface TextSegment {
  text: string;
  href?: string;
}
export function linkify(text: string): TextSegment[] {
  const re = /(https?:\/\/[^\s]+)/g;
  const out: TextSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
