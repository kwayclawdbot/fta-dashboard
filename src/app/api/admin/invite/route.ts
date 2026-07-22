import { NextRequest, NextResponse } from "next/server";
import { serviceClient, provisionMembership } from "@/lib/server/membership";

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
  const email = String(body?.email || "").trim();
  const program = body?.program === "fta" ? "fta" : "fic";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "invalid email" }, { status: 400 });

  const result = await provisionMembership({
    email,
    program,
    source: "admin",
    invitedBy: userRes.user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, mode: result.mode });
}
