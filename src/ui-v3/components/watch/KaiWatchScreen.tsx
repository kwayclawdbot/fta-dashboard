import Link from "next/link";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { KaiWatchRuleVM, KaiWatchVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import SetupTeaserRow from "./SetupTeaserRow";
import styles from "./KaiWatchScreen.module.css";

/**
 * /v3/watch/setups — the KAI WATCH tab.
 *
 * NO ARTBOARD EXISTS. Composed from the grammar (§9): the Watch head, a
 * SectionEyebrow per region, the flat list row, and — for the published setups —
 * the SetupTeaserRow that "06 Watch" already draws below its Getting-close
 * panel, unchanged.
 *
 * Two regions, because there are two different objects here. An ARMED WATCH is
 * the member's own `alert_rules` row, private to them by RLS. A LIVE SETUP is a
 * club-wide `alert_setups` row every member can read. Merging them into one
 * list would tell a member they armed things they never armed.
 *
 * HONESTY NOTE. The evaluation crons are dry in this environment, so most
 * watches have no recorded state and no `last_checked_at`. A watch in that
 * condition says "Not checked yet" rather than borrowing the baseline
 * "Watching" label, which would claim an evaluation that never ran.
 */
export default function KaiWatchScreen({ model }: { model: KaiWatchVM }) {
  return (
    <AppShell>
      <WatchHeader active="kai-watch" tabGap="16px" />

      <SectionEyebrow
        caption={
          model.rules.length > 0
            ? `${model.rules.length} armed · Kai checks each one every cycle`
            : undefined
        }
      >
        Armed watches
      </SectionEyebrow>

      {model.rules.length === 0 ? (
        <EmptyNote>
          Kai&rsquo;s watches land here. Nothing is armed yet — set a condition on a ticker and
          this is where you&rsquo;ll see what Kai is holding for you.
        </EmptyNote>
      ) : (
        <div className={styles.list}>
          {model.rules.map((rule) => (
            <WatchRow key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <div className={styles.setups}>
        <SectionEyebrow>Live setups</SectionEyebrow>
        {model.setups.length === 0 ? (
          <EmptyNote>
            No setups are live right now. When Kai publishes one, it shows up here with its
            conditions and how many of them hold.
          </EmptyNote>
        ) : (
          model.setups.map((setup) => <SetupTeaserRow key={setup.href ?? setup.title} setup={setup} />)
        )}
      </div>
    </AppShell>
  );
}

/**
 * One armed watch.
 *
 * The state is set in mono beside the freshness rather than in a coloured chip:
 * the alert digest's three chip washes are tied to buy / sell / heads-up, and
 * repainting them for a lifecycle state would make the same object mean two
 * things. A LIVE state (near trigger, triggered) is the one accent run the row
 * is allowed (§4) — everything else stays on the neutral ramp.
 */
function WatchRow({ rule }: { rule: KaiWatchRuleVM }) {
  const inner = (
    <>
      {rule.ticker ? (
        <TickerTile ticker={rule.ticker} size="sm" />
      ) : (
        <span className={styles.universe} aria-hidden="true">
          ✦
        </span>
      )}
      <span className={styles.copy}>
        <span className={styles.label}>{rule.label}</span>
        <span className={styles.meta}>
          <span className={styles.kind}>{rule.kindLabel}</span>
          {rule.stateLabel ? (
            <span className={rule.stateLive ? styles.stateLive : styles.state}>
              {rule.stateLabel}
            </span>
          ) : (
            <span className={styles.state}>Not checked yet</span>
          )}
          {rule.checkedLabel ? <span className={styles.state}>{rule.checkedLabel}</span> : null}
        </span>
      </span>
      {rule.href ? (
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  );

  return rule.href ? (
    <Link href={rule.href} className={styles.row}>
      {inner}
    </Link>
  ) : (
    <div className={styles.row}>{inner}</div>
  );
}
