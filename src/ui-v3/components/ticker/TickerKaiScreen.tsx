import Link from "next/link";
import AppShell from "@/ui-v3/components/AppShell";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type TickerKaiVM } from "@/ui-v3/ticker-data";
import TickerHead from "./TickerHead";
import TickerTabs from "./TickerTabs";
import KaiReport from "./KaiReport";
import styles from "./TickerKaiScreen.module.css";

/**
 * "14 Kai Report".
 *
 * The artboard's bar carries two actions. "Set Kai Watch" has a real
 * destination — the Watch board is where a member's rules live — so it stays.
 * "Share report" has no share implementation anywhere in the app, so it is
 * omitted and the one real action fills the bar.
 *
 * KAI_REPORT_DISCLAIMER is not decoration: the report is AI-written educational
 * analysis, and the compliance line travels with it from src/lib/kai/report.ts
 * rather than being retyped here. It renders whether or not a report exists,
 * because the tab makes the claim either way.
 *
 * Reports are admin-generated per ticker, so most names have none. That is the
 * ordinary case, not an error, and it says so.
 */
export default function TickerKaiScreen({ model }: { model: TickerKaiVM }) {
  return (
    <AppShell
      nav={false}
      bar={
        <Link href="/v3/watch/alerts" className={styles.action}>
          Set Kai Watch
        </Link>
      }
    >
      <TickerHead head={model.head} />
      <TickerTabs symbol={model.head.symbol} active="kai" />

      {model.report ? (
        <KaiReport report={model.report} />
      ) : (
        <EmptyNote tall>{TICKER_EMPTY.kai}</EmptyNote>
      )}

      <p className={styles.disclaimer}>{model.disclaimer}</p>
    </AppShell>
  );
}
