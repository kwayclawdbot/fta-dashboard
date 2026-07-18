// Week-themed collectible-card styling for flashcards. Maps each program week
// to a storybook art header + a color accent. Weeks beyond 6 wrap sensibly.

export interface WeekTheme {
  img: string;
  label: string;
  bar: string; // gradient for the art overlay / accent bar
  chip: string; // tailwind classes for the small week chip
  ring: string; // border accent
  glow: string; // rgba used for burst / flip glow
}

export const WEEK_THEMES: Record<number, WeekTheme> = {
  1: {
    img: "/art/funds-story.jpg",
    label: "Money Basics",
    bar: "linear-gradient(135deg, #38BDF8, #0EA5E9)",
    chip: "bg-chip-sky text-sky-800",
    ring: "border-sky-300",
    glow: "56,189,248",
  },
  2: {
    img: "/art/books-story.jpg",
    label: "Reading Charts",
    bar: "linear-gradient(135deg, #FBBF24, #F59E0B)",
    chip: "bg-chip-amber text-gold-800",
    ring: "border-gold-300",
    glow: "245,158,11",
  },
  3: {
    img: "/art/pool-story.jpg",
    label: "Patterns",
    bar: "linear-gradient(135deg, #34D399, #16A34A)",
    chip: "bg-chip-green text-green-700",
    ring: "border-green-300",
    glow: "34,197,94",
  },
  4: {
    img: "/art/kitchen-story.jpg",
    label: "Setups & Zones",
    bar: "linear-gradient(135deg, #F59E0B, #B45309)",
    chip: "bg-chip-amber text-gold-800",
    ring: "border-gold-400",
    glow: "217,119,6",
  },
  5: {
    img: "/art/tug-of-war.jpg",
    label: "The Rules",
    bar: "linear-gradient(135deg, #F87171, #DC2626)",
    chip: "bg-red-500/10 text-red-600",
    ring: "border-red-300",
    glow: "220,38,38",
  },
  6: {
    img: "/art/levelup-story.jpg",
    label: "Trade Ready",
    bar: "linear-gradient(135deg, #FCD34D, #D97706)",
    chip: "bg-chip-amber text-gold-800",
    ring: "border-gold-400",
    glow: "251,191,36",
  },
};

export function weekTheme(week: number | null | undefined): WeekTheme {
  if (!week || !WEEK_THEMES[week]) {
    const keys = Object.keys(WEEK_THEMES).map(Number);
    const idx = ((week ?? 1) - 1) % keys.length;
    return WEEK_THEMES[keys[idx]] || WEEK_THEMES[1];
  }
  return WEEK_THEMES[week];
}
