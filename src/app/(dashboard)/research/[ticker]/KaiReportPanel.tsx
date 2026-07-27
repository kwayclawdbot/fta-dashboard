"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Sparkles } from "lucide-react";

import KaiReportSection from "@/components/kai/KaiReportSection";
import type { KaiReport } from "@/lib/kai/report";

/**
 * KAI REPORT — the fifth tab on /research/[ticker] (canvas v2, board 14).
 *
 * The canvas gives Kai its own ticker subpage. We ship it, minus the two things
 * the canvas draws that this product cannot say:
 *   • the directive verdict ("ACCUMULATE") and its confidence donut — the app
 *     never renders an instruction, and the club sentiment arc stays the only
 *     radial in the system;
 *   • the options-flow signal card — Club surfaces are equities-only.
 * What is left is the part that was always the real value: Kai's written read,
 * grounded in stored data.
 *
 * LOADING ≠ EMPTY, and this tab is where that distinction bites hardest. The
 * report is seeded from the SERVER (page.tsx runs get_latest_kai_report next to
 * the research aggregate), so on first paint the tab already knows whether a
 * report exists. `resolved` is false only in the narrow case where the server
 * read failed and the client is retrying — and in that window the tab renders a
 * skeleton, never the "Kai hasn't written one" line.
 *
 * FOUNDING STATE: reports are written name by name, so most of the nine live
 * tickers genuinely have none. That state is designed, not apologetic, and it is
 * honest — it never fabricates a report, and it hands the member the two Kai
 * capabilities that ARE live on every ticker today: the contextual Ask-Kai sheet
 * and Kai Watch (plain-English alerts).
 */

/** The two live Kai capabilities, as one hairline strip — never a pill grid. */
function KaiActions({ ticker, onAskKai }: { ticker: string; onAskKai: () => void }) {
  const cell =
    "f0-focus flex flex-1 items-center justify-center gap-1.5 py-3.5 text-center font-display text-[13px] font-bold text-kai-600 transition-colors hover:text-kai-500 dark:text-kai-300 dark:hover:text-kai-200";
  return (
    <div className="mt-8 flex border-y border-sand">
      <button type="button" onClick={onAskKai} className={cell}>
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> Ask Kai about ${ticker}
      </button>
      <span className="w-px bg-sand" aria-hidden />
      <Link href="/alerts#kai-nl" className={cell}>
        <Bell className="h-4 w-4 shrink-0" aria-hidden /> Set a Kai Watch
      </Link>
    </div>
  );
}

export default function KaiReportPanel({
  ticker,
  companyName,
  report,
  resolved,
  locked,
  upsell,
  onAskKai,
}: {
  ticker: string;
  companyName: string;
  report: KaiReport | null;
  /** The report read has actually come back (server seed or client retry). */
  resolved: boolean;
  /** Free tier — the written report is a paid read. */
  locked: boolean;
  /** The entitlement wall to render when `locked` (owned by the caller). */
  upsell: ReactNode;
  onAskKai: () => void;
}) {
  // ── LOADING — shaped like the report, claims nothing ──────────────────────
  if (!resolved) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-2.5 w-44 rounded-full bg-kai-500/25 motion-safe:animate-pulse" />
        <div className="h-9 w-full max-w-md rounded-lg bg-sand/50 motion-safe:animate-pulse" />
        <div className="space-y-2.5">
          <div className="h-3 w-full rounded-full bg-sand/40 motion-safe:animate-pulse" />
          <div className="h-3 w-11/12 rounded-full bg-sand/40 motion-safe:animate-pulse" />
          <div className="h-3 w-8/12 rounded-full bg-sand/40 motion-safe:animate-pulse" />
        </div>
        <div className="h-[200px] rounded-xl bg-sand/40 motion-safe:animate-pulse" />
      </div>
    );
  }

  // ── FOUNDING — no report on this name yet, said plainly ───────────────────
  if (!report) {
    return (
      <div>
        <p className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-kai-600 dark:text-kai-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Kai research report
        </p>
        <div className="mt-3 border-t-2 border-kai-500/30" aria-hidden />
        <h2 className="mt-4 font-display text-display-2 font-extrabold leading-tight text-ink">
          Kai hasn&apos;t written up {companyName} yet.
        </h2>
        <p className="mt-3.5 max-w-prose text-[14.5px] leading-relaxed text-midnight-200">
          Research reports are written one company at a time, for the names the
          club is actually working on — so this page stays empty rather than
          filling itself with something nobody read. When ${ticker} gets one, it
          lands here.
        </p>
        <p className="mt-3.5 max-w-prose text-[13.5px] leading-relaxed text-soft">
          Kai can still work on ${ticker} right now: ask a question with the whole
          page as context, or describe in plain English what you want watched and
          Kai will set it up.
        </p>
        <KaiActions ticker={ticker} onAskKai={onAskKai} />
      </div>
    );
  }

  // ── LOCKED — the written report is the paid read ──────────────────────────
  if (locked) {
    return (
      <div>
        <p className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-kai-600 dark:text-kai-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Kai research report
        </p>
        <div className="mt-3 border-t-2 border-kai-500/30" aria-hidden />
        <p className="mt-4 max-w-prose text-[14.5px] leading-relaxed text-midnight-200">
          Kai has written a full research report on {companyName} — the business
          in plain English, the numbers, the moat, the risks, and a version you
          can read to your kids.
        </p>
        <div className="mt-5">{upsell}</div>
      </div>
    );
  }

  return (
    <div>
      <KaiReportSection report={report} />
      <KaiActions ticker={ticker} onAskKai={onAskKai} />
    </div>
  );
}
