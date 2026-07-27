"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { PRACTICE_IN_SIMBOT } from "@/lib/simbot-links";

/**
 * Platform-side "Practice this in Simbot" cross-link. Renders only for lessons
 * present in PRACTICE_IN_SIMBOT (teens course lessons with a Simbot analogue).
 * Nothing renders for unmapped lessons, so it is safe to drop into any lesson
 * action bar unconditionally.
 *
 * Orange type uses the GOLD ramp, which flips for the night page — the volt
 * ramp is frozen across themes and would land ~2.5:1 there.
 */
export default function PracticeInSimbotLink({ lessonId }: { lessonId: string }) {
  if (!PRACTICE_IN_SIMBOT[lessonId]) return null;
  return (
    <Link
      href="/simulator/simbot"
      className="inline-flex items-center gap-1.5 rounded-xl border border-sand px-3 py-2 font-display text-[13px] font-bold text-ink transition-colors hover:border-gold-400 hover:text-gold-700"
    >
      <Bot className="h-4 w-4" />
      Practice this in Simbot
    </Link>
  );
}
