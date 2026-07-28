import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ObjectCard — grammar primitive #5 (object card).
 *
 * The ONLY sanctioned container in the grammar. Use it EXCLUSIVELY for persistent
 * objects — a thesis, lesson, alert/setup, person, ticker, live_event — never as
 * a box to create hierarchy (that's what EditorialSection + spacing are for). If
 * the thing inside isn't a real object with its own identity and URL, it does not
 * get a card.
 *
 * Identity, not decoration: `accent` paints a 3px left spine in the object's
 * meaning-color. Accent discipline (PART III) — a screen runs ONE dominant + ONE
 * supporting accent, so keep to `accent` (register: volt/gold/metallic) and
 * `support` (teal); `kai` is reserved for objects Kai authored (a Kai recap, a
 * Kai brief). `live` marks a synchronous live_event.
 *
 * Motion communicates product meaning: interactive cards lift 1px on hover
 * (feedback), never a decorative float. Reduced-motion drops the transform.
 *
 * GROUND: `.club-b-card` — the reference board's card (14px radius, hairline
 * --sand border, flat in light). It replaces the pre-canvas `.paper-card`, whose
 * 16px radius and resting shadow are the previous version's surface and read as
 * a different app next to anything rebuilt from the board. The hover shadow
 * stays: that one is feedback, not decoration.
 */
export type ObjectAccent = "neutral" | "accent" | "support" | "kai" | "live";

const SPINE: Record<ObjectAccent, string> = {
  neutral: "",
  accent: "before:bg-[var(--accent-solid)]",
  support: "before:bg-teal-500",
  kai: "before:bg-kai-blue",
  live: "before:bg-volt-500",
};

export default function ObjectCard({
  children,
  href,
  onClick,
  accent = "neutral",
  interactive,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  accent?: ObjectAccent;
  /** Force the hover affordance on/off (defaults on when href/onClick given). */
  interactive?: boolean;
  className?: string;
}) {
  const isInteractive = interactive ?? Boolean(href || onClick);
  const spine =
    accent !== "neutral"
      ? `relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${SPINE[accent]}`
      : "";
  const cls = `club-b-card p-4 ${spine} ${
    isInteractive
      ? "transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-px hover:shadow-[var(--shadow-lift)] motion-reduce:hover:translate-y-0 active:translate-y-0"
      : ""
  } ${className}`;

  if (href) {
    return (
      <Link href={href} className={`block ${cls}`}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`block w-full text-left ${cls}`}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}
