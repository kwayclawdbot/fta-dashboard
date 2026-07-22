import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Funnel session lifecycle (public — powers the social-traffic funnel).
 *
 *  POST  — create-or-resume a session. New session captures UTM once; a resumed
 *          session (id passed) never overwrites UTM. Either way logs a 'landing'
 *          view. Returns the client-visible session state.
 *  GET    ?id= — rehydrate a session (deep-link / refresh).
 *
 * Written with the service role (funnel_sessions/events have RLS on + no client
 * policies), so anon traffic can drive the funnel without any table exposure.
 */

interface PostBody {
  id?: string;
  utm?: Record<string, unknown>;
}

function shape(row: {
  id: string;
  answers: Record<string, string> | null;
  email: string | null;
  phone: string | null;
  sms_optin: boolean | null;
  status: string;
}) {
  return {
    id: row.id,
    answers: row.answers ?? {},
    email: row.email ?? null,
    phone: row.phone ?? null,
    sms_optin: !!row.sms_optin,
    status: row.status,
  };
}

const SELECT = "id, answers, email, phone, sms_optin, status";

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    body = {};
  }

  const supabase = createAdminClient();

  // Resume an existing session if a valid id is supplied.
  if (body.id) {
    const { data: existing } = await supabase
      .from("funnel_sessions")
      .select(SELECT)
      .eq("id", body.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("funnel_events").insert({
        session_id: existing.id,
        step: "landing",
        event: "view",
        meta: { resumed: true },
      });
      return NextResponse.json(shape(existing));
    }
    // fall through to create if the id was stale/unknown
  }

  const utm =
    body.utm && typeof body.utm === "object" ? body.utm : {};

  const { data: created, error } = await supabase
    .from("funnel_sessions")
    .insert({ funnel: "free_class", utm, status: "started" })
    .select(SELECT)
    .single();

  if (error || !created) {
    return NextResponse.json({ error: "Could not start session." }, { status: 500 });
  }

  await supabase.from("funnel_events").insert({
    session_id: created.id,
    step: "landing",
    event: "view",
    meta: {},
  });

  return NextResponse.json(shape(created));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("funnel_sessions")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(shape(data));
}
