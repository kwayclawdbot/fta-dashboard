import { computeStreak as computeStreakImpl } from "@/lib/streak";
import {
  StreakFlame,
  markForSlug,
  type CourseMarkKey,
  type CourseMarkTone,
} from "@/components/art";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN KIT — the shared vocabulary of the Learn boards (canvas 08 / 20 / 21).

   Every object here is drawn from the owner's mockup rather than interpreted:
   the script wordmark, the path identity, the mono stat rail, the warm two-up
   cards. Nothing in this file reads or writes data. (The mockup's per-path
   pastel hue has since been retired — see "Path identity" below for why.)

   THEMING: the boards are the Club light palette, which IS this app's token set
   (paper #F7F4EF · ink #1A1614 · soft #7B7369 · sand #E5DFD5 · card #FFFFFF ·
   accent #FF7A1A). So the board colours are expressed as tokens, and each
   path hue is mixed against `--card` / `--ink`, which is what makes the dark
   twin (dark-r1-c0) come out right off the same markup.
   ══════════════════════════════════════════════════════════════════════════ */

// The board sets every "learn" wordmark in Kaushan Script. Loaded here rather
// than in the root layout so the face belongs to this surface and nothing else
// pays for it.
/** The standard product wordmark, set in the shared Sora display register. */
export function LearnWordmark({
  children = "learn",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`block font-display text-[34px] font-bold leading-none tracking-tight text-ink sm:text-[38px] ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Path identity ─────────────────────────────────────────────────────────
   The board used to give each path its own hue — orange, lime, purple, sky —
   rotated by index. That is four unrelated colours carrying meaning they do
   not have, and two of them are already spoken for: in this app green means
   price up and orange means the one action on the screen. A path tinted lime
   was reading, at a glance, as a gain. Worse, the hue rotated by POSITION, so
   the same path changed colour the moment a course was published above it.

   So the rainbow is gone. Every path now sits on ONE warm surface, and what
   tells them apart is the MARK — a drawn object with its own identity, which
   is stable per slug and survives reordering. Colour is left to say the one
   thing it says everywhere else in the app.

   The mark table is explicit for every published slug; `markForSlug` is the
   deterministic fallback (a stable hash, never a random draw) for anything
   seeded later. */

const PATH_MARKS: Record<string, CourseMarkKey> = {
  // FIC / Club foundations — the same ground, three registers.
  "fic-adult-foundations": "foundations",
  "fic-teens-foundations": "foundations",
  "fic-kids-foundations": "foundations",
  // FTA — six weeks of structure, sweeps and execution: chart work.
  "fta-trade-ready": "charts",
  // Legacy catalog.
  "stocks-options": "foundations",
  forex: "charts",
  futures: "charts",
  crypto: "money",
  "candlestick-patterns": "charts",
  "chart-patterns": "charts",
  // Trading foundations track.
  "tf-100": "foundations",
  "tf-101": "charts",
  "tf-102": "discipline",
  "tf-103": "discipline",
  // Investing track — all four are about what money does over time.
  "inv-101": "money",
  "inv-102": "money",
  "inv-200": "money",
  "inv-201": "money",
};

/** The mark a path is drawn with. Explicit where we know it, hashed where we
 *  don't — either way the same slug always draws the same object. */
export function pathMark(slug: string): CourseMarkKey {
  return PATH_MARKS[(slug || "").toLowerCase()] ?? markForSlug(slug);
}

/** FTA surfaces are the metallic register; everything else is Club. */
export function pathTone(program?: string | null): CourseMarkTone {
  return program === "fta" ? "fta" : "club";
}

/** The one warm field every path row sits on — no per-path hue. It is the
 *  band's warmth held back a step, so a path row reads as a sibling of the
 *  unit band rather than competing with it. */
export function pathFieldStyle(): React.CSSProperties {
  return {
    background:
      "linear-gradient(100deg, color-mix(in srgb, var(--accent-solid) 10%, var(--card)) 0%, var(--card) 72%)",
    borderColor: "color-mix(in srgb, var(--accent-solid) 20%, var(--sand))",
  };
}

/* ── Glyphs ───────────────────────────────────────────────────────────────
   `lessons.node_kind` (migration 162) is real data, and the board draws it as
   an emoji. Same column, drawn the way it was mocked. */

export type NodeGlyphKind = "lesson" | "game" | "challenge" | "boss" | "mission";

export const KIND_GLYPH: Record<NodeGlyphKind, string> = {
  lesson: "📖",
  game: "🎮",
  challenge: "🎯",
  boss: "🏆",
  mission: "📍",
};

/* ── Stat rail ────────────────────────────────────────────────────────────
   Board 20's header: ember streak · ⚡ lifetime XP. Both are read off real rows
   by the caller; this only draws them. `null` renders nothing rather than a
   zero that was never measured. */

export function StatRail({
  streak,
  xp,
  className = "",
}: {
  streak: number | null;
  xp: number | null;
  className?: string;
}) {
  if (streak == null && xp == null) return null;
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {streak != null && streak > 0 && (
        // The drawn ember, not the emoji. The rail sets its own mono numeral,
        // so the mark ships countless (`showCount={false}`) and the figure
        // stays in the rail's type — one flame, two type systems, no clash.
        <span className="flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums text-gold-700">
          <StreakFlame streak={streak} size={14} showCount={false} />
          {streak}
          <span className="sr-only"> day streak</span>
        </span>
      )}
      {xp != null && (
        <span
          className="font-mono text-[11px] font-semibold tabular-nums"
          style={{ color: "color-mix(in srgb, #D99A00 78%, var(--ink))" }}
        >
          <span aria-hidden>⚡ </span>
          {xp.toLocaleString()} XP
        </span>
      )}
    </div>
  );
}

/* ── Warm band ────────────────────────────────────────────────────────────
   The unit band on board 20 and the streak card on board 08 are the same
   object at two angles: a warm accent-tinted field with a hairline. */

export function warmFieldStyle(angle = "120deg"): React.CSSProperties {
  return {
    background: `linear-gradient(${angle}, color-mix(in srgb, var(--accent-solid) 24%, var(--card)) 0%, color-mix(in srgb, var(--accent-solid) 8%, var(--card)) 100%)`,
    borderColor: "color-mix(in srgb, var(--accent-solid) 34%, var(--sand))",
  };
}

/** Mono eyebrow, board spec: 8.5–9.5px, .14–.16em, uppercase, gold. */
export function MonoEyebrow({
  children,
  tone = "gold",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "gold" | "soft" | "ink";
  className?: string;
}) {
  const colour =
    tone === "gold" ? "text-gold-700" : tone === "ink" ? "text-ink" : "text-soft";
  return (
    <p
      className={`font-mono text-[10px] font-semibold uppercase tracking-[0.15em] ${colour} ${className}`}
    >
      {children}
    </p>
  );
}

/* ── Streak ───────────────────────────────────────────────────────────────
   THERE IS ONE STREAK. This used to be a second implementation with its own
   day-key helper and its own qualifying-event rule (lesson completions only),
   which is why /courses said 0 while /progress said 1 for the same member on
   the same day. The definition — and the code — now live in `src/lib/streak.ts`
   and every surface reads it from there.

   Kept as a named re-export because callers already import `dayStreak` from the
   learn kit; it is now literally the canonical function, not a copy of it. */

export { computeStreak, dayKeyLocal } from "@/lib/streak";

export function dayStreak(
  isoTimestamps: (string | null | undefined)[],
  nowMs: number
): number {
  return computeStreakImpl(isoTimestamps, nowMs).days;
}
