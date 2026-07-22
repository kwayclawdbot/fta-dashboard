import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Log a single funnel step event (public, fire-and-forget from the client).
 * An 'answer' event also merges the answer into funnel_sessions.answers and, on
 * the first interaction, promotes status 'started' → 'engaged'.
 */

interface EventBody {
  id?: string;
  step?: string;
  event?: "view" | "answer" | "submit" | "back" | "exit_intent";
  answer?: { key?: string; value?: string };
  meta?: Record<string, unknown>;
}

const VALID = new Set(["view", "answer", "submit", "back", "exit_intent"]);

export async function POST(req: Request) {
  let body: EventBody;
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const id = (body.id || "").trim();
  const step = (body.step || "").trim().slice(0, 40);
  const event = body.event;
  if (!id || !step || !event || !VALID.has(event)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = createAdminClient();

  await supabase.from("funnel_events").insert({
    session_id: id,
    step,
    event,
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
  });

  // Merge an answer + advance status.
  if (event === "answer" && body.answer?.key && body.answer?.value) {
    const { data: row } = await supabase
      .from("funnel_sessions")
      .select("answers, status")
      .eq("id", id)
      .maybeSingle();
    if (row) {
      const answers = { ...(row.answers || {}), [body.answer.key]: body.answer.value };
      const status =
        row.status === "started" ? "engaged" : row.status;
      await supabase
        .from("funnel_sessions")
        .update({ answers, status, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  }

  return NextResponse.json({ ok: true });
}
