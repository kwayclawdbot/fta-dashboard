import tokensJson from "@/ui-v3/tokens.json";
import V3ThemeToggle from "./V3ThemeToggle";
import styles from "./v3.module.css";

/**
 * ui-v3 token proof sheet.
 *
 * Not a screen — a specimen. It renders the extracted design system straight
 * out of tokens.json (roles, counts, derivation reasons) painted with the
 * variables from tokens.css, so a regeneration is visible immediately and any
 * old-style leakage into /v3 shows up as an obvious mismatch.
 */

type Role = { value: string; count: number; why: string };
type FontRole = { value: string; name: string; count: number; why: string };

type TokensFile = {
  sources: string[];
  themes: Record<
    string,
    {
      source: string;
      declarationCount: number;
      artboards: string[];
      roles: Record<string, Role>;
      fonts: { roles: Record<string, FontRole | null> };
      counts: Record<string, number>;
      scales: {
        fontSizes: Record<string, number>;
        radii: Record<string, number>;
        spacing: Record<string, number>;
        shadows: Record<string, number>;
        fontWeights: Record<string, number>;
      };
    }
  >;
};

const tokens = tokensJson as unknown as TokensFile;
const dark = tokens.themes.dark;
const light = tokens.themes.light;

const varName = (role: string) => `--${role}`;

export default function V3TokenSpecimen() {
  const roleNames = Object.keys(dark.roles);
  const fontRoles = Object.entries(dark.fonts.roles).filter(
    (entry): entry is [string, FontRole] => entry[1] !== null,
  );
  const sizes = Object.keys(dark.scales.fontSizes).sort(
    (a, b) => parseFloat(a) - parseFloat(b),
  );
  const radii = Object.keys(dark.scales.radii).sort(
    (a, b) => parseFloat(a) - parseFloat(b),
  );
  const shadows = Object.keys(dark.scales.shadows);
  const spacing = Object.keys(dark.scales.spacing).sort(
    (a, b) => parseFloat(a) - parseFloat(b),
  );

  return (
    <main className={styles.page}>
      <V3ThemeToggle />
      <header className={styles.header}>
        <p className={styles.eyebrow}>ui-v3 · generated tokens</p>
        <h1 className={styles.title}>
          Cheat Code <span className={styles.titleAccent}>Design System</span>
        </h1>
        <p className={styles.lede}>
          Extracted mechanically from {dark.artboards.length} artboards across two
          mockups ({dark.declarationCount.toLocaleString()} CSS declarations parsed
          per theme). Nothing on this page is hand-picked — regenerate with{" "}
          <code className={styles.code}>node scripts/extract-mockup-tokens.mjs</code>.
        </p>
        <ul className={styles.sourceList}>
          {tokens.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Semantic roles</h2>
        <p className={styles.sectionNote}>
          Left chip is the live CSS variable. Flip the theme control to confirm the
          light twin resolves from the same variable name.
        </p>
        <div className={styles.roleGrid}>
          {roleNames.map((role) => (
            <div key={role} className={styles.role}>
              <span
                className={styles.swatch}
                style={{ background: `var(${varName(role)})` }}
              />
              <div className={styles.roleBody}>
                <code className={styles.roleName}>{varName(role)}</code>
                <span className={styles.roleValues} data-numeric>
                  {dark.roles[role]?.value} · {light.roles[role]?.value ?? "same"}
                </span>
                <span className={styles.roleWhy}>{dark.roles[role]?.why}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Type</h2>
        <div className={styles.typeList}>
          {fontRoles.map(([role, font]) => (
            <div key={role} className={styles.typeRow}>
              <div className={styles.typeMeta}>
                <code className={styles.roleName}>--font-{role}</code>
                <span className={styles.roleWhy}>{font.why}</span>
              </div>
              <p
                className={styles.typeSample}
                style={{
                  fontFamily: `var(--font-${role})`,
                  fontStyle: role === "display" ? "italic" : "normal",
                  fontWeight: role === "display" ? 800 : 400,
                  textTransform: role === "display" ? "uppercase" : "none",
                }}
              >
                {font.name} — Buy the dip 24.50
              </p>
            </div>
          ))}
        </div>

        <div className={styles.scaleRows}>
          {sizes.map((size) => (
            <div key={size} className={styles.scaleRow}>
              <code className={styles.scaleLabel}>
                --fs-{String(parseFloat(size)).replace(".", "-")}
              </code>
              <span
                className={styles.scaleSample}
                style={{ fontSize: `var(--fs-${String(parseFloat(size)).replace(".", "-")})` }}
              >
                {size} · used {dark.scales.fontSizes[size]}×
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Surfaces, radii, shadows</h2>
        <div className={styles.radiusRow}>
          {radii.map((r) => (
            <div
              key={r}
              className={styles.radiusChip}
              style={{ borderRadius: `var(--radius-${String(parseFloat(r)).replace(".", "-")})` }}
            >
              <span data-numeric>{r}</span>
            </div>
          ))}
        </div>
        <div className={styles.shadowRow}>
          {shadows.map((shadow, i) => (
            <div key={shadow} className={styles.shadowChip} style={{ boxShadow: `var(--shadow-${i + 1})` }}>
              <code className={styles.scaleLabel}>--shadow-{i + 1}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Spacing in heavy rotation</h2>
        <div className={styles.spacingList}>
          {spacing.map((s) => (
            <div key={s} className={styles.spacingRow}>
              <code className={styles.scaleLabel}>
                --space-{String(parseFloat(s)).replace(".", "-")}
              </code>
              <span
                className={styles.spacingBar}
                style={{ width: `calc(var(--space-${String(parseFloat(s)).replace(".", "-")}) * 6)` }}
              />
              <span className={styles.roleWhy} data-numeric>
                {s} · {dark.scales.spacing[s]}×
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.roleWhy}>
          Screens are translated from the artboard DOM, never restyled from old
          components. See src/ui-v3/README.md.
        </p>
      </footer>
    </main>
  );
}
