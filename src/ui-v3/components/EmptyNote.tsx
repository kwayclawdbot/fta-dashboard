import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./EmptyNote.module.css";

/**
 * What a section renders when its data is genuinely empty.
 *
 * The artboards never draw an empty state — they are all shot on a full club —
 * so the honest move is NOT to invent a new visual pattern for absence. This is
 * the artboards' own container: the same --surface fill, 1px --border and
 * radius the flat cards on "02 Discover" and "07 You Profile" carry, holding one
 * muted sentence at the caption ramp. The section keeps its eyebrow, so the
 * screen's rhythm is identical whether the region is full or waiting.
 *
 * `tall` matches the height of the panel it stands in for (the Most-divisive
 * donut, the Getting-close panel) so the screen does not jump when data lands.
 *
 * ── THE ACTION, AND WHERE IT IS ALLOWED ──────────────────────────────────────
 * Several of these regions are empty because THE MEMBER HAS NOT DONE THE THING
 * YET: the feed has no posts, the watchlist has no names, nobody has taken a
 * side. Stating that and stopping turns a club you could start into a club that
 * looks abandoned.
 *
 * So a note may carry ONE action — but only where its own sentence names
 * something the member can go and do. A region that is empty because the DATA is
 * still accruing (the attention ledger, the two-week attention history) gets no
 * action, because there is nowhere honest to send them.
 *
 * It is drawn as one accent run on an 11px/600 line: DESIGN-GRAMMAR §4.4 ("the
 * one primary action in a region") at §6's `actionTone="accent"` size. No new
 * colour, no new type step, no button chrome — an empty note is still a flat
 * card, not a call-to-action panel. `href` renders a Link; `onClick` renders a
 * button, for a client parent that opens something in place. Passing both is a
 * mistake, and `href` wins.
 */
export interface EmptyNoteAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export default function EmptyNote({
  children,
  tall = false,
  center = false,
  action,
}: {
  children: ReactNode;
  tall?: boolean;
  center?: boolean;
  action?: EmptyNoteAction;
}) {
  const cls = [
    styles.note,
    tall ? styles.tall : "",
    center ? styles.center : "",
    action ? styles.withAction : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <span>{children}</span>
      {action ? (
        action.href ? (
          <Link href={action.href} className={styles.action}>
            {action.label} →
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={styles.action}>
            {action.label} →
          </button>
        )
      ) : null}
    </div>
  );
}
