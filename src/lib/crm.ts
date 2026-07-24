import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyTier } from "@/lib/tier";

/**
 * Admin CRM data layer.
 *
 * Everything reads through the SECURITY DEFINER RPCs added in migration 037
 * (admin_member_activity / admin_daily_activity / admin_crm_overview /
 * admin_member_timeline / admin_family_detail). Each RPC enforces role='admin'
 * internally, so these fetchers are only ever useful to an admin session — the
 * (admin) layout already gates the route. admin_notes is a plain table with
 * admin-only RLS, read/written directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface MemberRow {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  age_group: string | null;
  track: string | null;
  family_id: string | null;
  family_name: string | null;
  tier: FamilyTier;
  /** FTA Challenge year-1 Club clock end (migration 127); null = unlimited Club. */
  club_until: string | null;
  /** fta family past its Club window with no other Club source (academy stays). */
  club_lapsed: boolean;
  onboarding_complete: boolean;
  joined_at: string;
  xp_total: number;
  lessons_completed: number;
  quizzes_taken: number;
  quizzes_passed: number;
  posts: number;
  comments: number;
  missions: number;
  watchlist_adds: number;
  rsvps: number;
  badges: number;
  chat_messages: number;
  last_seen: string | null;
}

export interface DailyPoint {
  day: string;
  active_users: number;
  signups: number;
  posts: number;
  lessons_completed: number;
}

export interface OverviewMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  family_name: string | null;
  tier?: FamilyTier;
  joined_at?: string;
  last_seen?: string | null;
}

export interface ActiveFamily {
  family_id: string;
  name: string | null;
  tier: FamilyTier;
  active_members: number;
  events_7d: number;
}

export interface CrmOverview {
  total_members: number;
  total_families: number;
  tier_fic: number;
  tier_fta: number;
  members_fic: number;
  members_fta: number;
  dau: number;
  wau: number;
  mau: number;
  newest_signups: OverviewMember[];
  active_families: ActiveFamily[];
  at_risk: OverviewMember[];
}

export type TimelineType =
  | "xp"
  | "lesson"
  | "quiz"
  | "post"
  | "comment"
  | "mission"
  | "rsvp"
  | "badge"
  | "chat"
  | "lead"
  | "comm";

export interface TimelineEvent {
  type: TimelineType;
  ts: string;
  title: string;
  meta: string | null;
}

export interface FamilyDetail {
  family: {
    id: string;
    name: string | null;
    plan_tier: string | null;
    tier: FamilyTier;
    created_at: string;
    enrolled_at: string | null;
    expires_at: string | null;
    has_stripe: boolean;
  } | null;
  enrollments: {
    program: string;
    status: string;
    started_at: string | null;
    cohort: string | null;
  }[];
  members: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    age_group: string | null;
    email: string | null;
    xp_total: number;
    last_seen: string | null;
  }[];
  orientation: { step_key: string; completed_at: string | null }[];
  watchlist: {
    ticker: string;
    company_name: string | null;
    status: string | null;
    champion: string | null;
  }[];
  combined: {
    xp_total: number;
    lessons: number;
    quizzes: number;
    posts: number;
    missions: number;
    rsvps: number;
    watchlist_size: number;
  };
}

export interface AdminNote {
  id: string;
  note: string;
  created_at: string;
  author_id: string | null;
  author: { display_name: string | null } | null;
}

/* ── fetchers ─────────────────────────────────────────────────────────────── */

export async function fetchMembers(supabase: DB): Promise<MemberRow[]> {
  const { data, error } = await supabase.rpc("admin_member_activity");
  if (error) throw error;
  return (data as MemberRow[]) || [];
}

export async function fetchOverview(supabase: DB): Promise<CrmOverview | null> {
  const { data, error } = await supabase.rpc("admin_crm_overview");
  if (error) throw error;
  return (data as CrmOverview) || null;
}

export async function fetchDaily(
  supabase: DB,
  days = 30
): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc("admin_daily_activity", {
    p_days: days,
  });
  if (error) throw error;
  return (data as DailyPoint[]) || [];
}

export async function fetchTimeline(
  supabase: DB,
  userId: string,
  limit = 40
): Promise<TimelineEvent[]> {
  const { data, error } = await supabase.rpc("admin_member_timeline", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as TimelineEvent[]) || [];
}

export async function fetchFamilyDetail(
  supabase: DB,
  familyId: string
): Promise<FamilyDetail | null> {
  const { data, error } = await supabase.rpc("admin_family_detail", {
    p_family_id: familyId,
  });
  if (error) throw error;
  return (data as FamilyDetail) || null;
}

/* ── admin notes ──────────────────────────────────────────────────────────── */

export async function fetchNotes(
  supabase: DB,
  userId: string
): Promise<AdminNote[]> {
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, note, created_at, author_id, author:author_id(display_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Supabase types the embedded relation as an array in some setups.
  return ((data as unknown as AdminNote[]) || []).map((n) => ({
    ...n,
    author: Array.isArray(n.author) ? n.author[0] ?? null : n.author,
  }));
}

export async function addNote(
  supabase: DB,
  userId: string,
  authorId: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from("admin_notes")
    .insert({ user_id: userId, author_id: authorId, note });
  if (error) throw error;
}

export async function deleteNote(supabase: DB, id: string): Promise<void> {
  await supabase.from("admin_notes").delete().eq("id", id);
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Whole-day gap since a timestamp, or null if never. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Compact "last seen" label. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Recency bucket used for the activity filter + the status dot. */
export type RecencyBucket = "today" | "week" | "month" | "dormant" | "never";
export function recencyBucket(iso: string | null | undefined): RecencyBucket {
  const d = daysSince(iso);
  if (d === null) return "never";
  if (d < 1) return "today";
  if (d < 7) return "week";
  if (d < 30) return "month";
  return "dormant";
}

/** Admin-theme tier chip classes (zinc/amber, matching existing admin pages). */
export function tierChipClass(tier: FamilyTier): string {
  return tier === "fta"
    ? "text-amber-400 bg-amber-400/10"
    : "text-zinc-400 bg-zinc-800";
}

export function roleChipClass(role: string): string {
  switch (role) {
    case "admin":
      return "text-red-400 bg-red-400/10";
    case "coach":
      return "text-purple-400 bg-purple-400/10";
    case "parent":
      return "text-blue-400 bg-blue-400/10";
    case "child":
      return "text-emerald-400 bg-emerald-400/10";
    default:
      return "text-zinc-400 bg-zinc-800";
  }
}

/* ── CSV export ───────────────────────────────────────────────────────────── */

const CSV_COLUMNS: { key: keyof MemberRow; label: string }[] = [
  { key: "display_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "age_group", label: "Age Group" },
  { key: "family_name", label: "Family" },
  { key: "tier", label: "Tier" },
  { key: "xp_total", label: "XP" },
  { key: "lessons_completed", label: "Lessons" },
  { key: "quizzes_taken", label: "Quizzes" },
  { key: "quizzes_passed", label: "Quizzes Passed" },
  { key: "posts", label: "Posts" },
  { key: "comments", label: "Comments" },
  { key: "missions", label: "Missions" },
  { key: "watchlist_adds", label: "Watchlist Adds" },
  { key: "rsvps", label: "RSVPs" },
  { key: "badges", label: "Badges" },
  { key: "chat_messages", label: "Chat Messages" },
  { key: "onboarding_complete", label: "Onboarded" },
  { key: "last_seen", label: "Last Seen" },
  { key: "joined_at", label: "Joined" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildMemberCsv(rows: MemberRow[]): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvCell(r[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
