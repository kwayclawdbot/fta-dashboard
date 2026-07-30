import Sparkline from "@/ui-v3/components/discover/Sparkline";
import type { TickerKaiVM } from "@/ui-v3/ticker-data";
import styles from "./KaiReport.module.css";

/**
 * "14 Kai Report" — the report Kai actually wrote for this ticker.
 *
 * TWO THINGS THE ARTBOARD PROMISES THAT THE REPORT DOES NOT CARRY, and both are
 * the loudest objects on the board:
 *
 *   "Accumulate"  — a verdict. `kai_reports.sections` has no verdict field, and
 *                   a verdict is an instruction. The panel leads on the
 *                   report's own `headline`, which is the line it was written
 *                   to lead on.
 *   "82% CONF"    — a confidence ring. Nothing measures the model's confidence,
 *                   and a number in a ring is the most believable form a made-up
 *                   number can take. There is no ring.
 *
 * What is left is the whale, the blue, the panel and the prose — and the prose
 * is the part a member came for.
 *
 * The evidence rows below the panel are the report's own sections. Only the
 * price section gets a drawing, because `data.bars` is the only series the
 * stored report carries; the others say what they have to say in words rather
 * than borrowing a chart that means nothing.
 */
export default function KaiReport({
  report,
}: {
  report: NonNullable<TickerKaiVM["report"]>;
}) {
  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.avatar} aria-hidden="true">
            🐋
          </div>
          <div className={styles.panelBody}>
            <div className={styles.eyebrow}>Kai&rsquo;s report · {report.generatedLabel}</div>
            {report.sectorTagline ? (
              <div className={styles.tagline}>{report.sectorTagline}</div>
            ) : null}
          </div>
        </div>
        <p className={styles.headline}>{report.headline}</p>
      </section>

      {report.sections.map((section) => (
        <article key={section.key} className={styles.row}>
          {section.series ? (
            <div className={styles.figure}>
              <Sparkline
                series={section.series}
                viewWidth={56}
                viewHeight={44}
                strokeWidth={2}
                tone="positive"
              />
            </div>
          ) : null}
          <div className={styles.rowBody}>
            <div className={styles.rowEyebrow}>{section.eyebrow}</div>
            <div className={styles.rowTitle}>{section.title}</div>
            <p className={styles.rowCopy}>{section.body}</p>
          </div>
        </article>
      ))}

      {report.risks.length > 0 ? (
        <section className={styles.risks}>
          <div className={styles.risksEyebrow}>What Kai is watching</div>
          <ul className={styles.riskList}>
            {report.risks.map((risk) => (
              <li key={risk} className={styles.risk}>
                <span className={styles.bullet} aria-hidden="true" />
                {risk}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
