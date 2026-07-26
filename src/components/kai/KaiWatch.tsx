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

  const body = (
    <div className="overflow-hidden rounded-2xl border border-sand bg-paper shadow-soft">
      {/* Gradient header — Kai identity */}
      <div className="kai-gradient relative flex items-center gap-2.5 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-bold leading-tight text-white">
            Kai Watch
          </p>
          <p className="text-[11px] leading-tight text-white/85">
            Tell Kai what to watch — in plain English
          </p>
        </div>
        {variant === "modal" && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-white/90 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {(phase === "idle" || phase === "parsing" || phase === "error") && (
            <m.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-xl border border-sand bg-paper/60 p-2 transition focus-within:border-kai-blue">
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
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-[11px] text-soft/60">
                    Kai turns this into a real alert.
                  </span>
                  <button
                    onClick={parse}
                    disabled={phase === "parsing" || text.trim().length < 2}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-kai-blue px-3 py-1.5 text-[13px] font-semibold text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
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

              {phase === "error" && error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                  {error}
                </p>
              )}

              {phase !== "error" && !defaultTicker && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setText(ex)}
                      className="rounded-full border border-sand bg-paper px-2.5 py-1 text-[11px] font-medium text-soft transition hover:border-kai-blue hover:text-ink"
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
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-6 w-6" />
                    </span>
                    <p className="font-semibold text-ink">Kai&apos;s on it</p>
                    <p className="text-[13px] text-soft">
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
                        <div className="flex items-start gap-2.5 rounded-xl bg-kai-blue-soft p-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-kai-blue text-white">
                            <Sparkles className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-[13px] leading-snug text-ink">
                            Got it — I&apos;ll tell you when{" "}
                            {joinLabels(result.rules.map((r) => r.label))}.
                          </p>
                        </div>

                        {/* Structured interpretation (transparency) */}
                        <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-soft/70">
                          What I&apos;ll watch
                        </p>
                        <div className="space-y-1.5">
                          {result.rules.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2.5 rounded-xl border border-sand bg-paper p-2.5"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kai-blue-soft text-kai-blue">
                                <Bell className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-ink">
                                  {r.label}
                                </p>
                                <p className="text-[11px] text-soft/70">
                                  {KIND_TAG[r.kind]}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-xl border border-sand bg-paper/60 p-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-soft" />
                        <p className="text-[13px] leading-snug text-ink">
                          {result.note ||
                            "That's not something I can watch directly yet. I can watch price levels, big moves, volume spikes, new highs/lows, the club's sentiment, and fresh news — want to try one of those?"}
                        </p>
                      </div>
                    )}

                    {result.supported && result.note && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-soft/80">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        {result.note}
                      </p>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={reset}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sand bg-paper px-3 py-2.5 text-[13px] font-semibold text-soft hover:bg-sand"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {result.supported ? "Not quite" : "Try again"}
                      </button>
                      {result.supported && (
                        <button
                          onClick={create}
                          disabled={phase === "creating"}
                          className="flex-1 rounded-xl bg-kai-blue py-2.5 text-[14px] font-bold text-white shadow-soft transition hover:brightness-110 disabled:opacity-60"
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
                      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </m.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <m.div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
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
