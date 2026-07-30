import type { SetupConditionVM, NotifySettingVM } from "@/ui-v3/watch-data";
import ConditionMark from "./ConditionMark";
import styles from "./SetupPanels.module.css";

/**
 * "19 Alert Setup" — Conditions, Notify me, and the since-flagged row.
 *
 * The Conditions eyebrow states the real fraction. "all met" only appears when
 * every condition genuinely holds; otherwise it reads "N of M met", which is the
 * same sentence the dial on 06 tells.
 */
export function ConditionsPanel({
  conditions,
  met,
}: {
  conditions: SetupConditionVM[];
  met: number;
}) {
  if (conditions.length === 0) return null;
  const allMet = met === conditions.length;

  return (
    <section className={styles.card}>
      <div className={`${styles.eyebrow} ${styles.eyebrowLive}`}>
        Conditions · {allMet ? "all met" : `${met} of ${conditions.length} met`}
      </div>
      <div className={styles.list}>
        {conditions.map((condition) => (
          <div key={condition.label} className={styles.row}>
            <ConditionMark met={condition.met} size="md" />
            <span className={`${styles.label} ${condition.met ? "" : styles.labelOff}`}>
              {condition.label}
            </span>
            {condition.reading ? (
              <span
                className={`${styles.reading} ${condition.met ? "" : styles.readingPending}`}
                data-numeric
              >
                {condition.reading}
                {condition.met ? " ✓" : ""}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The member's real notification state for this setup.
 *
 * Each switch REPORTS state — it is not a control, because no mutation endpoint
 * exists for these settings inside v3 yet. It is therefore marked up as a status
 * image with a spoken on/off, not as a checkbox that silently does nothing.
 */
export function NotifyPanel({ settings }: { settings: NotifySettingVM[] }) {
  if (settings.length === 0) return null;
  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>Notify me</div>
      <div className={`${styles.list} ${styles.listWide}`}>
        {settings.map((setting) => (
          <div key={setting.label} className={styles.row}>
            <span className={`${styles.label} ${setting.on ? "" : styles.labelOff}`}>
              {setting.label}
            </span>
            <span
              className={`${styles.switch} ${setting.on ? styles.switchOn : ""}`}
              role="img"
              aria-label={setting.on ? "On" : "Off"}
            >
              <span className={`${styles.knob} ${setting.on ? styles.knobOn : ""}`} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What the stock has done since Kai flagged the setup.
 *
 * This is the slot the artboard fills with "72% follow-through · 41 triggers".
 * No per-setup-pattern backtest exists in the data layer, so the row carries the
 * observational move instead — a fact about this setup, never graded as a win.
 */
export function SinceFlaggedRow({ line }: { line: string }) {
  return (
    <div className={styles.since}>
      <span className={styles.sinceGlyph} aria-hidden="true">
        📜
      </span>
      <span className={styles.sinceText}>{line}</span>
    </div>
  );
}
