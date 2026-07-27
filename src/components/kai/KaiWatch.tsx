"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  X,
  Bell,
  Info,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_ACTIVE_RULES,
  type AlertKind,
  type AlertParams,
  type AlertRule,
  type AlertSurface,
} from "@/lib/alerts/types";

/**
 * KAI WATCH — the premium natural-language layer over the C6 alert engine (R4).
 *
 * A member tells Kai what to watch in plain English; the /api/kai-watch/parse
 * route (claude-haiku-4-5, structured output) turns it into validated C6
 * alert_rules specs, which Kai confirms in plain language before this component
 * writes them under the member's own-row RLS (cap-aware).
 *
 * Compliance: every confirmation is NOTIFICATION framing ("I'll tell you when…"),
 * never advice. Unsupported asks get an honest "here's what I CAN watch instead"
 * (owner decision 7 — signals + interpretation, never thesis-omniscience).
 *
 * Two shapes: an inline "panel" (watchlist / alerts hub) and a "modal" launched
 * prefilled from a ticker row ("Watch with Kai").
 *
 * ── CANVAS V2 (cohesion lane) ────────────────────────────────────────────────
 * This was the last pre-canvas Kai surface. Four things changed and none of them
 * is cosmetic:
 *
 *   1. THE CONTAINER. It was `rounded-2xl border bg-card shadow-soft` — a
 *      generic card box, which the brand register bans, wrapping a saturated
 *      kai→kai gradient BAR that repeated the identity the mark already carries.
 *      Inline (panel) it is now an object on the paper: a mark, a masthead, a
 *      composer, hairlines. Floating (modal) it keeps a real surface, because a
 *      sheet over a scrim genuinely needs a ground — `bg-paper` + `.f0-frame`,
 *      not `bg-card` + a shadow.
 *
 *   2. THE MARK. The header hand-rolled a Kai avatar (`bg-white/20` + Sparkles
 *      on the gradient). `.f0-kai-mark` is the canonical one, shared with Home,
 *      Help, the chat and the loading states, so Kai looks like Kai everywhere
 *      and there is one place to change it.
 *
 *   3. COLOUR LAW. The success state was `bg-green-500/12 text-green-600` and
 *      every error line was `text-red-600 dark:text-red-500`. Green and red are
 *      PRICE — a confirmation that shares a colour with an up move, and a
 *      validation message that shares one with a down move, are both violations.
 *      Success is now Kai's own blue (Kai is the one confirming) and errors
 *      carry WEIGHT instead of hue, matching the feed composer and ChangedMyMind.
 *
 *   4. Kai blue is the ONLY identity colour on this surface, and nothing that is
 *      not Kai wears it.
 */

interface ParsedRule {
  kind: AlertKind;
  ticker: string | null;
  params: AlertParams;
  label: string;
}

interface ParseResult {
  supported: boolean;
  rules: ParsedRule[];
  note: string;
}

type Phase = "idle" | "parsing" | "result" | "creating" | "created" | "error";

const EXAMPLES = [
  "Tell me if NVDA drops below $150 and volume spikes",
  "Ping me when AAPL hits a new 52-week high",
  "Watch TSLA for when the club turns bearish",
  "Let me know if PLTR has big news and moves 5%",
];

export default function KaiWatch({
  userId,
  defaultTicker,
  surface = "watchlist",
  variant = "panel",
  onClose,
  onCreated,
  presetText,
  presetNonce,
}: {
  userId: string;
  defaultTicker?: string;
  surface?: AlertSurface;
  variant?: "panel" | "modal";
  onClose?: () => void;
  onCreated?: (rules: AlertRule[]) => void;
  /** Intention chips seed the box with a ready sentence (Kai Watch hub). */
  presetText?: string;
  presetNonce?: number;
}) {
  const [text, setText] = useState(
    defaultTicker ? `Watch ${defaultTicker} for me — ` : ""
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (variant === "modal") inputRef.current?.focus();
  }, [variant]);

  // Intention chip → seed the box (deterministic prefill; parse stays opt-in so
  // it degrades gracefully if credits are dead — the sentence is still editable).
  useEffect(() => {
    if (presetNonce == null || presetText == null) return;
    setText(presetText);
    setPhase("idle");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
    // place caret at end
    const el = inputRef.current;
    if (el) {
      const len = presetText.length;
      requestAnimationFrame(() => el.setSelectionRange(len, len));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNonce]);

  const parse = useCallback(async () => {
    const q = text.trim();
    if (q.length < 2) return;
    setPhase("parsing");
    setError(null);
    try {
      const res = await fetch("/api/kai-watch/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q, ticker: defaultTicker }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Kai Watch is a member feature."
            : "Kai couldn't read that one — try rephrasing it."
        );
        setPhase("error");
        return;
      }
      const data = (await res.json()) as ParseResult;
      setResult(data);
      setPhase("result");
    } catch {
      setError("Something went wrong reaching Kai. Try again.");
      setPhase("error");
    }
  }, [text, defaultTicker]);

  const create = useCallback(async () => {
    if (!result || result.rules.length === 0) return;
    setPhase("creating");
    const supabase = createClient();
    const created: AlertRule[] = [];
    for (const r of result.rules) {
      const { data, error: err } = await supabase
        .from("alert_rules")
        .insert({
          user_id: userId,
          kind: r.kind,
          ticker: r.ticker,
          params: r.params,
          label: r.label,
          surface,
          active: true,
        })
        .select("*")
        .single();
      if (err) {
        setError(
          /cap reached/i.test(err.message)
            ? `You're at the ${MAX_ACTIVE_RULES}-alert limit — pause one first, then ask Kai again.`
            : "Kai couldn't save that. Try again."
        );
        setPhase("error");
        return;
      }
      if (data) created.push(data as AlertRule);
    }
    onCreated?.(created);
    setPhase("created");
    if (variant === "modal") setTimeout(() => onClose?.(), 1400);
  }, [result, userId, surface, onCreated, variant, onClose]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setPhase("idle");
    setText(defaultTicker ? `Watch ${defaultTicker} for me — ` : "");
  }, [defaultTicker]);

  const isModal = variant === "modal";

  const body = (
    <section
      className={isModal ? "f0-frame overflow-hidden rounded-2xl bg-paper p-5" : ""}
    >
      {/* IDENTITY — MODAL ONLY. The mark IS the branding: no gradient bar, no
          second blue object, and `.f0-kai-mark` is the same one Home, Help and
          the chat wear. The PANEL deliberately has no masthead: it is embedded
          under the alerts hub's own "Tell Kai what to watch" heading, and a
          second title one line below the first is the drift this lane exists to
          remove. Inline, Kai's identity appears where Kai actually speaks — the
          interpretation and the confirmation below. */}
      {isModal && (
        <header className="mb-4 flex items-start gap-3">
          <span className="f0-kai-mark h-10 w-10 shrink-0" aria-hidden>
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-extrabold leading-tight text-ink">
              Kai Watch
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-soft">
              Tell Kai what to watch — in plain English
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="f0-focus f0-press -mr-1 -mt-1 rounded-lg p-1 text-soft transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
      )}

      <div>
        <AnimatePresence mode="wait">
          {(phase === "idle" || phase === "parsing" || phase === "error") && (
            <m.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Plain Tailwind border, NOT .f0-frame: globals.css has no
                  @layer, so an unlayered .f0-frame would outrank the
                  focus-within border utility and the field would never light. */}
              <div className="rounded-xl border border-sand p-2 transition-colors focus-within:border-kai-500">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse();
                  }}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Tell me if NVDA drops below $150 and volume spikes"
                  className="w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-snug text-ink outline-none placeholder:text-soft/50"
                />
                <div className="flex items-center justify-between gap-3 px-1 pt-1">
                  <span className="text-[11px] text-soft/70">
                    Kai turns this into a real alert.
                  </span>
                  <button
                    onClick={parse}
                    disabled={phase === "parsing" || text.trim().length < 2}
                    className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-kai-500 px-3.5 py-1.5 font-display text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {phase === "parsing" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Reading…
                      </>
                    ) : (
                      <>
                        Ask Kai <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Red is PRICE. A validation message carries weight, not hue. */}
              {phase === "error" && error && (
                <p className="f0-rule-left mt-3 py-0.5 pl-3 text-[12.5px] font-semibold leading-snug text-ink">
                  {error}
                </p>
              )}

              {phase !== "error" && !defaultTicker && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setText(ex)}
                      className="f0-chip f0-focus f0-press px-2.5 py-1 text-[11px] font-medium text-soft transition-colors hover:text-ink"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </m.div>
          )}

          {(phase === "result" || phase === "creating" || phase === "created") &&
            result && (
              <m.div
                key="result"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {phase === "created" ? (
                  /* Kai is the one confirming, so the confirmation wears Kai's
                     blue. It was a green disc — green is PRICE. */
                  <div className="flex flex-col items-center gap-2.5 py-6 text-center">
                    <span className="f0-kai-mark h-11 w-11" aria-hidden>
                      <Check className="h-6 w-6" />
                    </span>
                    <p className="font-display text-[17px] font-extrabold text-ink">
                      Kai&apos;s on it
                    </p>
                    <p className="max-w-[38ch] text-[13px] leading-relaxed text-soft">
                      {result.rules.length === 1
                        ? "Your alert is live."
                        : `${result.rules.length} alerts are live.`}{" "}
                      Manage them any time in your alerts.
                    </p>
                  </div>
                ) : (
                  <>
                    {result.supported ? (
                      <>
                        {/* Kai speaking: the mark, then the sentence. Not a
                            tinted box — the mark already says who this is. */}
                        <div className="flex items-start gap-2.5">
                          <span className="f0-kai-mark mt-0.5 h-6 w-6 shrink-0" aria-hidden>
                            <Sparkles className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-[14px] leading-relaxed text-ink">
                            Got it — I&apos;ll tell you when{" "}
                            {joinLabels(result.rules.map((r) => r.label))}.
                          </p>
                        </div>

                        {/* Structured interpretation (transparency) */}
                        <p className="mb-1 mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-soft/70">
                          Exactly what will trip
                        </p>
                        <div className="f0-ledger f0-rule-top f0-rule-bottom">
                          {result.rules.map((r, i) => (
                            <div key={i} className="f0-ledger-row">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kai-500/10 text-kai-600 dark:text-kai-300">
                                <Bell className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-[14px] font-bold text-ink">
                                  {r.label}
                                </p>
                                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
                                  {KIND_TAG[r.kind]}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="f0-rule-left flex items-start gap-2.5 py-0.5 pl-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-soft" />
                        <p className="text-[14px] leading-relaxed text-ink">
                          {result.note ||
                            "That's not something I can watch directly yet. I can watch price levels, big moves, volume spikes, new highs/lows, the club's sentiment, and fresh news — want to try one of those?"}
                        </p>
                      </div>
                    )}

                    {result.supported && result.note && (
                      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-soft">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        {result.note}
                      </p>
                    )}

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={reset}
                        className="f0-chip f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {result.supported ? "Not quite" : "Try again"}
                      </button>
                      {result.supported && (
                        <button
                          onClick={create}
                          disabled={phase === "creating"}
                          className="f0-focus f0-press flex-1 rounded-lg bg-kai-500 py-2.5 font-display text-[14px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
                        >
                          {phase === "creating" ? (
                            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                          ) : result.rules.length === 1 ? (
                            "Yes, watch this"
                          ) : (
                            `Yes, watch these ${result.rules.length}`
                          )}
                        </button>
                      )}
                    </div>

                    {error && (
                      <p className="f0-rule-left mt-3 py-0.5 pl-3 text-[12.5px] font-semibold leading-snug text-ink">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </m.div>
            )}
        </AnimatePresence>
      </div>
    </section>
  );

  if (isModal) {
    return (
      <m.div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <m.div
          className="w-full max-w-md"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </m.div>
      </m.div>
    );
  }

  return body;
}

const KIND_TAG: Record<AlertKind, string> = {
  price_cross: "Price alert",
  pct_move: "Big-move alert",
  vol_surge: "Volume alert",
  rsi_cross: "RSI alert",
  ema_cross: "Moving-average alert",
  w52_break: "52-week alert",
  preset_match: "Screen alert",
  sentiment_velocity: "Community-sentiment alert",
  news_event: "News alert",
};

function joinLabels(labels: string[]): string {
  const l = labels.map((s) => s.charAt(0).toLowerCase() + s.slice(1));
  if (l.length === 1) return l[0];
  if (l.length === 2) return `${l[0]} or ${l[1]}`;
  return `${l.slice(0, -1).join(", ")}, or ${l[l.length - 1]}`;
}
