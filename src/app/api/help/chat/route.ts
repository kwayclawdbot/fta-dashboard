import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildHelpSystemPrompt } from "@/lib/help/knowledge";

// Same key/env + client pattern as src/app/api/report-card/route.ts (Anthropic
// via fetch). Haiku keeps the help bot cheap and fast.
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TURNS = 20; // client also caps; server enforces.

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        reply:
          "The help bot is offline right now. Please use the “Speak to the team” tab and we'll get back to you.",
      },
      { status: 200 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawMessages: unknown = body?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Kid-safe copy for child accounts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const kidSafe = profile?.role === "child";

  // Sanitize + cap the transcript.
  const messages: ChatTurn[] = rawMessages
    .filter(
      (m): m is ChatTurn =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "invalid transcript" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 500,
        system: buildHelpSystemPrompt(kidSafe),
        messages,
      }),
    });
    const data = await res.json();
    const reply: string = data.content?.[0]?.text?.trim() || "";
    if (!reply) {
      return NextResponse.json({
        reply:
          "I'm having trouble answering that right now. Please use the “Speak to the team” tab and a real person will help you out.",
      });
    }
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[HelpChat] error:", e);
    return NextResponse.json({
      reply:
        "I'm having trouble answering that right now. Please use the “Speak to the team” tab and a real person will help you out.",
    });
  }
}
