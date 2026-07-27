"use client";

import { SOCIAL_FLOORS } from "@/lib/social/reactions";

/* ══════════════════════════════════════════════════════════════════════════
   RESPECT — canvas v2, Club Screens 03 (Changed My Mind).

   The reaction that replaces a like on a change-of-mind post. A like says "I
   agree"; RESPECT says "you updated, and that took something". It is the single
   strongest idea in the canvas archive, and it only works if it is visibly NOT
   the like button: same gesture, different word, different colour, different
   shape.

   ── COLOUR ───────────────────────────────────────────────────────────────
   LIME. It is a community reaction, and lime is community sentiment. Not red —
   red is price, and a red heart next to a price delta is the collision the
   colour law exists to prevent. (The canvas draws this chip in orange on
   #FFF1EA; orange is brand + ACTION, and a reaction to someone else's post is
   not an action the app is asking for, so it does not qualify.)

   ── FORM ─────────────────────────────────────────────────────────────────
   No chrome at rest: the word carries it. The lime tint appears only once the
   member has given respect, so the fill IS the state rather than decoration —
   which also keeps a thread of ten posts from becoming ten tinted chips. The
   word stays fully legible with colour stripped, because "RESPECT" and
   "RESPECTED" are different words, not the same word in two colours.

   ── BELOW FLOOR ──────────────────────────────────────────────────────────
   Production has 3 positioned posts. "RESPECT 1" is worse than no number — it
   publishes how small the room is on every single post. Under
   SOCIAL_FLOORS.reactionHighlight the count is withheld and the control is just
   the word, which is honest and reads better. The member's OWN respect is
   always reflected in the label, so the button never feels unresponsive.
   ══════════════════════════════════════════════════════════════════════════ */

export interface RespectActionProps {
  /** Total respects on the post, including the viewer's. */
  count: number;
  /** Has the viewer given respect. */
  active: boolean;
  onToggle: () => void;
  /** Read-only rendering (kid-walled surfaces, another member's profile). */
  disabled?: boolean;
  loading?: boolean;
  /** Count is withheld below this. */
  floor?: number;
  size?: "sm" | "md";
  className?: string;
}

export default function RespectAction({
  count,
  active,
  onToggle,
  disabled = false,
  loading = false,
  floor = SOCIAL_FLOORS.reactionHighlight,
  size = "md",
  className = "",
}: RespectActionProps) {
  if (loading) {
    return (
      <span
        className={`inline-block h-6 w-24 rounded-md bg-sand motion-safe:animate-pulse ${className}`}
        aria-hidden
      />
    );
  }

  const showCount = count >= floor;
  const type = size === "sm" ? "text-[10px]" : "text-[11px]";
  const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5";

  // The label itself carries the state — not colour alone.
  const word = active ? "Respected" : "Respect";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={
        showCount
          ? `${word}. ${count.toLocaleString()} members respected this update.`
          : `${word} this update.`
      }
      className={`f0-focus inline-flex items-center gap-1.5 rounded-md ${pad} font-display ${type} font-extrabold uppercase tracking-[0.12em] transition-colors disabled:opacity-45 ${
        active
          ? "bg-lime-500/14 text-lime-700 dark:text-lime-400"
          : "text-soft hover:text-ink"
      } ${className}`}
    >
      {/* The mark: a nod, not a heart. Two strokes that close upward — it reads
          as acknowledgement rather than approval, and it fills only when given
          so the resting row stays quiet. */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M3 8.6 6.3 12 13 4.6"
          stroke="currentColor"
          strokeWidth={active ? 2.4 : 1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{word}</span>
      {showCount && (
        <span className="font-mono font-semibold tabular-nums">
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}
