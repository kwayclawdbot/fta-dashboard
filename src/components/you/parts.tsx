"use client";

import Link from "next/link";

import { StreakPip } from "@/components/art";

/* ══════════════════════════════════════════════════════════════════════════
   YOU · BOARD VOCABULARY — the objects drawn on App Light board 07 (You ·
   Profile), board 22 (Belts · Rank System) and Club Screens board 09 (Member
   profile), built as drawn.

   THE CARD RULE WAS RESCINDED. An earlier pass read the standing "no generic
   card containers" note as a ban and rebuilt these surfaces out of hairline
   ledgers; the owner overruled it — the board is the spec. The board's ground
   is a WHITE ROUNDED CARD with a hairline border (13–16px radius, no shadow in
   light), which is exactly the `.club-b-card` / `.club-b-warm` pair the Home
   lane already added to globals.css for board 01. This file composes from that
   pair rather than minting a second card system.

   RADIAL GAUGES ARE ALLOWED. Board 07 draws an `87 OPINION SCORE` conic dial
   beside the member's name; board 22 draws belt discs; Club 09 draws an XP
   ring. The shapes are drawn here as drawn. WHAT THEY MEASURE is the part that
   changed — see the compliance note below and the per-call comments.

   ── THE ONE HARD LINE ─────────────────────────────────────────────────────
   No member accuracy, hit rate, or scored opinion ships. The boards draw
   `87 OPINION SCORE`, `Accuracy 74%`, `Accuracy 71%`, `Influence 1.8x`,
   `People Influenced 382` and belt gates reading `10 graded calls · 50%+
   accuracy`. Every one of those SHAPES is built. Every one of them is fed from
   participation data instead: XP progress, belt standing, daily streak,
   conviction (the member's own bull share), changed minds, respect received.
   Publishing a member's hit rate — or any score derived from one — is a
   performance claim on the most shareable surface in the app.

   COLOUR LAW (unchanged): green/red = PRICE only · lime = community sentiment
   only · orange/accent = brand + action only · Kai blue = AI only · purple is
   a BELT colour and appears nowhere else. The board paints its `71% Accuracy`
   tile green and its `✗ −2.1%` call red; neither ships, so neither hue does.

   DARK: every colour here is a semantic token (--card / --sand / --paper /
   ink / soft) or the mode accent, so the whole set re-skins at
   :root[data-theme="dark"] with no `dark:` variant anywhere. Orange TEXT is
   `text-gold-700` (the ramp that flips), never `text-volt-*` (frozen).
   ══════════════════════════════════════════════════════════════════════════ */

/* The one honest empty value. It LIVES in `@/lib/dash` — a directive-free
   module — because this file is `"use client"`, and a plain function exported
   from a client module cannot be CALLED during a server render (React throws
   "Attempted to call dash() from the server"). The server-rendered public
   profile at /u/[username] did exactly that and threw on every handle. The
   re-export keeps the client surfaces that already import it from here working
   unchanged. */
export { dash } from "@/lib/dash";

/* ── Masthead ─────────────────────────────────────────────────────────────
   The board sets "you" / "belts" as a lowercase Kaushan Script wordmark at
   34px. No script face is loaded in the app (see the report: adding one needs
   layout.tsx + globals.css, neither of which this lane owns), so the closest
   honest rendering of the drawn object is the display face set lowercase at
   the drawn size with the drawn tightness. Everything else about the row —
   the optional back chevron, the quiet action glyph opposite — is as drawn. */
export function BoardMast({
  word,
  lede,
  back,
  action,
  caps = "lower",
}: {
  word: string;
  lede?: React.ReactNode;
  /** Drawn on board 22 as a "←" ahead of the wordmark. */
  back?: { href: string; label: string };
  /** The board's top-right affordance (the ⚙ on 07). */
  action?: React.ReactNode;
  /**
   * The board sets its wordmarks lowercase. Surfaces whose headline is a
   * COMMERCIAL STRING (referrals) pass "none" so the copy renders exactly as
   * written — a case transform is a change to shipped commercial copy.
   */
  caps?: "lower" | "none";
}) {
  return (
    <header>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Link
              href={back.href}
              aria-label={back.label}
              className="f0-focus f0-press shrink-0 rounded text-soft transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none">
                <path
                  d="M19 12H5m0 0 6-6m-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )}
          <h1
            className={`min-w-0 font-display text-[34px] font-extrabold leading-none tracking-[-0.035em] text-ink ${
              caps === "lower" ? "truncate lowercase" : "text-balance"
            }`}
          >
            {word}
          </h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {lede && (
        <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">{lede}</p>
      )}
    </header>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────
   The board's ground. `.club-b-card` is the shared neutral card (var(--card)
   over a hairline var(--sand), 14px radius); radius overrides ride in from the
   caller where the board draws a tighter corner (13px on the stat tiles). */
export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  return <As className={`club-b-card ${className}`}>{children}</As>;
}

/** The board's brand-tinted card: peach wash → card, warm hairline. Used for
    the streak block (07) and the "you are here" belt rung (22). */
export function WarmCard({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Board 22 gives the current rung an orange edge + bloom. */
  glow?: boolean;
}) {
  return (
    <div
      className={`club-b-warm ${className}`}
      style={
        glow
          ? {
              borderColor: "var(--accent-solid)",
              boxShadow: "0 0 12px color-mix(in srgb, var(--accent-solid) 20%, transparent)",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/* ── Eyebrow ──────────────────────────────────────────────────────────────
   Mono, letterspaced, uppercase — the board's section marker. `charged` is the
   orange variant it uses over a list ("RECENT CALLS", "HOW BELTS SHOW UP"). */
export function Eyebrow({
  children,
  charged = false,
  className = "",
}: {
  children: React.ReactNode;
  charged?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] ${
        charged ? "text-gold-700" : "text-soft"
      } ${className}`}
    >
      {children}
    </p>
  );
}

/** Eyebrow + a quiet right-hand action, the board's list header. */
export function ListHead({
  children,
  action,
  charged = true,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  charged?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Eyebrow charged={charged}>{children}</Eyebrow>
      {action && <div className="shrink-0 text-[11px]">{action}</div>}
    </div>
  );
}

/* ── Conic dial ───────────────────────────────────────────────────────────
   Board 07's `87 OPINION SCORE` object, drawn exactly: a 64px conic ring over
   the sand track with a paper-coloured well punched out of it, a mono numeral
   and a two-line 6.5px label.

   WHAT IT MEASURES. Never an opinion score — the app computes none and may
   not. It renders XP PROGRESS TOWARD THE NEXT BELT, with the belt as its
   label. That is a real read (lifetime XP against the level table), it is a
   participation measure rather than a verdict, and it is the one number on the
   surface a member can actually move by doing something.

   The arc is the ACTION colour by law (progress toward something you can act
   on), which is also what the board painted it. */
export function Dial({
  pct,
  value,
  label,
  size = 64,
}: {
  /** 0–100. Drives the sweep only. */
  pct: number;
  /** The numeral in the well. Pre-formatted. */
  value: string;
  /** Up to two short lines under the numeral. */
  label: [string, string] | [string];
  size?: number;
}) {
  const p = Math.max(0, Math.min(100, pct));
  const well = Math.round(size * 0.8125); // 52 at 64, the drawn ratio
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent-solid) 0 ${p}%, var(--sand) ${p}% 100%)`,
      }}
      role="img"
      aria-label={`${label.join(" ")}: ${value}`}
    >
      <div
        className="grid place-items-center rounded-full bg-paper text-center"
        style={{ width: well, height: well }}
      >
        <div>
          <div className="font-mono text-[16px] font-semibold leading-none tabular-nums text-ink">
            {value}
          </div>
          <div className="mt-[2px] text-[6.5px] font-semibold uppercase leading-[1.25] tracking-[0.08em] text-soft">
            {label[0]}
            {label[1] && (
              <>
                <br />
                {label[1]}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Ring avatar ──────────────────────────────────────────────────────────
   The board's 92px identity disc: a conic orange ring, a 3px paper gutter, and
   the member's picture or initials inside. The ring is brand, not a belt — the
   belt is spelled out on the line beneath it, exactly as drawn. */
export function RingAvatar({
  name,
  avatarUrl,
  size = 92,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <span
      className="block shrink-0 rounded-full p-[3px]"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(var(--accent-solid), var(--accent-strong), var(--accent-solid))",
        boxShadow: "0 0 14px color-mix(in srgb, var(--accent-solid) 18%, transparent)",
      }}
    >
      <span
        className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-sand"
        style={{ border: "3px solid var(--paper)" }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span
            className="font-display font-extrabold text-ink"
            style={{ fontSize: Math.round(size * 0.3) }}
          >
            {(name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
    </span>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────────
   The board's five-across strip of small cards: mono numeral over a tiny
   label, centred. The board paints one of them green (`71% Accuracy`); that
   tile does not ship and neither does the hue — green is price. */
export function StatTile({
  value,
  label,
  loading = false,
}: {
  value: string;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="club-b-card min-w-0 flex-1 rounded-[13px] px-1.5 py-[11px] text-center">
      {loading ? (
        <span
          className="mx-auto block h-[15px] w-9 rounded bg-sand motion-safe:animate-pulse"
          aria-hidden
        />
      ) : (
        <p className="font-mono text-[15px] font-semibold leading-none tabular-nums text-ink">
          {value}
        </p>
      )}
      <p className="mt-[3px] text-[8px] font-semibold leading-tight text-soft">{label}</p>
    </div>
  );
}

/** The board's five-tile row. Wraps below the phone width rather than
    squeezing five 8px labels into a 320px viewport. */
export function StatTileRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/* ── Labelled bar ─────────────────────────────────────────────────────────
   The "Strongest areas" object: a label, a right-hand measure, and a 4px
   track. The board's right-hand measure is a PERCENTILE ("Top 4%"), which is a
   ranking of the member against other members and is not computed anywhere in
   this app. Callers pass a share of the member's own record instead. */
export function BarRow({
  label,
  meta,
  pct,
  className = "",
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  pct: number;
  className?: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-[10.5px]">
        <span className="min-w-0 truncate text-ink">{label}</span>
        {meta && <span className="shrink-0 tabular-nums text-soft">{meta}</span>}
      </div>
      <div
        className="mt-1 h-1 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-valuenow={w}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

/* ── Streak pips ──────────────────────────────────────────────────────────
   Board 07 draws seven 8×22 rounded bars beside the streak number, the leading
   ones filled. They render the last seven days, one pip per day, filled only
   where the day carries a real XP event — so the row is a record, not a
   decoration that always looks half-full. */
export function StreakPips({ days }: { days: boolean[] }) {
  // The last entry is TODAY, and today is the only cell that can change while
  // the member is looking at it. It gets the art layer's <StreakPip today/> so
  // the row has one moment of feedback — a spring pop as it lands — instead of
  // silently re-rendering seven identical bars. The other six are history and
  // are drawn flat, because history does not animate.
  const last = days.length - 1;
  return (
    <div className="flex shrink-0 items-center gap-1" aria-hidden>
      {days.map((on, i) =>
        i === last ? (
          <StreakPip key={i} filled={on} today size={12} />
        ) : (
          <span
            key={i}
            className="block h-[22px] w-2 rounded-[4px]"
            style={{
              background: on
                ? "var(--accent-solid)"
                : "color-mix(in srgb, var(--accent-solid) 22%, var(--sand))",
            }}
          />
        )
      )}
    </div>
  );
}

/* ── Row card ─────────────────────────────────────────────────────────────
   The board's list item: a card with a mono key on the left, a description
   filling the middle, and a right-hand value. Board 07 uses it for the
   "Recent calls" ledger and board 22 for the belt rungs. */
export function RowCard({
  lead,
  title,
  sub,
  value,
  href,
  className = "",
}: {
  /** Left object — a ticker, a belt disc, an avatar. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {lead && <span className="shrink-0 self-center">{lead}</span>}
      <span className="min-w-0 flex-1 self-center">
        <span className="block truncate font-display text-[13px] font-bold text-ink">
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-[10.5px] leading-snug text-soft">
            {sub}
          </span>
        )}
      </span>
      {value && <span className="shrink-0 self-center text-right">{value}</span>}
    </>
  );
  const cls = `club-b-card flex items-center gap-3 rounded-[12px] px-3 py-2.5 ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${cls} f0-focus f0-press`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/* ── Honest empty ─────────────────────────────────────────────────────────
   A stated absence with a way out — never a decorative placeholder pretending
   content exists. Set inside the board's card so an empty section keeps the
   surface's rhythm instead of collapsing a hole into it. */
export function EmptyCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="club-b-card rounded-[14px] px-4 py-5">
      <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Text action ──────────────────────────────────────────────────────────
   The board's quiet "See all" / "Find one" affordance. Orange type, no button
   chrome. `text-gold-700` is the orange ramp that flips at night. */
export function TextAction({
  href,
  onClick,
  external,
  children,
}: {
  href?: string;
  onClick?: () => void;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "f0-focus inline-flex items-center gap-1.5 rounded font-display text-[12px] font-bold text-gold-700 transition-colors hover:text-gold-600";
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ── Belt disc ────────────────────────────────────────────────────────────
   Board 22's rung glyph: a 38px disc ringed in the belt's own colour with the
   belt's knot bar across it, and a star pip on the rung the member is standing
   on. Belt colour is INTRINSIC — a blue belt is blue in both themes — so these
   are inline styles from BELTS, never tokens. Purple is a legal belt colour
   and enters no other chrome.

   TWO THINGS THE INTRINSIC-COLOUR RULE COSTS, both fixed here rather than by
   lying about a belt's colour:

   1. THE ENDS DISAPPEAR. Black (#1F2430) against the dark card and White
      (#E8EAF0 / #B9BFCC) against the warm light page are each within a hair of
      their ground, so the top and bottom of the ladder had no silhouette at
      all — the Black rung's disc was simply not visible in dark. `.f0-belt-disc`
      adds a neutral hairline drawn from the PAGE's ink, which is dark on light
      and light on dark and therefore always the opposite of whatever the belt
      is losing against.

   2. UNEARNED RUNGS WENT GREY. Muting a saturated belt to 55% on the light page
      washes it into the sand — a new member (White belt) saw four grey discs and
      no ladder. The mute is now shallow, and the disc BODY is the card rather
      than the sand, so the belt hue reads against white instead of beige. An
      unearned rung is still obviously quieter; it is just still a belt. */
export function BeltDisc({
  hex,
  borderHex,
  size = 38,
  starred = false,
  muted = false,
}: {
  hex: string;
  borderHex: string;
  size?: number;
  starred?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className="f0-belt-disc relative grid shrink-0 place-items-center rounded-full bg-card"
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, size * 0.066)}px solid ${hex === "#E8EAF0" ? borderHex : hex}`,
        opacity: muted ? 0.8 : 1,
      }}
      aria-hidden
    >
      <span
        className="block rounded-[2px]"
        style={{
          width: Math.round(size * 0.42),
          height: Math.max(3, Math.round(size * 0.13)),
          backgroundColor: hex === "#E8EAF0" ? borderHex : hex,
        }}
      />
      {starred && (
        <span
          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full text-[7px] leading-none"
          style={{
            width: 14,
            height: 14,
            background: "var(--accent-solid)",
            color: "var(--accent-on)",
            border: "2px solid var(--paper)",
          }}
        >
          ★
        </span>
      )}
    </span>
  );
}

/** Board 22's filled belt chip — the belt's own colour behind its own name. */
export function BeltChip({
  hex,
  onHex,
  label,
}: {
  hex: string;
  onHex: string;
  label: string;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded px-1.5 py-px font-display text-[9px] font-bold"
      style={{ backgroundColor: hex, color: onHex }}
    >
      {label}
    </span>
  );
}

/* ── Mini meter ───────────────────────────────────────────────────────────
   The 40×6 bar on board 22's footer bar. Same law as every other progress
   fill: it is the ACTION colour, riding --accent-solid so it is club orange /
   family gold / FTA metallic with no branch at the call site. */
export function MiniMeter({ pct, width = 40 }: { pct: number; width?: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span
      className="block h-1.5 shrink-0 overflow-hidden rounded-full bg-sand"
      style={{ width }}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${w}%` }}
      />
    </span>
  );
}
