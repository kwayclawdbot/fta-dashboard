"use client";

import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import {
  BRANDS,
  DAY1_MIN_PICKS,
  fmtPct,
  fmtUsd,
  priceTone,
  type Day1Payload,
  type DaySeed,
} from "./data";
import {
  Chip,
  ErrorLine,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  Panel,
} from "./parts";

/**
 * DAY 1 · DO — "TAP WHAT YOU USED THIS WEEK".
 *
 * The canvas's whole trick is the translation: a member taps things from their
 * own week and watches them become tickers with live prices. Two details make it
 * honest rather than cute.
 *
 *   • The MAPPINGS ARE TRUE. Xbox and ChatGPT both resolve to MSFT, and the
 *     board says why in each case rather than quietly pointing a consumer brand
 *     at a convenient proxy. When two taps collide the second row states
 *     "merged with above" instead of inflating the count — the canvas draws that
 *     exact row and it is the honest one.
 *   • The PRICES ARE REAL, read from `screener_metrics` on the server. A ticker
 *     with no row renders "—", never a fabricated 0.00%.
 *
 * The list this produces is the artifact; the share step posts it and it becomes
 * a real watchlist the member keeps.
 */
export default function Day1Do({
  seed,
  onSubmit,
  busy,
  error,
}: {
  seed: DaySeed;
  onSubmit: (payload: Day1Payload) => void;
  busy: boolean;
  error: string | null;
}) {
  const initial = useMemo(() => {
    const saved = seed.doPayload as Day1Payload | null;
    if (!saved?.picks?.length) return [] as string[];
    const wanted = new Set(saved.picks.map((p) => p.brand));
    return BRANDS.filter((b) => wanted.has(b.key)).map((b) => b.key);
  }, [seed.doPayload]);

  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  /* The tap order is the reading order — first tap wins the ticker, a later tap
     on the same company is shown as merged rather than dropped silently. */
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return picked.map((key) => {
      const brand = BRANDS.find((b) => b.key === key)!;
      const merged = seen.has(brand.ticker);
      seen.add(brand.ticker);
      const q = seed.quotes[brand.ticker] ?? null;
      return { brand, merged, quote: q };
    });
  }, [picked, seed.quotes]);

  const unique = rows.filter((r) => !r.merged);
  const enough = unique.length >= DAY1_MIN_PICKS;
  const notes = unique.map((r) => r.brand.note).filter(Boolean) as string[];

  const submit = () => {
    onSubmit({
      picks: unique.map((r) => ({
        brand: r.brand.key,
        ticker: r.brand.ticker,
        company: r.quote?.name ?? null,
        price: r.quote?.price ?? null,
        chg: r.quote?.chg ?? null,
      })),
    });
  };

  return (
    <div className="f0-stagger space-y-7">
      <div className="space-y-2">
        <MissionHead align="left">
          Tap what you used <span className="text-gold-700">this week</span>
        </MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">
          We turn your real life into tickers — pick at least {DAY1_MIN_PICKS}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Things you used this week">
        {BRANDS.map((b) => (
          <Chip key={b.key} on={picked.includes(b.key)} onClick={() => toggle(b.key)}>
            <span aria-hidden>{b.emoji}</span> {b.label}
          </Chip>
        ))}
      </div>

      <Panel
        label="Your picks became"
        meta={
          picked.length === 0
            ? undefined
            : `${unique.length} of ${DAY1_MIN_PICKS}${enough ? " ✓" : ""}`
        }
      >
        {rows.length === 0 ? (
          <p className="py-2 text-[14px] leading-relaxed text-soft">
            Nothing yet. Tap a few things above — the tickers fill in as you go.
          </p>
        ) : (
          <div className="f0-ledger">
            {rows.map((r) => (
              <div
                key={r.brand.key}
                className={`f0-ledger-row justify-between gap-3 ${r.merged ? "opacity-60" : ""}`}
              >
                <span
                  className="f0-tile-field grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-display text-[15px] font-black"
                  aria-hidden
                >
                  {r.brand.ticker.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[14px] font-bold tracking-wide text-ink">
                    {r.brand.ticker}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-soft">
                    from {r.brand.from}
                    {r.merged ? " · merged with above" : ""}
                    {!r.merged && r.quote?.name ? ` · ${r.quote.name}` : ""}
                  </span>
                </span>
                {r.merged ? (
                  <ArrowUp className="h-4 w-4 shrink-0 self-center text-soft" aria-hidden />
                ) : (
                  <span className="shrink-0 self-center text-right">
                    <span className="block font-mono text-[14px] font-semibold tabular-nums text-ink">
                      {fmtUsd(r.quote?.price)}
                    </span>
                    <span
                      className={`block font-mono text-[11px] font-semibold tabular-nums ${priceTone(
                        r.quote?.chg
                      )}`}
                    >
                      {fmtPct(r.quote?.chg)}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((n) => (
            <Note key={n}>{n}</Note>
          ))}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-soft">
        Prices are the latest close we hold, not a live quote. Adding a company to
        a list is practice — nothing is bought and no money is at risk.
      </p>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton onClick={submit} disabled={!enough} busy={busy}>
          {enough
            ? "Looks right → write my why"
            : `Pick ${DAY1_MIN_PICKS - unique.length} more`}
        </MissionButton>
      </MissionFooter>
    </div>
  );
}
