import type { CSSProperties } from "react";
import Link from "next/link";
import { groupedCount, type CircleRoomViewModel } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import { circleGlyph, circlePaint } from "./circle-paint";
import CircleNoteRow from "./CircleNoteRow";
import styles from "./CircleRoomScreen.module.css";

/**
 * "23 Inside Circle", translated from the artboard.
 *
 * The artboard gives it a full-bleed 16px header, a full-bleed pinned bar, a 16px
 * thread well and its own composer footer — and no bottom nav. That is
 * <AppShell padding="bleed" nav={false}>; the thread band carries the `flex: 1`
 * that pins the composer to the bottom of the column.
 *
 * REGIONS WITH NO SOURCE, rendered honestly rather than faked:
 *  - "312 online" and the presence dot: no presence table exists → omitted.
 *  - "… is typing": same → omitted.
 *  - "# charts" / "# receipts" / "🔊 live": a Circle has no channels;
 *    `club_circle_notes` is the single stream, so those three are inert chips
 *    and only "# takes" is real.
 *  - The Kai row wants a sentiment SERIES ("moved +6 pts bullish in the last
 *    hour"). Only the current split exists, so the row states the split.
 *  - The composer is display-only; no write path is wired on the v3 routes.
 */
export default function CircleRoomScreen({ model }: { model: CircleRoomViewModel }) {
  return (
    <AppShell padding="bleed" nav={false} className={styles.screen}>
      <Header model={model} />
      <ThesisBar premise={model.premise} />

      <div className={styles.thread}>
        {model.groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.dayRow}>
              <span className={styles.dayPill}>{group.label}</span>
            </div>
            {group.notes.map((n) => (
              <CircleNoteRow key={n.id} note={n} />
            ))}
          </div>
        ))}

        {model.split ? <KaiSplitRow split={model.split} /> : null}
      </div>

      <Composer channel={model.channel} />
    </AppShell>
  );
}

function Header({ model }: { model: CircleRoomViewModel }) {
  const paint = circlePaint(model.ticker);
  const glyph = circleGlyph(model.ticker, model.topic);

  return (
    <div className={styles.header}>
      <div className={styles.headRow}>
        <Link href="/v3/club/circles" className={styles.back} aria-label="Back to Circles">
          ←
        </Link>

        <div
          className={styles.crest}
          style={
            {
              "--arc": model.urgent ? "var(--negative)" : "var(--accent)",
              "--pct": `${model.elapsedPct}%`,
              "--disc-bg": paint.bg,
              "--disc-fg": paint.fg,
            } as CSSProperties
          }
        >
          <div className={styles.crestDisc} aria-hidden="true">
            {glyph}
          </div>
        </div>

        <div className={styles.identity}>
          <div className={styles.title}>{model.title}</div>
          <div className={styles.meta}>
            {model.clock ? (
              <span
                className={model.urgent ? styles.clockUrgent : styles.clock}
                data-numeric
              >
                ⏳ {model.clock}
              </span>
            ) : (
              <span className={styles.clockClosed}>closed</span>
            )}{" "}
            · <span data-numeric>{groupedCount(model.members)}</span> members
          </div>
        </div>

        <div className={styles.headTools} aria-hidden="true">
          <span>📌</span>
          <span>👥</span>
        </div>
      </div>

      <div className={styles.chips}>
        <span className={styles.chipActive}># {model.channel}</span>
        <span className={styles.chipIdle} aria-disabled="true">
          # charts
        </span>
        <span className={styles.chipIdle} aria-disabled="true">
          # receipts
        </span>
        <span className={styles.chipIdle} aria-disabled="true">
          🔊 live
        </span>
      </div>
    </div>
  );
}

function ThesisBar({ premise }: { premise: string }) {
  return (
    <div className={styles.thesis}>
      <span className={styles.pin} aria-hidden="true">
        📌
      </span>
      <span className={styles.thesisCopy}>
        <strong className={styles.thesisLabel}>Circle thesis:</strong> {premise}
      </span>
      <span className={styles.thesisChevron} aria-hidden="true">
        ›
      </span>
    </div>
  );
}

/**
 * The Kai row. The artboard states a sentiment DELTA; the only real per-circle
 * sentiment is the current split (one stance per author, from each member's
 * latest note), so that is what the row states.
 */
function KaiSplitRow({ split }: { split: { bull: number; neutral: number; bear: number } }) {
  return (
    <div className={styles.kai}>
      <span className={styles.kaiMark} aria-hidden="true">
        🐋
      </span>
      <div className={styles.kaiCopy}>
        <strong className={styles.kaiName}>Kai</strong> · Circle stance stands at{" "}
        <span className={styles.kaiBull} data-numeric>
          {split.bull} bull
        </span>
        {" · "}
        <span data-numeric>{split.neutral} neutral</span>
        {" · "}
        <span className={styles.kaiBear} data-numeric>
          {split.bear} bear
        </span>
      </div>
      <span className={styles.kaiAuto}>AUTO</span>
    </div>
  );
}

/** Display-only: posting a note is not wired on the v3 routes. */
function Composer({ channel }: { channel: string }) {
  return (
    <div className={styles.composer}>
      <div className={styles.composerRow}>
        <span className={styles.composerBtnAccent} aria-hidden="true">
          +
        </span>
        <div className={styles.composerField}>Message # {channel}</div>
        <span className={styles.composerBtn} aria-hidden="true">
          📈
        </span>
        <span className={styles.composerSend} aria-hidden="true">
          ➤
        </span>
      </div>
    </div>
  );
}
