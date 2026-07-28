"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionRule, familyRegister } from "@/components/family/register";

/**
 * PARENTS ONLY — the screen a non-parent gets instead of a silent bounce.
 *
 * /family links straight into the household screens, and those screens used to
 * answer a child (or any non-parent member) by calling router.replace('/dashboard')
 * with no sentence anywhere: the member tapped a link on the family home and
 * landed back where they started, with nothing to read. A refusal the product
 * means has to be a refusal the product SAYS.
 *
 * Composed the way the family register composes — a marked rule, one display
 * voice, one paragraph, two text actions. No boxed card standing in for a page.
 */
export default function ParentsOnly({
  screen,
  note,
}: {
  /** The screen being withheld, sentence-cased ("The family overview"). */
  screen: string;
  /** Why it is withheld, in the household's voice. */
  note: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-10" style={familyRegister}>
      <div className="flex items-center gap-4">
        <SectionRule>Parents only</SectionRule>
      </div>

      <h1 className="mt-5 font-display text-display-1 font-bold text-midnight-50">
        {screen} is a parent screen.
      </h1>
      <p className="mt-3 max-w-[48ch] font-body text-[15px] leading-relaxed text-midnight-400">
        {note}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Link
          href="/family"
          className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-gold-500 transition-colors hover:text-gold-400"
        >
          Back to Family
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <Link
          href="/dashboard"
          className="font-display text-[13px] font-semibold text-midnight-400 transition-colors hover:text-midnight-100"
        >
          Your home
        </Link>
      </div>
    </div>
  );
}
