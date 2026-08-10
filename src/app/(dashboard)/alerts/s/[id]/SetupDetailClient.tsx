"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Share2, Sparkles } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import KaiChatShared from "@/components/kai/KaiChatShared";
import AlertLevelChart from "@/components/alerts/AlertLevelChart";
import WatchSetupButton from "@/components/alerts/WatchSetupButton";
import {
  GlowPct,
  KaiVoice,
  PlanRail,
  kaiSetupLine,
  money,
  tickerAccent,
} from "@/components/alerts/poster";
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
}: {
  setup: AlertSetup;
  broadcast: TradeAlert | null;
  current: number | null;
  companyName: string;
  thread: AlertEvent[];
  /** Still fetched by the server page; the story renders only THIS setup's
   *  own recorded beats (related-events blocks removed by the redesign). */
  related?: AlertEvent[];
}) {
  const [kaiOpen, setKaiOpen] = useState(false);
  const [kaiNonce, setKaiNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const meta = SETUP_STATE_META[setup.state];
  const hue = tickerAccent(setup.ticker);
  const L = readSetupLevels(setup.levels);
  const entry = setup.entry ?? broadcast?.entry ?? null;
  const stop = L.stop ?? L.support;
  const target = broadcast?.targets?.[0]?.price ?? L.resistance;
  const px = current ?? setup.snapshot_price;

  const snap = setup.snapshot_price;
  const perfPct =
    snap != null && current != null && snap > 0 ? ((current - snap) / snap) * 100 : null;

  // The thesis centerpiece — the stored words only, never invented.
  const thesis = setup.thesis || broadcast?.narrative || setupStateLine(setup.state, setup.ticker);

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
      {/* ══ HERO — the chart IS the page's opening frame, full-bleed ═══════ */}
      <div
        className="relative h-[40vh] max-h-[460px] min-h-[300px] overflow-hidden border-b"
        style={{ borderColor: `color-mix(in srgb, ${hue} 22%, var(--sand))` }}
      >
        {/* heat by glow — breathing while the setup is a live thing */}
        <span
          aria-hidden
          className={`absolute -top-24 right-[-10%] h-72 w-72 rounded-full blur-3xl poster-glow ${
            meta.live ? "poster-breathe" : ""
          }`}
          style={{ background: hue }}
        />

        <AlertLevelChart
          variant="hero"
          symbol={setup.ticker}
          entry={entry}
          stop={stop}
          target={target}
          accent={hue}
        />

        {/* top overlay — back · Follow + Share pills (the ONLY actions) */}
        <div className="absolute inset-x-0 top-0 z-[2] flex items-center gap-2 p-4">
          <Link
            href="/alerts"
            aria-label="Back to Kai Watch"
            className="f0-focus grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sand bg-card/80 text-soft backdrop-blur-sm transition hover:text-ink"
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
              className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card/80 px-3 py-1.5 text-[12px] font-semibold text-ink backdrop-blur-sm transition hover:border-kai-500/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-kai-600" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Share"}
            </button>
          </div>
        </div>

        {/* bottom overlay — identity left · live price + glowing move right */}
        <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo
              symbol={setup.ticker}
              name={companyName}
              size={40}
              rounded="rounded-[12px]"
            />
            <div className="min-w-0">
              <h1
                className="font-display text-[30px] font-black leading-none tracking-[-0.04em]"
                style={{
                  background: `linear-gradient(180deg, var(--ink) 0%, ${hue} 150%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
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
      </div>

      <div className="mx-auto w-full max-w-[68ch] px-4 sm:px-6">
        {/* ── KAI'S THESIS — the centerpiece, large violet typography ────── */}
        <div className="mt-7 flex items-start gap-3">
          <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-kai-500 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <KaiVoice size="xl">{thesis}</KaiVoice>
            {/* state is ONE human Kai line — never a chip */}
            <p className="mt-2.5 text-[12.5px] font-semibold text-soft">
              {kaiSetupLine(setup)}
            </p>
            <p className="mt-2 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-soft/60">
              An interpretation of what already happened — never a forecast.
            </p>
          </div>
        </div>

        {/* ── THE PLAN AS A RAIL — Entry → Target, stop beneath ──────────── */}
        {entry != null && target != null && (
          <PlanRail
            className="mt-6 rounded-[14px] border border-sand bg-card px-4 py-3.5"
            from={{ label: "Entry", value: entry }}
            to={{ label: "Target", value: target, color: "var(--color-price-up)" }}
            stop={stop}
            accent={hue}
          />
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

        <p className="mt-8 text-[11px] leading-relaxed text-soft/70">
          This is educational market analysis, not financial advice or a recommendation to buy or sell.
          Prices may be delayed. Past performance never guarantees future results.
        </p>
      </div>
    </div>
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
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-soft/60">
          {stamp(at)}
        </p>
      </div>
    </li>
  );
}
