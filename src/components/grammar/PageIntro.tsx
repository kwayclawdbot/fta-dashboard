import type { ReactNode } from "react";

/**
 * PageIntro — grammar primitive #1 (page intro).
 *
 * A surface's opening composition: headline, optional context line, 0–2 actions.
 * It is NOT a card — it sits on the open canvas (containment communicates meaning
 * or doesn't exist). The shell no longer prints the page title in the top bar
 * (PART IV), so each surface owns its own opening moment through this.
 *
 * Type scale (PART III, pass/fail): headline is the 32–40px feature tier,
 * `context` is 16px reading body, `eyebrow` is metadata-tiny. No everything-is-13px.
 */
export default function PageIntro({
  title,
  eyebrow,
  context,
  actions,
  className = "",
}: {
  title: ReactNode;
  /** Metadata-tiny label above the headline. Use sparingly (accent discipline). */
  eyebrow?: ReactNode;
  /** One-line reading-body context under the headline. */
  context?: ReactNode;
  /** 0–2 actions, right-aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-soft">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[28px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[32px] lg:text-[36px]">
          {title}
        </h1>
        {context && (
          <p className="mt-1.5 max-w-[60ch] text-base leading-relaxed text-soft">
            {context}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
