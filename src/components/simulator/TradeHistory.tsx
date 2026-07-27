"use client";

import { useSyncExternalStore } from "react";
import type { Trade } from "@/lib/simulator/portfolio-manager";

/**
 * TRADE HISTORY — a ledger grouped by DAY, replacing the bordered table.
 *
 * A trading record is read by session, so the day is the organising unit: each
 * day gets a ruled header carrying that session's realised P&L, and its closes
 * hang underneath as hairline rows. No table chrome, no card — the type and the
 * rules carry the structure, and every number is mono and tabular so the
 * columns line up down the page.
 *
 * COLOUR LAW: green/red is the realised P&L only (canonical price tokens, no
 * `dark:` variant). LONG / SHORT is a label and stays in the mono soft register.
 *
 * HONESTY: a day with no realised move renders its total in `soft`, not green —
 * flat is flat.
 */

interface TradeHistoryProps {
  trades: Trade[];
}

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tone(n: number): string {
  if (n === 0) return "text-soft";
  return n > 0 ? "text-price-up" : "text-price-down";
}

/* THE MEMBER'S CLOCK, as an external store bucketed to the hour. `dayOf` read
   `new Date()` / `Date.now()` and ran in the render body, which is the impure-
   call rule and is non-idempotent across midnight: a re-render at 00:00 silently
   relabels "Today" without the data changing. Hour buckets keep the snapshot
   stable between calls; `null` on the server so the first client render agrees,
   and until it resolves every day carries its absolute date (never a wrong
   "Today"). Same pattern as ChallengeSlot. */
const SUBSCRIBE = () => () => {};
const CLIENT_HOUR = () => Math.floor(Date.now() / 3_600_000);
const SERVER_HOUR = () => null;

/** Day key + human label, resolved against the member's own clock. */
function dayOf(iso: string | undefined, nowHour: number | null): { key: string; label: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { key: "unknown", label: "Undated" };
  const key = d.toDateString();
  const nowMs = nowHour == null ? null : nowHour * 3_600_000;
  const today = nowMs == null ? null : new Date(nowMs).toDateString();
  const yesterday = nowMs == null ? null : new Date(nowMs - 86_400_000).toDateString();
  if (today && key === today) return { key, label: "Today" };
  if (yesterday && key === yesterday) return { key, label: "Yesterday" };
  return {
    key,
    label: d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  };
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  const nowHour = useSyncExternalStore(SUBSCRIBE, CLIENT_HOUR, SERVER_HOUR);
  // Newest close first, then bucketed by day in that same order.
  const ordered = [...trades].sort(
    (a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime()
  );
  const days: { key: string; label: string; rows: Trade[] }[] = [];
  for (const t of ordered) {
    const { key, label } = dayOf(t.closedAt, nowHour);
    const last = days[days.length - 1];
    if (last && last.key === key) last.rows.push(t);
    else days.push({ key, label, rows: [t] });
  }

  return (
    // The heading lives on the account-record TAB that controls this panel.
    <div>
      {trades.length === 0 ? (
        <p className="py-5 text-[13.5px] leading-relaxed text-soft">
          No closes yet. Every practice trade you exit is written here, day by day,
          with what you made or lost on it.
        </p>
      ) : (
        <div className="space-y-5">
          {days.map((day) => {
            const dayPnl = day.rows.reduce((s, t) => s + t.pnl, 0);
            return (
              <div key={day.key}>
                <div className="f0-rule-top flex items-baseline justify-between gap-4 pt-2.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soft">
                    {day.label}
                  </span>
                  <span
                    className={`font-mono text-[12px] font-semibold tabular-nums ${tone(dayPnl)}`}
                  >
                    {dayPnl > 0 ? "+" : ""}${money(dayPnl)}
                  </span>
                </div>

                <div className="f0-ledger">
                  {day.rows.map((t) => (
                    <div key={t.id} className="f0-ledger-row">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[14px] font-extrabold tracking-tight text-ink">
                          ${t.symbol}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-soft">
                          {t.side === "long" ? "Long" : "Short"} ·{" "}
                          {t.quantity.toLocaleString()} @ ${t.entryPrice.toFixed(2)} → $
                          {t.exitPrice.toFixed(2)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 font-mono text-[14px] font-semibold tabular-nums ${tone(
                          t.pnl
                        )}`}
                      >
                        {t.pnl > 0 ? "+" : ""}${money(t.pnl)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
