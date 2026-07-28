"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LessonEngine from "@/components/learn/LessonEngine/LessonEngine";
import { applyNarration } from "@/lib/learn/narration";
import type { AudioAsset, LessonJSON } from "@/lib/learn/schema";
import { ADULT_D03 } from "@/lib/learn/curriculum/adult-d03";

/**
 * DEV-ONLY lesson harness.
 *
 * The pilot row in the database is still 202's text-heavy JSON — migration 206
 * is generated but deliberately NOT applied here (the orchestrator applies
 * migrations). So the audio-first rebuild has to be reviewable against the REAL
 * engine, the REAL steps and the REAL audio files without touching prod: this
 * page renders the typed curriculum module with the generated manifest folded
 * in, exactly as 206 will fold it in.
 *
 * It writes with whatever session the browser actually has, so a signed-in run
 * exercises the same lesson_progress / quiz_attempts / xp_events path as the
 * live route — there is no second, fake completion path here.
 *
 * 404s in production. It is a workbench, not a surface.
 */
export default function DevLessonAudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Harness />;
}

function Harness() {
  const supabase = createClient();
  const [lesson, setLesson] = useState<LessonJSON | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [note, setNote] = useState("loading narration manifest…");

  useEffect(() => {
    let alive = true;
    (async () => {
      const clone: LessonJSON = JSON.parse(JSON.stringify(ADULT_D03));
      try {
        const res = await fetch("/lessons/audio/adult-d03/manifest.json");
        if (res.ok) {
          const manifest = (await res.json()) as {
            provider?: string;
            voice?: string;
            segments: Record<string, AudioAsset>;
          };
          const n = applyNarration(clone, manifest.segments ?? {});
          if (alive)
            setNote(
              `${n} segments · voice ${manifest.voice} · provider ${manifest.provider}`
            );
        } else if (alive) {
          setNote("no manifest — running silent");
        }
      } catch {
        if (alive) setNote("no manifest — running silent");
      }
      if (alive) setLesson(clone);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      setUserId(user?.id ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("family_id")
          .eq("id", user.id)
          .maybeSingle();
        if (alive) setFamilyId(profile?.family_id ?? null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lesson) {
    return (
      <div className="p-10 text-sm text-soft" data-harness-state="loading">
        {note}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper px-4 py-8">
      <p
        className="mx-auto mb-6 max-w-2xl font-mono text-[10px] uppercase tracking-[0.14em] text-soft"
        data-harness-note
      >
        dev harness · {note} · user {userId ? userId.slice(0, 8) : "anon"}
      </p>
      <LessonEngine
        lesson={lesson}
        lessonId="c0d3f1a0-0000-4000-8000-000000000003"
        quizId={null}
        register="adult"
        supabase={supabase}
        userId={userId}
        familyId={familyId}
        courseTitle="Investing, Explained Simply"
        moduleTitle="Phase 1 · FIND"
        backHref="/courses/investing-explained-simply"
        nextHref={null}
      />
    </div>
  );
}
