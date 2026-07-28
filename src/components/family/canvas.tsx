import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { familyRegister } from "@/components/family/register";

/* ══════════════════════════════════════════════════════════════════════════
   FAMILY MODE — the drawn surface vocabulary for F1–F9.

   SOURCE OF TRUTH: .planning/design-project-v2/"Cheat Code Family.dc.html"
   plus boards/family-r{0,1}-c{0,1,2}.png. The family canvas is built from WARM
   ROUNDED CARDS on warm paper: a white card with a 1px sand hairline and a
   16px radius, warm accent-tinted "field" cards for the things that reward,
   a kai-blue card wherever Kai speaks, mini stat tiles in rows of three to
   five, conic progress rings, and pill chips. This file is that set.

   An earlier pass reinterpreted the canvas as ledgers and hairlines. That was
   rejected: build what is drawn. Cards, rings and equal-column stat tiles are
   the intended language here.

   COLOUR: Family Mode is warm gold. `familyGold` pins the accent for the whole
   subtree so a family screen renders gold even when the shell is in club
   register. Every surface colour below is a token (--card/--sand/--ink/--soft/
   --accent-solid/--kai-blue), so the whole set re-maps in dark with no variant.

   COLOUR LAW, unchanged: green/red = PRICE only · lime = COMMUNITY SENTIMENT
   only · gold/orange = BRAND + ACTION only · kai blue = Kai/AI only. Where the
   board paints a chip green ("🛡 SAFE") or red ("● LIVE") for decoration, it
   renders here in the accent register instead — same object, legal colour.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The family colour pin. `familyRegister` re-points the F0 primitives' hardcoded
 * volt stops at whatever accent the shell is in; this goes one step further and
 * pins the accent ITSELF to the constant metallic-gold ramp (--fg*), so Family
 * Mode is warm gold on every surface in this lane regardless of shell register.
 * Nothing outside the subtree is affected and no token is redefined globally.
 */
export const familyGold: CSSProperties = {
  ...familyRegister,
  "--accent-a": "var(--fg400)",
  "--accent-b": "var(--fg500)",
  "--accent-solid": "var(--fg500)",
  "--accent-strong": "var(--fg400)",
  // Orange TEXT rides the gold ramp (the volt ramp is frozen across themes).
  // Pinning g600/g700 to the metallic ramp keeps `text-gold-700` warm gold here
  // even when the shell register is club — and lifts it in dark, where the base
  // --g700 (#B45309) would be brown-on-brown.
  "--g600": "var(--fg600)",
  "--g700": "var(--fg700)",
} as CSSProperties;

/* ── Card fields ──────────────────────────────────────────────────────────
   The board's four card grounds. Written as color-mix over the live tokens so
   a "warm" card is accent-tinted card stock in BOTH themes rather than a baked
   #FFEEDD that goes bone-white on a #17120B page. */

const WARM_FIELD: CSSProperties = {
  background:
    "linear-gradient(120deg, color-mix(in srgb, var(--accent-solid) 16%, var(--card)) 0%, var(--card) 72%)",
  borderColor: "color-mix(in srgb, var(--accent-solid) 32%, var(--sand))",
};

const LEAD_FIELD: CSSProperties = {
  background:
    "linear-gradient(120deg, color-mix(in srgb, var(--accent-solid) 22%, var(--card)) 0%, var(--card) 66%)",
  borderColor: "var(--accent-solid)",
};

const KAI_FIELD: CSSProperties = {
  background: "color-mix(in srgb, var(--kai-blue) 9%, var(--card))",
  borderColor: "color-mix(in srgb, var(--kai-blue) 30%, var(--sand))",
};

export type CardTone = "plain" | "warm" | "lead" | "kai";

function toneStyle(tone: CardTone): CSSProperties | undefined {
  if (tone === "warm") return WARM_FIELD;
  if (tone === "lead") return LEAD_FIELD;
  if (tone === "kai") return KAI_FIELD;
  return undefined;
}

/** Every family screen's root. One place that owns the register + the measure. */
export function FamilySurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div style={familyGold} className={`mx-auto w-full max-w-3xl ${className}`}>
      {children}
    </div>
  );
}

/* ── The card ─────────────────────────────────────────────────────────────
   The single most-repeated object on the canvas: 16px radius, 1px sand
   hairline, white card stock, soft lift. `tone` swaps the ground for the
   warm reward field, the active-step field, or Kai's blue. */
export function FamilyCard({
  tone = "plain",
  className = "",
  children,
  style,
}: {
  tone?: CardTone;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "plain" ? "border-sand bg-card shadow-soft" : ""
      } ${className}`}
      style={{ ...toneStyle(tone), ...style }}
    >
      {children}
    </div>
  );
}

/* ── Masthead ─────────────────────────────────────────────────────────────
   The board sets three of the nine headlines in a script face ("learn
   together", "family watchlist", "parent corner"). There is no script in this
   type system, so the equivalent warmth is carried by dropping the uppercase
   display treatment to sentence case and marking ONE word with the drawn
   accent underline (or circle) — never a phrase, or the mark stops meaning
   anything. */
export function FamilyMast({
  eyebrow,
  title,
  mark,
  markStyle = "underline",
  lede,
  aside,
  size = "lg",
}: {
  eyebrow?: string;
  /** Rendered before the marked word. */
  title: string;
  /** The ONE word that carries the annotation. */
  mark?: string;
  markStyle?: "underline" | "circle";
  lede?: ReactNode;
  aside?: ReactNode;
  /** `md` is the drill-down step (F3's "Jaylen's guardrails"). */
  size?: "lg" | "md";
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow tone="accent">{eyebrow}</Eyebrow>}
        <h1
          className={`mt-2 font-display font-extrabold text-ink ${
            size === "lg" ? "text-display-1" : "text-display-2"
          }`}
        >
          {title}
          {mark && (
            <>
              {" "}
              <span
                className={markStyle === "circle" ? "f0-circle-mark" : "f0-underline-mark"}
              >
                {mark}
              </span>
            </>
          )}
        </h1>
        {lede && <p className="mt-3 max-w-md text-[14px] leading-relaxed text-soft">{lede}</p>}
      </div>
      {aside && <div className="shrink-0 pt-1">{aside}</div>}
    </header>
  );
}

/* ── Labels ───────────────────────────────────────────────────────────────
   The board's small-caps mono label. Gold above a settings group, soft above
   a content section. No hairline: the card edges already do the dividing. */
export function Eyebrow({
  children,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "accent" | "kai";
  className?: string;
}) {
  const toneCls =
    tone === "accent" ? "text-gold-700" : tone === "kai" ? "text-kai-blue" : "text-soft";
  return (
    <p
      className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] ${toneCls} ${className}`}
    >
      {children}
    </p>
  );
}

/** A section label with an optional trailing action, as drawn. */
export function SectionLabel({
  children,
  action,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  tone?: "soft" | "accent";
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <Eyebrow tone={tone}>{children}</Eyebrow>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Back line ────────────────────────────────────────────────────────────*/
export function BackLine({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="f0-focus f0-press inline-flex items-center gap-1.5 text-[13px] font-display font-bold text-soft transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────
   The board's pills: 🛡 FAMILY, PAPER, ON, DONE, LEVEL 9, WIN = ⚡ +50.

   The board paints the safety chips green and the LIVE chip red. Both are
   decorative uses of colours the law reserves (green/red = price), so the
   family build renders them in the accent register — the chip still reads as
   a state, and a percentage on the same screen keeps its one meaning. */
export function Chip({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "accent" | "solid" | "kai" | "ink";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] leading-none";
  if (tone === "accent") {
    return (
      <span
        className={`${base} text-gold-700 ${className}`}
        style={{
          background: "color-mix(in srgb, var(--accent-solid) 15%, transparent)",
          borderColor: "color-mix(in srgb, var(--accent-solid) 34%, transparent)",
        }}
      >
        {children}
      </span>
    );
  }
  if (tone === "solid") {
    return (
      <span className={`${base} border-transparent bg-accent text-night-950 ${className}`}>
        {children}
      </span>
    );
  }
  if (tone === "kai") {
    return (
      <span
        className={`${base} text-kai-blue ${className}`}
        style={{
          background: "color-mix(in srgb, var(--kai-blue) 12%, transparent)",
          borderColor: "color-mix(in srgb, var(--kai-blue) 32%, transparent)",
        }}
      >
        {children}
      </span>
    );
  }
  if (tone === "ink") {
    return (
      <span className={`${base} border-transparent bg-ink text-paper ${className}`}>
        {children}
      </span>
    );
  }
  return (
    <span className={`${base} border-sand bg-card text-soft ${className}`}>{children}</span>
  );
}

/* ── XP tag ───────────────────────────────────────────────────────────────
   The canvas's "⚡ +50". XP rewards an action, so it is brand/ACTION colour by
   law — never green (price) and never lime (community sentiment). */
export function XpTag({
  amount,
  prefix = "+",
  suffix = " XP",
  className = "",
}: {
  amount: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums text-gold-700 ${className}`}
    >
      <span aria-hidden>⚡</span>
      {prefix}
      {amount.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ── Stat tiles ───────────────────────────────────────────────────────────
   The board's 3–5 up mini cards: mono numeral over a small label. Drawn as
   equal columns inside a card (F2 paper portfolio, F3 digest) or standing on
   the paper as their own cards (F5, F9). `inset` switches between the two. */
export interface StatTile {
  value: string;
  label: string;
  /** `price` tones are the ONLY ones that may go green/red. */
  tone?: "ink" | "accent" | "price-up" | "price-down" | "sentiment";
}

export function StatTiles({
  items,
  inset = false,
  className = "",
}: {
  items: StatTile[];
  /** Sunken tiles for use INSIDE a card; default is a standalone card each. */
  inset?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {items.map((s) => (
        <div
          key={s.label}
          className={`min-w-0 flex-1 rounded-lg px-2 py-3 text-center ${
            inset ? "bg-paper" : "border border-sand bg-card shadow-soft"
          }`}
        >
          <p
            className={`font-mono text-[16px] font-semibold tabular-nums ${toneClass(s.tone)}`}
          >
            {s.value}
          </p>
          <p className="mt-1 text-[10.5px] leading-tight text-soft">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function toneClass(tone?: StatTile["tone"]): string {
  switch (tone) {
    case "accent":
      return "text-gold-700";
    case "price-up":
      return "text-price-up";
    case "price-down":
      return "text-price-down";
    case "sentiment":
      return "text-sentiment";
    default:
      return "text-ink";
  }
}

/* ── Ring ─────────────────────────────────────────────────────────────────
   The conic progress donut the board draws on the belt step (F2), the "up
   next" lesson (F5) and the teen avatar (F9). A ring, not a gauge with a
   needle: it carries one percentage and the number sits in the middle. */
export function Ring({
  pct: value,
  label,
  ariaLabel,
  size = 56,
  thickness = 6,
  children,
  className = "",
}: {
  pct: number;
  /** Centre text when no children are supplied. */
  label?: string;
  ariaLabel: string;
  size?: number;
  thickness?: number;
  children?: ReactNode;
  className?: string;
}) {
  const w = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const inner = size - thickness * 2;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent-solid) 0 ${w}%, var(--sand) ${w}% 100%)`,
      }}
    >
      <div
        className="grid place-items-center overflow-hidden rounded-full bg-card"
        style={{ width: inner, height: inner }}
      >
        {children ?? (
          <span className="font-mono text-[10px] font-semibold tabular-nums text-ink">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Bar ──────────────────────────────────────────────────────────────────
   Drawn everywhere on the canvas — the family level, the challenge standings,
   skill mastery, mission progress. Action colour by law. */
export function Bar({
  pct: value,
  label,
  valueLabel,
  tone = "accent",
  height = 7,
  className = "",
}: {
  pct: number;
  label?: ReactNode;
  valueLabel?: ReactNode;
  /** `sentiment` is lime — legal only for a community reading. */
  tone?: "accent" | "sentiment";
  height?: number;
  className?: string;
}) {
  const w = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`min-w-0 ${className}`}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <span className="truncate text-[12.5px] font-display font-bold text-ink">
              {label}
            </span>
          )}
          {valueLabel && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-soft">
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <div
        className="overflow-hidden rounded-full bg-sand"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(w)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === "string" ? label : undefined}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            tone === "sentiment" ? "bg-sentiment-fill" : ""
          }`}
          style={{
            width: `${w}%`,
            ...(tone === "accent"
              ? {
                  background:
                    "linear-gradient(90deg, var(--accent-solid), var(--accent-strong))",
                }
              : null),
          }}
        />
      </div>
    </div>
  );
}

/* ── Row card ─────────────────────────────────────────────────────────────
   The board's settings/list card: one card, rows divided by a hairline
   INSIDE it (F2 guardrails, F3 all three groups + recent changes, F8 the
   conversation list). */
export function RowCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-sand bg-card px-4 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Row({
  icon,
  label,
  sub,
  right,
  children,
  className = "",
}: {
  icon?: ReactNode;
  label?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  /** Extra content beneath the label block (a rail, a note, a bar). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-sand/70 py-3 last:border-b-0 ${className}`}
    >
      {icon && <span className="shrink-0 text-[15px] leading-none">{icon}</span>}
      <div className="min-w-0 flex-1">
        {label && (
          <div className="font-display text-[13.5px] font-bold text-ink">{label}</div>
        )}
        {sub && <div className="mt-0.5 text-[11.5px] leading-snug text-soft">{sub}</div>}
        {children}
      </div>
      {right && <div className="shrink-0 self-center">{right}</div>}
    </div>
  );
}

/** A navigating row — the same object with the board's chevron. */
export function FamilyLink({
  href,
  label,
  sub,
  meta,
  icon,
}: {
  href: string;
  label: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="f0-focus group flex items-center gap-3 border-b border-sand/70 py-3 last:border-b-0"
    >
      {icon && <span className="shrink-0 text-[15px] leading-none">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13.5px] font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[11.5px] leading-snug text-soft">{sub}</p>}
      </div>
      {meta && <span className="shrink-0 text-[11.5px] text-soft">{meta}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  );
}

/* ── Actions ──────────────────────────────────────────────────────────────
   Two of them, both drawn: the solid accent pill ("Continue ⚡+30", "Play",
   "Remind us") and the quiet text action ("Edit", "See all"). */
export function PillAction({
  href,
  onClick,
  external,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  external?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const cls = `f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[12.5px] font-extrabold text-night-950 ${className}`;
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

export function TextAction({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`f0-focus f0-press inline-flex items-center gap-1 font-display text-[12.5px] font-bold text-gold-700 transition-colors hover:text-gold-600 ${className}`}
    >
      {children}
    </Link>
  );
}

/* ── Founding state ───────────────────────────────────────────────────────
   MANDATORY on every screen. The canvas is drawn at "126 families" and week
   30; a real household on day one is three people and no history. This is the
   designed below-floor state — a stated absence with a way out, drawn as a
   dashed SLOT so it can never be mistaken for a filled card. */
export function FoundingState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="f0-tile-empty rounded-xl p-4">
      <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-soft">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Honest absence note ──────────────────────────────────────────────────
   Used wherever the canvas draws a number this product cannot truthfully
   produce. It states WHY rather than printing a zero. */
export function AbsenceNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 max-w-lg text-[11.5px] leading-relaxed text-soft">{children}</p>
  );
}

/* ── Kai note ─────────────────────────────────────────────────────────────
   "Kai for kids" (F1) and the mini-lesson offer (F4). Kai blue and nothing
   else on the screen wears it. */
export function KaiNote({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={KAI_FIELD}
    >
      <span className="f0-kai-mark h-7 w-7 shrink-0 text-[13px]" aria-hidden>
        🐋
      </span>
      <div className="min-w-0 flex-1 text-[12px] leading-snug text-soft">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Formatters ───────────────────────────────────────────────────────────*/

/** Percent formatter that keeps an honest em-dash for a missing reading. */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function priceTone(n: number | null | undefined): "ink" | "price-up" | "price-down" {
  if (n == null) return "ink";
  return n >= 0 ? "price-up" : "price-down";
}
