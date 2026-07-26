// FIC Learning World brand tokens — warm sand / volt / teal / Kai-blue
export const COLORS = {
  sand: "#F4ECDD",
  sandDeep: "#E9DEC8",
  card: "#FBF6EC",
  ink: "#211E18",
  inkSoft: "#5C564B",
  volt: "#FF6B1A",
  teal: "#12B3A3",
  kai: "#3E74E8",
  kaiDeep: "#2A55B8",
  up: "#12B3A3",
  down: "#E4572E",
  white: "#FFFFFF",
} as const;

export const FONT = {
  display: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  body: '"Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

// Responsive scale helper: size relative to the smaller viewport edge
export const scaler = (width: number, height: number) => {
  const base = Math.min(width, height);
  return (frac: number) => Math.round(base * frac);
};
