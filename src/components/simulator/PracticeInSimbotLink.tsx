"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { PRACTICE_IN_SIMBOT } from "@/lib/simbot-links";

/**
 * Platform-side "Practice this in Simbot" cross-link. Renders only for lessons
 * present in PRACTICE_IN_SIMBOT (teens course lessons with a Simbot analogue).
 * Nothing renders for unmapped lessons, so it is safe to drop into any lesson
 * action bar unconditionally.
 */
export default function PracticeInSimbotLink({ lessonId }: { lessonId: string }) {
  if (!PRACTICE_IN_SIMBOT[lessonId]) return null;
  return (
    <Link
      href="/simulator/simbot"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm font-display font-semibold text-gold-400 transition-colors hover:bg-gold-400/20"
    >
      <Bot className="h-4 w-4" />
      Practice this in Simbot
    </Link>
  );
}
