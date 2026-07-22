import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/membership";

// Admin support writes: team replies + status changes. Mirrors the auth pattern
// in src/app/api/admin/invite/route.ts — service client + verify the caller's
// JWT resolves to a profiles.role='admin'. Member RLS is never touched; the
// service role bypasses it, and the caller is verified as admin first.

const VALID_STATUS = new Set(["open", "pending", "resolved", "closed"]);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data: userRes, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !userRes?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: prof } = await db
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (prof?.role !== "admin")
    return NextResponse.json({ error: "admin only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");
  const ticketId = String(body?.ticket_id || "");
  if (!ticketId)
    return NextResponse.json({ error: "ticket_id required" }, { status: 400 });

  // Ticket must exist.
  const { data: ticket } = await db
    .from("help_tickets")
    .select("id")
    .eq("id", ticketId)
    .single();
  if (!ticket)
    return NextResponse.json({ error: "ticket not found" }, { status: 404 });

  if (action === "reply") {
    const text = String(body?.body || "").trim();
    if (!text)
      return NextResponse.json({ error: "empty reply" }, { status: 400 });
    // The AFTER-INSERT trigger bumps activity + inserts the member's
    // 'support_reply' notification (028 pipe).
    const { error } = await db
      .from("help_messages")
      .insert({ ticket_id: ticketId, sender: "team", body: text.slice(0, 5000) });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_status") {
    const status = String(body?.status || "");
    if (!VALID_STATUS.has(status))
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    const { error } = await db
      .from("help_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
