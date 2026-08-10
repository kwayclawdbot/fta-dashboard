"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, Share2, X, ChevronRight } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import ClubMark from "@/components/brand/ClubMark";
import { m } from "@/lib/motion";
import {
  GlowPct,
  KaiVoice,
  PlanRail,
  kaiOutcomeLine,
  money,
  pctStr,
  tickerAccent,
} from "@/components/alerts/poster";
import type { AlertOutcome } from "@/lib/alerts/history";

/* ══════════════════════════════════════════════════════════════════════════
   SHARE OUTCOME CARD — rebuilt 2026-08-10 as the FULL shareable result card
   (owner ruling): the cheatcode-os ShareCard visual language, big, on club
   tokens — radial accent glow, giant gradient ticker, glowing counted-up %,
   Entry → Peak rail, held/date line, brand footer, on-card disclaimer.

   Three objects in this file:
     • ShareOutcomeCard (default) — the big card itself, with Share + Save
       image (the existing native-canvas 1080×1080 PNG export, unchanged)
       and an optional "See the story" deep link to /alerts/s/[id].
     • ResultShareModal — the overlay presentation History opens when a
       winner/loser poster is clicked.
     • OutcomePoster — the History feed's mini result poster (logo, gradient
       ticker, glowing result %, one Kai closing line, date).

   HONESTY: the % is the recorded peak favourable move, wins AND losses get
   the identical object, and the disclaimer rides the card + every export.
   ══════════════════════════════════════════════════════════════════════════ */

const DISCLAIMER = "Educational analysis, not advice.";

function accentFor(o: AlertOutcome): string {
  return (o.peakPct ?? 0) >= 0 ? "var(--color-price-up)" : "var(--color-price-down)";
}

export default function ShareOutcomeCard({
  o,
  won,
  storyHref,
  onClose,
}: {
  o: AlertOutcome;
  won: boolean;
  /** Deep link to the setup's story page — rendered only when it exists. */
  storyHref?: string | null;
  /** When presented inside the modal, the close affordance. */
  onClose?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const accent = accentFor(o);
  const hue = tickerAccent(o.ticker);
  const issued = new Date(o.issued_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const share = useCallback(async () => {
    const dur = o.daysToPeak != null ? ` in ${o.daysToPeak}d` : "";
    const legs =
      o.peakPrice != null ? ` (entry $${money(o.snapshot_price)} → peak $${money(o.peakPrice)})` : "";
    const text =
      `KAI on $${o.ticker}: ${pctStr(o.peakPct)} peak favourable move${dur}${legs}. ` +
      `Winners and losers, tracked in the open. ${DISCLAIMER}`;
    const url = `${window.location.origin}/alerts#history`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `KAI · $${o.ticker}`, text, url });
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
  }, [o]);

  const saveImage = useCallback(async () => {
    const node = cardRef.current;
    if (!node || saving) return;
    setSaving(true);
    try {
      const dataUrl = await drawShareCanvas(node, o, won);
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `kai-${o.ticker}-${o.issued_at.slice(0, 10)}.png`;
        a.click();
      }
    } finally {
      setSaving(false);
    }
  }, [o, won, saving]);

  return (
    <div
      ref={cardRef}
      className="relative w-full overflow-hidden rounded-[20px] border p-5 sm:p-6"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 30%, var(--sand))`,
        background: `radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, ${accent} 14%, transparent), transparent 60%), radial-gradient(120% 80% at 100% 100%, color-mix(in srgb, ${hue} 10%, transparent), transparent 55%), var(--card)`,
      }}
    >
      {/* the radial glow blob */}
      <span
        aria-hidden
        className="absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />

      {/* brand head — ClubMark + the violet KAI mark, date right, close */}
      <div className="relative z-[1] flex items-center gap-2">
        <ClubMark size={16} />
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.22em] text-kai-blue">
          Kai
        </span>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/70">
          {issued}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="f0-focus -mr-1 shrink-0 rounded-full p-1 text-soft transition hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* the giant gradient ticker */}
      <div className="relative z-[1] mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className="font-display font-black leading-[0.92] tracking-[-0.04em]"
            style={{
              fontSize: o.ticker.length > 4 ? 44 : 54,
              background: `linear-gradient(180deg, var(--ink) 0%, ${accent} 140%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ${o.ticker}
          </div>
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-soft/70">
            {[o.direction, o.setup_label].filter(Boolean).join(" · ")}
          </p>
        </div>
        <CompanyLogo symbol={o.ticker} name={o.ticker} size={40} rounded="rounded-[12px]" />
      </div>

      {/* the glowing % */}
      <div className="relative z-[1] mt-5">
        <GlowPct value={o.peakPct ?? 0} size={56} />
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-soft/70">
          Peak favourable move
          {o.daysToPeak != null && ` · held ${o.daysToPeak}d`}
        </p>
      </div>

      {/* entry → peak rail */}
      {o.peakPrice != null && (
        <PlanRail
          className="relative z-[1] mt-5 rounded-[13px] border border-sand bg-paper/60 px-4 py-3"
          from={{ label: "Entry", value: o.snapshot_price }}
          to={{ label: "Peak", value: o.peakPrice, color: accent }}
          accent={accent}
        />
      )}

      {/* Kai's closing line */}
      <KaiVoice size="md" className="relative z-[1] mt-4">
        {kaiOutcomeLine(won)}
      </KaiVoice>

      {/* actions */}
      <div className="relative z-[1] mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={share}
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-kai-500/50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-kai-600" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Share"}
        </button>
        <button
          type="button"
          onClick={saveImage}
          disabled={saving}
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-sand bg-card px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-kai-500/50 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Save image
        </button>
        {storyHref && (
          <Link
            href={storyHref}
            className="f0-focus ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-kai-blue transition hover:opacity-80"
          >
            See the story <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* brand footer + the on-card disclaimer */}
      <div className="relative z-[1] mt-4 flex items-center justify-between gap-3 border-t border-sand pt-3">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/60">
          Cheat Code Club · Kai track record
        </span>
        <span className="truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-soft/60">
          {DISCLAIMER}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RESULT SHARE MODAL — the overlay History opens on a winner/loser poster.
   Paper-toned scrim (mode-correct), spring-in card, Esc / backdrop close.
   ══════════════════════════════════════════════════════════════════════════ */
export function ResultShareModal({
  o,
  won,
  storyHref,
  onClose,
}: {
  o: AlertOutcome;
  won: boolean;
  storyHref?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`$${o.ticker} result card`}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close the result card"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "color-mix(in srgb, var(--paper) 78%, transparent)" }}
      />
      <m.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-md"
      >
        <ShareOutcomeCard o={o} won={won} storyHref={storyHref} onClose={onClose} />
      </m.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OUTCOME POSTER — the History feed's mini result poster. Logo, gradient
   ticker, glowing result % (static glow — a scrolling grid of count-ups
   would be noise), one Kai closing line, mono date. Clicking opens the
   full shareable card above.
   ══════════════════════════════════════════════════════════════════════════ */
export function OutcomePoster({
  o,
  won,
  onOpen,
}: {
  o: AlertOutcome;
  won: boolean;
  onOpen: () => void;
}) {
  const accent = accentFor(o);
  const hue = tickerAccent(o.ticker);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the $${o.ticker} ${won ? "win" : "loss"} result card`}
      className="f0-focus f0-press relative block w-full overflow-hidden rounded-[16px] border border-sand bg-card p-3.5 text-left transition hover:border-kai-500/40"
      style={{
        background: `radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, ${accent} 9%, transparent), transparent 55%), radial-gradient(110% 90% at 0% 100%, color-mix(in srgb, ${hue} 6%, transparent), transparent 55%), var(--card)`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo symbol={o.ticker} name={o.ticker} size={30} rounded="rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <span
            className="font-display text-[17px] font-black leading-none tracking-[-0.03em]"
            style={{
              background: `linear-gradient(180deg, var(--ink) 0%, ${accent} 150%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ${o.ticker}
          </span>
          <p className="mt-1 truncate font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/60">
            {new Date(o.issued_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            {o.setup_label ? ` · ${o.setup_label}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 font-mono text-[24px] font-bold tabular-nums leading-none"
          style={{
            color: accent,
            letterSpacing: "-0.03em",
            textShadow: `0 0 16px color-mix(in srgb, ${accent} 50%, transparent)`,
          }}
        >
          {pctStr(o.peakPct)}
        </span>
      </div>
      <KaiVoice size="sm" className="mt-2.5">
        {kaiOutcomeLine(won)}
      </KaiVoice>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CANVAS EXPORT — the card re-drawn at 1080×1080 with the LIVE tokens (so a
   club-dark export is violet-on-terminal and a family export is warm paper)
   and the loaded font stacks read off the DOM. Pure native canvas — the
   repo carries no html-to-image, and no new dependency is added.
   ══════════════════════════════════════════════════════════════════════════ */

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m6 = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m6) {
    const n = parseInt(m6[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(hex);
  if (m3) {
    const [r, g, b] = m3[1].split("").map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color; // non-hex token — draw it opaque rather than guessing
}

/** ClubMark's two interlocking loops, drawn natively (viewBox 100×64 scaled). */
function drawClubMark(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const s = h / 64;
  const lw = 12 * s;
  const r = 22 * s;
  const cyL = { x: x + 34 * s, y: y + 32 * s };
  const cyR = { x: x + 66 * s, y: y + 32 * s };

  const teal = ctx.createLinearGradient(x + 44 * s, y + 12 * s, x + 96 * s, y + 54 * s);
  teal.addColorStop(0, "#00C389");
  teal.addColorStop(1, "#00B4D8");
  const orange = ctx.createLinearGradient(x + 8 * s, y + 12 * s, x + 60 * s, y + 54 * s);
  orange.addColorStop(0, "#FF5A00");
  orange.addColorStop(1, "#FFB000");

  ctx.lineWidth = lw;
  ctx.strokeStyle = teal;
  ctx.beginPath();
  ctx.arc(cyR.x, cyR.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = orange;
  ctx.beginPath();
  ctx.arc(cyL.x, cyL.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Re-draw the teal ring across the top crossing only → the interlocked weave.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 41 * s, y + 2 * s, 18 * s, 27 * s);
  ctx.clip();
  ctx.strokeStyle = teal;
  ctx.beginPath();
  ctx.arc(cyR.x, cyR.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

async function drawShareCanvas(
  node: HTMLElement,
  o: AlertOutcome,
  won: boolean
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    await document.fonts.ready;
  } catch {
    // Fonts API unavailable — draw with whatever is loaded.
  }

  const cs = getComputedStyle(node);
  const tok = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  const paper = tok("--paper", "#050505");
  const card = tok("--card", "#0D0F12");
  const ink = tok("--ink", "#F5F7FA");
  const soft = tok("--soft", tok("--color-soft", "#8E97A5"));
  const up = tok("--price-up", tok("--color-price-up", "#22C55E"));
  const down = tok("--price-down", tok("--color-price-down", "#F23645"));
  const kai = tok("--kai-blue", "#7C6BFF");
  const mono = tok("--font-mono", 'ui-monospace, "SFMono-Regular", monospace');
  const disp = tok("--font-display", "Inter, system-ui, sans-serif");
  const accent = ((o.peakPct ?? 0) >= 0 ? up : down) || (won ? up : down);

  const W = 1080;
  const H = 1080;
  const PAD = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Ground — paper with a card wash and two soft glows (accent + violet).
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, withAlpha(card, 0.9));
  wash.addColorStop(1, withAlpha(card, 0.55));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const glowA = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, 640);
  glowA.addColorStop(0, withAlpha(accent, 0.26));
  glowA.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);
  const glowK = ctx.createRadialGradient(W * 0.08, H * 0.98, 0, W * 0.08, H * 0.98, 620);
  glowK.addColorStop(0, withAlpha(kai, 0.2));
  glowK.addColorStop(1, withAlpha(kai, 0));
  ctx.fillStyle = glowK;
  ctx.fillRect(0, 0, W, H);

  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const setSpacing = (v: string) => {
    if ("letterSpacing" in spaced) spaced.letterSpacing = v;
  };

  // Head — ClubMark + KAI (violet), issue date right.
  drawClubMark(ctx, PAD, PAD, 54);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = kai;
  ctx.font = `800 42px ${disp}`;
  setSpacing("8px");
  ctx.fillText("KAI", PAD + 106, PAD + 44);
  ctx.fillStyle = soft;
  ctx.font = `500 24px ${mono}`;
  setSpacing("3px");
  ctx.textAlign = "right";
  ctx.fillText(
    new Date(o.issued_at)
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase(),
    W - PAD,
    PAD + 40
  );
  ctx.textAlign = "left";

  // Context line — direction + setup label (only what the record carries).
  ctx.fillStyle = soft;
  ctx.font = `600 26px ${mono}`;
  setSpacing("4px");
  const context = [o.direction.toUpperCase(), o.setup_label?.toUpperCase() ?? "KAI DAILY SETUP"]
    .filter(Boolean)
    .join(" · ");
  ctx.fillText(context.slice(0, 52), PAD, 236);

  // The ticker, huge.
  ctx.fillStyle = ink;
  const tickerSize = o.ticker.length > 4 ? 148 : 176;
  ctx.font = `900 ${tickerSize}px ${disp}`;
  setSpacing("-4px");
  ctx.fillText(`$${o.ticker}`, PAD - 6, 420);

  // The outcome — big mono, price-toned.
  ctx.fillStyle = accent;
  ctx.font = `700 168px ${mono}`;
  setSpacing("-4px");
  ctx.fillText(pctStr(o.peakPct), PAD - 4, 622);
  ctx.fillStyle = soft;
  ctx.font = `600 26px ${mono}`;
  setSpacing("5px");
  ctx.fillText(
    `PEAK FAVOURABLE MOVE${o.daysToPeak != null ? ` · HELD ${o.daysToPeak}D` : ""}`,
    PAD,
    684
  );

  // Entry → Peak rail.
  const railY = 748;
  const railH = 150;
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 2;
  ctx.fillStyle = withAlpha(ink, 0.05);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(PAD, railY, W - PAD * 2, railH, 24);
  } else {
    ctx.rect(PAD, railY, W - PAD * 2, railH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = soft;
  ctx.font = `600 22px ${mono}`;
  setSpacing("5px");
  ctx.fillText("ENTRY", PAD + 40, railY + 54);
  ctx.textAlign = "right";
  ctx.fillText("PEAK", W - PAD - 40, railY + 54);
  ctx.textAlign = "left";

  setSpacing("0px");
  ctx.fillStyle = ink;
  ctx.font = `700 46px ${mono}`;
  ctx.fillText(`$${money(o.snapshot_price)}`, PAD + 40, railY + 112);
  if (o.peakPrice != null) {
    ctx.fillStyle = accent;
    ctx.textAlign = "right";
    ctx.fillText(`$${money(o.peakPrice)}`, W - PAD - 40, railY + 112);
    ctx.textAlign = "left";
  }
  const lineGrad = ctx.createLinearGradient(PAD + 300, 0, W - PAD - 300, 0);
  lineGrad.addColorStop(0, withAlpha(accent, 0));
  lineGrad.addColorStop(0.5, withAlpha(accent, 0.8));
  lineGrad.addColorStop(1, withAlpha(accent, 0));
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD + 290, railY + railH / 2 + 12);
  ctx.lineTo(W - PAD - 290, railY + railH / 2 + 12);
  ctx.stroke();

  // Footer — brand line + the disclaimer, always on the exported object.
  ctx.fillStyle = soft;
  ctx.font = `600 22px ${mono}`;
  setSpacing("5px");
  ctx.fillText("CHEAT CODE CLUB · KAI TRACK RECORD", PAD, H - 96);
  ctx.font = `500 22px ${mono}`;
  setSpacing("2px");
  ctx.fillText(DISCLAIMER.toUpperCase(), PAD, H - 54);
  setSpacing("0px");

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
