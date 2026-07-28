import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyGuardrails } from "@/lib/family/guardrails";
import { DEFAULT_GUARDRAILS } from "@/lib/family/guardrails";
import { researchComplete, type WatchlistItem } from "@/lib/watchlist";

/**
 * FAMILY MODE — server reads (canvas F1–F9).
 *
 * Every function here is called from a server component so the screens arrive
 * with their data already resolved. That is a rule, not a preference: the
 * original defect this codebase keeps rediscovering is a surface rendering its
 * founding state while a client fetch is still in flight (adoption plan §0.4).
 * Seeded server data means "loading" and "empty" cannot be confused, because
 * loading is over by the time the markup exists.
 *
 * Absence is always `null`, never a plausible-looking substitute. The one
 * number this file refuses to compute at all is member accuracy — the canvas
 * draws "Call accuracy 67%" on the teen account, and publishing a member's hit
 * rate is a performance claim (adoption plan §0.1). Conviction and
 * participation are shipped in its place.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>;

export interface FamilyMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  age_group: string | null;
  xp: number;
}

export interface FamilyContext {
  userId: string;
  role: string;
  isParent: boolean;
  familyId: string;
  familyName: string | null;
  members: FamilyMember[];
  /** Supervised members — the ones guardrails and the teen screens apply to. */
  kids: FamilyMember[];
  familyXp: number;
}

/**
 * The spine every family screen starts from. Returns null when the viewer has
 * no family — the caller redirects rather than rendering an empty household.
 */
export async function getFamilyContext(db: DB): Promise<FamilyContext | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: me } = await db
    .from("profiles")
    .select("id, role, family_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.family_id) return null;

  const [{ data: family }, { data: rows }] = await Promise.all([
    db.from("families").select("name").eq("id", me.family_id).maybeSingle(),
    db
      .from("profiles")
      .select("id, display_name, avatar_url, role, age_group")
      .eq("family_id", me.family_id),
  ]);

  const people = (rows ?? []) as Omit<FamilyMember, "xp">[];
  const ids = people.map((p) => p.id);

  // xp_for_users (migration 118) is the sanctioned batched read — one grouped
  // SUM, never an N+1, and it does not depend on the xp_events family policy
  // staying as permissive as it is today.
  const xpByUser = new Map<string, number>();
  if (ids.length) {
    const { data: xp } = await db.rpc("xp_for_users", { p_user_ids: ids });
    for (const e of (xp ?? []) as { user_id: string; xp: number }[]) {
      xpByUser.set(e.user_id, Number(e.xp) || 0);
    }
  }

  const members: FamilyMember[] = people
    .map((p) => ({ ...p, xp: xpByUser.get(p.id) ?? 0 }))
    .sort((a, b) => {
      if (a.role === b.role) return (b.xp ?? 0) - (a.xp ?? 0);
      return a.role === "parent" ? -1 : 1;
    });

  return {
    userId: user.id,
    role: me.role ?? "member",
    // Admins are parents for gating purposes. The old /parent-corner admitted
    // `parent || admin`; narrowing to parent-only on the merge locked admins
    // (incl. the owner) out of every parent surface — caught by the live sweep
    // when /family/corner bounced the owner's admin account to /family.
    isParent: me.role === "parent" || me.role === "admin",
    familyId: me.family_id,
    familyName: (family?.name as string | null) ?? null,
    members,
    kids: members.filter((m) => m.role === "child"),
    familyXp: members.reduce((s, m) => s + m.xp, 0),
  };
}

// ── F1 · the family challenge ───────────────────────────────────────────────

export interface PaperStanding {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  /** null when the member has never opened a paper account. */
  return_pct: number | null;
  balance: number | null;
}

/**
 * Paper standings for the whole household. Goes through the definer RPC because
 * sim_portfolios RLS is strictly own-row (migration 003) — a parent genuinely
 * cannot read a child's portfolio any other way.
 */
export async function getPaperStandings(db: DB, familyId: string): Promise<PaperStanding[]> {
  const { data } = await db.rpc("family_paper_standings", { p_family: familyId });
  return ((data ?? []) as PaperStanding[]).filter(Boolean);
}

/**
 * The benchmark the challenge is run against. Reads the EOD close cache
 * (asset_prices, migration 178) for SPY. Returns null when the cache has no
 * usable pair — the screen then says so instead of inventing a market return.
 */
export async function getBenchmarkReturn(db: DB, days = 7): Promise<number | null> {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await db
    .from("asset_prices")
    .select("as_of, close")
    .eq("symbol", "SPY")
    .gte("as_of", since)
    .order("as_of", { ascending: true });

  const rows = (data ?? []) as { as_of: string; close: number }[];
  if (rows.length < 2) return null;
  const first = Number(rows[0].close);
  const last = Number(rows[rows.length - 1].close);
  if (!first) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

// ── F2 · the teen paper account ─────────────────────────────────────────────

export interface PaperPosition {
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  opened_at: string;
}

export interface PaperAccount {
  portfolio: {
    balance: number;
    starting_balance: number;
    total_trades: number;
    winning_trades: number;
    total_pnl: number;
  } | null;
  positions: PaperPosition[];
}

export async function getPaperAccount(db: DB, childId: string): Promise<PaperAccount> {
  const { data } = await db.rpc("family_paper_account", { p_child: childId });
  const payload = (data ?? {}) as Partial<PaperAccount>;
  return {
    portfolio: payload.portfolio ?? null,
    positions: payload.positions ?? [],
  };
}

// ── F3 · guardrails, the audit log, the digest ──────────────────────────────

export async function getGuardrails(
  db: DB,
  childId: string,
  familyId: string
): Promise<FamilyGuardrails> {
  const { data } = await db
    .from("family_guardrails")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();

  if (data) return data as FamilyGuardrails;

  // No row yet = the documented defaults. Rendering them is honest: the RPC
  // creates the row on the first change, with exactly these starting values.
  return {
    child_id: childId,
    family_id: familyId,
    updated_at: new Date().toISOString(),
    updated_by: null,
    ...DEFAULT_GUARDRAILS,
  };
}

export interface GuardrailEvent {
  id: string;
  setting: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  actor_name: string | null;
}

export async function getGuardrailEvents(
  db: DB,
  childId: string,
  limit = 6
): Promise<GuardrailEvent[]> {
  const { data } = await db
    .from("family_guardrail_events")
    .select("id, setting, old_value, new_value, created_at, actor_id")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as (Omit<GuardrailEvent, "actor_name"> & { actor_id: string | null })[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string | null>();
  if (actorIds.length) {
    const { data: people } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    for (const p of (people ?? []) as { id: string; display_name: string | null }[]) {
      names.set(p.id, p.display_name);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    setting: r.setting,
    old_value: r.old_value,
    new_value: r.new_value,
    created_at: r.created_at,
    actor_name: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
  }));
}

export interface FamilyDigest {
  app_minutes: number;
  learn_seconds: number;
  lessons: number;
  xp: number;
  paper_pct: number | null;
  /** Always null today — there is no moderation-flag store to read. */
  flags: number | null;
}

export async function getDigest(db: DB, childId: string): Promise<FamilyDigest | null> {
  const { data, error } = await db.rpc("family_child_digest", { p_child: childId });
  if (error || !data) return null;
  return data as FamilyDigest;
}

// ── F4 · the family circle ──────────────────────────────────────────────────

export interface CircleMessage {
  id: string;
  author_id: string | null;
  kind: string;
  body: string;
  created_at: string;
}

export async function getCircleMessages(db: DB, familyId: string, limit = 50) {
  const { data } = await db
    .from("family_circle_messages")
    .select("id, author_id, kind, body, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as CircleMessage[]).reverse();
}

// ── F5 / F9 · learning ──────────────────────────────────────────────────────

export interface SkillReading {
  id: string;
  name: string;
  domain: string;
  mastery: number;
}

export async function getSkillMastery(db: DB, userId: string): Promise<SkillReading[]> {
  const [{ data: skills }, { data: mastery }] = await Promise.all([
    db.from("skills").select("id, name, domain, sort").order("sort", { ascending: true }),
    db.from("skill_mastery").select("skill_id, mastery_score").eq("user_id", userId),
  ]);

  const scores = new Map<string, number>();
  for (const m of (mastery ?? []) as { skill_id: string; mastery_score: number }[]) {
    scores.set(m.skill_id, m.mastery_score);
  }

  const byDomain = new Map<string, { total: number; n: number; name: string }>();
  for (const s of (skills ?? []) as { id: string; name: string; domain: string }[]) {
    const entry = byDomain.get(s.domain) ?? { total: 0, n: 0, name: s.domain };
    entry.total += scores.get(s.id) ?? 0;
    entry.n += 1;
    byDomain.set(s.domain, entry);
  }

  return [...byDomain.entries()].map(([domain, v]) => ({
    id: domain,
    name: DOMAIN_LABELS[domain] ?? domain,
    domain,
    mastery: v.n ? Math.round(v.total / v.n) : 0,
  }));
}

const DOMAIN_LABELS: Record<string, string> = {
  business: "Business",
  markets: "Markets",
  technical: "Charts",
  risk: "Risk",
  psychology: "Mindset",
};

export interface LessonCounts {
  completed: number;
  total: number;
  minutes: number;
}

export async function getLessonCounts(db: DB, userIds: string[]): Promise<Map<string, LessonCounts>> {
  const out = new Map<string, LessonCounts>();
  if (!userIds.length) return out;
  const { data } = await db
    .from("lesson_progress")
    .select("user_id, status, time_spent_sec")
    .in("user_id", userIds);
  for (const r of (data ?? []) as {
    user_id: string;
    status: string;
    time_spent_sec: number | null;
  }[]) {
    const cur = out.get(r.user_id) ?? { completed: 0, total: 0, minutes: 0 };
    cur.total += 1;
    if (r.status === "completed") cur.completed += 1;
    cur.minutes += Math.round((r.time_spent_sec ?? 0) / 60);
    out.set(r.user_id, cur);
  }
  return out;
}

/** The next unfinished published FIC lesson for a member — F5's "Up next". */
export async function getNextLesson(db: DB, userId: string) {
  const { data: done } = await db
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "completed");
  const doneIds = new Set(((done ?? []) as { lesson_id: string }[]).map((d) => d.lesson_id));

  const { data: lessons } = await db
    .from("lessons")
    .select("id, title, video_duration_sec, sort_order, module_id, modules!inner(course_id, sort_order, courses!inner(program, published))")
    .order("sort_order", { ascending: true })
    .limit(200);

  type Row = {
    id: string;
    title: string;
    video_duration_sec: number | null;
    modules: { courses: { program: string; published: boolean } } | null;
  };

  for (const l of (lessons ?? []) as unknown as Row[]) {
    const course = l.modules?.courses;
    if (!course?.published || course.program !== "fic") continue;
    if (doneIds.has(l.id)) continue;
    return {
      id: l.id,
      title: l.title,
      minutes: l.video_duration_sec ? Math.max(1, Math.round(l.video_duration_sec / 60)) : null,
    };
  }
  return null;
}

// ── F6 · the watchlist vote ─────────────────────────────────────────────────

export interface CircleVote {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string | null;
  vote_night: string;
}

export async function getVotes(db: DB, familyId: string, night: string): Promise<CircleVote[]> {
  const { data } = await db
    .from("family_watchlist_votes")
    .select("id, user_id, ticker, company_name, vote_night")
    .eq("family_id", familyId)
    .eq("vote_night", night);
  return (data ?? []) as CircleVote[];
}

export interface WatchlistEntry {
  id: string;
  ticker: string;
  company_name: string;
  status: string;
  updated_at: string;
}

export async function getFamilyWatchlist(db: DB, familyId: string): Promise<WatchlistEntry[]> {
  const { data } = await db
    .from("family_watchlist")
    .select("id, ticker, company_name, status, updated_at")
    .eq("family_id", familyId)
    .order("updated_at", { ascending: false })
    .limit(12);
  return (data ?? []) as WatchlistEntry[];
}

// ── F8 · family missions ────────────────────────────────────────────────────

export interface FamilyMission {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kid_prompt: string | null;
  xp_reward: number;
  /** Members of this household who have completed it. */
  completed_by: string[];
}

export async function getFamilyMissions(
  db: DB,
  familyId: string,
  memberIds: string[]
): Promise<FamilyMission[]> {
  const [{ data: missions }, { data: completions }] = await Promise.all([
    db
      .from("fic_missions")
      .select("id, slug, title, description, kid_prompt, xp_reward, sort")
      .order("sort", { ascending: true }),
    memberIds.length
      ? db
          .from("mission_completions")
          .select("mission_id, user_id")
          .eq("family_id", familyId)
      : Promise.resolve({ data: [] as { mission_id: string; user_id: string }[] }),
  ]);

  const byMission = new Map<string, string[]>();
  for (const c of (completions ?? []) as unknown as {
    mission_id: string;
    user_id: string;
  }[]) {
    const list = byMission.get(c.mission_id) ?? [];
    list.push(c.user_id);
    byMission.set(c.mission_id, list);
  }

  return ((missions ?? []) as Omit<FamilyMission, "completed_by">[]).map((m) => ({
    ...m,
    completed_by: byMission.get(m.id) ?? [],
  }));
}

/**
 * "Your family this week" — the per-child at-a-glance strip.
 *
 * Carried across from the retired `/parent-corner` route, where it ran on the
 * BROWSER client after mount. Moving it server-side is the point: on the old
 * route the strip simply did not exist until a fetch resolved, so a household
 * with children rendered as a household without any (loading read as empty,
 * adoption plan §0.4). Here the roll-up is resolved before the markup exists.
 *
 * Still ONE batched read per source — roster missions, the family watchlist and
 * this week's XP — with every roll-up done in memory. No per-child round trips.
 */
export interface ChildWeek {
  id: string;
  missionsThisWeek: number;
  watchlistCount: number;
  researchedCount: number;
  xpThisWeek: number;
}

export async function getChildWeek(
  db: DB,
  familyId: string,
  kidIds: string[]
): Promise<Map<string, ChildWeek>> {
  const out = new Map<string, ChildWeek>();
  if (!kidIds.length) return out;

  const weekAgoIso = new Date(Date.now() - 7 * 864e5).toISOString();

  const [missionsRes, watchlistRes, xpRes] = await Promise.all([
    db
      .from("mission_completions")
      .select("user_id")
      .in("user_id", kidIds)
      .gte("completed_at", weekAgoIso),
    // Watchlist is family-scoped; champion_id is filtered in memory so this is
    // one query rather than one per child.
    db
      .from("family_watchlist")
      .select("champion_id, how_they_make_money, strength, risk, trend")
      .eq("family_id", familyId),
    db
      .from("xp_events")
      .select("user_id, amount")
      .in("user_id", kidIds)
      .gte("created_at", weekAgoIso),
  ]);

  for (const id of kidIds) {
    out.set(id, {
      id,
      missionsThisWeek: 0,
      watchlistCount: 0,
      researchedCount: 0,
      xpThisWeek: 0,
    });
  }

  for (const r of (missionsRes.data ?? []) as { user_id: string }[]) {
    const e = out.get(r.user_id);
    if (e) e.missionsThisWeek += 1;
  }

  for (const r of (watchlistRes.data ?? []) as WatchlistResearchRow[]) {
    const e = r.champion_id ? out.get(r.champion_id) : undefined;
    if (!e) continue;
    e.watchlistCount += 1;
    if (researchComplete(r as Partial<WatchlistItem>)) e.researchedCount += 1;
  }

  for (const r of (xpRes.data ?? []) as { user_id: string; amount: number }[]) {
    const e = out.get(r.user_id);
    if (e) e.xpThisWeek += r.amount ?? 0;
  }

  return out;
}

type WatchlistResearchRow = {
  champion_id: string | null;
  how_they_make_money: string | null;
  strength: string | null;
  risk: string | null;
  trend: string | null;
};

// ── shared ──────────────────────────────────────────────────────────────────

export async function getRecentBadges(db: DB, userId: string, limit = 4) {
  const { data } = await db
    .from("user_badges")
    .select("id, earned_at, badges(title, icon_url)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as {
    id: string;
    earned_at: string;
    badges: { title: string; icon_url: string | null } | null;
  }[]).map((b) => ({
    id: b.id,
    earned_at: b.earned_at,
    title: b.badges?.title ?? "Badge",
  }));
}

/** XP earned by the household in the last 7 days. */
export async function getWeeklyXp(db: DB, memberIds: string[]): Promise<number> {
  if (!memberIds.length) return 0;
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await db
    .from("xp_events")
    .select("amount")
    .in("user_id", memberIds)
    .gte("created_at", since);
  return ((data ?? []) as { amount: number }[]).reduce((s, e) => s + (e.amount ?? 0), 0);
}
