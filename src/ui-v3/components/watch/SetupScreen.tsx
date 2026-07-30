import Link from "next/link";
import type { SetupDetailVM } from "@/ui-v3/watch-data";
import SetupChart from "./SetupChart";
import { ConditionsPanel, NotifyPanel, SinceFlaggedRow } from "./SetupPanels";
import ArmAlertButton from "./ArmAlertButton";
import styles from "./SetupScreen.module.css";

/**
 * "19 Alert Setup", translated from the artboard.
 *
 * This screen carries an action bar instead of the bottom nav, so it renders its
 * own column rather than AppShell's. The chart card is omitted when the ticker
 * has no close series to draw; the since-flagged row is omitted when the setup
 * carries no reference price.
 *
 * The artboard's second footer slot ("Share") is absent: there is no share
 * endpoint for a setup, and a button that does nothing is worse than no button.
 */
export default function SetupScreen({ model }: { model: SetupDetailVM }) {
  return (
    <div className={styles.viewport}>
      <div className={styles.screen}>
        <div className={styles.body}>
          <div className={styles.head}>
            <Link href="/v3/watch/alerts" className={styles.back} aria-label="Back to alerts">
              ←
            </Link>
            <div className={styles.identity}>
              <div className={styles.title}>{model.title}</div>
              <div className={styles.subtitle}>{model.subtitle}</div>
            </div>
            <span
              className={`${styles.status} ${model.statusLive ? styles.statusLive : ""}`}
              data-numeric
            >
              {model.statusLabel}
            </span>
          </div>

          {model.chart ? <SetupChart chart={model.chart} quote={model.quote} /> : null}

          <ConditionsPanel conditions={model.conditions} met={model.met} />
          {model.conditions.length === 0 ? (
            <p className={styles.empty}>
              This setup has no evaluable conditions yet — it carries no levels and you have no
              watches on {model.ticker}.
            </p>
          ) : null}

          <NotifyPanel settings={model.notify} />
          {model.sinceLine ? <SinceFlaggedRow line={model.sinceLine} /> : null}
        </div>

        <div className={styles.bar}>
          <ArmAlertButton
            setupId={model.id}
            armed={model.followed}
            interactive={model.source === "live"}
          />
        </div>
      </div>
    </div>
  );
}
