import { PlayCircle, ArrowRight } from "lucide-react";
import { ObjectCard } from "@/components/grammar";

/**
 * ContinuePath — the small "keep learning" object (convergence amendment #3).
 *
 * For adults, Learn is not a primary nav slot — it stays consistently VISIBLE
 * through this contextual object on Home AND on ticker pages (a lesson relevant to
 * the viewed ticker), so learning never feels buried even though it isn't primary.
 *
 * Built from the grammar: it IS a persistent object (a lesson to resume), so it
 * gets an ObjectCard (containment communicates meaning) with the register accent
 * spine. Consumable anywhere — pass a `pickup` (title/href/context) and, on a
 * ticker page, a `ticker` to reframe the eyebrow.
 */
export interface LearningPickup {
  title: string;
  href: string;
  context: string | null;
}

export default function ContinuePath({
  pickup,
  ticker,
  className = "",
}: {
  pickup: LearningPickup | null;
  /** On a ticker page, reframes the eyebrow ("Learn: NVDA"). */
  ticker?: string;
  className?: string;
}) {
  // Deep-links to the path's current node (the resume lesson) when known; else
  // to the Learning World front door (§3 — the journey, not the course grid).
  const href = pickup?.href ?? "/learn";
  const title = pickup?.title ?? "Pick up the Foundations";
  const context = pickup?.context ?? "One concept, one company, every week.";
  const eyebrow = ticker ? `Learn · ${ticker}` : "Keep learning";

  return (
    <ObjectCard href={href} accent="accent" className={`group flex items-center gap-4 ${className}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-[var(--accent-strong)]">
        <PlayCircle className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
          {eyebrow}
        </p>
        <p className="truncate font-semibold text-ink">{title}</p>
        <p className="truncate text-[12px] text-soft">{context}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--accent-strong)] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </ObjectCard>
  );
}
