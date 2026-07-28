"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PRACTICE_SIZE_USD,
  SCREEN_FILTERS,
  SCREEN_MIN_FILTERS,
  fmtPct,
  fmtUsd,
  priceTone,
  type Day4Payload,
  type DaySeed,
  type Quote,
} from "./data";
import {
  Chip,
  ErrorLine,
  KaiNote,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  Panel,
} from "./parts";

/**
 * DAY 4 · DO — SCREEN, THEN PRACTISE.
 *
 * The canvas's filters ("Revenue +20%/yr · Profitable · Club signal > 60%") do
 * not exist as columns, and a filter chip that does not filter is a dead
 * control. These five ARE columns of `screener_metrics`, so the match count
 * under them is a count of real rows and the shortlist changes when you toggle
 * one — which is the only way the lesson ("a screener turns 'what should I buy?'
 * into 'here is my shortlist'") actually lands.
 *
 * THE PRACTICE REP is a paper ticket recorded on the member's Day-4 artifact.
 * The board never says the order went to the simulator, because there is no
 * server-side simulator position to write: the simulator is a self-contained
 * surface, and claiming a fill it never received would be the same lie as a
 * fabricated price. Entry is stated as the last close we hold, not as a fill.
 */
export default function Day4Do({
  seed,
  onSubmit,
  busy,
  error,
}: {
  seed: DaySeed;
  onSubmit: (payload: Day4Payload) => void;
  busy: boolean;
  error: string | null;
}) {
  const saved = seed.doPayload as Day4Payload | null;

  const [filters, setFilters] = useState<string[]>(
    saved?.filters?.length ? saved.filters : ["up_1m", "above_50", "not_stretched"]
  );
  const [picked, setPicked] = useState<string | null>(saved?.ticker ?? null);
  const [reason, setReason] = useState(saved?.reason ?? "");

  const matches = useMemo(() => runScreen(seed.universe, filters), [seed.universe, filters]);
  const enoughFilters = filters.length >= SCREEN_MIN_FILTERS;
  const pickedQuote = matches.find((m) => m.ticker === picked) ?? null;
  const canSubmit =
    enoughFilters && Boolean(pickedQuote) && reason.trim().length >= 12;

  const toggle = (key: string) =>
    setFilters((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));

  const submit = () => {
    if (!pickedQuote) return;
    onSubmit({
      filters,
      matches: matches.length,
      ticker: pickedQuote.ticker,
      company: pickedQuote.name ?? null,
      size: PRACTICE_SIZE_USD,
      entry: pickedQuote.price ?? null,
      reason: reason.trim(),
    });
  };

  return (
    <div className="f0-stagger space-y-7">
      <div className="space-y-2">
        <MissionHead align="left">
          {filters.length} filters →{" "}
          <span className="text-gold-700">
            {matches.length} {matches.length === 1 ? "name" : "names"} → 1 rep
          </span>
        </MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">
          Every filter below is a real column in the screener. Toggle one and the
          shortlist moves — that is the whole skill.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Screen filters">
        {SCREEN_FILTERS.map((f) => (
          <Chip key={f.key} on={filters.includes(f.key)} onClick={() => toggle(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <p className="-mt-3 text-[13px] leading-relaxed text-soft">
        {enoughFilters
          ? SCREEN_FILTERS.filter((f) => filters.includes(f.key))
              .map((f) => f.sub)
              .join(" · ")
          : `Pick at least ${SCREEN_MIN_FILTERS} — one filter is a hunch, three is a screen.`}
      </p>

      <Panel
        label={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
        meta="sorted by 1-month move"
      >
        {seed.universe.length === 0 ? (
          <p className="py-2 text-[14px] leading-relaxed text-soft">
            The screener has not refreshed yet, so there is nothing to filter
            tonight. Your streak is safe — come back once it runs.
          </p>
        ) : matches.length === 0 ? (
          <p className="py-2 text-[14px] leading-relaxed text-soft">
            Nothing clears all {filters.length} filters right now. That is a real
            result, not a bug — loosen one and see what appears.
          </p>
        ) : (
          <div className="f0-ledger">
            {matches.slice(0, 12).map((m) => {
              const on = m.ticker === picked;
              return (
                <button
                  key={m.ticker}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(m.ticker)}
                  className={`f0-ledger-row f0-focus f0-press w-full justify-between gap-3 text-left ${
                    on ? "rounded-xl ring-2 ring-[color:var(--accent-solid)]" : ""
                  }`}
                >
                  <span
                    className="f0-tile-field grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-display text-[15px] font-black"
                    aria-hidden
                  >
                    {m.ticker.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[14px] font-bold tracking-wide text-ink">
                      {m.ticker}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-soft">
                      {m.name ?? m.sector ?? "—"}
                    </span>
                  </span>
                  <span className="shrink-0 self-center text-right">
                    <span
                      className={`block font-mono text-[14px] font-semibold tabular-nums ${priceTone(
                        m.chg1m
                      )}`}
                    >
                      {fmtPct(m.chg1m)}
                    </span>
                    <span className="block text-[10px] font-display font-bold uppercase tracking-[0.1em] text-soft">
                      1 month
                    </span>
                  </span>
                </button>
              );
            })}
            {matches.length > 12 && (
              <div className="f0-ledger-row justify-between">
                <span className="text-[13px] text-soft">
                  {matches.length - 12} more clear these filters
                </span>
                <Link href="/screener" className="font-display text-[13px] font-bold text-gold-700">
                  Open the screener
                </Link>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* the practice ticket */}
      <Panel label="Practice ticket · paper only" lead={Boolean(pickedQuote)}>
        {pickedQuote ? (
          <>
            <p className="font-display text-display-3 font-extrabold uppercase text-ink">
              Buy {pickedQuote.ticker}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[17px] font-bold tabular-nums text-ink">
                  {fmtUsd(PRACTICE_SIZE_USD)}
                </p>
                <p className="mt-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
                  Practice size
                </p>
              </div>
              <div>
                <p className="font-mono text-[17px] font-bold tabular-nums text-ink">
                  {fmtUsd(pickedQuote.price)}
                </p>
                <p className="mt-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
                  Last close
                </p>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
                Your entry reason
              </span>
              <textarea
                rows={3}
                maxLength={400}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this one, in your own words — and what would tell you that you were wrong."
                className="f0-focus mt-2 w-full resize-none rounded-lg bg-sand/50 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-soft/70"
              />
            </label>
            <p className="mt-2 text-[12px] leading-relaxed text-soft">
              Written now, readable later. The reason is the part you learn from —
              the outcome is only half the lesson.
            </p>
          </>
        ) : (
          <p className="py-2 text-[14px] leading-relaxed text-soft">
            Pick one name from the shortlist above and the ticket fills in here.
          </p>
        )}
      </Panel>

      <KaiNote>
        a screener turns &ldquo;what should I buy?&rdquo; into &ldquo;here is my
        shortlist.&rdquo; That is the skill that outlives this week.
      </KaiNote>

      <Note>
        No money moves. This is a written practice rep on your challenge card, not
        an order — the practice account lives in the{" "}
        <Link href="/simulator" className="font-bold text-gold-700">
          simulator
        </Link>
        , and the last close is the price we hold, not a fill.
      </Note>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton onClick={submit} disabled={!canSubmit} busy={busy}>
          {!enoughFilters
            ? `Pick ${SCREEN_MIN_FILTERS - filters.length} more filters`
            : !pickedQuote
              ? "Pick one name"
              : reason.trim().length < 12
                ? "Write your entry reason"
                : "Log my practice rep · $0 real risk"}
        </MissionButton>
      </MissionFooter>
    </div>
  );
}

/* ── the screen itself ────────────────────────────────────────────────────
   Pure, and every predicate reads a column that exists. A null reading FAILS
   the filter rather than passing it — a name we hold no data on has not been
   shown to clear anything. */
function runScreen(universe: Quote[], filters: string[]): Quote[] {
  const on = (k: string) => filters.includes(k);
  return universe
    .filter((q) => {
      if (on("up_1m") && !(q.chg1m != null && q.chg1m > 0)) return false;
      if (on("above_50") && q.ema50 !== "above") return false;
      if (on("near_high") && !(q.distHigh != null && q.distHigh >= -15)) return false;
      if (on("volume_hot") && !(q.volRatio != null && q.volRatio >= 1.2)) return false;
      if (on("not_stretched") && !(q.rsi != null && q.rsi < 70)) return false;
      return true;
    })
    .sort((a, b) => (b.chg1m ?? -Infinity) - (a.chg1m ?? -Infinity));
}
