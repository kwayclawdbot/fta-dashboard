"use client";

import { useState, useMemo, useCallback } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Bell, BellPlus, X, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ruleLabel,
  MAX_ACTIVE_RULES,
  type AlertKind,
  type AlertParams,
  type AlertSurface,
} from "@/lib/alerts/types";

/**
 * Contextual "Set alert" — the ONE reusable alert-creation control, dropped on
 * screener rows, watchlist cards and research pages. It opens a small modal
 * prefilled from the surface's context (a price to cross, a preset to diff, a
 * research key level) and writes an alert_rules row (own-row RLS). Education-
 * first: it describes a condition to WATCH, never a trade to place.
 */

export interface AlertLevel {
  label: string;
  price: number;
  op?: "above" | "below";
}

export interface SetAlertButtonProps {
  ticker: string | null;
  surface: AlertSurface;
  /** Kind the modal opens on. */
  defaultKind?: AlertKind;
  /** Suggested price levels (research/watchlist) → quick-fill chips for price_cross. */
  levels?: AlertLevel[];
  /** Seed price for a price_cross when no levels given (e.g. current price). */
  seedPrice?: number | null;
  /** preset_match provenance (screener preset header button). */
  presetId?: string;
  presetLabel?: string;
  /** Visual variant. */
  variant?: "icon" | "chip" | "full";
  className?: string;
  /** Stop click bubbling to a clickable parent card. */
  stopPropagation?: boolean;
}

const KIND_LABEL: Record<AlertKind, string> = {
  price_cross: "Price crosses a level",
  pct_move: "Big move (%)",
  vol_surge: "Volume surge",
  rsi_cross: "RSI crosses",
  ema_cross: "Above/below its average",
  w52_break: "New 52-week high/low",
  preset_match: "New names in a screen",
  // Kai-Watch NL kinds — created via Kai Watch, not the manual builder below.
  sentiment_velocity: "Community sentiment turns",
  news_event: "Major news breaks",
};

export default function SetAlertButton(props: SetAlertButtonProps) {
  const {
    ticker,
    surface,
    defaultKind,
    levels = [],
    seedPrice = null,
    presetId,
    presetLabel,
    variant = "chip",
    className = "",
    stopPropagation = true,
  } = props;

  const [open, setOpen] = useState(false);
  const isPreset = defaultKind === "preset_match" || (!!presetId && !ticker);

  const onOpen = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(true);
    },
    [stopPropagation]
  );

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={onOpen}
        title="Set alert"
        aria-label="Set alert"
        className={`inline-flex items-center justify-center rounded-lg border border-sand bg-paper p-1.5 text-soft transition hover:border-gold-300 hover:text-gold-700 ${className}`}
      >
        <Bell className="h-3.5 w-3.5" />
      </button>
    ) : variant === "full" ? (
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-gold-300/60 bg-chip-amber/50 px-3 py-1.5 text-[13px] font-semibold text-gold-700 transition hover:bg-chip-amber ${className}`}
      >
        <BellPlus className="h-4 w-4" />
        Set alert
      </button>
    ) : (
      <button
        type="button"
        onClick={onOpen}
        title="Set alert"
        className={`inline-flex items-center gap-1 rounded-lg border border-sand bg-paper px-2 py-1 text-[11px] font-semibold text-ink transition hover:border-gold-300 ${className}`}
      >
        <Bell className="h-3.5 w-3.5" />
        Alert
      </button>
    );

  return (
    <>
      {trigger}
      <AnimatePresence>
        {open && (
          <AlertModal
            ticker={ticker}
            surface={surface}
            isPreset={isPreset}
            defaultKind={defaultKind}
            levels={levels}
            seedPrice={seedPrice}
            presetId={presetId}
            presetLabel={presetLabel}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AlertModal({
  ticker,
  surface,
  isPreset,
  defaultKind,
  levels,
  seedPrice,
  presetId,
  presetLabel,
  onClose,
}: {
  ticker: string | null;
  surface: AlertSurface;
  isPreset: boolean;
  defaultKind?: AlertKind;
  levels: AlertLevel[];
  seedPrice: number | null;
  presetId?: string;
  presetLabel?: string;
  onClose: () => void;
}) {
  const kinds: AlertKind[] = isPreset
    ? ["preset_match"]
    : ["price_cross", "pct_move", "vol_surge", "rsi_cross", "ema_cross", "w52_break"];

  const [kind, setKind] = useState<AlertKind>(
    defaultKind ?? (isPreset ? "preset_match" : "price_cross")
  );
  const [params, setParams] = useState<AlertParams>(() =>
    initialParams(defaultKind ?? (isPreset ? "preset_match" : "price_cross"), seedPrice, levels)
  );
  const [digest, setDigest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(
    () =>
      isPreset
        ? `New names in "${presetLabel ?? "screen"}"`
        : ruleLabel(kind, ticker, params),
    [kind, ticker, params, isPreset, presetLabel]
  );

  function pickKind(k: AlertKind) {
    setKind(k);
    setParams(initialParams(k, seedPrice, levels));
  }

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again.");
      setBusy(false);
      return;
    }
    const finalParams: AlertParams = isPreset
      ? { presetId, presetLabel }
      : params;
    const { error: err } = await supabase.from("alert_rules").insert({
      user_id: user.id,
      kind: isPreset ? "preset_match" : kind,
      ticker: isPreset ? null : ticker,
      params: finalParams,
      label,
      digest,
      surface,
      active: true,
    });
    if (err) {
      setError(
        /cap reached/i.test(err.message)
          ? `You've hit the ${MAX_ACTIVE_RULES}-alert limit. Pause one in your Alerts hub first.`
          : "Could not save that alert. Try again."
      );
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(onClose, 1100);
  }, [isPreset, presetId, presetLabel, kind, ticker, params, label, digest, surface, onClose]);

  return (
    <m.div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <m.div
        className="w-full max-w-md rounded-t-3xl border border-sand bg-paper p-5 shadow-xl sm:rounded-3xl"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              {isPreset ? "Watch this screen" : `Set an alert${ticker ? ` — ${ticker}` : ""}`}
            </h3>
            <p className="mt-0.5 text-[12px] leading-snug text-soft">
              Get a heads-up when a condition is met. This is a study prompt, not
              trading advice.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-soft hover:bg-sand"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </span>
            <p className="font-semibold text-ink">Alert set</p>
            <p className="text-[13px] text-soft">Manage it any time in your Alerts hub.</p>
          </div>
        ) : (
          <>
            {!isPreset && (
              <div className="mb-3">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-soft/70">
                  Condition
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {kinds.map((k) => (
                    <button
                      key={k}
                      onClick={() => pickKind(k)}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
                        kind === k
                          ? "border-gold-400 bg-chip-amber text-gold-700"
                          : "border-sand bg-paper text-soft hover:border-gold-300"
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isPreset && (
              <ParamInputs
                kind={kind}
                params={params}
                setParams={setParams}
                levels={levels}
              />
            )}

            <div className="mt-3 rounded-xl border border-sand bg-paper/60 px-3.5 py-2.5">
              <p className="text-[12px] font-semibold text-soft/70">You&apos;ll be alerted when</p>
              <p className="text-[14px] font-semibold text-ink">{label}</p>
            </div>

            <label className="mt-3 flex items-center gap-2.5 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={digest}
                onChange={(e) => setDigest(e.target.checked)}
                className="h-4 w-4 rounded border-sand accent-gold-600"
              />
              Hold for my daily digest (no instant push)
            </label>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-sand bg-paper py-2.5 text-[14px] font-semibold text-soft hover:bg-sand"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 py-2.5 text-[14px] font-bold text-white shadow-soft transition hover:brightness-105 disabled:opacity-60"
              >
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Set alert"}
              </button>
            </div>
          </>
        )}
      </m.div>
    </m.div>
  );
}

function initialParams(
  kind: AlertKind,
  seedPrice: number | null,
  levels: AlertLevel[]
): AlertParams {
  const firstLevel = levels[0];
  switch (kind) {
    case "price_cross":
      return {
        op: firstLevel?.op ?? "above",
        price: firstLevel?.price ?? (seedPrice != null ? round2(seedPrice) : undefined),
      };
    case "pct_move":
      return { pct: 5, window: "1d" };
    case "vol_surge":
      return { ratio: 3 };
    case "rsi_cross":
      return { op: "below", level: 30 };
    case "ema_cross":
      return { ema: 20, side: "above" };
    case "w52_break":
      return { edge: "high" };
    case "preset_match":
      return {};
    default:
      return {};
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ParamInputs({
  kind,
  params,
  setParams,
  levels,
}: {
  kind: AlertKind;
  params: AlertParams;
  setParams: (p: AlertParams) => void;
  levels: AlertLevel[];
}) {
  const patch = (p: Partial<AlertParams>) => setParams({ ...params, ...p });

  if (kind === "price_cross") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Seg
            active={params.op !== "below"}
            onClick={() => patch({ op: "above" })}
            label="Above"
          />
          <Seg
            active={params.op === "below"}
            onClick={() => patch({ op: "below" })}
            label="Below"
          />
        </div>
        <NumField
          prefix="$"
          value={params.price ?? ""}
          onChange={(v) => patch({ price: v })}
          placeholder="Price"
        />
        {levels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {levels.map((l) => (
              <button
                key={l.label}
                onClick={() => patch({ price: round2(l.price), op: l.op ?? params.op ?? "above" })}
                className="rounded-full border border-sand bg-paper px-2 py-0.5 text-[11px] font-medium text-soft hover:border-gold-300"
              >
                {l.label} · ${round2(l.price).toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (kind === "pct_move") {
    return (
      <div className="space-y-2">
        <NumField
          suffix="%"
          value={params.pct ?? ""}
          onChange={(v) => patch({ pct: v })}
          placeholder="Move size"
        />
        <div className="flex gap-2">
          <Seg active={params.window !== "5d"} onClick={() => patch({ window: "1d" })} label="In a day" />
          <Seg active={params.window === "5d"} onClick={() => patch({ window: "5d" })} label="In a week" />
        </div>
      </div>
    );
  }
  if (kind === "vol_surge") {
    return (
      <NumField
        suffix="× avg"
        value={params.ratio ?? ""}
        onChange={(v) => patch({ ratio: v })}
        placeholder="Volume vs average"
      />
    );
  }
  if (kind === "rsi_cross") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Seg active={params.op === "below"} onClick={() => patch({ op: "below" })} label="Falls below" />
          <Seg active={params.op === "above"} onClick={() => patch({ op: "above" })} label="Rises above" />
        </div>
        <NumField
          value={params.level ?? ""}
          onChange={(v) => patch({ level: v })}
          placeholder="RSI level (e.g. 30)"
        />
      </div>
    );
  }
  if (kind === "ema_cross") {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Seg active={params.ema !== 50} onClick={() => patch({ ema: 20 })} label="20-day" />
          <Seg active={params.ema === 50} onClick={() => patch({ ema: 50 })} label="50-day" />
        </div>
        <div className="flex gap-2">
          <Seg active={params.side !== "below"} onClick={() => patch({ side: "above" })} label="Closes above" />
          <Seg active={params.side === "below"} onClick={() => patch({ side: "below" })} label="Closes below" />
        </div>
      </div>
    );
  }
  if (kind === "w52_break") {
    return (
      <div className="flex gap-2">
        <Seg active={params.edge !== "low"} onClick={() => patch({ edge: "high" })} label="New high" />
        <Seg active={params.edge === "low"} onClick={() => patch({ edge: "low" })} label="New low" />
      </div>
    );
  }
  return null;
}

function Seg({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${
        active ? "border-gold-400 bg-chip-amber text-gold-700" : "border-sand bg-paper text-soft hover:border-gold-300"
      }`}
    >
      {label}
    </button>
  );
}

function NumField({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: {
  value: number | "";
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-3 py-2">
      {prefix && <span className="text-[14px] font-semibold text-soft">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-soft/50"
      />
      {suffix && <span className="whitespace-nowrap text-[13px] font-medium text-soft">{suffix}</span>}
    </div>
  );
}
