import type { StanceCardVM } from "@/ui-v3/discover-data";
import styles from "./StanceCards.module.css";

/**
 * "CLUB'S MOST BULLISH" / "CLUB'S MOST BEARISH" — two flat cards side by side.
 *
 * These are the only containers on either Discover artboard whose border is
 * tinted rather than neutral: a dark green and a dark rose that exist in the
 * mockups for these two cards alone. They are declared in the module, scoped to
 * the theme, exactly as GradientPanel keeps its washes.
 *
 * TWO THINGS THE CARDS REFUSE TO DO, both of which the live board did:
 *
 *  - Repeat the other card's list. Every row here used to keep its place even at
 *    a 0% bear share, so on a club where nobody is bearish the "most bearish"
 *    card printed the same three tickers as "most bullish", each at 0%. A card
 *    with nothing to rank now says so.
 *  - Print a share that no quorum supports. `pct` arrives null below the shared
 *    opinion floor; the row keeps its rank and drops the number, and the card's
 *    caption names what ordered it instead.
 */
export default function StanceCards({
  bullish,
  bearish,
}: {
  bullish: StanceCardVM;
  bearish: StanceCardVM;
}) {
  return (
    <div className={styles.row}>
      <StanceCard title="Club's most bullish" card={bullish} tone="bull" />
      <StanceCard title="Club's most bearish" card={bearish} tone="bear" />
    </div>
  );
}

function StanceCard({
  title,
  card,
  tone,
}: {
  title: string;
  card: StanceCardVM;
  tone: "bull" | "bear";
}) {
  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.title}>{title}</div>

      {card.rows.length === 0 ? (
        <div className={styles.empty}>{card.emptyCopy}</div>
      ) : (
        <>
          {card.orderLabel ? <div className={styles.order}>{card.orderLabel}</div> : null}
          <div className={styles.list}>
            {card.rows.map((row) => (
              <div key={row.ticker} className={styles.item}>
                <span className={styles.ticker}>{row.ticker}</span>
                {row.pct !== null ? (
                  <span className={styles.pct} data-numeric>
                    {row.pct}%
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
