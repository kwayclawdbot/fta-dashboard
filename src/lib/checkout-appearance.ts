import type { Appearance } from "@stripe/stripe-js";

/**
 * Stripe Elements Appearance mapped to the Cheat Code Club (club-mode) design
 * tokens so the Payment Element's card fields read as native to our warm-cream /
 * volt-orange checkout — the ONLY Stripe-rendered surface on the page. Light and
 * dark variants mirror the app's club light/dark token blocks.
 */
export function buildAppearance(dark: boolean): Appearance {
  const t = dark
    ? {
        card: "#191C22",
        input: "#0F1115",
        border: "#2A2E37",
        ink: "#F2F4F8",
        soft: "#9AA0AD",
      }
    : {
        card: "#FBF3E4",
        input: "#FFFFFF",
        border: "#E4D5BB",
        ink: "#0F1115",
        soft: "#5C5648",
      };

  return {
    theme: "flat",
    variables: {
      colorPrimary: "#FF6A00",
      colorBackground: t.card,
      colorText: t.ink,
      colorTextSecondary: t.soft,
      colorDanger: "#DC2626",
      fontFamily: "Sora, system-ui, -apple-system, sans-serif",
      fontSizeBase: "15px",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        backgroundColor: t.input,
        border: `1px solid ${t.border}`,
        boxShadow: "none",
        padding: "12px 14px",
      },
      ".Input:focus": {
        border: "1px solid #FF6A00",
        boxShadow: "0 0 0 3px rgba(255,106,0,0.15)",
      },
      ".Input::placeholder": { color: t.soft },
      ".Label": {
        color: t.soft,
        fontWeight: "600",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      },
      ".Tab, .Block": {
        backgroundColor: t.input,
        border: `1px solid ${t.border}`,
        boxShadow: "none",
      },
      ".Tab:hover": { border: "1px solid #FFA766" },
      ".Tab--selected": {
        border: "1px solid #FF6A00",
        boxShadow: "0 0 0 1px #FF6A00",
      },
      ".Error": { color: "#DC2626" },
    },
  };
}

/** Google-hosted Sora so the iframe's field text matches our headline font. */
export const STRIPE_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap",
  },
];
