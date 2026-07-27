"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { MessagesSquare, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentFicWeek, type FicWeek } from "@/lib/fic";
import { StatusChip } from "@/components/grammar";

/**
 * "This week's Table Talk" — the signature family-home card (Family Mode canvas,
 * artboard 01). One 15-minute dinner conversation drawn straight from the
 * current FIC week's parent content. Self-contained: fetches its own week and
 * renders null when there's nothing prepared, so the parent Home just drops it
 * in. Warm-paper / gold register; built on the grammar (ObjectCard-style spine).
 */
export default function TableTalkCard() {
  const supabase = createClient();
  const [week, setWeek] = useState<FicWeek | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const w = await getCurrentFicWeek(supabase);
        if (mounted) setWeek(w);
      } catch {
        /* fail soft — the card simply doesn't render */
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The conversation prompt: prefer a dedicated prompt, else the class title.
  const prompt = week?.parent_prompt || week?.class_title;
  if (!week || !prompt) return null;

  // Count the dinner questions so the sub-line is honest ("Three questions…").
  const qCount = (week.parent_dinner_questions || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean).length;
  const sub =
    qCount > 0
      ? `One 15-minute conversation. ${qCount} question${
          qCount === 1 ? "" : "s"
        } to ask at dinner.`
      : "One 15-minute conversation to have together this week.";

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href="/parent-corner"
        className="paper-card group relative block overflow-hidden p-5 pl-6 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--accent-solid)] hover:-translate-y-px hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0"
      >
        <div className="mb-2 flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-gold-600" />
          <StatusChip tone="accent">This week&apos;s Table Talk</StatusChip>
        </div>
        <h3 className="font-display text-[22px] font-bold leading-snug tracking-tight text-ink">
          {prompt}
        </h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-soft">{sub}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 group-hover:text-gold-800">
          Open the guide
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </m.div>
  );
}
