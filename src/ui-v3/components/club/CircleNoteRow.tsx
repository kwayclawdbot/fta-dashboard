import type { CSSProperties } from "react";
import type { CircleNoteVM } from "@/ui-v3/club-data";
import { beltPaint } from "./belt-paint";
import BeltChip from "./BeltChip";
import MemberDisc from "./MemberDisc";
import styles from "./CircleNoteRow.module.css";

/**
 * One `club_circle_notes` row, drawn as the artboard's thread entry: a belt-ringed
 * 36px disc beside a name / time / body column.
 *
 * The artboard names the author in a lighter tint of their ring colour. No token
 * exists for those tints, so the name takes the ring colour itself — except for
 * the Circle's opener, whom the artboard tints --accent-strong (a real
 * distinction: `club_circles.created_by`).
 *
 * The artboard badges exactly ONE author on this screen — the same author it
 * tints accent, i.e. the Circle's opener — so the belt chip is drawn for the
 * opener only rather than for all four voices.
 *
 * OMITTED, because `club_circle_notes` has no column behind them: the reaction
 * chips (🔥 24 / 🐂 18 / 💡 7), the "↩ 6 replies" thread block, and the posted
 * chart card. Each is a capability, not a value — inventing counts for them is
 * exactly what DESIGN-GRAMMAR §9.5 forbids.
 *
 * KAI's daily note is the one row that is not a person. It keeps the artboard's
 * thread geometry — same disc, same column — but takes the assistant's own cool
 * blue and its 🐋 mark, the identity KaiInsightRow already carries on the feed,
 * so the two surfaces name Kai the same way. A belt would be meaningless on it
 * and is dropped.
 */
export default function CircleNoteRow({ note }: { note: CircleNoteVM }) {
  const ring = note.beltKey ? beltPaint(note.beltKey).ring : "var(--text-muted)";
  const nameColor = note.isOpener ? "var(--accent-strong)" : ring;

  if (note.isKai) {
    return (
      <div className={styles.row}>
        <div className={styles.kaiMark} aria-hidden="true">
          🐋
        </div>
        <div className={styles.column}>
          <div className={styles.head}>
            <span className={styles.kaiName}>{note.authorName}</span>
            <span className={styles.time}>{note.time}</span>
          </div>
          <p className={styles.body}>
            <Cashtags text={note.body} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <MemberDisc initials={note.initials} size="lg" belt={note.beltKey} />
      <div className={styles.column}>
        <div className={styles.head}>
          <span className={styles.name} style={{ "--name": nameColor } as CSSProperties}>
            {note.authorName}
          </span>
          {note.isOpener && note.beltKey && note.beltShort ? (
            <BeltChip belt={note.beltKey} label={note.beltShort} size="sm" />
          ) : null}
          <span className={styles.time}>{note.time}</span>
        </div>
        <p className={styles.body}>
          <Cashtags text={note.body} />
        </p>
      </div>
    </div>
  );
}

/**
 * The artboard sets a cashtag inside a note in an accent-tinted mono pill. The
 * pattern is the app's own (`parseCashtags` in src/lib/feed uses this exact
 * shape), so the highlight is real markup over real text, not decoration.
 */
const CASHTAG = /(\$[A-Za-z]{1,6})(?![A-Za-z])/g;

function Cashtags({ text }: { text: string }) {
  const parts = text.split(CASHTAG);
  return (
    <>
      {parts.map((part, i) =>
        // split() with one capture group puts every match at an odd index.
        i % 2 === 1 ? (
          <span key={i} className={styles.cashtag}>
            {part.toUpperCase()}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}
