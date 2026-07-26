import type { ReactNode } from "react";

/**
 * EditorialSection — grammar primitive #4 (editorial section).
 *
 * A titled block of content on the OPEN CANVAS — no card by default. This is the
 * antidote to the `rounded-2xl border bg-card p-4` reflex: hierarchy comes from a
 * section lead (20–24px), spacing, and an optional hairline, NOT a box. Reach for
 * ObjectCard only when the content is a persistent object that deserves
 * containment.
 *
 * `divide` draws a top hairline so consecutive sections read as a stacked
 * editorial flow. `action` is an optional trailing link (e.g. "See all →").
 */
export default function EditorialSection({
  title,
  lead,
  action,
  divide = false,
  children,
  className = "",
}: {
  /** Section lead — the 20–24px supporting tier. Omit for an untitled block. */
  title?: ReactNode;
  /** Optional one-line context under the title (reading body). */
  lead?: ReactNode;
  /** Trailing action (link/button) aligned to the title row. */
  action?: ReactNode;
  /** Draw a top hairline (stacked editorial rhythm). */
  divide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${divide ? "border-t border-sand pt-6" : ""} ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-[20px] font-bold leading-tight tracking-tight text-ink sm:text-[22px]">
                {title}
              </h2>
            )}
            {lead && (
              <p className="mt-0.5 text-sm leading-relaxed text-soft">{lead}</p>
            )}
          </div>
          {action && <div className="shrink-0 text-sm">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
