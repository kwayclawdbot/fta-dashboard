import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const TTS_VOICE = "nova";

// ── Helpers ──

async function callHaiku(prompt: string, maxTokens = 400): Promise<string> {
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
    return data.content?.[0]?.text || "";
  } catch (e) {
    console.error("[Coach] Haiku error:", e);
    return "";
  }
}

async function generateTTS(text: string, voice = TTS_VOICE): Promise<Buffer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", input: text, voice, response_format: "mp3" }),
    });
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error("[Coach] TTS error:", e);
    return null;
  }
}

async function uploadAudio(audio: Buffer, filename: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    await fetch(`${url}/storage/v1/object/coach-audio/${filename}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "audio/mpeg",
        "x-upsert": "true",
      },
      body: new Uint8Array(audio),
    });
    return `${url}/storage/v1/object/public/coach-audio/${filename}`;
  } catch {
    return `data:audio/mpeg;base64,${audio.toString("base64")}`;
  }
}

async function makeAudio(text: string, voice: string, prefix: string, userId: string, lessonId: string) {
  const audio = await generateTTS(text, voice);
  if (!audio) return null;
  const ts = Date.now();
  return uploadAudio(audio, `${prefix}_${userId.slice(0, 8)}_${lessonId}_${ts}.mp3`);
}

// ── POST /api/coach — main ask endpoint ──

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action = "ask", lesson_id, question, section_content, conversation_history, score, total, answers, lesson_title, lesson_objectives, audio = true, voice = TTS_VOICE } = body;

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, age_group")
    .eq("id", user.id)
    .single();

  const name = profile?.display_name?.split(" ")[0] || "";
  const audience = profile?.age_group === "teens" ? "teen" : profile?.age_group === "kids" ? "kid" : "adult";

  // Get progress context
  const { count: completedCount } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  // Get recent quiz
  const { data: recentQuiz } = await supabase
    .from("quiz_attempts")
    .select("score, passed")
    .eq("user_id", user.id)
    .order("attempted_at", { ascending: false })
    .limit(1);

  const quizSummary = recentQuiz?.[0] ? `Last quiz: ${recentQuiz[0].score}% (${recentQuiz[0].passed ? "passed" : "failed"})` : "";

  let text = "";
  let audioUrl: string | null = null;

  if (action === "ask") {
    const sectionCtx = section_content ? `\nSection content:\n---\n${section_content.slice(0, 2000)}\n---` : "";
    const convCtx = conversation_history?.length
      ? "\nPrior Q&A:\n" + conversation_history.slice(-6).map((m: any) => `  ${m.role}: ${m.content}`).join("\n")
      : "";

    const prompt = `You are the FTA AI Coach — knowledgeable, patient trading tutor.
Student: ${name || "Student"} | Audience: ${audience} | Completed: ${completedCount || 0} lessons
${quizSummary}${sectionCtx}${convCtx}

STUDENT ASKS: "${question}"

Answer in 2-4 sentences. Conversational. Use an analogy or example.
${audience === "kid" ? "Simple words, fun comparisons." : ""}
${audience === "teen" ? "Relatable, cool." : ""}
Plain text only (read aloud). No markdown.`;

    text = await callHaiku(prompt, 300);
    if (!text) text = "Great question! Could you rephrase that?";

    if (audio) audioUrl = await makeAudio(text, voice, "ask", user.id, lesson_id || "");

    // Save conversation
    await supabase.from("coach_conversations").insert({
      user_id: user.id,
      lesson_id: lesson_id || "",
      question,
      answer: text,
      audio_url: audioUrl,
    });

  } else if (action === "intro") {
    const objectives = lesson_objectives?.join(", ") || "";
    const prompt = `You are the FTA AI Coach. Personalized 15-second greeting.
Student: ${name || "there"} | Audience: ${audience} | Completed: ${completedCount || 0} lessons
${quizSummary}
Lesson: "${lesson_title}" | Objectives: ${objectives}
3-5 sentences, max 100 words. Warm, motivating. Plain text only.`;

    text = await callHaiku(prompt, 200);
    if (!text) text = `Hey ${name || "there"}! Ready for today's lesson?`;

    if (audio) audioUrl = await makeAudio(text, voice, "intro", user.id, lesson_id || "");

  } else if (action === "feedback") {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const wrong = answers?.filter((a: any) => !a.is_correct) || [];
    const prompt = `You are the FTA AI Coach. Post-quiz feedback.
Student: ${name || "there"} | Audience: ${audience}
Score: ${score}/${total} (${pct}%)
Wrong: ${JSON.stringify(wrong.slice(0, 5))}
3-5 sentences. Reference wrong answers. Encourage. Plain text only.`;

    text = await callHaiku(prompt, 300);
    if (!text) text = `You scored ${score}/${total}. ${pct >= 70 ? "Great job!" : "Keep practicing!"}`;

    if (audio) audioUrl = await makeAudio(text, voice, "feedback", user.id, lesson_id || "");
  }

  return NextResponse.json({ text, audio_url: audioUrl });
}
