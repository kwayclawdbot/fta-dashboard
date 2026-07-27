import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CIRCLES — time-boxed sub-groupings of the Club (canvas v2, App board 16).
 *
 * A Circle is a breakout room around ONE event or ONE thesis, opened by a
 * member, on a hard 30-day clock. When the clock runs out the room closes and
 * the thread stands as the record. Backed by `club_circles` /
 * `club_circle_members` / `club_circle_notes` (migration 190) — every count and
 * every name on the surface is a real read. Nothing here is seeded or faked.
 *
 * DELIBERATELY NOT BUILT: the canvas grades a Circle's calls at month end
 * ("Voted by Black Belts · graded at month end", "Accuracy 74%"). Publishing a
 * member's accuracy is a performance claim — CANVAS-V2-ADOPTION-PLAN §0.1. A
 * Circle carries PARTICIPATION (who is in, how many notes) and CONVICTION (the
 * bear/neutral/bull split of the room), never a scoreboard.
 */

/** Mirrors the club-wide stance vocabulary (ticker_stances, migration 151). */
export type CircleStance = "bear" | "neutral" | "bull";

export interface Circle {
  id: string;
  slug: string;
  title: string;
  topic: string;
  premise: string;
  ticker: string | null;
  created_by: string;
  created_at: string;
  expires_at: string;
}

export interface CircleListRow extends Circle {
  members: number;
  notes: number;
}

export interface CirclePerson {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  /** Lifetime XP — resolves the belt. 0 until `xp_for_users` answers. */
  xp: number;
}

export interface CircleNote {
  id: string;
  body: string;
  stance: CircleStance | null;
  created_at: string;
  author: CirclePerson | null;
  isMine: boolean;
}

export interface CircleRoom {
  circle: Circle;
  roster: CirclePerson[];
  notes: CircleNote[];
  /** Bear/neutral/bull tally across the room's notes (one per author, latest). */
  split: Record<CircleStance, number>;
  joined: boolean;
  meId: string | null;
}

/** The clock, in days. Immutable once a Circle is open — that is the format. */
export const CIRCLE_DAYS = 30;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, "public", any>;

/* ── errors ───────────────────────────────────────────────────────────────
   Migration 190 ships in this same commit but is applied out of band. Until it
   lands, PostgREST answers "relation does not exist" (42P01) or "table not
   found in schema cache" (PGRST205). The surface renders a STATED absence for
   that case rather than a crash or, worse, a plausible-looking empty room. */
export function isMissingSchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

/* ── the clock ────────────────────────────────────────────────────────────── */

/** "6d 14h" · "18h" · "42m". Returns null once the clock has run out. */
export function timeLeft(expiresAt: string, now: Date = new Date()): string | null {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, mins)}m`;
}

export function isOpen(c: { expires_at: string }, now: Date = new Date()): boolean {
  return new Date(c.expires_at).getTime() > now.getTime();
}

/* ── identity ─────────────────────────────────────────────────────────────── */

/** URL identity: title-derived, plus a short suffix so two Circles can share a
 *  name without a collision-retry loop. */
export function slugFor(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "circle";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/** Uppercased, punctuation-stripped, or null. Equities only — no options. */
export function normalizeTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/^\$/, "");
  if (!t) return null;
  return /^[A-Z.\-]{1,10}$/.test(t) ? t : null;
}

/* ── reads ────────────────────────────────────────────────────────────────── */

async function peopleFor(supabase: DB, ids: string[]): Promise<Map<string, CirclePerson>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, CirclePerson>();
  if (unique.length === 0) return map;

  const [profiles, xp] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", unique),
    supabase.rpc("xp_for_users", { p_user_ids: unique }),
  ]);

  const xpById = new Map<string, number>();
  for (const r of ((xp.data ?? []) as { user_id: string; xp: number }[]) || []) {
    xpById.set(r.user_id, Number(r.xp) || 0);
  }
  for (const p of (profiles.data ?? []) as Omit<CirclePerson, "xp">[]) {
    map.set(p.id, { ...p, xp: xpById.get(p.id) ?? 0 });
  }
  return map;
}

/** Every Circle plus its real roster/thread counts, soonest clock first. */
export async function listCircles(
  supabase: DB
): Promise<{ rows: CircleListRow[]; missingSchema: boolean }> {
  const { data, error } = await supabase
    .from("club_circles")
    .select("*")
    .order("expires_at", { ascending: true });

  if (error) return { rows: [], missingSchema: isMissingSchema(error) };

  const circles = (data ?? []) as Circle[];
  if (circles.length === 0) return { rows: [], missingSchema: false };

  const { data: counts } = await supabase.rpc("club_circle_counts");
  const byId = new Map<string, { members: number; notes: number }>();
  for (const c of ((counts ?? []) as { circle_id: string; members: number; notes: number }[])) {
    byId.set(c.circle_id, { members: Number(c.members) || 0, notes: Number(c.notes) || 0 });
  }

  return {
    rows: circles.map((c) => ({
      ...c,
      members: byId.get(c.id)?.members ?? 0,
      notes: byId.get(c.id)?.notes ?? 0,
    })),
    missingSchema: false,
  };
}

/** One Circle with its roster and thread. `null` when the slug is unknown. */
export async function getCircleRoom(
  supabase: DB,
  slug: string
): Promise<{ room: CircleRoom | null; missingSchema: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? null;

  const { data, error } = await supabase
    .from("club_circles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { room: null, missingSchema: isMissingSchema(error) };
  if (!data) return { room: null, missingSchema: false };
  const circle = data as Circle;

  const [membersRes, notesRes] = await Promise.all([
    supabase
      .from("club_circle_members")
      .select("member_id, joined_at")
      .eq("circle_id", circle.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("club_circle_notes")
      .select("id, body, stance, created_at, author_id")
      .eq("circle_id", circle.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const memberIds = ((membersRes.data ?? []) as { member_id: string }[]).map((m) => m.member_id);
  const noteRows = (notesRes.data ?? []) as {
    id: string;
    body: string;
    stance: CircleStance | null;
    created_at: string;
    author_id: string;
  }[];

  const people = await peopleFor(supabase, [...memberIds, ...noteRows.map((n) => n.author_id)]);

  // One stance per author (their most recent note carries their position), so a
  // member who writes five times does not become five voices in the split.
  const latestStance = new Map<string, CircleStance>();
  for (const n of [...noteRows].reverse()) {
    if (n.stance) latestStance.set(n.author_id, n.stance);
  }
  const split: Record<CircleStance, number> = { bear: 0, neutral: 0, bull: 0 };
  for (const s of latestStance.values()) split[s] += 1;

  return {
    room: {
      circle,
      roster: memberIds.map((id) => people.get(id)).filter((p): p is CirclePerson => !!p),
      notes: noteRows.map((n) => ({
        id: n.id,
        body: n.body,
        stance: n.stance,
        created_at: n.created_at,
        author: people.get(n.author_id) ?? null,
        isMine: !!meId && n.author_id === meId,
      })),
      split,
      joined: !!meId && memberIds.includes(meId),
      meId,
    },
    missingSchema: false,
  };
}

/* ── writes ───────────────────────────────────────────────────────────────── */

/** Opens a Circle and joins the opener to it. Returns the slug, or an error. */
export async function openCircle(
  supabase: DB,
  input: { title: string; topic: string; premise: string; ticker?: string | null }
): Promise<{ slug: string | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slug: null, error: "You need to be signed in to open a Circle." };

  const slug = slugFor(input.title);
  const expires = new Date(Date.now() + CIRCLE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("club_circles").insert({
    slug,
    title: input.title.trim(),
    topic: input.topic.trim(),
    premise: input.premise.trim(),
    ticker: input.ticker ?? null,
    created_by: user.id,
    expires_at: expires,
  });
  if (error) {
    return {
      slug: null,
      error: isMissingSchema(error)
        ? "Circles aren't switched on for this deployment yet."
        : "That Circle didn't open. Check the title and premise and try again.",
    };
  }

  // The opener is the first member. A Circle with an empty roster would be a
  // room nobody is standing in.
  const { data: created } = await supabase
    .from("club_circles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (created?.id) {
    await supabase
      .from("club_circle_members")
      .insert({ circle_id: created.id, member_id: user.id });
  }
  return { slug, error: null };
}

export async function joinCircle(supabase: DB, circleId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("club_circle_members")
    .insert({ circle_id: circleId, member_id: user.id });
  return !error;
}

export async function leaveCircle(supabase: DB, circleId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("club_circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("member_id", user.id);
  return !error;
}

export async function postCircleNote(
  supabase: DB,
  circleId: string,
  body: string,
  stance: CircleStance | null
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("club_circle_notes").insert({
    circle_id: circleId,
    author_id: user.id,
    body: body.trim(),
    stance,
  });
  return !error;
}
