import type { ClubCirclesViewModel } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import ClubHeader, { StartCircleCta } from "./ClubHeader";
import CircleBubble, { StartCircleBubble } from "./CircleBubble";
import styles from "./ClubCirclesScreen.module.css";

/**
 * "16 Club Circles", translated from the artboard: the Club head, the rule of
 * the room, then rows of three bubbles with the opener tile last.
 *
 * The artboard draws exactly nine cells (eight Circles + "Start yours"). The
 * adapter caps the list at eight so the opener tile always closes the grid.
 */
export default function ClubCirclesScreen({ model }: { model: ClubCirclesViewModel }) {
  // Anonymous keeps the affordance (it leads somewhere that asks them to sign
  // in); the kid register does not, because `club_circles` INSERT refuses it.
  const canOpen = !model.viewer || model.viewer.canPost;

  return (
    <AppShell>
      <ClubHeader active="circles" right={<StartCircleCta canPost={canOpen} />} />

      <p className={styles.rule}>
        Breakout rooms around one event or thesis. Every Circle expires — 30 days max, then
        the receipts get graded.
      </p>

      <div className={styles.grid}>
        {model.rows.map((c) => (
          <CircleBubble key={c.slug} circle={c} variant="grid" />
        ))}
        <StartCircleBubble canPost={canOpen} />
      </div>
    </AppShell>
  );
}
