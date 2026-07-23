// Platform → Simbot cross-links (reverse of the Simbot→lesson links that ship
// inside public/sim/index.html as window.FTA_LESSON_LINKS). Maps a teens course
// lesson id to a Simbot practice anchor. When the lesson viewer renders a lesson
// present in this map, it surfaces a "Practice this in Simbot" call-to-action.
//
// The sim currently opens on its Lesson list; a future enhancement can accept
// `?lesson=<anchor>` on /simulator/simbot to deep-open — at which point the link
// href becomes `/simulator/simbot?lesson=${PRACTICE_IN_SIMBOT[lessonId]}`.
export const PRACTICE_IN_SIMBOT: Record<string, string> = {
  "f1c00000-0002-0002-0002-000000000001": "fight",     // Supply & Demand
  "f1c00000-0002-0002-0004-000000000001": "time",      // Candle Anatomy
  "f1c00000-0002-0002-0005-000000000001": "read",      // Reading a Candle
  "f1c00000-0002-0002-0007-000000000001": "swings",    // Trend Structure
  "f1c00000-0002-0002-0008-000000000001": "levels",    // Support & Resistance
  "f1c00000-0002-0002-0009-000000000001": "range",     // Role Reversal & Breakouts
  "f1c00000-0002-0003-0001-000000000001": "engulf",    // Chart Patterns
  "f1c00000-0002-0005-0001-000000000001": "sizing",    // 1-2% Rule & Sizing
  "f1c00000-0002-0006-0001-000000000001": "replay",    // Paper Trading Setup
  "f1c00000-0002-0006-0002-000000000001": "checklist", // First-Trade Checklist
};

export function hasSimbotPractice(lessonId: string): boolean {
  return Boolean(PRACTICE_IN_SIMBOT[lessonId]);
}
