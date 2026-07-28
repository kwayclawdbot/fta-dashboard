/**
 * TICKER LABELS + SERIES HYGIENE — the small, testable rules that keep the
 * ticker surfaces from printing vendor artefacts as if they were facts.
 *
 * Four separate problems, one module because they are all "the feed said X, a
 * member reads Y":
 *
 *   1. SECTOR. Polygon hands us `sic_description`, which is a 1970s SEC filing
 *      category in screaming caps ("SEMICONDUCTORS & RELATED DEVICES",
 *      "ELECTRICAL INDUSTRIAL APPARATUS"). Printed raw under a company name it
 *      reads as a system leaking its own plumbing. A small map covers the
 *      descriptions this club actually meets; everything else is title-cased so
 *      the worst case is a long-but-human label, never a shout.
 *
 *   2. COMPANY NAME IN PROSE. "Study Nvidia Corp together", "Kai hasn't written
 *      up Apple Inc. yet" — the legal suffix belongs on a filing, not in a
 *      sentence. The IDENTITY heading keeps the registered name; prose gets the
 *      short one.
 *
 *   3. SPLIT-BROKEN EPS. Polygon reports each filing's EPS AS FILED, so a
 *      10-for-1 split makes the pre-split years tower over the post-split ones
 *      (NVDA's fake 2024 spike). We can recover the true series without a share
 *      count feed: implied shares = netIncome ÷ eps, and a split shows up as a
 *      clean integer jump in that implied count between ADJACENT periods.
 *      Detected + clean → adjust. Detected + not clean → we refuse to draw.
 *
 *   4. NON-CONTIGUOUS PERIODS. A missing filing (PLUG has no FY2024) draws two
 *      bars side by side that are two years apart, and a "YoY" figure computed
 *      across the hole. Periods carry their own calendar position, so the gap is
 *      detectable — the series is BROKEN where the hole is and the year-on-year
 *      number is withheld unless the last two periods really are adjacent.
 */

/* ── 1 · SECTOR ─────────────────────────────────────────────────────────── */

/** SIC descriptions → the words a member would actually use. */
const SECTOR_MAP: Record<string, string> = {
  "SEMICONDUCTORS & RELATED DEVICES": "Semiconductors",
  "ELECTRONIC COMPUTERS": "Computers & hardware",
  "SERVICES-PREPACKAGED SOFTWARE": "Software",
  "SERVICES-COMPUTER PROGRAMMING, DATA PROCESSING, ETC.": "Software & internet",
  "SERVICES-COMPUTER PROGRAMMING DATA PROCESSING": "Software & internet",
  "ELECTRICAL INDUSTRIAL APPARATUS": "Industrial electrical equipment",
  "RETAIL-CATALOG & MAIL-ORDER HOUSES": "Online retail",
  "RETAIL-VARIETY STORES": "Retail",
  "RETAIL-EATING PLACES": "Restaurants",
  "MOTOR VEHICLES & PASSENGER CAR BODIES": "Automotive",
  "PHARMACEUTICAL PREPARATIONS": "Pharmaceuticals",
  "BIOLOGICAL PRODUCTS, (NO DIAGNOSTIC SUBSTANCES)": "Biotechnology",
  "STATE COMMERCIAL BANKS": "Banking",
  "NATIONAL COMMERCIAL BANKS": "Banking",
  "FIRE, MARINE & CASUALTY INSURANCE": "Insurance",
  "CRUDE PETROLEUM & NATURAL GAS": "Oil & gas",
  "PETROLEUM REFINING": "Oil refining",
  "ELECTRIC SERVICES": "Utilities",
  "REAL ESTATE INVESTMENT TRUSTS": "Real estate (REIT)",
  "OPERATIVE BUILDERS": "Homebuilding",
  "AIR TRANSPORTATION, SCHEDULED": "Airlines",
  "TELEPHONE COMMUNICATIONS (NO RADIOTELEPHONE)": "Telecom",
  "RADIO & TV BROADCASTING & COMMUNICATIONS EQUIPMENT": "Communications equipment",
  "SERVICES-MOTION PICTURE & VIDEO TAPE PRODUCTION": "Film & television",
  "BLANK CHECKS": "Shell / blank-check company",
  "UNIT INVESTMENT TRUSTS, CLOSED-END MANAGEMENT INVESTMENT OFFICES":
    "Fund",
  "INVESTORS, NEC": "Fund",
};

/** Words that stay upper-cased when we title-case an unmapped description. */
const KEEP_UPPER = new Set(["ETC", "NEC", "REIT", "US", "USA", "TV", "IT"]);

/**
 * A human sector label. Mapped where we know the description, title-cased with
 * the ampersands and hyphens preserved where we don't, `null` when the feed had
 * nothing (an absent sector prints nothing — it never prints "Unknown").
 */
export function humanSector(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const hit = SECTOR_MAP[s.toUpperCase()];
  if (hit) return hit;
  // Already mixed-case (some feeds are) — leave it alone.
  if (s !== s.toUpperCase()) return s;
  const titled = s
    .toLowerCase()
    .replace(/[a-z]+/g, (w) =>
      KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)
    )
    // "Services-Prepackaged Software" reads better as a plain phrase.
    .replace(/^Services-/, "")
    .replace(/^Retail-/, "Retail · ")
    .replace(/,\s*$/, "");
  return titled;
}

/* ── 2 · COMPANY NAME IN PROSE ──────────────────────────────────────────── */

/** Registered-entity and share-class noise that never belongs in a sentence. */
const NAME_NOISE =
  /(?:,?\s+(?:class\s+[a-z]\s+)?(?:ordinary\s+shares?|common\s+stock|common\s+shares?|depositary\s+shares?|shares?)(?:\s+class\s+[a-z])?|,?\s+(?:inc|inc\.|incorporated|corp|corp\.|corporation|co|co\.|company|ltd|ltd\.|limited|plc|llc|l\.l\.c\.|lp|l\.p\.|n\.v\.|nv|s\.a\.|sa|ag|holdings?|group)\b\.?)+\s*$/i;

/**
 * The name a sentence should use. Strips trailing legal-entity and share-class
 * suffixes, repeatedly (Polygon happily ships "Foo Holdings Inc. Common Stock").
 * Falls back to the ticker when stripping would leave nothing.
 */
export function proseName(name: string | null | undefined, ticker?: string): string {
  let n = (name ?? "").trim();
  if (!n) return (ticker ?? "").toUpperCase();
  for (let i = 0; i < 4; i++) {
    const next = n.replace(NAME_NOISE, "").trim().replace(/[,·-]\s*$/, "").trim();
    if (next === n) break;
    n = next;
  }
  return n || (ticker ?? "").toUpperCase();
}

/* ── 3 · PRICE FORMATTING ───────────────────────────────────────────────── */

/**
 * A price bound for a compact range label. Whole dollars read fine on a $200
 * name and destroy a $1.40–$4.14 one ("1–4"), so anything under $10 keeps two
 * decimals and anything under $1 keeps three.
 */
export function fmtBound(v: number): string {
  const a = Math.abs(v);
  if (a < 1) return v.toFixed(3);
  if (a < 10) return v.toFixed(2);
  return v.toFixed(0);
}

/* ── 4 · PERIOD CONTIGUITY ──────────────────────────────────────────────── */

/** Calendar position of a reported period, or null when the label is opaque. */
export interface PeriodPos {
  /** Absolute index in quarters, so annual and quarterly compare the same way. */
  index: number;
  /** How many `index` steps one period is expected to advance. */
  step: number;
}

/** "FY2024" / "2024" → annual position; "Q3 2026" → quarterly position. */
export function periodPos(label: string | null | undefined): PeriodPos | null {
  const s = (label ?? "").trim();
  if (!s) return null;
  const q = s.match(/^Q([1-4])\s+(\d{4})$/i);
  if (q) return { index: Number(q[2]) * 4 + (Number(q[1]) - 1), step: 1 };
  const y = s.match(/^(?:FY\s*)?(\d{4})$/i);
  if (y) return { index: Number(y[1]) * 4, step: 4 };
  return null;
}

/**
 * `breaks[i] === true` means row i does NOT follow row i−1 on the calendar — a
 * missing filing sits between them and the chart must show the discontinuity
 * rather than butting the two bars together. Index 0 is always false.
 */
export function seriesBreaks(labels: (string | null | undefined)[]): boolean[] {
  return labels.map((lab, i) => {
    if (i === 0) return false;
    const a = periodPos(labels[i - 1]);
    const b = periodPos(lab);
    if (!a || !b) return false; // unparseable — claim nothing
    return b.index - a.index !== b.step;
  });
}

/** True when the last two periods really are adjacent (so a YoY/QoQ is honest). */
export function lastPairAdjacent(labels: (string | null | undefined)[]): boolean {
  if (labels.length < 2) return false;
  const b = seriesBreaks(labels);
  return b[b.length - 1] === false;
}

/* ── 5 · SPLIT-ADJUSTED EPS ─────────────────────────────────────────────── */

export interface EpsPoint {
  label: string;
  eps: number;
}

export interface EpsSeries {
  rows: EpsPoint[];
  /** True when a stock split was detected and the older years were restated. */
  adjusted: boolean;
}

const SPLIT_MIN = 1.5; // below this it's dilution/buyback, not a split
const SPLIT_TOL = 0.03; // an actual split lands on a clean integer ratio

/**
 * Annual EPS, restated onto today's share count.
 *
 * Polygon reports EPS as filed, so a split leaves a step change in the series
 * that looks like a collapse in earnings power (NVDA: $11.93 → $2.94 across its
 * 10-for-1). We don't carry a share-count feed, but net income is split-proof,
 * so IMPLIED SHARES = netIncome ÷ eps recovers it: a split is a clean integer
 * jump in that implied count between two ADJACENT periods.
 *
 * Returns `null` — meaning DON'T DRAW THIS CHART — when a step change is present
 * but can't be explained as a clean split. A wrong EPS history is worse than no
 * EPS history, and there is no third option available to us here.
 */
export function splitAdjustedEps(
  annual: { label: string; eps: number | null; netIncome: number | null }[]
): EpsSeries | null {
  const rows = annual.filter(
    (a) => a.eps != null && Number.isFinite(a.eps) && Math.abs(a.eps) > 1e-9
  ) as { label: string; eps: number; netIncome: number | null }[];
  if (rows.length < 2) return null;

  // Implied share count per period (sign-free: loss-making years divide two
  // negatives). Null where net income is missing — those steps are skipped.
  const shares = rows.map((r) =>
    r.netIncome != null && Number.isFinite(r.netIncome)
      ? Math.abs(r.netIncome / r.eps)
      : null
  );

  // Walk newest → oldest accumulating the split factor that applies to each
  // older period.
  const factor = new Array(rows.length).fill(1);
  let cum = 1;
  for (let i = rows.length - 1; i >= 1; i--) {
    const now = shares[i];
    const prev = shares[i - 1];
    const adjacent = !seriesBreaks(rows.map((r) => r.label))[i];
    if (now != null && prev != null && prev > 0 && adjacent) {
      const ratio = now / prev;
      if (ratio >= SPLIT_MIN) {
        const whole = Math.round(ratio);
        if (whole >= 2 && Math.abs(ratio - whole) / whole <= SPLIT_TOL) {
          cum *= whole;
        } else {
          // A step change we cannot honestly explain. Refuse the chart.
          return null;
        }
      }
    }
    factor[i - 1] = cum;
  }

  const adjusted = cum !== 1;
  return {
    rows: rows.map((r, i) => ({ label: r.label, eps: r.eps / factor[i] })),
    adjusted,
  };
}
