"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Share2, Sparkles } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import KaiChatShared from "@/components/kai/KaiChatShared";
import { StatCard } from "@/components/research/board";
import { CompanyProfileCard, NewsList } from "@/components/research/ResearchSections";
import { letterColor } from "@/components/research/GradeVisuals";
import { fetchNews, type NewsHeadline } from "@/lib/market/client";
import type { ResearchPayload } from "@/lib/research/types";
import AlertLevelChart, {
  ALERT_CHART_TFS,
  type AlertChartTf,
} from "@/components/alerts/AlertLevelChart";
import WatchSetupButton from "@/components/alerts/WatchSetupButton";
import { GlowPct, PlanRail, kaiSetupLine, money } from "@/components/alerts/poster";
import { SETUP_STATE_META, setupStateLine, readSetupLevels } from "@/lib/alerts/watch-ui";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";
import type { AlertEvent, AlertSetup, TradeAlert } from "@/lib/alerts/types";

/**
 * SETUP DETAIL — /alerts/s/[id], rebuilt 2026-08-10 as THE STORY (owner-
 * approved poster language; prior art cheatcode-os KaiWinDetailPage on club
 * tokens):
 *
 *   • Full-bleed ~40vh hero — the real 1-month close line drawn edge-to-edge
 *     with a neon glow, the plan's ENTRY / STOP / TARGET as labelled glowing
 *     horizontals ON the chart, and the content floating on it: back arrow +
 *     Follow/Share pills top, logo + gradient $TICKER bottom-left, live
 *     price + the glowing since-flagged % bottom-right.
 *   • Kai's thesis as the centerpiece — large quoted violet typography, with
 *     the ONE human state line beneath (no chips, no lifecycle bars, no
 *     distance meters, per the heat-by-glow law).
 *   • The plan as a rail — Entry → Target with the stop marked beneath.
 *   • THE STORY AS A THREAD — SMS-style beats built ONLY from recorded data
 *     (issued_at → the setup_update events genuinely fanned out to this
 *     member → the resolution's state_entered_at), and the inline Kai chat
 *     continuing the SAME thread with a composer at its foot.
 *
 * COMPLIANCE: the footer disclaimer is rendered VERBATIM. Kai keeps all its
 * own caps/meters/guardrails — the embed is the real KaiChatShared panel.
 */

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" }
  )}`;
}

const TERMINAL_STATES: SetupState[] = ["triggered", "invalidated", "expired"];

export default function SetupDetailClient({
  setup,
  broadcast,
  current,
  companyName,
  thread,
  research = null,
}: {
  setup: AlertSetup;
  broadcast: TradeAlert | null;
  current: number | null;
  companyName: string;
  thread: AlertEvent[];
  /** Still fetched by the server page; the story renders only THIS setup's
   *  own recorded beats (related-events blocks removed by the redesign). */
  related?: AlertEvent[];
  /** Server-seeded research aggregate — the concise ticker-detail context
   *  (key stats, company profile, financial-health grade). Honest null when
   *  the compose failed or the ticker has no coverage. */
  research?: ResearchPayload | null;
}) {
  const [kaiOpen, setKaiOpen] = useState(false);
  const [kaiNonce, setKaiNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [tf, setTf] = useState<AlertChartTf>("1h");

  // Recent third-party headlines — client-fetched like the research page.
  // null = loading, [] = the feed had nothing (rendered as an absent section).
  const [news, setNews] = useState<NewsHeadline[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchNews(setup.ticker, 5).then((n) => {
      if (live) setNews(n);
    });
    return () => {
      live = false;
    };
  }, [setup.ticker]);

  const meta = SETUP_STATE_META[setup.state];
  const L = readSetupLevels(setup.levels);
  const entry = setup.entry ?? broadcast?.entry ?? null;
  const stop = L.stop ?? L.support;
  const target = broadcast?.targets?.[0]?.price ?? L.resistance;
  const px = current ?? setup.snapshot_price;

  const snap = setup.snapshot_price;
  const perfPct =
    snap != null && current != null && snap > 0 ? ((current - snap) / snap) * 100 : null;

  /* ── THE TRADE BRIEF — the page's opening summary (owner directive):
     what the company is, why it's moving, why the trade — every sentence
     composed ONLY from stored data. A missing input is a missing row. */

  // What the company is — the stored description's first sentence.
  const desc = research?.company.description?.trim() ?? "";
  const firstStop = desc.indexOf(". ");
  const companyLine = !desc
    ? null
    : firstStop > 40
      ? desc.slice(0, firstStop + 1)
      : desc.length > 220
        ? desc.slice(0, 220).trimEnd() + "…"
        : desc;

  // Why it's moving — the human state line + the REAL recorded moves, with
  // every number set as a highlighted mono figure (terminal law: the data
  // is the decoration).
  const mo = research?.momentum;
  const moveFrags: React.ReactNode[] = [];
  if (perfPct != null)
    moveFrags.push(
      <span key="flag">
        {perfPct >= 0 ? "up" : "down"}{" "}
        <BriefNum tone={perfPct >= 0 ? "up" : "down"}>
          {Math.abs(perfPct).toFixed(1)}%
        </BriefNum>{" "}
        since Kai flagged it
      </span>
    );
  if (mo?.chg1m != null)
    moveFrags.push(
      <span key="m1">
        {mo.chg1m >= 0 ? "up" : "down"}{" "}
        <BriefNum tone={mo.chg1m >= 0 ? "up" : "down"}>
          {Math.abs(mo.chg1m).toFixed(1)}%
        </BriefNum>{" "}
        over the last month
      </span>
    );
  const movingRich = (
    <>
      {kaiSetupLine(setup)}
      {moveFrags.length > 0 && (
        <>
          {" "}
          ${setup.ticker} is{" "}
          {moveFrags.map((f, i) => (
            <span key={i}>
              {i > 0 && " and "}
              {f}
            </span>
          ))}
          .
        </>
      )}
      {mo?.rsi14 != null && (
        <>
          {" "}
          RSI sits at <BriefNum>{Math.round(mo.rsi14)}</BriefNum>.
        </>
      )}
    </>
  );

  // Why the trade — the stored thesis when it reads like a sentence (a bare
  // tag like "BREAKOUT" is not a voice line); otherwise the plan's own
  // stored legs, stated plainly with highlighted mono prices.
  const storedThesis = (setup.thesis || broadcast?.narrative || "").trim();
  const speakableThesis =
    storedThesis.includes(" ") && /[a-z]/.test(storedThesis) ? storedThesis : null;
  const legFrags: React.ReactNode[] = [];
  if (entry != null)
    legFrags.push(
      <span key="e">
        entry <BriefNum>${money(entry)}</BriefNum>
      </span>
    );
  if (target != null)
    legFrags.push(
      <span key="t">
        target <BriefNum tone="up">${money(target)}</BriefNum>
      </span>
    );
  if (stop != null)
    legFrags.push(
      <span key="s">
        stop <BriefNum tone="down">${money(stop)}</BriefNum>
      </span>
    );
  const tradeRich = speakableThesis ?? (
    <>
      {broadcast?.setup_label || `Kai's ${setup.direction} setup`}
      {legFrags.length > 0 && (
        <>
          {" — "}
          {legFrags.map((f, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {f}
            </span>
          ))}
        </>
      )}
      .
    </>
  );

  // Machine-recorded conditions ("2 of 3") — rendered ONLY when present.
  const conditions = Array.isArray(setup.detail?.conditions)
    ? (setup.detail!.conditions as { label: string; met: boolean }[])
    : [];
  const metCount = conditions.filter((c) => c.met).length;

  /* ── THE STORY'S BEATS — recorded moments only ─────────────────────────
     issued (created_at) → every setup_update event genuinely fanned out to
     this member (ascending) → the resolution (state_entered_at), skipped
     when the thread already carries that terminal step. */
  const beats = useMemo(() => {
    const list: { id: string; at: string; text: string }[] = [
      {
        id: "issued",
        at: setup.created_at,
        text: broadcast?.setup_label
          ? `${broadcast.setup_label} — Kai flagged $${setup.ticker}.`
          : `Kai flagged $${setup.ticker}.`,
      },
    ];
    const asc = [...thread].sort((a, b) => +new Date(a.fired_at) - +new Date(b.fired_at));
    for (const e of asc) {
      const st = (e.payload?.state as SetupState) || setup.state;
      list.push({
        id: e.id,
        at: e.fired_at,
        text: e.payload?.message || setupStateLine(st, setup.ticker),
      });
    }
    const terminal = TERMINAL_STATES.includes(setup.state);
    const threadHasTerminal = asc.some((e) => e.payload?.state === setup.state);
    if (terminal && !threadHasTerminal) {
      list.push({
        id: "resolved",
        at: setup.state_entered_at,
        text: setupStateLine(setup.state, setup.ticker),
      });
    }
    return list;
  }, [setup, broadcast, thread]);

  // Share — the story's own URL + an honest one-line summary.
  const share = useCallback(async () => {
    const url = window.location.href;
    const text =
      `Kai's ${setup.direction} setup on $${setup.ticker} — ${meta.label.toLowerCase()}. ` +
      `Educational analysis, not advice.`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `KAI · $${setup.ticker}`, text, url });
        return;
      }
    } catch {
      // Dismissed / unsupported → fall through to the clipboard copy.
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — nothing honest left to do silently.
    }
  }, [setup, meta.label]);

  // The seeded Ask-Kai context — names THIS setup: ticker, state, levels.
  const kaiChip = `${setup.ticker} · ${meta.label} setup`;
  const kaiQuery =
    `Walk me through the ${setup.direction} setup on ${setup.ticker} — it's currently "${meta.label}". ` +
    `${entry != null ? `Entry ${money(entry)}, ` : ""}${stop != null ? `stop ${money(stop)}, ` : ""}${
      target != null ? `target ${money(target)}. ` : ""
    }` +
    `What has to happen next, and what would tell me the read is wrong?`;

  function openKaiInline() {
    setKaiNonce((n) => n + 1);
    setKaiOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      {/* ══ HERO — header + the SMS-style marked-up chart (owner directive:
             the levels-marked candle chart members know from the Kai SMS/MMS
             alerts — real candles, labelled ENTRY/STOP/TARGET, shaded
             risk/reward zones; no full-bleed line wash) ═══════════════════ */}
      <div className="border-b border-sand px-4 pb-5 pt-4 sm:px-6">
        {/* top row — back · Follow + Share pills */}
        <div className="flex items-center gap-2">
          <Link
            href="/alerts"
            aria-label="Back to Kai Watch"
            className="f0-focus grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sand bg-card text-soft transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <WatchSetupButton
              setupId={setup.id}
              initialSubscribed={!!setup.subscribed}
              size="sm"
            />
            <button
              type="button"
              onClick={share}
              className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-kai-500/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-kai-600" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Share"}
            </button>
          </div>
        </div>

        {/* identity — logo + ticker left · live price + move right */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo
              symbol={setup.ticker}
              name={companyName}
              size={40}
              rounded="rounded-[12px]"
            />
            <div className="min-w-0">
              <h1 className="font-display text-[30px] font-black leading-none tracking-[-0.04em] text-ink">
                ${setup.ticker}
              </h1>
              <p className="mt-1 truncate text-[11.5px] text-soft/85">{companyName}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {px != null && (
              <p className="font-mono text-[13px] font-semibold tabular-nums leading-none text-ink">
                {money(px)}
              </p>
            )}
            {perfPct != null && (
              <div className="mt-1.5">
                <GlowPct value={perfPct} size={30} />
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/70">
                  Since flagged
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── THE TRADE BRIEF — a ledger, not a paragraph: mono label rail
               left, Space Grotesk prose right, every real number set as a
               highlighted mono figure ─────────────────────────────────────── */}
        <div className="mt-6">
          {companyLine && <BriefRow label="The company">{companyLine}</BriefRow>}
          <BriefRow label="Why it's moving">{movingRich}</BriefRow>
          <BriefRow label="The trade" tone="kai">
            &ldquo;{tradeRich}&rdquo;
          </BriefRow>
          <p className="mt-2.5 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-soft/60">
            An interpretation of what already happened — never a forecast.
          </p>
        </div>

        {/* ── FINANCIAL HEALTH — the report-card band: a dark ink panel with
               the shield seal, gold eyebrow, and a segmented four-area grade
               meter (owner directive: custom, not a chip row) ─────────────── */}
        {research?.grades.overall.letter &&
          (() => {
            const g = research.grades.overall;
            if (!g.letter) return null;
            const gc = letterColor(g.letter);
            return (
              <Link
                href={`/research/${encodeURIComponent(setup.ticker)}`}
                className="f0-focus mt-6 block"
              >
                <div
                  className="relative overflow-hidden rounded-[18px] border border-white/10 px-4 py-4 shadow-soft transition hover:brightness-[1.06] sm:px-5"
                  style={{ background: "linear-gradient(140deg, #221c12 0%, #2b2416 58%, #241e13 100%)" }}
                >
                  {/* grade-coloured sheen off the seal's corner */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(110% 130% at 0% 0%, color-mix(in srgb, ${gc} 26%, transparent) 0%, transparent 55%)`,
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <GradeSeal letter={g.letter} color={gc} size={64} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-gold-500/90">
                            Financial health
                          </p>
                          <p className="font-grotesk text-[22px] font-bold leading-tight tracking-[-0.01em] text-white">
                            {g.label ?? "Graded"}
                          </p>
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-gold-500/90 sm:flex">
                          Full research <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      {/* the four areas as a segmented meter */}
                      <span className="mt-2.5 grid grid-cols-4 gap-1.5">
                        {research.grades.dimensions.map((d) => {
                          const dc = d.letter ? letterColor(d.letter) : null;
                          return (
                            <span key={d.dimension} className="min-w-0">
                              <span
                                aria-hidden
                                className="block h-[5px] rounded-full"
                                style={{
                                  background: dc ?? "rgba(255,255,255,0.14)",
                                  boxShadow: dc
                                    ? `0 0 10px color-mix(in srgb, ${dc} 55%, transparent)`
                                    : undefined,
                                }}
                              />
                              <span className="mt-1 flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.08em] text-white/55">
                                <span className="truncate">{d.dimension}</span>
                                <span
                                  className="pl-1 text-[9px] font-bold"
                                  style={dc ? { color: dc } : undefined}
                                >
                                  {d.letter ?? "—"}
                                </span>
                              </span>
                            </span>
                          );
                        })}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })()}

        {/* the marked-up chart — tf switch · candles · levels · zones */}
        <div className="mt-5">
          <div className="flex items-center gap-1.5">
            {ALERT_CHART_TFS.map((t) => {
              const active = t.key === tf;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTf(t.key)}
                  aria-pressed={active}
                  className={`f0-focus rounded-[8px] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
                    active
                      ? "bg-ink text-card"
                      : "bg-paper text-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <AlertLevelChart
              symbol={setup.ticker}
              entry={entry}
              stop={stop}
              target={target}
              tf={tf}
              size="hero"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[68ch] px-4 sm:px-6">
        {/* ── THE NUMBERS — the research page's identity strip, concise ──── */}
        {research && (
          <div className="mt-6 flex gap-2">
            <StatCard
              label="Market cap"
              value={research.keyStats.marketCapText ?? "—"}
            />
            <StatCard
              label="P/E"
              value={research.keyStats.pe != null ? research.keyStats.pe.toFixed(1) : "—"}
            />
            <StatCard
              label="RSI 14"
              value={
                research.momentum.rsi14 != null
                  ? Math.round(research.momentum.rsi14)
                  : "—"
              }
            />
            <StatCard
              label="1M move"
              value={
                research.momentum.chg1m != null
                  ? `${research.momentum.chg1m >= 0 ? "+" : ""}${research.momentum.chg1m.toFixed(1)}%`
                  : "—"
              }
              tone={
                research.momentum.chg1m == null
                  ? "ink"
                  : research.momentum.chg1m >= 0
                    ? "up"
                    : "down"
              }
            />
          </div>
        )}

        {/* ── THE PLAN AS A RAIL — Entry → Target, stop beneath ──────────── */}
        {entry != null && target != null && (
          <PlanRail
            className="mt-6 rounded-[14px] border border-sand bg-card px-4 py-3.5"
            from={{ label: "Entry", value: entry }}
            to={{ label: "Target", value: target, color: "var(--color-price-up)" }}
            stop={stop}
            accent="var(--color-price-up)"
          />
        )}

        {/* ── THE CONDITIONS — the cron's honest "2 of 3", never invented ── */}
        {conditions.length > 0 && (
          <section className="mt-6">
            <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft/80">
              {metCount} of {conditions.length} conditions
            </p>
            <ul className="space-y-1.5 rounded-[14px] border border-sand bg-card px-4 py-3">
              {conditions.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-2 text-[12.5px] leading-[1.4] ${
                    c.met ? "text-ink/90" : "text-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`font-mono text-[11px] ${c.met ? "text-price-up" : "text-soft/60"}`}
                  >
                    {c.met ? "✓" : "○"}
                  </span>
                  {c.label}
                  <span className="sr-only">{c.met ? " — met" : " — not yet"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── THE STORY AS A THREAD — recorded beats, then the live chat ── */}
        <section className="mt-8">
          <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft/80">
            The story
          </p>
          <ol className="space-y-3">
            {beats.map((b) => (
              <StoryBeat key={b.id} text={b.text} at={b.at} />
            ))}
          </ol>

          {/* the SAME thread continues into the real Kai chat */}
          <div className="mt-4">
            {kaiOpen ? (
              <div className="h-[min(70vh,560px)] overflow-hidden rounded-[16px] border border-sand bg-card">
                <KaiChatShared
                  variant="panel"
                  onClose={() => setKaiOpen(false)}
                  contextChip={kaiChip}
                  initialInput={kaiQuery}
                  contextNonce={kaiNonce}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={openKaiInline}
                className="f0-focus f0-press flex w-full items-center gap-2.5 rounded-[22px] border border-sand bg-card px-4 py-3 text-left transition hover:border-[color:var(--kai-blue)]"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-kai-500 text-[10px] font-bold text-white">
                  K
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-soft">
                  Message Kai about the {setup.ticker} {meta.label.toLowerCase()} setup…
                </span>
                <Sparkles className="h-4 w-4 shrink-0 text-kai-blue" />
              </button>
            )}
          </div>
        </section>

        {/* ── THE COMPANY — the research page's about block, as-is ───────── */}
        {research && (
          <section className="mt-8">
            <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft/80">
              The company
            </p>
            <CompanyProfileCard company={research.company} kidsMode={false} />
          </section>
        )}

        {/* ── IN THE NEWS — recent third-party headlines, concise ────────── */}
        {news != null && news.length > 0 && (
          <section className="mt-8">
            <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft/80">
              In the news
            </p>
            <NewsList news={news} />
          </section>
        )}

        <p className="mt-8 text-[11px] leading-relaxed text-soft/70">
          This is educational market analysis, not financial advice or a recommendation to buy or sell.
          Prices may be delayed. Past performance never guarantees future results.
        </p>
      </div>
    </div>
  );
}

/* ── one brief row: mono label rail left · Space Grotesk prose right ────── */
function BriefRow({
  label,
  tone = "ink",
  children,
}: {
  label: string;
  tone?: "ink" | "kai";
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3 border-t border-sand py-3 first:border-t-0 first:pt-0 sm:grid-cols-[112px_1fr] sm:gap-4">
      <p className="pt-[4px] text-right font-mono text-[8.5px] font-semibold uppercase leading-[1.5] tracking-[0.14em] text-soft/70">
        {label}
      </p>
      <p
        className={`min-w-0 font-grotesk text-[15.5px] font-medium leading-[1.55] tracking-[-0.01em] ${
          tone === "kai" ? "text-kai-blue" : "text-ink"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/* ── a highlighted figure inside the brief — the data IS the decoration ─── */
function BriefNum({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "up" | "down";
}) {
  const c =
    tone === "up" ? "text-price-up" : tone === "down" ? "text-price-down" : "";
  return (
    <span className={`font-mono text-[0.92em] font-bold tabular-nums ${c}`}>
      {children}
    </span>
  );
}

/* ── the grade seal — a beveled shield badge, drawn (owner directive: the
   flat circle was not attractive). Gradient depth + inner rim + top gloss,
   the letter set in the display stack; colour keyed to the grade so all six
   letters ship for free and stay crisp at any size. ─────────────────────── */
function GradeSeal({
  letter,
  color,
  size = 62,
}: {
  letter: string;
  color: string;
  size?: number;
}) {
  const gid = useId().replace(/:/g, "");
  // Classic shield: flat shoulders, rounded flanks, pointed foot.
  const SHIELD =
    "M32 2 L56 10 Q58 10.7 58 13 V32 C58 47 47 57.5 32 62 C17 57.5 6 47 6 32 V13 Q6 10.7 8 10 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0"
      style={{ filter: `drop-shadow(0 7px 16px color-mix(in srgb, ${color} 45%, transparent))` }}
    >
      <defs>
        <linearGradient id={`gs-${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${color} 68%, white)` }} />
          <stop offset="42%" style={{ stopColor: color }} />
          <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${color} 66%, black)` }} />
        </linearGradient>
        <linearGradient id={`gs-${gid}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`gs-${gid}-clip`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>

      {/* body */}
      <path d={SHIELD} fill={`url(#gs-${gid}-body)`} />
      {/* inner rim */}
      <path
        d={SHIELD}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.4"
        strokeWidth="1.6"
        transform="translate(32 32) scale(0.92) translate(-32 -32)"
      />
      {/* top gloss */}
      <rect
        x="0"
        y="0"
        width="64"
        height="26"
        clipPath={`url(#gs-${gid}-clip)`}
        fill={`url(#gs-${gid}-gloss)`}
      />

      {/* the letter — depth pass under the face pass */}
      <text
        x="32"
        y="39.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-display)"
        fontWeight="900"
        fontSize="30"
        fill="#000"
        fillOpacity="0.28"
      >
        {letter}
      </text>
      <text
        x="32"
        y="37.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-display)"
        fontWeight="900"
        fontSize="30"
        fill="#fff"
      >
        {letter}
      </text>
    </svg>
  );
}

/* ── one SMS-style beat: Kai's line in a bubble + the real mono timestamp ── */
function StoryBeat({ text, at }: { text: string; at: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-kai-500 text-[10px] font-bold text-white"
      >
        K
      </span>
      <div className="min-w-0">
        <div className="rounded-[16px] rounded-tl-[5px] border border-sand bg-card px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed text-kai-blue">&ldquo;{text}&rdquo;</p>
        </div>
        {/* locale/timezone-dependent by design — the member's clock wins,
            so hydration is told not to compare against the server's TZ */}
        <p
          suppressHydrationWarning
          className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-soft/60"
        >
          {stamp(at)}
        </p>
      </div>
    </li>
  );
}
