import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketCategory, TicketStatus, HelpMessage } from "./tickets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/**
 * Admin support data layer. Reads go through the SECURITY DEFINER RPCs from
 * migration 050 (admin-gated internally). Writes (team reply, status change)
 * go through /api/admin/support with the service role — never direct table
 * mutation, and member RLS is never loosened.
 */

export interface AdminTicketRow {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  family_id: string | null;
  family_name: string | null;
  message_count: number;
  last_sender: "user" | "team" | "ai" | null;
  awaiting_team: boolean;
}

export interface AdminTicketDetail {
  ticket: {
    id: string;
    subject: string;
    category: TicketCategory;
    status: TicketStatus;
    priority: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    user_id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    role: string;
    family_id: string | null;
    family_name: string | null;
  } | null;
  messages: HelpMessage[];
}

export async function fetchAdminTickets(
  supabase: DB,
  filters: { status?: string; category?: string } = {}
): Promise<AdminTicketRow[]> {
  const { data, error } = await supabase.rpc("admin_help_tickets", {
    p_status: filters.status || "all",
    p_category: filters.category || "all",
  });
  if (error) throw new Error(error.message);
  return (data as AdminTicketRow[]) ?? [];
}

export async function fetchAdminTicketDetail(
  supabase: DB,
  ticketId: string
): Promise<AdminTicketDetail> {
  const { data, error } = await supabase.rpc("admin_help_ticket_detail", {
    p_ticket_id: ticketId,
  });
  if (error) throw new Error(error.message);
  return (data as AdminTicketDetail) ?? { ticket: null, messages: [] };
}

async function authHeader(supabase: DB): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token || ""}`,
    "Content-Type": "application/json",
  };
}

/** Admin: post a team reply (service-role route → fires member notification). */
export async function adminReply(
  supabase: DB,
  ticketId: string,
  body: string
): Promise<void> {
  const res = await fetch("/api/admin/support", {
    method: "POST",
    headers: await authHeader(supabase),
    body: JSON.stringify({ action: "reply", ticket_id: ticketId, body }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Reply failed");
  }
}

/** Admin: change ticket status. */
export async function adminSetStatus(
  supabase: DB,
  ticketId: string,
  status: TicketStatus
): Promise<void> {
  const res = await fetch("/api/admin/support", {
    method: "POST",
    headers: await authHeader(supabase),
    body: JSON.stringify({ action: "set_status", ticket_id: ticketId, status }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Status update failed");
  }
}
