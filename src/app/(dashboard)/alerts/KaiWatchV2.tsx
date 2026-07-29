"use client";

/**
 * KAI WATCH · v2 sheet — the SMS-migration hero (DESIGN-UX-SPEC §4/§6, board 18
 * "Kai Watch"). Rendered ONLY behind designV2Enabled() (AlertsClientV2 mounts
 * it). This is a STANDALONE re-skin of ../../../components/kai/KaiWatch onto the
 * cc canvas — it hits the SAME /api/kai-watch/parse contract and writes rules to
 * alert_rules under the member's own-row RLS exactly as the v1 component does. No
 * new endpoint, no new data. The v1 KaiWatch is left untouched.
 *
 * COMPLIANCE (owner decision 7): every confirmation is NOTIFICATION framing
 * ("I'll tell you when…"), never advice. Unsupported asks get Kai's honest
 * "here's what I CAN watch instead" straight from the route's `note`.
 *
 * COLOUR LAW: this is a KAI surface, so Kai-blue (--cc-blue) carries identity;
 * the single primary action (Ask Kai / Yes, watch this) is the orange CTA with a
 * halo — the one place orange is spent on this sheet.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Sparkles, ArrowRight, Loader2, Check, X, Bell, Info, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_ACTIVE_RULES,
  type AlertKind,
  type AlertParams,
  type AlertRule,
  type AlertSurface,
} from "@/lib/alerts/types";

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
  "Alert me if NVDA breaks 180 on volume",
  "Ping me when AAPL hits a new 52-week high",
  "Watch TSLA for when the club turns bearish",
  "Let me know if PLTR has big news and moves 5%",
];

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

const KAI_MARK = (
  <span
    className="grid shrink-0 place-items-center rounded-full"
    style={{ width: 26, height: 26, background: "color-mix(in srgb, var(--cc-blue) 16%, transparent)", color: "var(--cc-blue)" }}
    aria-hidden
  >
    <Sparkles className="h-3.5 w-3.5" />
  </span>
);

export default function KaiWatchV2({
  open,
  userId,
  surface = "strategy",
  presetText,
  presetNonce,
  onClose,
  onCreated,
}: {
  open: boolean;
  userId: string;
  surface?: AlertSurface;
  presetText?: string;
  presetNonce?: number;
  onClose: () => void;
  onCreated?: (rules: AlertRule[]) => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus on open; seed from an intention chip when the nonce changes.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect(() => {
    if (presetNonce == null || presetText == null) return;
    setText(presetText);
    setPhase("idle");
    setResult(null);
    setError(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(presetText.length, presetText.length);
    });
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
        body: JSON.stringify({ text: q }),
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
      setResult((await res.json()) as ParseResult);
      setPhase("result");
    } catch {
      setError("Something went wrong reaching Kai. Try again.");
      setPhase("error");
    }
  }, [text]);

  const create = useCallback(async () => {
    if (!result || result.rules.length === 0) return;
    setPhase("creating");
    const supabase = createClient();
    const created: AlertRule[] = [];
    for (const r of result.rules) {
      const { data, error: err } = await supabase
        .from("alert_rules")
        .insert({ user_id: userId, kind: r.kind, ticker: r.ticker, params: r.params, label: r.label, surface, active: true })
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
    setTimeout(() => onClose(), 1500);
  }, [result, userId, surface, onCreated, onClose]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setPhase("idle");
    setText("");
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            className="w-full max-w-md overflow-hidden rounded-t-2xl border sm:rounded-2xl"
            style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* masthead */}
            <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: "var(--cc-line)" }}>
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--cc-blue) 16%, transparent)", color: "var(--cc-blue)" }}
                aria-hidden
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="cc-display text-[19px]" style={{ color: "var(--cc-ink)" }}>New Kai Watch</p>
                <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
                  Tell Kai what to watch — in plain English.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-lg p-1 transition" style={{ color: "var(--cc-soft)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <AnimatePresence mode="wait">
                {(phase === "idle" || phase === "parsing" || phase === "error") && (
                  <m.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div
                      className="rounded-xl border p-2 transition-colors focus-within:border-[var(--cc-blue)]"
                      style={{ borderColor: "var(--cc-line)", background: "var(--cc-bg)" }}
                    >
                      <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse();
                        }}
                        rows={2}
                        maxLength={500}
                        placeholder="Tell Kai what to watch — 'alert me if NVDA breaks 180 on volume'"
                        className="w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-snug outline-none"
                        style={{ color: "var(--cc-ink)" }}
                      />
                      <div className="flex items-center justify-between gap-3 px-1 pt-1">
                        <span className="text-[11px]" style={{ color: "var(--cc-soft)" }}>Kai turns this into a real alert.</span>
                        <button
                          onClick={parse}
                          disabled={phase === "parsing" || text.trim().length < 2}
                          className="cc-halo inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition disabled:opacity-50"
                          style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
                        >
                          {phase === "parsing" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Reading…</>) : (<>Ask Kai <ArrowRight className="h-4 w-4" /></>)}
                        </button>
                      </div>
                    </div>

                    {phase === "error" && error && (
                      <p className="mt-3 border-l-2 py-0.5 pl-3 text-[12.5px] font-semibold leading-snug" style={{ borderColor: "var(--cc-orange)", color: "var(--cc-ink)" }}>
                        {error}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setText(ex)}
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                          style={{ background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </m.div>
                )}

                {(phase === "result" || phase === "creating" || phase === "created") && result && (
                  <m.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {phase === "created" ? (
                      <div className="flex flex-col items-center gap-2.5 py-6 text-center">
                        <span
                          className="grid h-11 w-11 place-items-center rounded-full"
                          style={{ background: "color-mix(in srgb, var(--cc-blue) 16%, transparent)", color: "var(--cc-blue)" }}
                          aria-hidden
                        >
                          <Check className="h-6 w-6" />
                        </span>
                        <p className="cc-display text-[19px]" style={{ color: "var(--cc-ink)" }}>Kai&apos;s on it</p>
                        <p className="max-w-[38ch] text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                          {result.rules.length === 1 ? "Your alert is live." : `${result.rules.length} alerts are live.`} Manage them any time in My Watches.
                        </p>
                      </div>
                    ) : (
                      <>
                        {result.supported ? (
                          <>
                            <div className="flex items-start gap-2.5">
                              {KAI_MARK}
                              <p className="text-[14px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>
                                Got it — I&apos;ll tell you when {joinLabels(result.rules.map((r) => r.label))}.
                              </p>
                            </div>

                            <p className="cc-mono mb-1.5 mt-5" style={{ color: "var(--cc-soft)" }}>Exactly what will trip</p>
                            <div className="divide-y rounded-xl border" style={{ borderColor: "var(--cc-line)", background: "var(--cc-bg)" }}>
                              {result.rules.map((r, i) => (
                                <div key={i} className="flex items-center gap-2.5 p-3" style={i > 0 ? { borderColor: "var(--cc-line)" } : undefined}>
                                  <span
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                                    style={{ background: "color-mix(in srgb, var(--cc-blue) 12%, transparent)", color: "var(--cc-blue)" }}
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13.5px] font-bold" style={{ color: "var(--cc-ink)" }}>{r.label}</p>
                                    <p className="cc-mono !text-[10px] !tracking-[0.12em]" style={{ color: "var(--cc-dim)" }}>{KIND_TAG[r.kind]}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-2.5 border-l-2 py-0.5 pl-3" style={{ borderColor: "var(--cc-line)" }}>
                            <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--cc-soft)" }} />
                            <p className="text-[14px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>
                              {result.note ||
                                "That's not something I can watch directly yet. I can watch price levels, big moves, volume spikes, new highs/lows, the club's sentiment, and fresh news — want to try one of those?"}
                            </p>
                          </div>
                        )}

                        {result.supported && result.note && (
                          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug" style={{ color: "var(--cc-soft)" }}>
                            <Info className="mt-0.5 h-3 w-3 shrink-0" /> {result.note}
                          </p>
                        )}

                        <div className="mt-5 flex gap-2">
                          <button
                            onClick={reset}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13px] font-bold transition-colors"
                            style={{ background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> {result.supported ? "Not quite" : "Try again"}
                          </button>
                          {result.supported && (
                            <button
                              onClick={create}
                              disabled={phase === "creating"}
                              className="cc-halo flex-1 rounded-full py-2.5 text-[14px] font-extrabold transition disabled:opacity-60"
                              style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
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
                          <p className="mt-3 border-l-2 py-0.5 pl-3 text-[12.5px] font-semibold leading-snug" style={{ borderColor: "var(--cc-orange)", color: "var(--cc-ink)" }}>
                            {error}
                          </p>
                        )}
                      </>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
