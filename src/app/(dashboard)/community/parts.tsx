"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
import type { FeedPost, PostPosition } from "@/lib/feed";
import { useNewMemberHints } from "@/components/hints/useNewMemberHints";

/**
 * COMMUNITY — surface-specific primitives (canvas rebuild B, board: Community).
 *
 * The generic vocabulary (DisplayHead, SectionRule, Ledger, TextAction…) lives in
 * @/components/f0/parts and is imported, not re-implemented. What stays here is
 * what only the Community board needs: the mode control, the stance/cashtag/
 * credibility marks, presence, and the founding-state note.
 *
 * Everything obeys the locked system:
 *   · LIGHT PRIMARY — warm sand/cream ground. The ONE dark object on the whole
 *     surface is the Live tab's f0-hero-field room. Nothing here paints dark.
 *   · NO generic card containers. Objects get identity from RULES, TYPE SCALE
 *     and MONO LEDGER captions — never from border + shadow + bg-card.
 *   · COLOUR LAW: green/red = PRICE only · lime = COMMUNITY SENTIMENT only ·
 *     orange = BRAND + ACTION only. Orange TEXT uses the gold-* ramp (themed);
 *     orange FILLS keep bg-volt-500. The volt ramp is frozen across themes.
 *   · REAL DATA ONLY. Counts render from the live club contract; below the
 *     participation floor the surface renders designed founding copy instead of
 *     a raw small number. There is no path in this file that prints "0 online".
 */

/* ── orientation: new member vs returning ─────────────────────────────────── */
/**
 * THE BOARD IS THE PAGE.
 *
 * Owner law: Community is not a landing page. A returning member opens it and
 * lands in content — no hero title, no "This week in the Club" masthead eating
 * the first viewport. A NEW member still gets the orienting title, because they
 * genuinely do not yet know what this surface is.
 *
 * The condition is keyed off state that ALREADY EXISTS. No column was invented:
 *
 *   1. ACCOUNT AGE — `useNewMemberHints` (the app's existing first-run
 *      mechanism) resolves `profiles.created_at` and reports whether the account
 *      is inside the 24h new-member window. It also carries the permanent
 *      per-key dismissal in localStorage (`fic-hint-community-board`), so a new
 *      member who dismisses the title never sees it again on that device.
 *
 *   2. PARTICIPATION — the orientation disappears EARLY, before the 24h window
 *      closes, the moment the member actually takes part. Both signals come free
 *      with the server feed seed, so this costs zero extra queries:
 *        · `feed_posts.author_id === me.id` in the seeded feed → they have
 *          written an entry;
 *        · a row in `post_likes` for this viewer (`likedByMe`) → they have
 *          backed one.
 *      Someone who posts in their first hour stops being told what the board is.
 *
 * The 60-row feed window can't produce a false "new": account age gates it, so a
 * member older than a day never sees the title regardless of what the window
 * holds. Participation only ever REMOVES the title, never restores it.
 *
 * No "?" reopen affordance is rendered for this spot on purpose. The hints
 * convention keeps help reachable behind a small icon, but a permanent icon at
 * the top of the board is exactly the standing chrome the owner asked to remove,
 * and the board explains itself once you are standing in it.
 */
export function useClubOrientation({
  meId,
  posts,
  likedByMe,
}: {
  meId: string | null | undefined;
  posts: FeedPost[];
  likedByMe: string[] | Set<string>;
}): { ready: boolean; show: boolean } {
  const hint = useNewMemberHints("community-board");

  const likedCount =
    likedByMe instanceof Set ? likedByMe.size : (likedByMe?.length ?? 0);
  const hasParticipated =
    !!meId &&
    (likedCount > 0 || posts.some((p) => p.author?.id === meId));

  return { ready: hint.ready, show: hint.show && !hasParticipated };
}

/* ── segmented control ────────────────────────────────────────────────────── */
/**
 * The premium segmented control that carries Feed / Lounge / Live.
 *
 * A recessed sand track with ONE raised paper segment. The raised segment is
 * paper (never ink, never orange) so the surface keeps exactly one dark object —
 * the on-air room field — and so orange stays reserved for actions. The active
 * segment earns a volt tick to its left: the accent marks the selection without
 * flooding a navigation control with brand colour.
 *
 * DARK flips the MECHANISM, not the composition (same move the foundation makes
 * for club2-card): in light the track is darker than the page and the active pill
 * is the page colour, so the pill reads RAISED. On a near-black page `bg-paper`
 * would vanish into the ground, so dark inverts it — the track drops to `card`
 * and the active pill lifts to `sand`. Selected still means "closer to you" in
 * both themes.
 */
export interface Segment {
  id: string;
  label: string;
  /** Renders a red on-air pulse in place of the volt tick (live rooms only). */
  onAir?: boolean;
  count?: number;
}

export function SegmentedControl({
  segments,
  active,
  onSelect,
  ariaLabel,
}: {
  segments: Segment[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex w-full items-stretch gap-1 rounded-full bg-sand/55 p-1 dark:bg-card"
    >
      {segments.map((s) => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect(s.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 font-display text-[12px] font-bold uppercase tracking-[0.1em] transition-all duration-200 ${
              isActive
                ? "bg-paper text-ink shadow-soft dark:bg-sand"
                : "text-soft hover:text-ink"
            }`}
          >
            {s.onAir ? (
              <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
            ) : (
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                  isActive ? "bg-volt-500" : "bg-transparent"
                }`}
              />
            )}
            <span className="truncate">{s.label}</span>
            {s.count != null && s.count > 0 && (
              <span className="font-mono text-[10px] font-bold tabular-nums text-soft">
                {s.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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

/**
 * The presence rail — "who's here" as a mono ledger line, not a stat box.
 *
 * ABOVE the floor it states the real numbers. BELOW the floor (the founding
 * club: a handful of members, a handful of moves a day) it never prints the raw
 * count. It reframes: the faces that exist are shown, and the copy says the room
 * is small ON PURPOSE. There is no branch that can render "0 online".
 *
 * `compact` is the returning-member form: a single ~18px line with a smaller
 * face stack, sitting directly under the mode control so the first ENTRY starts
 * high in the viewport. With the masthead gone this is the only standing chrome
 * the board carries, so it has to earn its line.
 */
export function PresenceRail({
  presence,
  founding,
  compact = false,
}: {
  presence: ClubPresence | null;
  /** Founding line used below the floor / with no data. */
  founding: string;
  compact?: boolean;
}) {
  const faces =
    presence?.avatars.map((a) => ({ name: null, avatar_url: a.url })) ?? [];
  const atScale = presence?.floorMet ?? false;

  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      {faces.length > 0 && (
        <AvatarStack faces={faces} max={compact ? 4 : 5} size={compact ? "xs" : "sm"} />
      )}
      <p
        className={`min-w-0 font-mono leading-tight tracking-wide text-soft ${
          compact ? "text-[10.5px]" : "text-[11px]"
        }`}
      >
        {atScale && presence ? (
          <>
            <span className="font-bold text-ink tabular-nums">
              {presence.connectedMinds}
            </span>{" "}
            members
            {presence.actionsToday > 0 && (
              <>
                {" · "}
                <span className="font-bold text-ink tabular-nums">
                  {presence.actionsToday}
                </span>{" "}
                moves today
              </>
            )}
          </>
        ) : (
          founding
        )}
      </p>
    </div>
  );
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
