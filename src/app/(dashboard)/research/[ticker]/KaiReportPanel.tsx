"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Share2, Sparkles } from "lucide-react";

import KaiReportSection, { type KaiSectionKey } from "@/components/kai/KaiReportSection";
import { toParagraphs, type KaiReport } from "@/lib/kai/report";
import { Card, CardLabel, Donut } from "@/components/research/board";

/**
 * TICKER · KAI REPORT — board 14 of the owner's mockup.
 *
 *   ┌ Kai field: mark · KAI'S READ · headline · coverage ring · lede ─┐
 *   ┌ insight card ─┐  ┌ insight card ─┐  ┌ insight card ─┐
 *   ┌ WHAT WOULD CHANGE THE READ — warm field, bulleted ─────────────┐
 *   [ Set Kai Watch ]                            [ Share report ]
 *
 * The board's composition ships in full — the tinted Kai field, the radial,
 * the three signal cards, the warm "change my mind" field and the two-button
 * action bar. Two things on the board do not:
 *
 *   • the verdict word "ACCUMULATE". Kai never issues a directive on this
 *     product. The field's headline is the report's OWN headline — Kai's
 *     sentence, in Kai's words, with no instruction in it.
 *   • the "82% CONF" label on the radial. A confidence figure would be a
 *     claim about accuracy, and this product publishes no accuracy figures.
 *     The ring is kept and REPOINTED at something real and checkable: how
 *     much of the report Kai was able to complete — the share of its nine
 *     written sections plus its two stored data series that actually
 *     resolved. It is labelled COVERAGE and it says so on hover.
 *
 * Options content stays out (the board's "call flow · 180–185 strikes" card):
 * Club surfaces are equities-only, so the three signal cards are drawn from
 * the report's own equity prose instead.
 *
 * LOADING ≠ EMPTY. The report is seeded from the SERVER (page.tsx runs
 * get_latest_kai_report next to the research aggregate), so on first paint the
 * tab already knows whether a report exists. `resolved` is false only in the
 * narrow case where the server read failed and the client is retrying — and in
 * that window the tab renders a skeleton, never "Kai hasn't written one".
 *
 * FOUNDING STATE: reports are written name by name, so most live tickers
 * genuinely have none. That state is designed, not apologetic, and it never
 * fabricates a report.
 */

/** Kai's identity disc, as the board draws it inside the verdict field. */
function KaiDisc() {
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px]"
      style={{
        background: "color-mix(in srgb, var(--color-kai-500) 14%, var(--color-card))",
        borderColor: "color-mix(in srgb, var(--color-kai-500) 42%, transparent)",
      }}
      aria-hidden
    >
      <Sparkles className="h-5 w-5 text-kai-600" />
    </span>
  );
}

/**
 * COVERAGE — the one honest source for the board's radial.
 * Nine written sections + two stored data series; the ring reads the share of
 * them Kai actually filled. It is a fact about the ARTEFACT, not a prediction.
 */
function coverage(report: KaiReport): number {
  const s = report.sections;
  const parts: boolean[] = [
    !!s.headline,
    !!s.sector_tagline,
    !!s.business_plain,
    !!s.the_numbers,
    !!s.moat,
    !!s.thesis,
    (s.risks?.length ?? 0) > 0,
    !!s.kids_explainer,
    (s.discussion_questions?.length ?? 0) > 0,
    (report.data?.bars?.length ?? 0) > 1,
    (report.data?.financials?.length ?? 0) > 1,
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

/**
 * ── SAY IT ONCE ────────────────────────────────────────────────────────────
 * The board's three signal cards used to carry a 128-character TEASE of three
 * sections, and the long report mounted below then printed those same three
 * sections in full, verbatim, a screen further down — along with the identical
 * five risks under a second heading. Eight thousand pixels of Kai tab, roughly
 * half of it a second copy, and a member who read the cards had no way to know
 * the paragraphs below were the same words.
 *
 * The repair is not to truncate harder. These cards now carry the sections
 * THEMSELVES — the visual, the title, and every paragraph — and the long body
 * skips exactly what they carry. Nothing Kai wrote is lost; it is printed once,
 * next to the object drawn for it, and the tab is half the height.
 *
 * What the body below still owns, because only it has them: the price and
 * revenue charts, the kids explainer, the family questions, the sources note
 * and the compliance line.
 */
function SignalCard({
  visual,
  title,
  text,
}: {
  visual: ReactNode;
  title: string;
  text: string;
}) {
  const paras = toParagraphs(text);
  return (
    <Card radius="md" className="p-[15px_16px]">
      <div className="flex items-center gap-3.5">
        {visual && (
          <span className="grid h-11 w-14 shrink-0 place-items-center" aria-hidden>
            {visual}
          </span>
        )}
        <h3 className="min-w-0 flex-1 text-[13.5px] font-bold leading-snug text-ink">{title}</h3>
      </div>
      <div className="mt-2.5 space-y-3">
        {paras.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-midnight-200">
            {p}
          </p>
        ))}
      </div>
    </Card>
  );
}

/** A tiny close-only sparkline off the report's own stored series. */
function Spark({ bars }: { bars: { c: number }[] }) {
  if (bars.length < 2) return null;
  const cs = bars.map((b) => b.c);
  const min = Math.min(...cs);
  const max = Math.max(...cs);
  const span = max - min || 1;
  const step = 54 / (cs.length - 1);
  const d = cs
    .map((c, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(40 - ((c - min) / span) * 34).toFixed(1)}`)
    .join(" ");
  const up = cs[cs.length - 1] >= cs[0];
  return (
    <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={up ? "var(--color-price-up)" : "var(--color-price-down)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The two live Kai capabilities, as the board's bottom action bar. */
function KaiActions({
  ticker,
  onAskKai,
  onShare,
}: {
  ticker: string;
  onAskKai: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2.5 border-t border-sand pt-3.5">
      <Link
        href="/alerts#kai-nl"
        className="f0-focus flex flex-1 items-center justify-center gap-1.5 rounded-full bg-kai-500 px-4 py-2.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-kai-600"
      >
        <Bell className="h-4 w-4 shrink-0" aria-hidden /> Set Kai Watch
      </Link>
      <button
        type="button"
        onClick={onShare ?? onAskKai}
        className="f0-focus flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand bg-card px-4 py-2.5 text-[12.5px] font-bold text-ink transition-colors hover:border-volt-300"
      >
        {onShare ? (
          <>
            <Share2 className="h-4 w-4 shrink-0" aria-hidden /> Share report
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> Ask Kai about ${ticker}
          </>
        )}
      </button>
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
  // ── LOADING — shaped like the board, claims nothing ───────────────────────
  if (!resolved) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Card tone="kai" className="h-[150px] motion-safe:animate-pulse">
          <span className="sr-only">Opening Kai&apos;s report</span>
        </Card>
        {[0, 1, 2].map((i) => (
          <Card key={i} radius="md" className="h-[76px] motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  // ── FOUNDING — no report on this name yet, said plainly ───────────────────
  if (!report) {
    return (
      <div>
        <Card tone="kai" className="p-4">
          <div className="flex items-center gap-3">
            <KaiDisc />
            <div className="min-w-0 flex-1">
              <CardLabel tone="kai">Kai research report</CardLabel>
              <p className="mt-1.5 font-display text-[19px] font-extrabold leading-tight text-ink">
                Kai hasn&apos;t written up {companyName} yet.
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-[1.55] text-midnight-200">
            Research reports are written one company at a time, for the names the
            club is actually working on — so this page stays empty rather than
            filling itself with something nobody read. When ${ticker} gets one, it
            lands here.
          </p>
        </Card>
        <Card radius="md" className="mt-3 px-4 py-3.5">
          <p className="text-[12.5px] leading-relaxed text-soft">
            Kai can still work on ${ticker} right now: ask a question with the whole
            page as context, or describe in plain English what you want watched and
            Kai will set it up.
          </p>
        </Card>
        <KaiActions ticker={ticker} onAskKai={onAskKai} />
      </div>
    );
  }

  // ── LOCKED — the written report is the paid read ──────────────────────────
  if (locked) {
    return (
      <div>
        <Card tone="kai" className="p-4">
          <div className="flex items-center gap-3">
            <KaiDisc />
            <div className="min-w-0 flex-1">
              <CardLabel tone="kai">Kai research report</CardLabel>
              <p className="mt-1.5 font-display text-[19px] font-extrabold leading-tight text-ink">
                {report.sections.headline || `Kai's read on ${companyName}`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-[1.55] text-midnight-200">
            Kai has written a full research report on {companyName} — the business
            in plain English, the numbers, the moat, the risks, and a version you
            can read to your kids.
          </p>
        </Card>
        <div className="mt-4">{upsell}</div>
      </div>
    );
  }

  const s = report.sections;
  const cover = coverage(report);
  const updated = new Date(report.generated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const risks = s.risks || [];
  const bars = report.data?.bars || [];

  const insights = (
    [
      {
        key: "business_plain" as const,
        title: "The business, in plain English",
        text: s.business_plain,
        visual: <RevenueSpark report={report} />,
      },
      {
        key: "the_numbers" as const,
        title: "What the numbers say",
        text: s.the_numbers,
        visual: <Spark bars={bars} />,
      },
      {
        key: "moat" as const,
        title: "What protects it",
        text: [s.moat, s.thesis].filter(Boolean).join("\n\n"),
        visual: <MoatRing />,
      },
    ] as const
  ).filter((i) => toParagraphs(i.text).length > 0);

  /* Everything the cards above carry is skipped by the long body below. */
  const surfaced: KaiSectionKey[] = [
    ...insights.map((i) => i.key),
    ...(risks.length > 0 ? (["risks"] as const) : []),
  ];

  return (
    <div>
      {/* ── KAI'S READ ─────────────────────────────────────────────────────── */}
      <Card tone="kai" className="p-4">
        <div className="flex items-center gap-3">
          <KaiDisc />
          <div className="min-w-0 flex-1">
            <CardLabel tone="kai">Kai&apos;s read · updated {updated}</CardLabel>
            <p className="mt-1.5 font-display text-[19px] font-extrabold leading-tight text-ink">
              {s.headline || `Kai's read on ${companyName}`}
            </p>
          </div>
          <Donut
            pct={cover}
            size={58}
            thickness={6}
            color="var(--color-kai-500)"
            track="color-mix(in srgb, var(--color-kai-500) 22%, transparent)"
            label={`Report coverage ${cover} percent — how much of this report Kai completed`}
          >
            <span className="block font-mono text-[12px] font-semibold leading-none tabular-nums text-ink">
              {cover}%
            </span>
            <span className="mt-0.5 block font-mono text-[6px] uppercase tracking-[0.08em] text-soft">
              Cover
            </span>
          </Donut>
        </div>
        {s.sector_tagline && (
          <p className="mt-3 text-[12px] leading-[1.55] text-midnight-200">{s.sector_tagline}</p>
        )}
      </Card>

      {/* ── THE THREE SIGNALS ──────────────────────────────────────────────── */}
      <div className="mt-3 space-y-2.5">
        {insights.map((i) => (
          <SignalCard key={i.key} visual={i.visual} title={i.title} text={i.text} />
        ))}
      </div>

      {/* ── WHAT WOULD CHANGE THE READ ─────────────────────────────────────── */}
      {risks.length > 0 && (
        <Card tone="brand" radius="md" className="mt-3 px-4 py-3.5">
          <CardLabel tone="brand">What would change the read</CardLabel>
          <ul className="mt-2.5 space-y-2">
            {risks.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-[11.5px] leading-snug text-midnight-300">
                <span
                  className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-volt-500"
                  aria-hidden
                />
                <span className="min-w-0">{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* The rest of the written report — charts, the kids explainer, the
          family questions, sources and the compliance line, all verbatim. The
          head is suppressed because the field above already carries it. */}
      <div className="mt-6">
        <KaiReportSection report={report} showHead={false} surfaced={surfaced} />
      </div>

      <KaiActions ticker={ticker} onAskKai={onAskKai} />
    </div>
  );
}

/** Four bars off the report's own stored financials — no bars, no card art. */
function RevenueSpark({ report }: { report: KaiReport }) {
  const rows = (report.data?.financials || []).slice(-4);
  const vals = rows.map((r) => r.revenue ?? 0).filter((v) => v > 0);
  if (vals.length < 2) return null;
  const peak = Math.max(...vals);
  return (
    <span className="flex h-11 w-14 items-end gap-[3px]" aria-hidden>
      {vals.map((v, i) => (
        <span
          key={i}
          className={`min-w-0 flex-1 rounded-[2px] ${
            i >= vals.length - 2 ? "bg-price-up" : "bg-sand"
          }`}
          style={{ height: `${Math.max(18, (v / peak) * 100)}%` }}
        />
      ))}
    </span>
  );
}

/** A quiet brand ring — the moat card's mark. Decorative, carries no number. */
function MoatRing() {
  return (
    <span
      className="grid h-[38px] w-[38px] place-items-center rounded-full border-[3px] border-volt-500/60"
      aria-hidden
    >
      <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-volt-500" />
    </span>
  );
}
