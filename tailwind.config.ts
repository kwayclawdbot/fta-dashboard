import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        midnight: {
          50: "#101828",
          100: "#1D2939",
          200: "#344054",
          300: "#475467",
          400: "#5B6472",
          500: "#667085",
          600: "#98A2B3",
          700: "#E4DBC6",
          800: "#EAE2D0",
          900: "#FFFFFF",
          950: "#FBF7EF",
        },
        night: {
          50: "#F0F2F5",
          300: "#75819D",
          500: "#192D5C",
          700: "#0F1B37",
          800: "#0A1225",
          900: "#050912",
          950: "#04060C",
        },
        paper: "#FBF7EF",
        ink: "#101828",
        soft: "#5B6472",
        sand: "#EAE2D0",
        "chip-amber": "#FEF3C7",
        "chip-sky": "#E0F2FE",
        "chip-green": "#DCFCE7",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        "slide-up": "slide-up 0.6s ease-out forwards",
        "fade-in": "fade-in 0.8s ease-out forwards",
        "count-up": "count-up 2s ease-out forwards",
        "glow": "glow 2s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
        "shake": "shake 0.5s ease-in-out",
        "width-grow": "width-grow 1.5s ease-out forwards",
      },
      keyframes: {
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(251, 191, 36, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(251, 191, 36, 0.6), 0 0 80px rgba(251, 191, 36, 0.2)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(40px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "glow": {
          "0%": { textShadow: "0 0 10px rgba(251, 191, 36, 0.3)" },
          "100%": { textShadow: "0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.2)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "width-grow": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
