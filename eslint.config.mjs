import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * ui-v3 IMPORT WALL
 * -----------------------------------------------------------------------------
 * The v3 rebuild is a strangler: a fresh component tree (src/ui-v3) rendered by
 * a fresh route prefix (src/app/v3) that must never inherit the old look. The
 * failure mode being engineered against is an agent "reusing" an old component
 * or an old design-system class and quietly dragging the old design back in, so
 * the boundary is enforced here rather than documented and hoped for.
 *
 * Allowed from v3: src/ui-v3, src/lib, src/hooks (data/API layers), next/*,
 * react, third-party packages. Everything else under src/ is off limits.
 */
const V3_FILES = ["src/ui-v3/**/*.{ts,tsx}", "src/app/v3/**/*.{ts,tsx}"];

const FORBIDDEN_IMPORT_PATTERNS = [
  {
    group: [
      "@/components",
      "@/components/*",
      "@/components/**",
      "**/src/components/*",
      "**/src/components/**",
    ],
    message:
      "ui-v3 must not import old components. Translate the screen from the mockup artboard DOM into src/ui-v3/components instead (see src/ui-v3/README.md).",
  },
  {
    group: [
      // Old route trees — their page/layout/client components carry the old design.
      "@/app",
      "@/app/*",
      "@/app/**",
      "**/src/app/(admin)/**",
      "**/src/app/(auth)/**",
      "**/src/app/(dashboard)/**",
      "**/src/app/club/**",
      "**/src/app/challenge/**",
      "**/src/app/checkout/**",
      "**/src/app/shop/**",
      "**/src/app/free-class/**",
      "**/src/app/r/**",
      "**/src/app/dev/**",
      // Relative escapes out of src/app/v3 or src/ui-v3 into a sibling tree.
      "../*",
      "../../*",
      "../../../*",
    ],
    message:
      "ui-v3 must not import from the old src/app route tree. Keep v3 screens self-contained under src/app/v3 + src/ui-v3; shared data access belongs in src/lib or src/hooks.",
  },
  {
    group: ["@/lib/theme", "**/src/lib/theme", "@/lib/motion", "**/src/lib/motion"],
    message:
      "ui-v3 has its own token/theme layer (src/ui-v3/tokens.css + base.css). Do not pull in the old theme or motion providers.",
  },
];

/*
 * Old design-system CLASS NAMES must not appear in v3 markup either — an import
 * rule cannot see a `className` string. This covers the hand-written global
 * classes in globals.css and the old Tailwind color theme.
 */
const OLD_CLASS_RE =
  "/(^|\\s)(f0-|club2-|club-|chip-metal|text-gradient|glow-border|cta-button|night-island|stack-row|testimonial-card|urgency-bar|ticker-row|kai-gradient|price-strike|section-divider|chart-frame)|(^|\\s)(bg|text|border|from|to|via)-(midnight|paper|ink|sand|card|gold|volt|teal|kai)(-|\\s|$)/";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: V3_FILES,
    rules: {
      "no-restricted-imports": ["error", { patterns: FORBIDDEN_IMPORT_PATTERNS }],
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name="className"] Literal[value=${OLD_CLASS_RE}]`,
          message:
            "Old design-system class name in ui-v3. v3 styling comes from src/ui-v3 tokens (CSS Modules or var(--token)) — never from globals.css classes or the old Tailwind color theme.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
