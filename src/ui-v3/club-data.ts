import "server-only";

import { getRequestClient, getRequestProfile, getRequestUser } from "@/lib/supabase/rsc";
import {
  getCircleRoom,
  listCircles,
  timeLeft,
  CIRCLE_DAYS,
  type CircleListRow,
  type CircleStance,
} from "@/lib/circles";
import { getCommunityFeedSeed } from "@/lib/feed-seed";
import { fetchChangedMinds } from "@/lib/social/stance";
import { isSharedFeedReadOnly, KID_FEED_READONLY_NOTE } from "@/lib/social/kid-posting";
import { deriveRegister } from "@/lib/register";
import { buildClubHomePayload } from "@/lib/club/home-payload";
import { resolveClubCtx } from "@/lib/club/home-context";
import { beltForXp, type BeltKey } from "@/lib/belts";
import { timeAgo } from "@/lib/feed";

/**
 * ui-v3 Club — the ONLY data access the three Club screens perform.
 *
 * Same contract as src/ui-v3/home-data.ts, and for the same reason: every
 * component under src/ui-v3/components/club is pure presentation, so one tree
 * serves a signed-in member (live Supabase reads) and an anonymous visitor
 * (fixtures) with no conditional inside the markup.
 *
 * HONESTY RULES (from DESIGN-GRAMMAR §9.5):
 *  - A field with no real source is `null` and the component omits that element.
 *  - Fixture-only content is reachable ONLY through `source: "fixtures"`, which
 *    is only chosen when there is no authenticated user.
 *  - Where the artboard draws a capability the data layer does not have, the
 *    region is rendered in a documented static state and listed in §"GAPS"
 *    below. It is never filled with an invented number.
 *
 * GAPS against the artboards (all flagged in the lane report):
 *  1. Circles carry no emoji/icon column. The artboards give every non-ticker
 *     Circle an emoji (🏛 ⚡ 💊 …); a Circle with a `ticker` renders the
 *     mockup-derived ticker paint, and one without falls back to the artboards'
 *     own documented NEUTRAL tile treatment with the topic's initial.
 *  2. No presence anywhere: the "312 online" count, the online dot and the
 *     "… is typing" line are omitted, not faked.
 *  3. A Circle has no channels. `club_circle_notes` is the single stream, so the
 *     "# takes" chip is real and "# charts" / "# receipts" / "🔊 live" render as
 *     inert chips.
 *  4. Circle notes carry no reactions, no threaded replies and no attachments,
 *     so those three regions of "23 Inside Circle" are omitted.
 *  5. The artboard's "Circle sentiment moved +6 pts bullish" needs a per-circle
 *     sentiment SERIES. Only the current split exists (one stance per author),
 *     so the Kai row states the split instead of a delta.
 *
 * GAP 6 IS CLOSED. The composers used to be display-only. They now write to the
 * SAME tables the old app writes — `feed_posts` (+ `ticker_stances` /
 * `stance_events` via `set_ticker_stance`), `post_likes`, `object_reactions` and
 * `club_circle_notes` — through `src/lib/*` helpers, under the member's own RLS.
 * No new table, no new RPC, no new migration. The write half lives in client
 * components; this adapter's job is to hand them the VIEWER (who am I, may I
 * post) and the interaction state (did I already like this, did I already
 * respect that) so no component has to ask the database who is looking at it.
 */

// ── view model ───────────────────────────────────────────────────────────────

/**
 * WHO IS LOOKING, and what they are allowed to do.
 *
 * Every participation control on these screens is gated on this one object, so
 * there is exactly one place the gate is decided and exactly one wording for the
 * refusal. Two postures, both mirroring a server-side rule rather than inventing
 * a client-side one:
 *
 *  - `null` — nobody is signed in. Controls prompt for sign-in; they are never
 *    hidden, because a feed you cannot answer looks broken rather than locked.
 *  - `canPost: false` with a `readOnlyNote` — the KID register. The authority is
 *    the RLS policy on `feed_posts` INSERT (`kid_feed_readonly() AND
 *    viewer_is_kid()`, migration 161) and the identical clause on
 *    `club_circle_notes` / `club_circle_members` INSERT (migration 191). This
 *    flag is the UI half of that pair, read through the same
 *    `isSharedFeedReadOnly()` the old app's composer reads, so the two halves
 *    can never drift apart. Reactions stay OPEN to kids — the reaction tables
 *    carry no kid clause, and SOCIAL-OBJECTS says kids read and react freely.
 */
export interface ClubViewerVM {
  id: string;
  familyId: string | null;
  /** May this member author a post / a Circle note / a Circle? */
  canPost: boolean;
  /** Why not, in the member's own register. Null when they can. */
  readOnlyNote: string | null;
}

/** The 96px Circle bubble, shared by "04 Club Feed" and "16 Club Circles". */
export interface CircleBubbleVM {
  slug: string;
  title: string;
  /** `club_circles.topic` — the artboard's "Semis" / "Macro" / "Thesis" word. */
  topic: string;
  /** `club_circles.ticker`, or null. Drives the tile paint and the glyph. */
  ticker: string | null;
  /** `timeLeft(expires_at)`. Null once the clock has run out. */
  clock: string | null;
  /** The artboard paints the clock --negative under 48h, --accent-strong above. */
  urgent: boolean;
  /** `club_circle_counts().members`. */
  members: number;
  /**
   * 0-100 — the elapsed share of this Circle's own clock, which is what the
   * artboard's conic arc encodes (NVDA at 22% of its 30 days, and the same 22%
   * appears again on "23 Inside Circle" for the same Circle).
   */
  elapsedPct: number;
}

export interface FeedPostVM {
  id: string;
  authorName: string;
  initials: string;
  /** "Black Belt" — `beltForXp(lifetime xp).belt.name`. Degree is dropped to match the artboard chip. */
  beltLabel: string | null;
  beltKey: BeltKey | null;
  /** First entry of `feed_posts.ticker_tags`. */
  ticker: string | null;
  /** `timeAgo(created_at)`. */
  time: string;
  body: string;
  /** `post_likes` count. */
  likes: number | null;
  /** `post_comments` count. */
  comments: number | null;
  /**
   * Does a `post_likes` row already exist for this viewer? The 👍 control is a
   * TOGGLE, so it has to open in the right state or the first tap deletes a row
   * the member cannot see and the count goes down.
   */
  likedByMe: boolean;
}

export interface ChangedMindVM {
  id: string;
  authorName: string;
  initials: string;
  beltLabel: string | null;
  beltKey: BeltKey | null;
  ticker: string;
  /** `stance_events.from_stance` → the artboard's "Bearish" run, stance-toned. */
  fromLabel: string | null;
  fromStance: CircleStance | null;
  /** `stance_events.to_stance` → the artboard's neutral-toned second run. */
  toLabel: string;
  note: string | null;
  /** `object_reactions` respect count on the stance event — the artboard's 🔥. */
  respect: number | null;
  /** `get_changed_minds().my_respect` — the toggle's opening state. */
  myRespect: boolean;
}

/**
 * Seeded demo content carries a provenance marker in the body — `[seed:v2demo]`
 * and friends — so an operator can tell fixture rows from member rows in the
 * database. It is bookkeeping, not something a member wrote, and it was printing
 * verbatim at the end of every seeded post in the live feed.
 *
 * Stripped at READ time, deliberately: the marker stays in the row so the seed
 * remains identifiable, and no migration is needed to make the feed read right.
 */
function cleanBody(body: string): string {
  return body.replace(/\[seed:[^\]]*\]/g, "").trim();
}

/** The artboard's "Kai Insight" row. Nearest real source: a club pulse signal. */
export interface KaiInsightVM {
  headline: string;
  ticker: string | null;
}

export interface ClubFeedViewModel {
  source: "live" | "fixtures";
  /** The composer avatar. Empty string hides it. */
  initials: string;
  /** Null for an anonymous visitor — see ClubViewerVM. */
  viewer: ClubViewerVM | null;
  circles: CircleBubbleVM[];
  posts: FeedPostVM[];
  changedMind: ChangedMindVM | null;
  kai: KaiInsightVM | null;
}

export interface ClubCirclesViewModel {
  source: "live" | "fixtures";
  rows: CircleBubbleVM[];
  /** True when migration 191 has not been applied to this database. */
  missingSchema: boolean;
  viewer: ClubViewerVM | null;
}

export interface CircleNoteVM {
  id: string;
  authorName: string;
  initials: string;
  beltKey: BeltKey | null;
  /** "Black" — the artboard's 2-glyph belt badge, from the real belt name. */
  beltShort: string | null;
  /** The artboard's "9:41 AM". */
  time: string;
  body: string;
  stance: CircleStance | null;
  /** `club_circles.created_by === author_id`. The artboard tints the opener accent. */
  isOpener: boolean;
}

/** Notes under one date divider ("TODAY" on the artboard). */
export interface NoteGroupVM {
  label: string;
  notes: CircleNoteVM[];
}

export interface CircleRoomViewModel {
  source: "live" | "fixtures";
  /** `club_circles.id` — what a note and a join are written against. */
  id: string;
  slug: string;
  title: string;
  topic: string;
  ticker: string | null;
  /** `club_circles.premise` — the artboard's pinned "Circle thesis:" bar. */
  premise: string;
  clock: string | null;
  urgent: boolean;
  elapsedPct: number;
  members: number;
  groups: NoteGroupVM[];
  /** One stance per author. Feeds the Kai row; null when nobody has staked one. */
  split: { bull: number; neutral: number; bear: number } | null;
  /** The composer placeholder's channel name. */
  channel: string;
  viewer: ClubViewerVM | null;
  /**
   * Is this viewer on the roster? `club_circle_notes` INSERT is member-gated in
   * RLS, so a non-member gets the JOIN affordance instead of the composer —
   * joining is a real write (`club_circle_members`, migration 191) and not a
   * dead button.
   */
  joined: boolean;
  /** The clock has not run out. A closed Circle takes no more notes and no joins. */
  open: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** The artboards' "1.8K joined" form. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`;
}

/** The artboards' "1,804 members" form. */
export function groupedCount(n: number): string {
  return n.toLocaleString("en-US");
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The artboard's stance wording. */
const STANCE_WORD: Record<CircleStance, string> = {
  bull: "Bullish",
  bear: "Bearish",
  neutral: "Neutral",
};

/** Under 48h the artboard flips the clock from --accent-strong to --negative. */
const URGENT_HOURS = 48;

function isUrgent(expiresAt: string, now: number): boolean {
  const ms = new Date(expiresAt).getTime() - now;
  return ms > 0 && ms < URGENT_HOURS * 3600_000;
}

/**
 * The conic arc's fill. A Circle's clock is at most CIRCLE_DAYS long but may be
 * shorter, so the share is measured against ITS OWN created_at → expires_at span
 * rather than a flat 30 days.
 */
function elapsedPctOf(createdAt: string, expiresAt: string, now: number): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  const span = end - start;
  if (!Number.isFinite(span) || span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / span) * 100)));
}

function beltNameFor(xp: number | undefined): { key: BeltKey; name: string } | null {
  if (typeof xp !== "number") return null;
  const { belt } = beltForXp(xp);
  return { key: belt.key, name: belt.name };
}

/** The artboard's "9:41 AM". */
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The artboard's centred "TODAY" pill; older days get their own date. */
function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "TODAY";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

// ── mappers ──────────────────────────────────────────────────────────────────

/** "04 Club Feed" draws three bubbles; "16 Club Circles" draws eight + the opener tile. */
const FEED_CIRCLE_LIMIT = 3;
const CIRCLES_GRID_LIMIT = 8;
/** The artboard's feed shows one plain post, one changed-mind card and one Kai row. */
const FEED_POST_LIMIT = 2;

function mapCircle(row: CircleListRow, now: number): CircleBubbleVM {
  return {
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    ticker: row.ticker,
    clock: timeLeft(row.expires_at, new Date(now)),
    urgent: isUrgent(row.expires_at, now),
    members: row.members,
    elapsedPct: elapsedPctOf(row.created_at, row.expires_at, now),
  };
}

/** Shape of one `pulse` signal as it crosses the payload boundary. */
interface RawPulseSignal {
  kind?: string | null;
  ticker?: string | null;
  headline?: string | null;
  detail?: string | null;
}

/**
 * The artboard's Kai row.
 *
 * There is no AI-authored feed post in the schema. The closest real thing is a
 * club `pulse` signal — and its `pattern` kind IS the Kai one ("Kai spotted a
 * pattern"), so that kind is preferred and any other signal is the fallback.
 */
function mapKai(pulse: unknown): KaiInsightVM | null {
  if (!pulse || typeof pulse !== "object") return null;
  const signals = (pulse as { signals?: unknown }).signals;
  if (!Array.isArray(signals)) return null;
  const list = signals as RawPulseSignal[];
  const pick = list.find((s) => s?.kind === "pattern") ?? list[0];
  if (!pick) return null;
  const headline = pick.detail || pick.headline;
  if (typeof headline !== "string" || headline.length === 0) return null;
  return { headline, ticker: pick.ticker ?? null };
}

// ── fixtures branch ──────────────────────────────────────────────────────────

/*
 * There are no Circle, feed-post or Circle-note fixtures anywhere in the repo,
 * and the shared club fixtures carry nothing shaped like one. So — exactly as
 * home-data.ts does for the greeting name and the index chips — the fixture
 * branch below IS THE ARTBOARD'S OWN CONTENT, used purely so the side-by-side
 * proof is complete. It is unreachable for any authenticated member.
 */

/** Build a fixture Circle from the artboard's own copy. */
function fixtureCircle(
  slug: string,
  title: string,
  topic: string,
  ticker: string | null,
  clock: string,
  urgent: boolean,
  members: number,
  elapsedPct: number
): CircleBubbleVM {
  return { slug, title, topic, ticker, clock, urgent, members, elapsedPct };
}

/** The eight Circles of "16 Club Circles", in artboard order. */
function fixtureCircles(): CircleBubbleVM[] {
  return [
    fixtureCircle("nvda-earnings", "NVDA Earnings", "Semis", "NVDA", "6d 14h", false, 1804, 22),
    fixtureCircle("fed-decision", "Fed Decision", "Macro", null, "1d 20h", true, 862, 7),
    fixtureCircle("tesla-robotaxi", "Tesla Robotaxi", "EV", "TSLA", "10d 3h", false, 1240, 34),
    fixtureCircle("ai-capex-cycle", "AI Capex Cycle", "Thesis", null, "16d", false, 940, 55),
    fixtureCircle("nuclear-trade", "Nuclear Trade", "Energy", null, "21d", false, 612, 70),
    fixtureCircle("glp-1-winners", "GLP-1 Winners", "Health", null, "14d", false, 505, 46),
    fixtureCircle("btc-halving", "BTC Halving+1yr", "Crypto", null, "24d", false, 488, 80),
    fixtureCircle("defense-budget", "Defense Budget", "Macro", null, "27d", false, 390, 90),
  ];
}

function fixtureFeedModel(): ClubFeedViewModel {
  return {
    source: "fixtures",
    initials: "MH",
    // The fixture branch is the ANONYMOUS branch, so there is no viewer and
    // every participation control renders its signed-out posture.
    viewer: null,
    circles: fixtureCircles().slice(0, FEED_CIRCLE_LIMIT),
    posts: [
      {
        id: "fx-post-1",
        authorName: "Marcus Hill",
        initials: "MH",
        beltLabel: "Black",
        beltKey: "black",
        ticker: "NVDA",
        time: "2m ago",
        body: "Blackwell demand is even stronger than the Street expects.",
        likes: 42,
        comments: 17,
        likedByMe: false,
      },
    ],
    changedMind: {
      id: "fx-flip-1",
      authorName: "Tiffany R.",
      initials: "TR",
      beltLabel: "Blue",
      beltKey: "blue",
      ticker: "TSLA",
      fromLabel: "Bearish",
      fromStance: "bear",
      toLabel: "Neutral",
      note: "The Robotaxi event changed my view short term. Let's see execution.",
      respect: 31,
      myRespect: false,
    },
    kai: { headline: "Unusual options flow detected", ticker: "AMD" },
  };
}

function fixtureCirclesModel(): ClubCirclesViewModel {
  return { source: "fixtures", rows: fixtureCircles(), missingSchema: false, viewer: null };
}

function fixtureRoomModel(slug: string): CircleRoomViewModel {
  const nvda = fixtureCircles()[0];
  return {
    source: "fixtures",
    id: "fx-circle-1",
    viewer: null,
    joined: false,
    open: true,
    slug: slug || nvda.slug,
    title: nvda.title,
    topic: nvda.topic,
    ticker: nvda.ticker,
    premise: "Blackwell demand > guidance. Graded at close on ER day.",
    clock: nvda.clock,
    urgent: nvda.urgent,
    elapsedPct: nvda.elapsedPct,
    members: nvda.members,
    channel: "takes",
    split: { bull: 18, neutral: 7, bear: 4 },
    groups: [
      {
        label: "TODAY",
        notes: [
          {
            id: "fx-note-1",
            authorName: "OptionsOG",
            initials: "OG",
            beltKey: "black",
            beltShort: "Black",
            time: "9:41 AM",
            body: "Checks from Taiwan overnight — CoWoS capacity fully booked through Q2. The $NVDA supply story is intact.",
            stance: "bull",
            isOpener: true,
          },
          {
            id: "fx-note-2",
            authorName: "Tiffany R.",
            initials: "TR",
            beltKey: "blue",
            beltShort: null,
            time: "9:44 AM",
            body: "Counter: implied move is only ±7.8%. Market's already paying for the beat.",
            stance: "neutral",
            isOpener: false,
          },
          {
            id: "fx-note-3",
            authorName: "DataDive",
            initials: "DD",
            beltKey: "yellow",
            beltShort: null,
            time: "9:52 AM",
            body: "Posted the hyperscaler capex read — six straight quarters of acceleration.",
            stance: "bull",
            isOpener: false,
          },
          {
            id: "fx-note-4",
            authorName: "DeShawn K.",
            initials: "DK",
            beltKey: "white",
            beltShort: null,
            time: "10:02 AM",
            body: "@OptionsOG what strikes are you playing into the print?",
            stance: null,
            isOpener: false,
          },
        ],
      },
    ],
  };
}

// ── the viewer ───────────────────────────────────────────────────────────────

/**
 * Resolve the participation posture from the request profile.
 *
 * `deriveRegister` + `isSharedFeedReadOnly` are the SAME pair the old app's
 * composer uses, so the v3 gate and the shipped gate are one decision made in
 * one place. If the owner ever re-opens kid posting they flip the constant in
 * `kid-posting.ts` and the RLS predicate — and both front ends follow.
 */
function viewerFrom(
  userId: string,
  profile: { role: string | null; age_group: string | null; track: string | null; family_id: string | null } | null
): ClubViewerVM {
  const readOnly = isSharedFeedReadOnly(deriveRegister(profile));
  return {
    id: userId,
    familyId: profile?.family_id ?? null,
    canPost: !readOnly,
    readOnlyNote: readOnly ? KID_FEED_READONLY_NOTE : null,
  };
}

/**
 * What the composer route needs before it can draw anything: who is writing,
 * and whether they are allowed to. Its own entry point because /v3/club/compose
 * reads none of the feed.
 */
export async function getComposeViewer(): Promise<ClubViewerVM | null> {
  const user = await getRequestUser();
  if (!user) return null;
  const profile = await getRequestProfile();
  return viewerFrom(user.id, profile ?? null);
}

// ── entry points ─────────────────────────────────────────────────────────────

/**
 * "04 Club Feed".
 *
 * Four independent reads, run together: the Circles strip, the feed seed, the
 * changed-mind RPC and the club `pulse` core. Any one of them coming back empty
 * removes its region rather than failing the screen.
 */
export async function getClubFeedViewModel(): Promise<ClubFeedViewModel> {
  const user = await getRequestUser();
  if (!user) return fixtureFeedModel();

  const supabase = await getRequestClient();
  const now = Date.now();

  const [circlesRes, seed, flips, profile, pulse] = await Promise.all([
    listCircles(supabase).catch(() => ({ rows: [], missingSchema: true })),
    getCommunityFeedSeed(supabase).catch(() => null),
    fetchChangedMinds(supabase, 1).catch(() => null),
    getRequestProfile(),
    // Only the ONE core the Kai row needs — the other eight are not read here.
    resolveClubCtx(supabase)
      .then((ctx) => (ctx ? buildClubHomePayload(ctx, ["pulse"]) : null))
      .then((payload) => payload?.pulse ?? null)
      .catch(() => null),
  ]);

  const displayName = profile?.display_name?.trim() ?? "";
  const viewer = viewerFrom(user.id, profile ?? null);
  // `likedByMe` arrives from the feed seed as a serialisable array; a Set is what
  // a per-row lookup wants.
  const liked = new Set(seed?.likedByMe ?? []);

  const posts: FeedPostVM[] = (seed?.posts ?? [])
    // Emptiness is judged AFTER the marker comes off, so a row whose only
    // content was a marker never reaches the feed.
    .filter((p) => p.kind === "post" && cleanBody(p.body).length > 0)
    .slice(0, FEED_POST_LIMIT)
    .map((p) => {
      const name = p.author?.display_name?.trim() || "Member";
      const belt = beltNameFor(p.author?.id ? seed?.beltXp[p.author.id] : undefined);
      return {
        id: p.id,
        authorName: name,
        initials: initialsFrom(name),
        beltLabel: belt?.name ?? null,
        beltKey: belt?.key ?? null,
        ticker: p.ticker_tags?.[0] ?? null,
        time: timeAgo(p.created_at),
        body: cleanBody(p.body),
        likes: seed?.likeCount[p.id] ?? 0,
        comments: seed?.commentCount[p.id] ?? 0,
        likedByMe: liked.has(p.id),
      };
    });

  const flip = flips?.items?.[0] ?? null;
  const flipName = flip?.display_name?.trim() || flip?.username || "Member";
  const changedMind: ChangedMindVM | null = flip
    ? {
        id: flip.id,
        authorName: flipName,
        initials: initialsFrom(flipName),
        // get_changed_minds returns no XP, so the belt chip has no source here.
        beltLabel: null,
        beltKey: null,
        ticker: flip.ticker,
        fromLabel: flip.from_stance ? STANCE_WORD[flip.from_stance] : null,
        fromStance: flip.from_stance ?? null,
        toLabel: STANCE_WORD[flip.to_stance],
        note: flip.note ? cleanBody(flip.note) || null : null,
        respect: flip.respect_count ?? null,
        myRespect: !!flip.my_respect,
      }
    : null;

  return {
    source: "live",
    initials: initialsFrom(displayName || "Member"),
    viewer,
    circles: circlesRes.rows.slice(0, FEED_CIRCLE_LIMIT).map((r) => mapCircle(r, now)),
    posts,
    changedMind,
    kai: mapKai(pulse),
  };
}

/** "16 Club Circles". */
export async function getClubCirclesViewModel(): Promise<ClubCirclesViewModel> {
  const user = await getRequestUser();
  if (!user) return fixtureCirclesModel();

  const supabase = await getRequestClient();
  const now = Date.now();
  const [{ rows, missingSchema }, profile] = await Promise.all([
    listCircles(supabase).catch(() => ({
      rows: [] as CircleListRow[],
      missingSchema: true,
    })),
    getRequestProfile(),
  ]);

  return {
    source: "live",
    rows: rows.slice(0, CIRCLES_GRID_LIMIT).map((r) => mapCircle(r, now)),
    missingSchema,
    viewer: viewerFrom(user.id, profile ?? null),
  };
}

/**
 * "23 Inside Circle".
 *
 * `slug` is `club_circles.slug` — the table's own URL identity. An unknown slug
 * for an anonymous visitor is the fixture Circle (so the design proof works
 * without credentials); for a member it is `null`, and the route 404s.
 */
export async function getCircleRoomViewModel(
  slug: string
): Promise<CircleRoomViewModel | null> {
  const user = await getRequestUser();
  if (!user) return fixtureRoomModel(slug);

  const supabase = await getRequestClient();
  const [{ room }, profile] = await Promise.all([
    getCircleRoom(supabase, slug).catch(() => ({ room: null })),
    getRequestProfile(),
  ]);
  if (!room) return null;

  const now = new Date();
  const nowMs = now.getTime();
  const { circle, notes, roster, split } = room;

  // The thread arrives newest-first; the artboard reads oldest-first down the
  // screen, under one date divider per day.
  const ordered = [...notes].reverse();
  const groups: NoteGroupVM[] = [];
  for (const n of ordered) {
    const label = dayLabel(n.created_at, now);
    const name = n.author?.display_name?.trim() || n.author?.username || "Member";
    const belt = beltNameFor(n.author?.xp);
    const vm: CircleNoteVM = {
      id: n.id,
      authorName: name,
      initials: initialsFrom(name),
      beltKey: belt?.key ?? null,
      beltShort: belt?.name ?? null,
      time: clockTime(n.created_at),
      body: cleanBody(n.body),
      stance: n.stance,
      isOpener: n.author?.id === circle.created_by,
    };
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(vm);
    else groups.push({ label, notes: [vm] });
  }

  const staked = split.bull + split.neutral + split.bear;
  const clock = timeLeft(circle.expires_at, now);

  return {
    source: "live",
    id: circle.id,
    viewer: viewerFrom(user.id, profile ?? null),
    joined: room.joined,
    // The same predicate the RLS policy applies (`expires_at > now()`), so the
    // composer disappears at exactly the moment the write would start failing.
    open: clock !== null,
    slug: circle.slug,
    title: circle.title,
    topic: circle.topic,
    ticker: circle.ticker,
    premise: circle.premise,
    clock,
    urgent: isUrgent(circle.expires_at, nowMs),
    elapsedPct: elapsedPctOf(circle.created_at, circle.expires_at, nowMs),
    members: roster.length,
    groups,
    split: staked > 0 ? split : null,
    channel: "takes",
  };
}

/** Re-exported so a component can state the clock's ceiling without a magic number. */
export { CIRCLE_DAYS };
