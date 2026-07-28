"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
import type { PostPosition } from "@/lib/feed";

/**
 * COMMUNITY — surface-specific primitives (canvas rebuild B, board: Community).
 *
 * The DRAWN vocabulary (masthead, tab strip, pills, cards, room tiles, the
 * stripe field, the marker notes) lives in ./board and is the system this
 * surface is built from. What stays HERE is the small set of marks that are not
 * on the boards but are the club's own language: the stance label, the cashtag,
 * the credibility tag, the avatar stack, the real presence read, the
 * founding-state note and the one orange action.
 *
 * The old mode chrome that used to live in this file — the recessed segmented
 * control and the mono presence rail — is GONE. The boards draw a masthead and
 * an underlined tab strip, and that is what ships (./board).
 *
 * What still holds:
 *   · LIGHT GROUND, warm paper, with the boards' near-black fields as the
 *     deliberate dark objects (the pinned thread, the on-air room, YOUR TURN).
 *   · CARDS ARE THE UNIT — the boards are built from them, so the surface is.
 *   · COLOUR: the price tokens (`text-price-up` / `text-price-down`) stay PRICE
 *     ONLY. Orange TEXT uses the gold-* ramp (themed); orange FILLS keep
 *     bg-volt-500, and the volt ramp is frozen across themes. The boards' room
 *     tiles and stance fills are literals precisely so they can never be
 *     mistaken for a quote by the stylesheet.
 *   · REAL DATA ONLY. Counts render from the live club contract; below the
 *     participation floor the surface renders designed founding copy instead of
 *     a raw small number. There is no path in this file that prints "0 online".
 */

/* ── stance label ─────────────────────────────────────────────────────────── */
/**
 * BULL / BEAR / NEUTRAL — the member's declared stance on a tagged ticker.
 *
 * STANCE COLOUR DECISION (the colour law forces this): green and red are
 * reserved for PRICE, so the stance label may not borrow them even though
 * bull/bear are conventionally green/red everywhere else in finance. Stance is
 * COMMUNITY SENTIMENT, and lime is the community-sentiment channel — so the
 * whole stance vocabulary is keyed to lime and direction is carried by WEIGHT,
 * not by hue:
 *     BULL    → charged lime bar + lime-700 label   (the positive pole)
 *     BEAR    → hollow ink bar + ink/70 label       (the negative pole, drawn
 *                                                    as lime's absence)
 *     NEUTRAL → sand bar + soft label
 * It is a typographic mark on a hairline — a mono caps label with a 2px vertical
 * rule — not a chip, so it sits inside an editorial entry without becoming a
 * pill wall.
 */
const STANCE: Record<PostPosition, { label: string; bar: string; text: string }> = {
  bull: { label: "Bull", bar: "bg-lime-500 dark:bg-lime-400", text: "text-lime-700 dark:text-lime-400" },
  neutral: { label: "Neutral", bar: "bg-sand", text: "text-soft" },
  bear: { label: "Bear", bar: "bg-ink/45", text: "text-ink/70" },
};

export function StanceLabel({
  position,
  size = "md",
}: {
  position: PostPosition;
  size?: "sm" | "md";
}) {
  const s = STANCE[position];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={`inline-block w-[2px] rounded-full ${s.bar} ${
          size === "sm" ? "h-2.5" : "h-3"
        }`}
      />
      <span
        className={`font-mono font-bold uppercase tracking-[0.14em] ${s.text} ${
          size === "sm" ? "text-[9.5px]" : "text-[10px]"
        }`}
      >
        {s.label}
      </span>
    </span>
  );
}

/* ── cashtag ──────────────────────────────────────────────────────────────── */
/**
 * An inline $CASHTAG. Mono, ink-weighted, with the `$` in teal — teal is the
 * established supporting accent for ticker identity in this app and is outside
 * the three reserved channels, so a ticker reference never reads as price,
 * sentiment or action.
 */
export function Cashtag({ ticker, size = "md" }: { ticker: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`font-mono font-bold tracking-tight text-ink underline decoration-teal-500/40 decoration-2 underline-offset-[3px] transition-colors group-hover/tag:decoration-teal-500 ${
        size === "sm" ? "text-[11px]" : "text-[12.5px]"
      }`}
    >
      <span className="text-teal-600 dark:text-teal-300">$</span>
      {ticker}
    </span>
  );
}

/* ── credibility tag ──────────────────────────────────────────────────────── */
/**
 * The author's earned standing, rendered as a mono caps tag beside their name.
 * Real data only: belt comes from the batched XP already loaded for the feed;
 * coach/admin authority overrides it. Free/FIC tier is NOT surfaced here — a
 * paid tier is not credibility.
 */
export function CredibilityTag({
  role,
  xp,
}: {
  role?: string | null;
  xp?: number;
}) {
  const authority = role === "coach" || role === "admin" ? role.toUpperCase() : null;
  const belt = xp && xp > 0 ? beltForXp(xp).short : null;
  const label = authority ?? (belt ? `${belt} belt` : null);
  if (!label) return null;
  return (
    <span
      className={`font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] ${
        authority ? "text-gold-700" : "text-soft"
      }`}
    >
      {label}
    </span>
  );
}

/* ── avatar stack ─────────────────────────────────────────────────────────── */
/** Overlapping real member faces. Renders nothing when there are no faces. */
export function AvatarStack({
  faces,
  max = 5,
  ring = "ring-paper",
  label,
  size = "sm",
}: {
  faces: { name?: string | null; avatar_url?: string | null }[];
  max?: number;
  /** Ring colour so the stack reads on whichever ground it sits on. */
  ring?: string;
  label?: string;
  size?: "xs" | "sm";
}) {
  if (!faces.length) return null;
  return (
    <div className={`flex ${size === "xs" ? "-space-x-1.5" : "-space-x-2"}`} aria-label={label}>
      {faces.slice(0, max).map((f, i) => (
        <Avatar
          key={i}
          name={f.name ?? "Member"}
          avatarUrl={f.avatar_url ?? undefined}
          size={size}
          className={`ring-2 ${ring}`}
        />
      ))}
    </div>
  );
}

/* ── club presence ────────────────────────────────────────────────────────── */
/**
 * Real club presence, from GET /api/club/collective (the cached club_metrics_kv
 * 'collective' row): the roster size, today's real action count, a bounded
 * non-kid avatar roster, and `floorMet` — false below FLOORS.connectedMinds.
 *
 * The hook NEVER invents anything. A 401 (signed out), a network failure, or a
 * cold cache all degrade to null, and every consumer renders founding copy for
 * null exactly as it does below the floor.
 */
export interface ClubPresence {
  connectedMinds: number;
  actionsToday: number;
  floorMet: boolean;
  avatars: { id: string; url: string }[];
}

export function useClubPresence(): ClubPresence | null {
  const [presence, setPresence] = useState<ClubPresence | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch("/api/club/collective", {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const j = (await res.json()) as Partial<ClubPresence>;
        if (!mounted) return;
        setPresence({
          connectedMinds: Number(j.connectedMinds) || 0,
          actionsToday: Number(j.actionsToday) || 0,
          floorMet: Boolean(j.floorMet),
          avatars: Array.isArray(j.avatars) ? j.avatars : [],
        });
      } catch {
        /* stay null → founding copy */
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);
  return presence;
}

/* ── founding note ────────────────────────────────────────────────────────── */
/**
 * The founding-state object. NOT a dashed empty-state box — it is an entry in
 * the same ledger as everything else: an eyebrow rule, a display-3 line that
 * takes a position, a mono ledger caption carrying the REAL small numbers
 * (owned, not hidden), and an optional action. A room with three posts in it
 * should read as a room that started, not as a room that failed.
 */
export function FoundingNote({
  eyebrow,
  headline,
  body,
  ledger,
  action,
}: {
  eyebrow: string;
  headline: string;
  body?: string;
  /** Mono caption fragments — real counts only, e.g. ["3 entries", "2 voices"]. */
  ledger?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="py-7">
      <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
        {eyebrow}
      </p>
      <h3 className="mt-2 max-w-[22ch] font-display text-display-3 font-extrabold text-ink">
        {headline}
      </h3>
      {body && (
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-soft">
          {body}
        </p>
      )}
      {ledger && ledger.length > 0 && (
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft">
          {ledger.join("  ·  ")}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── action ───────────────────────────────────────────────────────────────── */
/** The one place orange is allowed: an action. Pill, volt field, never on price. */
export function VoltAction({
  children,
  onClick,
  href,
  ghost = false,
  onDark = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Quiet variant — volt type on a tinted field, for secondary actions. */
  ghost?: boolean;
  /**
   * Secondary action sitting INSIDE the f0-hero-field. The field is obsidian in
   * BOTH themes, so its contents must be theme-INVARIANT: `text-gold-700` flips
   * with the PAGE, which would drop it to #C24400 on obsidian in light mode
   * (~3:1). Cream on a translucent cream field is correct on the field in either
   * theme. This is why the hero's secondary action is not the shared TextAction.
   */
  onDark?: boolean;
}) {
  const cls = `inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-[12px] font-bold uppercase tracking-[0.08em] transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0 ${
    onDark
      ? "bg-[#F7F3EA]/12 text-[#F7F3EA] hover:bg-[#F7F3EA]/20"
      : ghost
        ? "bg-volt-500/12 text-gold-700 hover:bg-volt-500/18"
        : "bg-volt-500 dark:bg-volt-600 text-white hover:bg-volt-600"
  }`;
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
