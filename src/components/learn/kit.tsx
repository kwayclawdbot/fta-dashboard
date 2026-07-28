import { Kaushan_Script } from "next/font/google";
import { computeStreak as computeStreakImpl } from "@/lib/streak";
import { StreakFlame } from "@/components/art";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN KIT — the shared vocabulary of the Learn boards (canvas 08 / 20 / 21).

   Every object here is drawn from the owner's mockup rather than interpreted:
   the script wordmark, the per-path hue + glyph, the mono stat rail, the warm
   two-up cards. Nothing in this file reads or writes data.

   THEMING: the boards are the Club light palette, which IS this app's token set
   (paper #F7F4EF · ink #1A1614 · soft #7B7369 · sand #E5DFD5 · card #FFFFFF ·
   accent #FF7A1A). So the board colours are expressed as tokens, and each
   path hue is mixed against `--card` / `--ink`, which is what makes the dark
   twin (dark-r1-c0) come out right off the same markup.
   ══════════════════════════════════════════════════════════════════════════ */

// The board sets every "learn" wordmark in Kaushan Script. Loaded here rather
// than in the root layout so the face belongs to this surface and nothing else
// pays for it.
const script = Kaushan_Script({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/** The script wordmark ("learn"), board 08 + board 20 head. */
export function LearnWordmark({
  children = "learn",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`${script.className} block text-[34px] leading-none text-ink sm:text-[38px] ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Path identity ─────────────────────────────────────────────────────────
   Board 08 gives each path its own hue and glyph (orange · lime · purple ·
   sky). The first is the register accent, so Family reads gold and Club reads
   orange without a second palette. */

export const PATH_HUES = [
  "var(--accent-solid)",
  "#A3E635",
  "#A66BFF",
  "#5BC4F0",
] as const;

export const PATH_GLYPHS = ["📊", "📈", "🎯", "🧱"] as const;

export function pathHue(index: number): string {
  return PATH_HUES[index % PATH_HUES.length];
}

export function pathGlyph(index: number): string {
  return PATH_GLYPHS[index % PATH_GLYPHS.length];
}

/** The wash the board lays across a path row: hue → paper, left to right. */
export function pathFieldStyle(hue: string): React.CSSProperties {
  return {
    background: `linear-gradient(90deg, color-mix(in srgb, ${hue} 26%, var(--card)) 0%, var(--card) 76%)`,
    borderColor: `color-mix(in srgb, ${hue} 42%, var(--sand))`,
  };
}

/** The percentage numeral: the hue, pulled toward ink so it stays legible on
 *  cream AND on the dark twin off one declaration. */
export function pathInk(hue: string): React.CSSProperties {
  return { color: `color-mix(in srgb, ${hue} 80%, var(--ink))` };
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
