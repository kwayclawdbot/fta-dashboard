import Ticker from "@/components/ui/Ticker";
import { ListHead, Eyebrow, StatTile, StatTileRow } from "@/components/you/parts";
import type { UserInsights } from "@/lib/insights/compute";

/* ══════════════════════════════════════════════════════════════════════════
   HOW THEY INVEST — Club Screens board 09's generated "who to follow" digest,
   built in the profile's OWN warm-light vocabulary (the eyebrow, the white
   hairline card, the stat tiles, the bar rows) rather than a second card
   style. Every value comes from getUserInsights(); nothing is invented here.

   COLOUR LAW, applied section by section:
     • Kai's read — the ONE Kai-blue on the page: a faint kai wash and a
       kai-blue sparkle tag. It renders only when a narrative exists; the
       instant the model call left kai_read null (the credit outage), the
       sub-card is simply absent — never an empty box.
     • Favorite stocks — weight bars in the ACTION colour (accent/orange),
       because a share of attention is a brand/participation measure. Each
       symbol rides the shared <Ticker> so it never renders as plain text.
     • Bull / bear lean — a LIME sentiment bar (never green/red); direction is
       carried by the word, hue only says "sentiment". Null lean → an honest
       "not enough calls yet" line instead of a fabricated 50%.
     • Favorite sectors — the profile's centred stat-tile trio.
     • Trading style — neutral hairline pills, only for what the member
       actually declared. Nothing is asserted from an empty strategy row.
   ══════════════════════════════════════════════════════════════════════════ */

// The declared strategy enums rendered as plain, human pills. Unknown values
// fall back to a capitalised form rather than being dropped — we show what the
// member told us, we just never fabricate what they didn't.
const RISK_LABEL: Record<string, string> = {
  aggressive: "Higher risk posture",
  moderate: "Balanced risk",
  conservative: "Lower risk posture",
};
const TIMEFRAME_LABEL: Record<string, string> = {
  longterm: "Long-term holds",
  swing: "Swing trades",
  daytrade: "Day trades",
  intraday: "Intraday",
  position: "Position trades",
};
const SETUP_LABEL: Record<string, string> = {
  breakout: "Breakout entries",
  oversold: "Buys oversold",
  momentum: "Momentum",
  pullback: "Buys pullbacks",
  reversal: "Reversals",
  trend: "Trend-following",
  value: "Value plays",
};

function cap(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** A quiet, neutral trait pill — the mockup's `.pf-tag`. */
function StylePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-sand bg-card px-2.5 py-1 text-[11.5px] font-semibold tracking-[-0.005em] text-soft">
      {children}
    </span>
  );
}

export default function HowTheyInvest({
  insights,
  who,
}: {
  insights: UserInsights;
  who: string;
}) {
  const { favorite_tickers, bull_lean, favorite_sectors, trading_style, kai_read } = insights;

  // Weight bars scale to the member's own leader (their top holding fills the
  // track); the mono % beside each is the raw share of their attention.
  const maxWeight = favorite_tickers.reduce((m, t) => Math.max(m, t.weight), 0) || 1;

  const stylePills: string[] = [
    trading_style.risk_posture
      ? RISK_LABEL[trading_style.risk_posture] ?? cap(trading_style.risk_posture)
      : null,
    trading_style.timeframe
      ? TIMEFRAME_LABEL[trading_style.timeframe] ?? cap(trading_style.timeframe)
      : null,
    ...trading_style.setups.map((s) => SETUP_LABEL[s] ?? cap(s)),
  ].filter((x): x is string => !!x);

  return (
    <section className="space-y-3 pt-1">
      <ListHead>How they invest</ListHead>

      {/* KAI'S READ — the only Kai-blue on the page. Absent (not empty) when the
          narrative is null, e.g. during a credit outage. */}
      {kai_read && (
        <div
          className="rounded-[14px] border border-sand px-4 py-3.5"
          style={{
            background:
              "radial-gradient(120% 150% at 100% 0%, var(--kai-blue-soft) 0%, transparent 52%), var(--card)",
          }}
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-kai-blue">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.9 4.8L18.5 9l-4.6 1.2L12 15l-1.9-4.8L5.5 9l4.6-1.2L12 3z" />
            </svg>
            Kai&apos;s read
          </span>
          <p className="mt-2 text-[14px] font-semibold leading-[1.45] tracking-[-0.01em] text-ink">
            {kai_read}
          </p>
        </div>
      )}

      {/* FAVORITE STOCKS — weighted, each on the shared Ticker + an orange bar. */}
      {favorite_tickers.length > 0 && (
        <div className="club-b-card rounded-[14px] px-4 py-3.5">
          <Eyebrow>Favorite stocks · by weight</Eyebrow>
          <div className="mt-2.5 space-y-2">
            {favorite_tickers.map((t) => {
              const pct = Math.round(t.weight * 100);
              const barPct = Math.round((t.weight / maxWeight) * 100);
              return (
                <div key={t.ticker} className="flex items-center gap-3">
                  <div className="w-[86px] shrink-0">
                    <Ticker symbol={t.ticker} size="sm" href={`/research/${encodeURIComponent(t.ticker)}`} />
                  </div>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${t.ticker} weight`}
                  >
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-soft">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BULL / BEAR LEAN — sentiment, so LIME. Direction is in the words. */}
      <div className="club-b-card rounded-[14px] px-4 py-3.5">
        <Eyebrow>Bull / bear lean</Eyebrow>
        {bull_lean == null ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-soft">
            Not enough calls yet — {who} hasn&apos;t taken a position we can read a lean from.
          </p>
        ) : (
          <>
            <div className="mt-2.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.04em]">
              <span className="text-sentiment">Bull-leaning</span>
              <span className="text-soft">Bear-leaning</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-sand"
              role="progressbar"
              aria-valuenow={bull_lean}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of positions called bullish"
            >
              <div
                className="h-full rounded-full bg-sentiment-fill transition-[width] duration-700 ease-out"
                style={{ width: `${bull_lean}%` }}
              />
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-soft">
              <span className="font-semibold text-ink">
                {bull_lean}% of {who}&apos;s calls are bullish.
              </span>{" "}
              {bull_lean >= 60
                ? "Leans toward strength more than fading it."
                : bull_lean <= 40
                  ? "Leans cautious — quicker to call weakness."
                  : "Balanced between bullish and bearish calls."}
            </p>
          </>
        )}
      </div>

      {/* FAVORITE SECTORS — the profile's centred stat-tile trio. */}
      {favorite_sectors.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>Favorite sectors</Eyebrow>
          <StatTileRow>
            {favorite_sectors.map((s) => (
              <StatTile key={s.sector} value={`${s.pct}%`} label={s.sector} />
            ))}
          </StatTileRow>
        </div>
      )}

      {/* TRADING STYLE — neutral pills, only for what was actually declared. */}
      {stylePills.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>Trading style</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {stylePills.map((p) => (
              <StylePill key={p}>{p}</StylePill>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-soft">
        Built from {who}&apos;s positions and club activity, so members can find and follow
        people who trade the way they want to learn.
      </p>
    </section>
  );
}
