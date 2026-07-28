/**
 * ART — the drawn-object layer.
 *
 * Every mark in here is inline SVG built to one illustration brief: a single
 * 2px non-scaling line, ONE flat fill, no gradients-as-decoration, no external
 * images, legible in both themes, and nothing that could plausibly have come
 * from an icon set. These exist to replace emoji and coloured lozenges — the
 * two places where the app's visual language was being written by the member's
 * operating system instead of by the design system.
 *
 * Import from here, not from the individual files, so the family stays visible
 * as a family.
 */

export { default as Belt, BeltMark } from "./Belt";
export type { BeltProps } from "./Belt";

export { default as StreakFlame, StreakPip } from "./StreakFlame";
export type { StreakFlameProps } from "./StreakFlame";

export {
  default as CourseMark,
  CourseMarkRing,
  FoundationsMark,
  ChartsMark,
  MoneyMark,
  DisciplineMark,
  markForSlug,
} from "./CourseMarks";
export type { CourseMarkProps, CourseMarkKey, CourseMarkTone } from "./CourseMarks";

export {
  EmptyPinBoard,
  EmptyTwoArrows,
  EmptyBeltOnPeg,
  EmptyStateNote,
} from "./EmptyStates";
export type { EmptyArtProps } from "./EmptyStates";
