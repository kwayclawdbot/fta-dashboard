import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import BeltChip from "@/ui-v3/components/club/BeltChip";
import { TICKER_EMPTY, type VoiceVM } from "@/ui-v3/ticker-data";
import styles from "./TopVoices.module.css";

/**
 * "TOP VOICES · Highest reputation takes".
 *
 * The artboard's own 844px frame clips this section right after its caption, so
 * the row treatment is not drawn anywhere. Rather than invent one, the rows are
 * the Club feed's existing flat-card shape — the belt chip beside a name over a
 * body line — which is the pattern this app already uses everywhere a member
 * says something.
 *
 * "Reputation" is the club's own ladder: the adapter orders these by the
 * author's lifetime XP, which is what resolves the belt shown on each row. The
 * caption therefore describes the real ordering.
 */
export default function TopVoices({ voices }: { voices: VoiceVM[] }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow
        labelTone="accent"
        caption="Highest reputation takes"
        captionGap={2}
        actionLabel={voices.length > 0 ? "See all" : undefined}
        actionHref={voices.length > 0 ? "/v3/club" : undefined}
        actionTone="dim"
      >
        Top voices
      </SectionEyebrow>

      {voices.length === 0 ? (
        <EmptyNote>{TICKER_EMPTY.voices}</EmptyNote>
      ) : (
        <div className={styles.list}>
          {voices.map((voice) => (
            <article key={voice.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.initials} aria-hidden="true">
                  {voice.initials}
                </span>
                <span className={styles.author}>{voice.authorName}</span>
                {voice.beltKey && voice.beltLabel ? (
                  <BeltChip belt={voice.beltKey} label={voice.beltLabel} size="sm" />
                ) : null}
              </div>
              <p className={styles.body}>{voice.snippet}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
