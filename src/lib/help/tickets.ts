import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export const TICKET_CATEGORIES = [
  "billing",
  "account",
  "classes",
  "technical",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: "Billing & payments",
  account: "Account & family",
  classes: "Courses & live classes",
  technical: "Technical / something broke",
  other: "Something else",
};

export type TicketStatus = "open" | "pending" | "resolved" | "closed";

export interface HelpMessage {
  id: string;
  ticket_id?: string;
  sender: "user" | "team" | "ai";
  body: string;
  created_at: string;
}

export interface HelpTicket {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  help_messages?: HelpMessage[];
}

/** Member: create a ticket + its first message (RLS own-row). */
export async function createTicket(
  supabase: DB,
  userId: string,
  input: { category: TicketCategory; subject: string; message: string }
): Promise<string> {
  const { data: ticket, error } = await supabase
    .from("help_tickets")
    .insert({
      user_id: userId,
      subject: input.subject.trim().slice(0, 200),
      category: input.category,
    })
    .select("id")
    .single();
  if (error || !ticket) throw new Error(error?.message || "Could not create ticket");

  const { error: msgErr } = await supabase.from("help_messages").insert({
    ticket_id: ticket.id,
    sender: "user",
    body: input.message.trim(),
  });
  if (msgErr) throw new Error(msgErr.message);

  return ticket.id as string;
}

/** Member: their tickets with full threads, newest activity first. */
export async function fetchMyTickets(supabase: DB): Promise<HelpTicket[]> {
  const { data, error } = await supabase
    .from("help_tickets")
    .select(
      "id, subject, category, status, priority, created_at, updated_at, last_message_at, help_messages(id, sender, body, created_at)"
    )
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  const tickets = (data as unknown as HelpTicket[]) ?? [];
  // Sort each thread chronologically (the nested select order isn't guaranteed).
  for (const t of tickets) {
    t.help_messages?.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  return tickets;
}

/** Member: append a reply (RLS enforces sender='user' on own ticket). */
export async function replyToTicket(
  supabase: DB,
  ticketId: string,
  body: string
): Promise<void> {
  const { error } = await supabase
    .from("help_messages")
    .insert({ ticket_id: ticketId, sender: "user", body: body.trim() });
  if (error) throw new Error(error.message);
}
