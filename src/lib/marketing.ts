import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marketing CRM data layer.
 *
 * Reads/writes go through the SECURITY DEFINER RPCs from migration 043
 * (admin_marketing_*). Each RPC enforces role='admin' internally, so these are
 * only useful in an admin session — the (admin) layout already gates the route.
 * Campaign sending, the FB webhook and unsubscribe are handled by server routes
 * under /api/marketing using the service role.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export const STAGES = [
  "new",
  "contacted",
  "engaged",
  "nurture",
  "converted",
  "cold",
  "unsubscribed",
] as const;
export type Stage = (typeof STAGES)[number];

/** Pipeline columns shown on the kanban (converted is the win column). */
export const PIPELINE_STAGES: Stage[] = [
  "new",
  "contacted",
  "engaged",
  "nurture",
  "converted",
  "cold",
];

export const STAGE_META: Record<
  Stage,
  { label: string; text: string; bg: string; dot: string }
> = {
  new: { label: "New", text: "text-sky-300", bg: "bg-sky-500/10", dot: "bg-sky-400" },
  contacted: { label: "Contacted", text: "text-blue-300", bg: "bg-blue-500/10", dot: "bg-blue-400" },
  engaged: { label: "Engaged", text: "text-violet-300", bg: "bg-violet-500/10", dot: "bg-violet-400" },
  nurture: { label: "Nurture", text: "text-amber-300", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  converted: { label: "Converted", text: "text-emerald-300", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  cold: { label: "Cold", text: "text-zinc-400", bg: "bg-zinc-700/40", dot: "bg-zinc-500" },
  unsubscribed: { label: "Unsubscribed", text: "text-red-300", bg: "bg-red-500/10", dot: "bg-red-400" },
};

export const SOURCE_META: Record<string, { label: string; text: string }> = {
  csv: { label: "CSV", text: "text-zinc-300" },
  facebook: { label: "Facebook", text: "text-blue-300" },
  manual: { label: "Manual", text: "text-zinc-300" },
  referral: { label: "Referral", text: "text-emerald-300" },
};

export type EventType =
  | "imported"
  | "emailed"
  | "smsed"
  | "opened"
  | "clicked"
  | "replied"
  | "stage_changed"
  | "converted";

export interface Lead {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  source: string;
  stage: Stage;
  tags: string[];
  notes: string | null;
  consent_source: string | null;
  converted_profile_id: string | null;
  last_activity_at: string;
  created_at: string;
  event_count: number;
  last_event_at: string | null;
  last_event_type: EventType | null;
  is_cold: boolean;
}

export interface LeadEvent {
  id: string;
  type: EventType;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface LeadDetail {
  lead: (Lead & { custom: Record<string, unknown>; updated_at: string }) | null;
  events: LeadEvent[];
}

export interface Campaign {
  id: string;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  segment: { stages?: string[]; tags?: string[] };
  status: "draft" | "sending" | "sent" | "failed";
  sent_at: string | null;
  stats: Record<string, unknown>;
  created_at: string;
  sends_total: number;
  sends_sent: number;
  sends_failed: number;
  sends_skipped: number;
}

export interface SegmentLead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stage: Stage;
  tags: string[];
}

/* ── fetchers ─────────────────────────────────────────────────────────────── */

export async function fetchLeads(supabase: DB): Promise<Lead[]> {
  const { data, error } = await supabase.rpc("admin_marketing_leads");
  if (error) throw error;
  return (data as Lead[]) || [];
}

export async function fetchLeadDetail(
  supabase: DB,
  leadId: string
): Promise<LeadDetail | null> {
  const { data, error } = await supabase.rpc("admin_marketing_lead_detail", {
    p_lead_id: leadId,
  });
  if (error) throw error;
  return (data as LeadDetail) || null;
}

export interface ImportRow {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string[];
}

export async function importLeads(
  supabase: DB,
  rows: ImportRow[],
  source = "csv"
): Promise<{ imported: number; updated: number; skipped: number }> {
  const { data, error } = await supabase.rpc("admin_marketing_import", {
    p_leads: rows,
    p_source: source,
  });
  if (error) throw error;
  return data as { imported: number; updated: number; skipped: number };
}

export async function addLead(
  supabase: DB,
  input: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    tags?: string[];
    source?: string;
    notes?: string;
  }
): Promise<{ id: string; created: boolean }> {
  const { data, error } = await supabase.rpc("admin_marketing_add_lead", {
    p_email: input.email,
    p_first_name: input.first_name ?? null,
    p_last_name: input.last_name ?? null,
    p_phone: input.phone ?? null,
    p_tags: input.tags ?? [],
    p_source: input.source ?? "manual",
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as { id: string; created: boolean };
}

export async function setStage(
  supabase: DB,
  leadId: string,
  stage: Stage
): Promise<void> {
  const { error } = await supabase.rpc("admin_marketing_set_stage", {
    p_lead_id: leadId,
    p_stage: stage,
  });
  if (error) throw error;
}

export async function updateLead(
  supabase: DB,
  leadId: string,
  patch: { notes?: string | null; tags?: string[] | null }
): Promise<void> {
  const { error } = await supabase.rpc("admin_marketing_update_lead", {
    p_lead_id: leadId,
    p_notes: patch.notes ?? null,
    p_tags: patch.tags ?? null,
  });
  if (error) throw error;
}

export async function syncConversions(
  supabase: DB
): Promise<{ converted: number; ids: string[] }> {
  const { data, error } = await supabase.rpc("admin_marketing_sync_conversions");
  if (error) throw error;
  return data as { converted: number; ids: string[] };
}

export async function fetchCampaigns(supabase: DB): Promise<Campaign[]> {
  const { data, error } = await supabase.rpc("admin_marketing_campaigns");
  if (error) throw error;
  return (data as Campaign[]) || [];
}

export async function createCampaign(
  supabase: DB,
  input: {
    name: string;
    channel: "email" | "sms";
    body: string;
    subject?: string;
    segment?: { stages?: string[]; tags?: string[] };
  }
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("admin_marketing_create_campaign", {
    p_name: input.name,
    p_channel: input.channel,
    p_body: input.body,
    p_subject: input.subject ?? null,
    p_segment: input.segment ?? {},
  });
  if (error) throw error;
  return data as { id: string };
}

export async function segmentLeads(
  supabase: DB,
  segment: { stages?: string[]; tags?: string[] }
): Promise<SegmentLead[]> {
  const { data, error } = await supabase.rpc("admin_marketing_segment_leads", {
    p_segment: segment,
  });
  if (error) throw error;
  return (data as SegmentLead[]) || [];
}

/* ── CSV parser (hand-rolled, RFC-4180-ish, no dependencies) ──────────────── */

/** Parse CSV text into a matrix of string cells. Handles quotes, commas,
 *  escaped double-quotes ("") and CRLF/LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // skip fully-empty trailing rows
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Guess which CSV column indices map to our fields (best-effort). */
export function guessColumnMap(headers: string[]): {
  email: number;
  first_name: number;
  last_name: number;
  phone: number;
  tags: number;
} {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const find = (...cands: string[]) =>
    norm.findIndex((h) => cands.some((c) => h === c || h.includes(c)));
  return {
    email: find("email", "e-mail", "mail"),
    first_name: find("first name", "first_name", "firstname", "first", "fname"),
    last_name: find("last name", "last_name", "lastname", "last", "lname"),
    phone: find("phone", "mobile", "cell", "tel"),
    tags: find("tags", "tag", "segment", "list"),
  };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

export function leadName(l: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const n = [l.first_name, l.last_name].filter(Boolean).join(" ").trim();
  return n || l.email;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

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
