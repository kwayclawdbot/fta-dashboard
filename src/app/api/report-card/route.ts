import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_NEXT_STEP,
  nextStepForLabel,
} from "@/lib/family/report-card-flags";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

async function callHaiku(prompt: string, maxTokens = 320): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "";
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
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || "";
  } catch (e) {
    console.error("[ReportCard] Haiku error:", e);
    return "";
  }
}

interface Stats {
  name?: string;
  track?: string;
  week?: number;
  lessonsDone?: number;
  lessonsTotal?: number;
  quizAvg?: number | null;
  quizCount?: number;
  lowQuizzes?: number;
  practiceCount?: number;
  gamesBest?: number | null;
  xp?: number;
  level?: string;
  /** Diagnoses — bullets. NEVER grammatical after "the best next step is to". */
  needsWork?: string[];
  /** Imperatives, index-aligned with `needsWork`. These complete that sentence. */
  nextSteps?: string[];
}

/**
 * Does a stored note contain the old bug — a needs-work DIAGNOSIS dropped into
 * the "next step is to ___" slot? Matched on the shape of the labels that were
 * ever interpolated there (they all start with a capital or a digit, which no
 * imperative in this file does).
 */
function isBrokenNextStep(note: string): boolean {
  return /next step is to (?:No |Behind pace|\d)/.test(note);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const childId: string = body.child_id;
  const week: number = body.week ?? 0;
  const stats: Stats = body.stats || {};
  const refresh: boolean = !!body.refresh;

  if (!childId) {
    return NextResponse.json({ error: "child_id required" }, { status: 400 });
  }

  // Verify the requester is a parent in the same family as the child.
  const [{ data: me }, { data: child }] = await Promise.all([
    supabase.from("profiles").select("role, family_id").eq("id", user.id).single(),
    supabase
      .from("profiles")
      .select("family_id, display_name")
      .eq("id", childId)
      .single(),
  ]);
  if (
    !me ||
    me.role !== "parent" ||
    !child ||
    !me.family_id ||
    child.family_id !== me.family_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Serve cached note unless a refresh is requested.
  if (!refresh) {
    const { data: cached } = await supabase
      .from("report_notes")
      .select("note")
      .eq("child_id", childId)
      .eq("week", week)
      .maybeSingle();
    // A note written before the fix below is stored, not regenerated, so the
    // broken sentence would outlive the bug. Notes carrying it are treated as
    // absent and rewritten on the next read; the upsert at the end replaces
    // them in place, so this self-heals once per child per week.
    if (cached?.note && !isBrokenNextStep(cached.note)) {
      return NextResponse.json({ note: cached.note, cached: true });
    }
  }

  const name = (stats.name || child.display_name || "your child").split(" ")[0];
  const prompt = `You are the FTA coach writing a short note to a PARENT about their child's progress this week. Warm, specific, encouraging. 3-4 sentences. Name exactly ONE concrete thing to practice next. Plain text, no markdown, no lists, no emojis.

Child: ${name} (${stats.track || "adults"} track), program week ${week}.
Foundations lessons: ${stats.lessonsDone ?? 0} of ${stats.lessonsTotal ?? 0} done.
Quizzes: ${stats.quizCount ?? 0} taken, average ${
    stats.quizAvg == null ? "n/a" : `${stats.quizAvg}%`
  }${(stats.lowQuizzes ?? 0) > 0 ? `, ${stats.lowQuizzes} below 70%` : ""}.
Practice: ${stats.practiceCount ?? 0} pattern/game sessions${
    stats.gamesBest != null ? `, best game ${stats.gamesBest}/10` : ""
  }.
XP: ${stats.xp ?? 0} (${stats.level || "Explorer"}).
Flags: ${stats.needsWork?.length ? stats.needsWork.join("; ") : "none"}.
Suggested next steps: ${
    stats.nextSteps?.length ? stats.nextSteps.join("; ") : "none"
  }.

Write the note now.`;

  let note = await callHaiku(prompt, 320);
  if (!note) {
    // Deterministic fallback so the card always has a note.
    //
    // THE SLOT TAKES AN IMPERATIVE. It used to take `needsWork[0]`, which is a
    // diagnosis, and every child's note came out as "the best next step is to
    // No pattern or game practice in the last 7 days." The client now sends the
    // matching action alongside each flag; `nextStepForLabel` recovers it for
    // any older payload that only carries labels.
    const one =
      stats.nextSteps?.[0] ||
      nextStepForLabel(stats.needsWork?.[0]) ||
      DEFAULT_NEXT_STEP;
    note = `${name} has completed ${stats.lessonsDone ?? 0} of ${
      stats.lessonsTotal ?? 0
    } foundation lessons this week and is at the ${
      stats.level || "Explorer"
    } level. ${
      (stats.quizAvg ?? 0) >= 70
        ? "Quiz work is solid."
        : "Quizzes are still finding their footing."
    } This week, the best next step is to ${one}.`;
  }

  await supabase
    .from("report_notes")
    .upsert(
      { child_id: childId, week, note },
      { onConflict: "child_id,week" }
    );

  return NextResponse.json({ note, cached: false });
}
