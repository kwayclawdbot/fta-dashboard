import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineEvent } from "@/lib/crm";

/**
 * Unified CRM contacts data layer (migration 080).
 *
 * ONE directory = member profiles ∪ lead-only marketing_leads, each labelled by
 * `contact_kind` (lead | free | fic | fta). Everything reads through the
 * admin-gated SECURITY DEFINER RPCs admin_contacts / admin_contact_support /
 * admin_contact_timeline. Individual 1:1 email/SMS sends POST to the
 * service-role route /api/marketing/contacts/send (which reuses the same Resend
 * / Twilio senders as the campaign pipeline and logs every send).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export type ContactKind = "lead" | "free" | "fic" | "fta";
export type ContactRecord = "member" | "lead";

export interface ContactRow {
  contact_id: string;
  record: ContactRecord;
  name: string | null;
  email: string | null;
  phone: string | null;
  contact_kind: ContactKind;
  role: string | null;
  stage: string | null;
  last_activity: string | null;
  created: string;
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
  last_message: string | null;
  last_sender: "user" | "team" | "ai" | null;
}

export const CONTACT_KIND_META: Record<
  ContactKind,
  { label: string; text: string; bg: string }
> = {
  lead: { label: "Lead", text: "text-sky-300", bg: "bg-sky-500/10" },
  free: { label: "Free", text: "text-zinc-300", bg: "bg-zinc-700/50" },
  fic: { label: "FIC", text: "text-blue-300", bg: "bg-blue-500/10" },
  fta: { label: "FTA", text: "text-amber-300", bg: "bg-amber-400/10" },
};

/* ── fetchers ─────────────────────────────────────────────────────────────── */

export async function fetchContacts(
  supabase: DB,
  opts: {
    search?: string;
    kind?: ContactKind | "all";
    sort?: "recent" | "name" | "created";
    limit?: number;
    offset?: number;
  } = {}
): Promise<ContactRow[]> {
  const { data, error } = await supabase.rpc("admin_contacts", {
    p_search: opts.search ?? null,
    p_kind: opts.kind ?? "all",
    p_sort: opts.sort ?? "recent",
    p_limit: opts.limit ?? 2000,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  return (data as ContactRow[]) || [];
}

export async function fetchContactSupport(
  supabase: DB,
  ident: { userId?: string | null; email?: string | null }
): Promise<SupportTicketSummary[]> {
  const { data, error } = await supabase.rpc("admin_contact_support", {
    p_user_id: ident.userId ?? null,
    p_email: ident.email ?? null,
  });
  if (error) throw error;
  return (data as SupportTicketSummary[]) || [];
}

export async function fetchContactTimeline(
  supabase: DB,
  ident: { userId?: string | null; email?: string | null; limit?: number }
): Promise<TimelineEvent[]> {
  const { data, error } = await supabase.rpc("admin_contact_timeline", {
    p_user_id: ident.userId ?? null,
    p_email: ident.email ?? null,
    p_limit: ident.limit ?? 80,
  });
  if (error) throw error;
  return (data as TimelineEvent[]) || [];
}

/* ── individual send (email / SMS) ────────────────────────────────────────── */

export interface SendPayload {
  channel: "email" | "sms";
  record: ContactRecord;
  contact_id: string;
  email: string | null;
  phone?: string | null;
  first_name?: string | null;
  subject?: string;
  body: string;
}

export interface SendResponse {
  ok: boolean;
  status: "sent" | "failed" | "blocked";
  error?: string;
  domain_blocked?: boolean;
  unsubscribed?: boolean;
  message_id?: string | null;
}

export async function sendContactMessage(
  supabase: DB,
  payload: SendPayload
): Promise<SendResponse> {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/marketing/contacts/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sess.session?.access_token || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as SendResponse;
  if (res.status === 409 && json?.unsubscribed) {
    return { ok: false, status: "blocked", unsubscribed: true, error: json.error };
  }
  return json;
}

/* ── CSV export (unified contact rows) ────────────────────────────────────── */

const CONTACT_CSV_COLUMNS: { key: keyof ContactRow; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "contact_kind", label: "Type" },
  { key: "role", label: "Role" },
  { key: "stage", label: "Stage" },
  { key: "last_activity", label: "Last Activity" },
  { key: "created", label: "Created" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildContactCsv(rows: ContactRow[]): string {
  const header = CONTACT_CSV_COLUMNS.map((c) => c.label).join(",");
  const body = rows
    .map((r) => CONTACT_CSV_COLUMNS.map((c) => csvCell(r[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
