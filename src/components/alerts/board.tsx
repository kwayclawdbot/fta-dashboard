import Link from "next/link";
import type { StateTone } from "@/lib/alerts/watch-ui";

/* ══════════════════════════════════════════════════════════════════════════
   WATCH BOARD PRIMITIVES — the objects the owner's canvas actually draws on
   boards 06 (Watch), 17 (Watchlist · Club Picks), 18 (Watch · Kai Alerts) and
   19 (Alert · View Setup).

   These boards are built FROM CARDS. A previous pass "interpreted" them into
   hairline ledgers; the owner overruled it. So this file is the card, the
   ring/dial, the state pill and the chip exactly as drawn — white #FFF card on
   the warm paper page, 1px #E5DFD5 hairline, 13–18px radius, and the accent
   gradient card for the "getting close" object.

   Every geometry number here is read off `Cheat Code App Light.dc.html`; every
   colour goes through a token (`--card`, `--sand`, `--accent-solid`, the state
   ramps), never a literal hex, so the dark twin comes for free.

   WHAT DOES NOT COME ACROSS FROM THE CANVAS:
     • BUY / SELL pills. An alert states what HAPPENED. The canvas's green
       "BUY SIGNAL" and red "SELL SIGNAL" chips are replaced by the shipped
       state language (Triggered / Building / Heating up / Into earnings),
       coloured by the state ramp — volt, teal, kai — never by the price ramp.
     • Invented checkmarks. The canvas draws "RSI reset ✓ · Call flow 3.1x ✓".
       Broadcasts carry no per-condition breakdown, so `MetricChip` renders the
       real measured quantity we DO store (proximity, detail.metric, levels)
       inside the drawn chip, and `CondRow`'s tick only lights on a condition
       the state machine actually recorded as met.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── the ramp a state tone paints with (CSS custom properties, so a dial can
      interpolate them inside a conic-gradient) ─────────────────────────────*/
const TONE_VAR: Record<StateTone, string> = {
  volt: "var(--color-volt-500)",
  teal: "var(--color-teal-500)",
  kai: "var(--color-kai-500)",
  quiet: "var(--color-soft)",
};

const TONE_TEXT: Record<StateTone, string> = {
  volt: "text-gold-700",
  teal: "text-teal-700",
  kai: "text-kai-600",
  quiet: "text-soft",
};

const TONE_CHIP: Record<StateTone, string> = {
  volt: "bg-volt-500/12 text-gold-700",
  teal: "bg-teal-500/12 text-teal-700",
  kai: "bg-kai-500/12 text-kai-600",
  quiet: "bg-sand text-soft",
};

const TONE_EDGE: Record<StateTone, string> = {
  volt: "border-l-volt-500",
  teal: "border-l-teal-500",
  kai: "border-l-kai-500",
  quiet: "border-l-sand",
};

export { TONE_TEXT, TONE_CHIP };

/* ══════════════════════════════════════════════════════════════════════════
   CARD — the board's ground object. White on paper, one hairline, r16.
   `edge` draws the canvas's 3px state stripe down the left of an alert card.
   ══════════════════════════════════════════════════════════════════════════ */
export function Card({
  children,
  className = "",
  edge,
  padded = true,
  dim = false,
}: {
  children: React.ReactNode;
  className?: string;
  edge?: StateTone;
  padded?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] border border-sand bg-card ${
        edge ? `border-l-[3px] ${TONE_EDGE[edge]}` : ""
      } ${padded ? "px-4 py-3.5" : ""} ${dim ? "opacity-70" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** The same card as a link (rows on board 06 / the compact rows on 18). */
export function CardLink({
  href,
  children,
  className = "",
  edge,
  dim = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  edge?: StateTone;
  dim?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`f0-focus f0-press block rounded-[16px] border border-sand bg-card px-4 py-3.5 transition hover:border-accent/45 ${
        edge ? `border-l-[3px] ${TONE_EDGE[edge]}` : ""
      } ${dim ? "opacity-70" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * The canvas's "GETTING CLOSE" card — a warm accent gradient washing out to the
 * card white, with a warmer hairline. Built from `--accent-solid` so it is club
 * orange, family gold or FTA metallic per mode, and never a hardcoded #FFEEDD.
 */
export function AccentCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-4 ${className}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent-solid) 15%, var(--card)) 0%, var(--card) 62%)",
        borderColor: "color-mix(in srgb, var(--accent-solid) 32%, var(--sand))",
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DIAL — the canvas's conic ring (board 06's 2/3, board 17's 78%).

   Radial gauges are explicitly allowed again, so this is the drawn object, not
   a substitute for it. What it is NEVER allowed to be is a probability: the
   centre prints the COUNT or the measured share it was built from, and the
   accessible name says the same thing in words.
   ══════════════════════════════════════════════════════════════════════════ */
export function Dial({
  /** 0..1 — how much of the ring is lit. */
  value,
  size = 88,
  ring = 7,
  tone = "volt",
  /** What is printed in the middle, e.g. "2/3" or "78%". */
  center,
  centerClassName = "",
  label,
}: {
  value: number;
  size?: number;
  ring?: number;
  tone?: StateTone | "sentiment" | "price-up" | "price-down";
  center: React.ReactNode;
  centerClassName?: string;
  label: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const paint =
    tone === "sentiment"
      ? "var(--color-sentiment-fill)"
      : tone === "price-up"
        ? "var(--color-price-up)"
        : tone === "price-down"
          ? "var(--color-price-down)"
          : TONE_VAR[tone];

  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${paint} 0 ${pct}%, var(--color-sand) ${pct}% 100%)`,
        }}
      />
      <span
        aria-hidden
        className="absolute grid place-items-center rounded-full bg-card"
        style={{ inset: ring }}
      >
        <span
          className={`font-mono font-semibold tabular-nums leading-none text-ink ${centerClassName}`}
        >
          {center}
        </span>
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STATE PILL — board 18's leading chip. The canvas says BUY SIGNAL; we say what
   happened. Mono, uppercase, tone-tinted, with the live dot when the state is
   one the member should look at now.
   ══════════════════════════════════════════════════════════════════════════ */
export function StatePill({
  tone,
  label,
  live = false,
}: {
  tone: StateTone;
  label: string;
  live?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${TONE_CHIP[tone]}`}
    >
      {live && (
        <span
          aria-hidden
          className="relative flex h-1.5 w-1.5 items-center justify-center"
        >
          <span
            className="absolute inline-flex h-1.5 w-1.5 rounded-full opacity-60 motion-safe:animate-ping"
            style={{ background: TONE_VAR[tone] }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: TONE_VAR[tone] }}
          />
        </span>
      )}
      {label}
    </span>
  );
}

/**
 * The canvas's small outlined chip under an alert body. It carries a MEASURED
 * quantity — never a fabricated "✓". Callers pass the real string the cron
 * recorded (`detail.metric`), a level we store, or a freshness reading.
 */
export function MetricChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[10px] border border-sand bg-paper px-2 py-1 font-mono text-[9.5px] leading-none text-soft">
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STAT GRID — CheatCodeDoors' setup stat rows: entry / stop / target / R:R as
   labelled mono values in a two-up grid whose 1px gaps are the sand hairline
   (grid gap over the sand ground, cells on card). Sizes are the prototype's:
   9.5px uppercase label · 12px mono value, 10/12px cell padding, r13 frame.
   Callers pass ONLY stats they actually have — a missing level is a missing
   cell, never a dash pretending to be a reading. Green/red stays on PRICE
   quantities via the optional tone.
   ══════════════════════════════════════════════════════════════════════════ */
export function StatGrid({
  stats,
  className = "",
}: {
  stats: { k: string; v: string; tone?: "up" | "down" }[];
  className?: string;
}) {
  if (stats.length === 0) return null;
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-[13px] border border-sand bg-sand ${className}`}
    >
      {stats.map((s, i) => (
        <div
          key={s.k}
          className={`flex items-baseline justify-between gap-2 bg-card px-3 py-2.5 ${
            i === stats.length - 1 && stats.length % 2 === 1 ? "col-span-2" : ""
          }`}
        >
          <dt className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-soft">
            {s.k}
          </dt>
          <dd
            className={`font-mono text-[12px] font-semibold tabular-nums ${
              s.tone === "up"
                ? "text-price-up"
                : s.tone === "down"
                  ? "text-price-down"
                  : "text-ink"
            }`}
          >
            {s.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LIFECYCLE BAR — CheatCodeDoors' watching-row progress bar: a 5px sand track
   whose fill shows WHERE IN THE LIFECYCLE the watch sits (WATCHING → BUILDING
   → NEAR TRIGGER → TRIGGERED / INVALIDATED). Fed the cron's real 0..1
   `detail.progress` when one was recorded; otherwise the state's fixed ladder
   position. It is a position, never a probability — which is why no % is
   printed and the accessible name says the state in words.
   ══════════════════════════════════════════════════════════════════════════ */
export function LifecycleBar({
  pct,
  tone = "quiet",
  label,
  className = "",
}: {
  /** 0..100 lifecycle position. */
  pct: number;
  tone?: StateTone;
  label: string;
  className?: string;
}) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div
      role="img"
      aria-label={label}
      className={`block h-[5px] overflow-hidden rounded-[3px] bg-sand ${className}`}
    >
      <span
        aria-hidden
        className="block h-full rounded-[3px]"
        style={{ width: `${p}%`, background: TONE_VAR[tone] }}
      />
    </div>
  );
}

/** A neutral count/eyebrow pill (board 18's "3 NEW"). */
export function CountPill({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${
        strong
          ? "bg-volt-500 text-night-950"
          : "border border-sand bg-card text-soft"
      }`}
    >
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV CARD — board 06's four rows (icon · title · sub · chevron or badge).
   ══════════════════════════════════════════════════════════════════════════ */
export function NavCard({
  href,
  onClick,
  icon,
  title,
  sub,
  badge,
}: {
  /** A real destination. Omit and pass `onClick` for a row that moves within
   *  the current board — a hash link to the page you are already on does not
   *  re-run the deep-link effect, so it would silently do nothing. */
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge?: number;
}) {
  const cls =
    "f0-focus f0-press flex w-full items-center gap-3 rounded-[13px] border border-sand bg-card px-3.5 py-3 text-left transition hover:border-accent/45";
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-paper text-soft">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">
          {title}
        </span>
        <span className="mt-px block truncate text-[10.5px] text-soft/85">
          {sub}
        </span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-[8px] bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-night-950">
          {badge}
        </span>
      ) : (
        <span aria-hidden className="shrink-0 text-soft/70">
          ›
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONDITION ROW — board 06 / 19's checklist.

   The tick only lights when the state machine RECORDED that step as reached.
   A step it has not reached draws the canvas's hollow ring instead, and a step
   we have no reading for is simply not drawn — there is no third "unknown"
   costume that looks like a claim.
   ══════════════════════════════════════════════════════════════════════════ */
export function CondRow({
  met,
  label,
  value,
  tone = "volt",
}: {
  met: boolean;
  label: string;
  value?: string | null;
  tone?: StateTone;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {met ? (
        <span
          aria-hidden
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-teal-500/18 text-[9px] font-bold text-teal-700"
        >
          ✓
        </span>
      ) : (
        <span
          aria-hidden
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border bg-paper"
          style={{ borderColor: TONE_VAR[tone] }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: TONE_VAR[tone] }}
          />
        </span>
      )}
      <span
        className={`min-w-0 flex-1 text-[12px] leading-snug ${
          met ? "text-ink/85" : "text-soft"
        }`}
      >
        {label}
      </span>
      {value && (
        <span
          className={`shrink-0 font-mono text-[10px] tabular-nums ${
            met ? "text-teal-700" : "text-soft/80"
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION EYEBROW — the canvas's mono, wide-tracked "TODAY" / "GETTING CLOSE"
   / "OFFICIAL CLUB PICKS" marker. Hairline optional (the canvas mostly runs
   these bare above a stack of cards).
   ══════════════════════════════════════════════════════════════════════════ */
export function Eyebrow({
  children,
  meta,
  accent = false,
  className = "",
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <p
        className={`font-mono text-[9px] font-semibold uppercase tracking-[0.16em] ${
          accent ? "text-gold-700" : "text-soft/80"
        }`}
      >
        {children}
      </p>
      {meta && <span className="ml-auto shrink-0">{meta}</span>}
    </div>
  );
}

/**
 * SECTION PILLS — the canvas's rail one level down, inside a board. Same pill
 * geometry as WatchRail so the two read as one system; inverted rather than
 * orange so a member can always tell which rail is a route (orange, brand) and
 * which is a control inside the page (ink).
 *
 * Stateless on purpose: the owning client component holds the selection, which
 * is why this file needs no "use client" of its own and can be imported by the
 * server-rendered detail screen for its other exports.
 */
export function SectionPills<T extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  className = "",
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onSelect: (t: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`club2-track sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur-sm ${className}`}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            className={`f0-focus f0-press shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition ${
              on
                ? "border-ink bg-ink text-paper"
                : "border-sand bg-card text-soft hover:text-ink"
            }`}
          >
            {t.label}
            {t.count ? (
              <span className="ml-1.5 font-mono text-[10px] tabular-nums opacity-70">
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * BOARD SKELETON — what a watch board looks like while it loads.
 *
 * LOADING ≠ EMPTY, and it also must not be a DIFFERENT object from the finished
 * screen: the generic dashboard skeleton drew a hairline ledger, so the hand-off
 * flickered from rows into cards. This is the card composition, pulsing.
 */
export function BoardSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6" aria-busy="true">
      <span className="sr-only">Loading {label}…</span>

      <div className="h-9 w-40 animate-pulse rounded-md bg-sand" />
      <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded-full bg-sand/70" />

      <div className="mt-4 flex gap-3.5">
        <div className="h-7 w-24 animate-pulse rounded-full bg-sand" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-sand/70" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-sand/70" />
      </div>

      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-sand/70" />
        ))}
      </div>

      <div className="mt-7 flex gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[58px] w-[58px] shrink-0 animate-pulse rounded-xl bg-sand" />
        ))}
      </div>

      <div className="mt-8 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[16px] border border-sand bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-[11px] bg-sand" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded-full bg-sand" />
                <div className="h-2.5 w-48 max-w-full animate-pulse rounded-full bg-sand/70" />
              </div>
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-sand" />
            </div>
            <div className="mt-2.5 h-[38px] w-full animate-pulse rounded-md bg-sand/60" />
            <div className="mt-2.5 flex items-center gap-2.5 border-t border-sand pt-2.5">
              <div className="h-2.5 w-16 animate-pulse rounded-full bg-sand" />
              <div className="h-2.5 flex-1 animate-pulse rounded-full bg-sand/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BOARD LEAD — the canvas's screen head: the big lowercase wordmark with the
   pill rail under it. The canvas sets the wordmark in a script face the app
   does not ship, so it is set in the display face at the same weight and
   optical size; everything else (the orange pill, the grey mono cells, the
   spacing) is the drawn object.
   ══════════════════════════════════════════════════════════════════════════ */
export function BoardLead({
  word,
  sub,
  actions,
}: {
  word: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-display-1 font-extrabold lowercase leading-none tracking-tight text-ink">
          {word}
        </h1>
        {sub && (
          <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-soft">
            {sub}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
