"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Download, Loader2, Share2 } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import ClubMark from "@/components/brand/ClubMark";
import type { AlertOutcome } from "@/lib/alerts/history";

/* ══════════════════════════════════════════════════════════════════════════
   SHARE OUTCOME CARD — a resolved Kai alert as a branded, shareable object.

   Prior art: the Kai dashboard's win detail (cheatcode-os ShareCard /
   KaiWinDetailPage) — huge ticker, glowing peak %, an Entry→Peak rail, a
   mono brand footer and a PNG export. This is that design adapted onto the
   club terminal law: semantic tokens only, Inter display, IBM Plex Mono
   numerals, ClubMark + the violet KAI mark, and the honesty framing (peak
   favourable move, winners AND losers, disclaimer on the card itself).

   Actions (no new npm deps — html-to-image is not in this repo):
     • Share — navigator.share of a text summary + link, clipboard fallback.
     • Save image — the card re-drawn onto a native <canvas> (1080×1080)
       using the live CSS tokens + loaded font stacks, downloaded as PNG.
   ══════════════════════════════════════════════════════════════════════════ */

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctStr(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

const DIR_GLYPH: Record<string, string> = { long: "↑", short: "↓", watch: "•" };

const DISCLAIMER = "Educational analysis, not advice.";

export default function ShareOutcomeCard({ o, won }: { o: AlertOutcome; won: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const peakTone = (o.peakPct ?? 0) >= 0 ? "text-price-up" : "text-price-down";
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
    const url = `${window.location.origin}/alerts#track`;
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
      className="flex flex-col rounded-[16px] border p-[15px]"
      style={{
        borderColor: "color-mix(in srgb, var(--kai-blue) 26%, var(--sand))",
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--kai-blue) 8%, var(--card)) 0%, var(--card) 58%)",
      }}
    >
      {/* brand head — ClubMark + the violet KAI mark, date on the right */}
      <div className="flex items-center gap-2">
        <ClubMark size={15} />
        <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.22em] text-kai-blue">
          Kai
        </span>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/70">
          {issued}
        </span>
      </div>

      {/* identity — logo · ticker · setup */}
      <div className="mt-3 flex items-center gap-2.5">
        <CompanyLogo symbol={o.ticker} name={o.ticker} size={34} rounded="rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[16px] font-extrabold leading-[1.1] tracking-tight text-ink">
              ${o.ticker}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-soft">
              <span aria-hidden>{DIR_GLYPH[o.direction] ?? DIR_GLYPH.watch}</span>
              {o.direction}
            </span>
          </div>
          {o.setup_label && (
            <p className="mt-0.5 truncate text-[11px] text-soft/85">{o.setup_label}</p>
          )}
        </div>
      </div>

      {/* the big mono outcome */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className={`font-mono text-[30px] font-bold leading-none tabular-nums ${peakTone}`}>
          {pctStr(o.peakPct)}
        </p>
        <p className="pb-0.5 text-right font-mono text-[9px] uppercase leading-[1.5] tracking-[0.12em] text-soft/70">
          Peak move
          {o.daysToPeak != null && (
            <>
              <br />
              held {o.daysToPeak}d
            </>
          )}
        </p>
      </div>

      {/* entry → peak rail */}
      {o.peakPrice != null && (
        <div className="mt-3 flex items-center gap-2.5 rounded-[12px] border border-sand bg-paper/60 px-3 py-2">
          <span className="shrink-0">
            <span className="block font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/70">
              Entry
            </span>
            <span className="mt-0.5 block font-mono text-[13px] font-semibold tabular-nums text-ink">
              ${money(o.snapshot_price)}
            </span>
          </span>
          <span
            aria-hidden
            className="h-px min-w-0 flex-1"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--kai-blue) 65%, transparent), transparent)",
            }}
          />
          <span className="shrink-0 text-right">
            <span className="block font-mono text-[8.5px] uppercase tracking-[0.14em] text-soft/70">
              Peak
            </span>
            <span
              className={`mt-0.5 block font-mono text-[13px] font-semibold tabular-nums ${peakTone}`}
            >
              ${money(o.peakPrice)}
            </span>
          </span>
        </div>
      )}

      {/* actions + the on-card disclaimer */}
      <div className="mt-3 flex items-center gap-2 border-t border-sand pt-2.5">
        <p className="min-w-0 flex-1 truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-soft/60">
          {DISCLAIMER}
        </p>
        <button
          type="button"
          onClick={share}
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sand bg-card px-2.5 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-kai-500/50"
        >
          {copied ? <Check className="h-3 w-3 text-kai-600" /> : <Share2 className="h-3 w-3" />}
          {copied ? "Copied" : "Share"}
        </button>
        <button
          type="button"
          onClick={saveImage}
          disabled={saving}
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sand bg-card px-2.5 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-kai-500/50 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Image
        </button>
      </div>
    </div>
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
