#!/usr/bin/env node
/**
 * extract-mockup-tokens.mjs
 * ---------------------------------------------------------------------------
 * Mechanically derives the ui-v3 design system from the design mockups in
 * `.planning/design-project-v2/mockups/`:
 *
 *   Cheat Code App.dc.html        -> dark theme (default)
 *   Cheat Code App Light.dc.html  -> light theme (overrides)
 *
 * The mockups are design-doc HTML exports: one <style> block plus ~1200 lines
 * of INLINE `style="..."` attributes and SVG fill/stroke attributes. Every
 * value below is read out of those declarations and counted — nothing here is
 * eyeballed or hand-tuned.
 *
 * Emits:
 *   src/ui-v3/tokens.css   CSS custom properties, dark default + light override
 *   src/ui-v3/tokens.json  raw extraction (every value + usage counts + the
 *                          derivation reason for each semantic role)
 *
 * Re-runnable: mockups change -> `node scripts/extract-mockup-tokens.mjs`.
 *
 * Usage:
 *   node scripts/extract-mockup-tokens.mjs [--quiet]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MOCKUP_DIR = join(ROOT, ".planning", "design-project-v2", "mockups");
const OUT_DIR = join(ROOT, "src", "ui-v3");

const THEMES = [
  { name: "dark", file: "Cheat Code App.dc.html" },
  { name: "light", file: "Cheat Code App Light.dc.html" },
];

const QUIET = process.argv.includes("--quiet");
const log = (...a) => {
  if (!QUIET) console.log(...a);
};

/* ========================================================================== *
 * 1. Parsing — pull every CSS declaration out of a mockup file
 * ========================================================================== */

/** Property -> role bucket. Drives which colors are backgrounds vs text etc. */
function bucketFor(prop) {
  if (prop === "background" || prop.startsWith("background")) return "bg";
  if (prop === "color" || prop === "-webkit-text-fill-color") return "text";
  if (prop.startsWith("border") || prop.startsWith("outline")) return "border";
  if (prop === "box-shadow" || prop === "text-shadow" || prop === "filter")
    return "shadow";
  if (prop === "fill") return "fill";
  if (prop === "stroke") return "stroke";
  return "other";
}

const COLOR_RE =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/g;

/** Normalize any color literal to a canonical string + rgba components. */
function parseColor(raw) {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return {
      key: "#" + hex.slice(0, 6).toUpperCase() + (hex.length === 8 ? hex.slice(6, 8).toUpperCase() : ""),
      r,
      g,
      b,
      a,
      opaque: a === 1,
    };
  }
  const nums = s
    .slice(s.indexOf("(") + 1, s.lastIndexOf(")"))
    .split(",")
    .map((n) => parseFloat(n.trim()));
  const [r, g, b] = nums;
  const a = nums.length > 3 ? nums[3] : 1;
  const key =
    a === 1
      ? "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("")
      : `rgba(${r}, ${g}, ${b}, ${a})`;
  return { key, r, g, b, a, opaque: a === 1 };
}

/** HSL-ish helpers used only for ROLE INFERENCE (never for output values). */
function hsl({ r, g, b }) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0,
    s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h, s, l };
}

/** Split a declaration list ("a:1;b:2") into [prop, value] pairs. */
function splitDecls(text) {
  const out = [];
  for (const chunk of text.split(";")) {
    const i = chunk.indexOf(":");
    if (i < 0) continue;
    const prop = chunk.slice(0, i).trim().toLowerCase();
    const value = chunk.slice(i + 1).trim();
    if (!prop || !value) continue;
    out.push([prop, value]);
  }
  return out;
}

function extractDeclarations(html) {
  const decls = [];

  // 1. inline style="..." attributes (the bulk of the mockup)
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    decls.push(...splitDecls(m[1]));
  }

  // 2. <style> blocks — strip selectors, keep declaration bodies
  for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    for (const body of m[1].matchAll(/\{([^{}]*)\}/g)) {
      decls.push(...splitDecls(body[1]));
    }
  }

  // 3. SVG presentation attributes (icon colors live here, not in style="")
  for (const m of html.matchAll(
    /\b(fill|stroke)="(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))"/g,
  )) {
    decls.push([m[1].toLowerCase(), m[2]]);
  }

  return decls;
}

/** The 23 phone artboards carry the canonical page background + frame border. */
function extractArtboards(html) {
  const boards = [];
  for (const m of html.matchAll(
    /data-screen-label="([^"]*)"\s+style="([^"]*)"/g,
  )) {
    boards.push({ label: m[1], decls: splitDecls(m[2]) });
  }
  return boards;
}

/* ========================================================================== *
 * 2. Aggregation
 * ========================================================================== */

function bump(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function toObj(map) {
  return Object.fromEntries(sortedEntries(map));
}

const PX_RE = /(-?\d*\.?\d+)px/g;

function analyze(html) {
  const decls = extractDeclarations(html);

  const colorTotal = new Map(); // key -> count
  const colorByBucket = new Map(); // bucket -> Map(key -> count)
  const colorMeta = new Map(); // key -> parsed color

  const fontFamilies = new Map();
  const fontSizes = new Map();
  const fontWeights = new Map();
  const lineHeights = new Map();
  const letterSpacings = new Map();
  const radii = new Map();
  const shadows = new Map();
  const spacing = new Map();
  const gradients = new Map();

  for (const [prop, value] of decls) {
    const bucket = bucketFor(prop);

    for (const raw of value.match(COLOR_RE) || []) {
      const c = parseColor(raw);
      colorMeta.set(c.key, c);
      bump(colorTotal, c.key);
      if (!colorByBucket.has(bucket)) colorByBucket.set(bucket, new Map());
      bump(colorByBucket.get(bucket), c.key);
    }

    if (/gradient\(/.test(value)) bump(gradients, value);

    switch (prop) {
      case "font-family":
        bump(fontFamilies, value.replace(/\s+/g, " ").trim());
        break;
      case "font-size":
        bump(fontSizes, value);
        break;
      case "font-weight":
        bump(fontWeights, value);
        break;
      case "line-height":
        bump(lineHeights, value);
        break;
      case "letter-spacing":
        bump(letterSpacings, value);
        break;
      case "border-radius":
        bump(radii, value);
        break;
      case "box-shadow":
        bump(shadows, value);
        break;
      default:
        break;
    }

    // Spacing: every px number appearing in a padding/margin/gap declaration.
    if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(prop)) {
      for (const m of value.matchAll(PX_RE)) bump(spacing, `${m[1]}px`);
    }
  }

  // First background declared in document order = the presentation canvas.
  let firstBackground = null;
  for (const [prop, value] of decls) {
    if (prop === "background" || prop === "background-color") {
      const c = (value.match(COLOR_RE) || [])[0];
      if (c) {
        firstBackground = parseColor(c).key;
        break;
      }
    }
  }

  // Co-declaration pass: which `color:` sits in the same inline style as which
  // background. Gives us the real "on <color>" foregrounds, not a guess.
  const onColor = new Map(); // bgKey -> Map(colorKey -> count)
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    const d = splitDecls(m[1]);
    const bgDecl = d.find(([p]) => p === "background" || p === "background-color");
    const fgDecl = d.find(([p]) => p === "color");
    if (!bgDecl || !fgDecl) continue;
    const bgC = (bgDecl[1].match(COLOR_RE) || [])[0];
    const fgC = (fgDecl[1].match(COLOR_RE) || [])[0];
    if (!bgC || !fgC) continue;
    const bgKey = parseColor(bgC).key;
    const fgKey = parseColor(fgC).key;
    if (!onColor.has(bgKey)) onColor.set(bgKey, new Map());
    bump(onColor.get(bgKey), fgKey);
  }

  // Artboard-derived anchors (page bg, frame border, screen radius).
  const boardBg = new Map();
  const boardBorder = new Map();
  const boardRadius = new Map();
  const boards = extractArtboards(html);
  for (const b of boards) {
    for (const [prop, value] of b.decls) {
      if (prop === "background" || prop === "background-color") {
        const c = (value.match(COLOR_RE) || [])[0];
        if (c) bump(boardBg, parseColor(c).key);
      }
      if (prop === "border") {
        const c = (value.match(COLOR_RE) || [])[0];
        if (c) bump(boardBorder, parseColor(c).key);
      }
      if (prop === "border-radius") bump(boardRadius, value);
    }
  }

  return {
    declarationCount: decls.length,
    artboards: boards.map((b) => b.label),
    colorTotal,
    colorByBucket,
    colorMeta,
    fontFamilies,
    fontSizes,
    fontWeights,
    lineHeights,
    letterSpacings,
    radii,
    shadows,
    spacing,
    gradients,
    boardBg,
    boardBorder,
    boardRadius,
    firstBackground,
    onColor,
  };
}

/* ========================================================================== *
 * 3. Semantic role inference — every rule below is stated + logged
 * ========================================================================== */

function bucketMap(a, bucket) {
  return a.colorByBucket.get(bucket) || new Map();
}

function rank(map, filter = () => true) {
  return sortedEntries(map).filter(([k, v]) => filter(k, v));
}

function inferRoles(a, themeName) {
  const roles = {}; // name -> { value, count, why }
  const meta = a.colorMeta;
  const bg = bucketMap(a, "bg");
  const text = bucketMap(a, "text");
  const border = bucketMap(a, "border");
  const opaque = (k) => meta.get(k)?.opaque;
  const sat = (k) => hsl(meta.get(k)).s;
  const lum = (k) => hsl(meta.get(k)).l;
  const hue = (k) => hsl(meta.get(k)).h;
  const used = new Set();

  const set = (name, key, why) => {
    if (!key) return;
    roles[name] = { value: key, count: a.colorTotal.get(key) || 0, why };
    used.add(key);
  };

  // --bg : the background declared on the phone artboards themselves.
  const pageBg = sortedEntries(a.boardBg)[0];
  set(
    "bg",
    pageBg?.[0],
    `most common background on the ${a.artboards.length} [data-screen-label] artboards (${pageBg?.[1]} boards)`,
  );

  // The presentation canvas BEHIND the artboards is the first background
  // declared in document order (the page wrapper). It is design-doc chrome, not
  // app UI, so it is excluded from the surface candidates below.
  const canvas = a.firstBackground;

  // --accent : most-used SATURATED color at mid lightness.
  const accentCand = rank(
    a.colorTotal,
    (k) => opaque(k) && sat(k) > 0.5 && lum(k) > 0.25 && lum(k) < 0.75,
  )[0];
  set(
    "accent",
    accentCand?.[0],
    `highest-usage saturated color (s>0.5, 0.25<l<0.75) — ${accentCand?.[1]} uses across ${[...a.colorByBucket]
      .filter(([, m]) => m.has(accentCand?.[0]))
      .map(([b]) => b)
      .join("/")} roles`,
  );

  // --text : most-used `color:` value.
  const textRank = rank(text, (k) => opaque(k) && !used.has(k));
  set("text", textRank[0]?.[0], `most frequent \`color:\` value (${textRank[0]?.[1]} uses)`);
  const textL = lum(roles.text?.value ?? "#000000");

  // --text-muted / --text-dim / --text-faint : the 3 next most-used desaturated
  // `color:` values, ordered by lightness distance from --text (nearest =
  // secondary copy, furthest = the faintest label). Ordering by distance rather
  // than raw usage is what keeps the light and dark twins in the same order —
  // the mockups are structurally identical, so the counts pair up exactly.
  const textRest = rank(text, (k) => opaque(k) && !used.has(k) && sat(k) < 0.4)
    .slice(0, 3)
    .sort((x, y) => Math.abs(lum(x[0]) - textL) - Math.abs(lum(y[0]) - textL));
  ["text-muted", "text-dim", "text-faint"].forEach((name, i) => {
    set(
      name,
      textRest[i]?.[0],
      `top-3 desaturated \`color:\` values, step ${i + 1} away from --text in lightness (${textRest[i]?.[1]} uses)`,
    );
  });

  // --surface / --surface-2 : the 2 most-used opaque desaturated backgrounds
  // that are neither the page bg, the presentation canvas, nor the accent.
  const surfaceRank = rank(bg, (k) => opaque(k) && !used.has(k) && k !== canvas && sat(k) < 0.45);
  ["surface", "surface-2"].forEach((name, i) => {
    set(
      name,
      surfaceRank[i]?.[0],
      `#${i + 1} most used opaque desaturated background that is not --bg/--accent/canvas (${surfaceRank[i]?.[1]} background uses)`,
    );
  });

  // --border : the frame color on the artboards themselves (also the single
  // most used border color in the document, by a factor of 10).
  const boardBorder = sortedEntries(a.boardBorder)[0];
  const borderRank = rank(border, (k) => opaque(k));
  set(
    "border",
    boardBorder?.[0] || borderRank[0]?.[0],
    boardBorder
      ? `border color on the artboard frames (${boardBorder[1]} boards, ${borderRank[0]?.[1]} border uses overall)`
      : `most frequent border color (${borderRank[0]?.[1]} uses)`,
  );

  // --positive / --negative : hue-selected market colors, most used in each band.
  const green = rank(
    a.colorTotal,
    (k) => opaque(k) && sat(k) > 0.25 && hue(k) >= 75 && hue(k) <= 175,
  )[0];
  set("positive", green?.[0], `highest-usage green-band color (hue 75-175, s>0.25) — ${green?.[1]} uses`);

  const red = rank(
    a.colorTotal,
    (k) =>
      opaque(k) &&
      sat(k) > 0.3 &&
      (hue(k) <= 20 || hue(k) >= 320) &&
      k !== roles.accent?.value,
  )[0];
  set("negative", red?.[0], `highest-usage red/pink-band color (hue >=320 or <=20, s>0.3) — ${red?.[1]} uses`);

  // --info : blue band (Kai).
  const blue = rank(
    a.colorTotal,
    (k) => opaque(k) && sat(k) > 0.3 && hue(k) >= 175 && hue(k) <= 250,
  )[0];
  set("info", blue?.[0], `highest-usage blue-band color (hue 175-250, s>0.3) — ${blue?.[1]} uses`);

  // --violet : purple band (circles / premium).
  const violet = rank(
    a.colorTotal,
    (k) => opaque(k) && sat(k) > 0.3 && hue(k) > 250 && hue(k) < 320,
  )[0];
  set("violet", violet?.[0], `highest-usage violet-band color (hue 250-320, s>0.3) — ${violet?.[1]} uses`);

  // --accent-strong / --accent-soft : the accent hue family (within 18 degrees,
  // s>0.4, used >= 5 times) split by CONTRAST AGAINST --bg, not by absolute
  // lightness — that is what makes the dark and light twins the same role
  // (dark steps the accent lighter, light steps it darker, both "stronger").
  if (roles.accent) {
    const aH = hue(roles.accent.value);
    const bgLum = lum(roles.bg?.value ?? "#000000");
    const contrast = (k) => Math.abs(lum(k) - bgLum);
    const accentContrast = contrast(roles.accent.value);
    const family = rank(
      a.colorTotal,
      (k) =>
        opaque(k) &&
        sat(k) > 0.4 && // > 0.4 keeps the warm NEUTRALS (paper / off-white, s~0.3) out
        Math.abs(hue(k) - aH) <= 18 &&
        k !== roles.accent.value &&
        (a.colorTotal.get(k) || 0) >= 5,
    );
    const strong = family.filter(([k]) => contrast(k) > accentContrast)[0];
    const soft = family.filter(([k]) => contrast(k) < accentContrast)[0];
    set(
      "accent-strong",
      strong?.[0],
      `accent hue family, most used member with MORE contrast against --bg than --accent (${strong?.[1]} uses)`,
    );
    set(
      "accent-soft",
      soft?.[0],
      `accent hue family, most used member with LESS contrast against --bg than --accent — the accent-tinted surface/border (${soft?.[1]} uses)`,
    );
  }

  // --gold : the belt / award band, distinct from the accent hue.
  const gold = rank(
    a.colorTotal,
    (k) => opaque(k) && sat(k) > 0.4 && hue(k) >= 35 && hue(k) <= 60 && !used.has(k),
  )[0];
  set("gold", gold?.[0], `highest-usage gold-band color (hue 35-60, s>0.4) — ${gold?.[1]} uses`);

  // --accent-on : the foreground painted ON accent fills. Read straight out of
  // the mockups: inline styles that set BOTH background:<accent> and color:<x>.
  const onAccent = a.onColor.get(roles.accent?.value);
  const onPick = onAccent ? sortedEntries(onAccent)[0] : null;
  set(
    "accent-on",
    onPick?.[0] || roles.bg?.value,
    onPick
      ? `most frequent \`color:\` co-declared with background:--accent (${onPick[1]} uses)`
      : "no co-declared foreground found; falls back to the artboard background",
  );

  return roles;
}

/* ========================================================================== *
 * 4. Scales — sizes, radii, shadows, spacing in heavy rotation
 * ========================================================================== */

const num = (v) => parseFloat(v);

function scales(a) {
  const pxOnly = (map, minCount) =>
    sortedEntries(map)
      .filter(([k, v]) => /^\d+(\.\d+)?px$/.test(k) && v >= minCount)
      .sort((x, y) => num(x[0]) - num(y[0]));

  const fontSizes = pxOnly(a.fontSizes, 3);
  const radii = pxOnly(a.radii, 3);
  const spacing = pxOnly(a.spacing, 8);

  const weights = sortedEntries(a.fontWeights)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((x, y) => num(x[0]) - num(y[0]));

  const lineHeights = sortedEntries(a.lineHeights)
    .filter(([, v]) => v >= 3)
    .slice(0, 8);

  const letterSpacings = sortedEntries(a.letterSpacings)
    .filter(([, v]) => v >= 3)
    .slice(0, 8);

  // Shadows are indexed (--shadow-1, -2 ...), so the ORDER has to be identical
  // in both themes or the light override would land on the wrong index. Sort by
  // geometry (the theme-invariant part) first, then usage, then value.
  const geometry = (s) => s.replace(COLOR_RE, "").replace(/\s+/g, " ").trim();
  const shadows = sortedEntries(a.shadows)
    .filter(([, v]) => v >= 2)
    .sort(
      (x, y) =>
        geometry(x[0]).localeCompare(geometry(y[0])) || y[1] - x[1] || x[0].localeCompare(y[0]),
    );

  return { fontSizes, radii, spacing, weights, lineHeights, letterSpacings, shadows };
}

/**
 * Font roles. Mechanical rules:
 *  - family whose name matches /mono/i          -> --font-mono
 *  - family matching /script|kaushan|cursive/i  -> --font-script
 *  - the family declared FIRST in document order (the page wrapper, i.e. the
 *    face everything else inherits)               -> --font-body
 *  - of the remainder, the one with the largest
 *    max font-size                                -> --font-display
 */
function inferFonts(html) {
  const perFamily = new Map(); // family -> { count, maxSize }
  const order = []; // families in document order

  // Walk inline styles as units so family + size in the same rule can be paired.
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    const d = splitDecls(m[1]);
    const fam = d.find(([p]) => p === "font-family")?.[1];
    const size = d.find(([p]) => p === "font-size")?.[1];
    if (!fam) continue;
    const key = fam.replace(/\s+/g, " ").trim();
    if (!perFamily.has(key)) {
      perFamily.set(key, { count: 0, maxSize: 0 });
      order.push(key);
    }
    const rec = perFamily.get(key);
    rec.count++;
    if (size && /px$/.test(size)) rec.maxSize = Math.max(rec.maxSize, num(size));
  }

  const families = [...perFamily.entries()].map(([family, rec]) => ({ family, ...rec }));
  const byKey = (k) => families.find((f) => f.family === k);
  const primaryName = (f) => (f.match(/^['"]?([^'",]+)/) || [, f])[1].trim();

  const mono = families.filter((f) => /mono/i.test(f.family)).sort((x, y) => y.count - x.count)[0];
  const script = families
    .filter((f) => /script|kaushan|cursive/i.test(f.family) && f !== mono)
    .sort((x, y) => y.count - x.count)[0];
  const rest = families.filter((f) => f !== mono && f !== script);
  const body = byKey(order.find((k) => rest.some((f) => f.family === k))) || rest[0];
  const display =
    [...rest].filter((f) => f !== body).sort((x, y) => y.maxSize - x.maxSize)[0] || body;

  return {
    families: families.sort((x, y) => y.count - x.count),
    roles: {
      display: display && {
        value: display.family,
        name: primaryName(display.family),
        count: display.count,
        why: `largest max font-size (${display.maxSize}px) among non-mono/non-script families other than --font-body`,
      },
      body: body && {
        value: body.family,
        name: primaryName(body.family),
        count: body.count,
        why: "first font-family declared in document order (the wrapper face every screen inherits)",
      },
      mono: mono && {
        value: mono.family,
        name: primaryName(mono.family),
        count: mono.count,
        why: "family name matches /mono/i",
      },
      script: script && {
        value: script.family,
        name: primaryName(script.family),
        count: script.count,
        why: "family name matches /script|kaushan|cursive/i",
      },
    },
  };
}

/* ========================================================================== *
 * 5. Emit
 * ========================================================================== */

/**
 * CSS custom property names are idents: no "." and no leading "-". Turn a raw
 * value into a safe, still-readable suffix. 8.5px -> 8-5 | -.02em -> n02em.
 */
function varSafe(value) {
  return String(value)
    .trim()
    .replace(/^-/, "n")
    .replace(/^\./, "")
    .replace(/\.(?=\d*(px|em|rem|%)?$)/g, "-")
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]/gi, "");
}

function slug(color) {
  return color.startsWith("#")
    ? "p-" + color.slice(1).toLowerCase()
    : "p-" + color.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function cssBlock(selector, lines) {
  return `${selector} {\n${lines.map((l) => (l ? `  ${l}` : "")).join("\n")}\n}\n`;
}

function themeVars(theme, opts = {}) {
  const { roles, sc, fonts, palette } = theme;
  const L = [];

  L.push("/* --- semantic roles (derived: see tokens.json .roles[].why) --- */");
  for (const [name, r] of Object.entries(roles)) L.push(`--${name}: ${r.value};`);

  if (!opts.colorsOnly) {
    L.push("");
    L.push("/* --- type families --- */");
    for (const [role, f] of Object.entries(fonts.roles)) {
      if (f) L.push(`--font-${role}: ${f.value};`);
    }

    L.push("");
    L.push("/* --- font sizes actually used in the mockups (count >= 3) --- */");
    for (const [size] of sc.fontSizes) L.push(`--fs-${varSafe(num(size))}: ${size};`);

    L.push("");
    L.push("/* --- font weights --- */");
    for (const [w] of sc.weights) L.push(`--fw-${w}: ${w};`);

    L.push("");
    L.push("/* --- line heights --- */");
    for (const [lh] of sc.lineHeights) L.push(`--lh-${varSafe(lh)}: ${lh};`);

    L.push("");
    L.push("/* --- letter spacing --- */");
    for (const [ls] of sc.letterSpacings) L.push(`--ls-${varSafe(ls)}: ${ls};`);

    L.push("");
    L.push("/* --- radii --- */");
    for (const [r] of sc.radii) L.push(`--radius-${varSafe(num(r))}: ${r};`);
    L.push(`--radius-full: 999px;`);

    L.push("");
    L.push("/* --- spacing values in heavy rotation (count >= 8) --- */");
    for (const [s] of sc.spacing) L.push(`--space-${varSafe(num(s))}: ${s};`);
  }

  L.push("");
  L.push("/* --- shadows (count >= 2) --- */");
  sc.shadows.forEach(([s], i) => L.push(`--shadow-${i + 1}: ${s.replace(/^box-shadow:\s*/, "")};`));

  L.push("");
  L.push(
    `/* --- raw palette (${palette.length} colors used >= 3x). THEME-LITERAL: exact hexes of one mockup, they do NOT flip between themes — prefer the semantic roles above. --- */`,
  );
  for (const [color, count] of palette) L.push(`--${slug(color)}: ${color}; /* ${count} */`);

  return L;
}

function buildTheme(themeDef) {
  const html = readFileSync(join(MOCKUP_DIR, themeDef.file), "utf8");
  const a = analyze(html);
  const roles = inferRoles(a);
  const sc = scales(a);
  const fonts = inferFonts(html);
  const palette = sortedEntries(a.colorTotal).filter(([, c]) => c >= 3);
  return { name: themeDef.name, file: themeDef.file, a, roles, sc, fonts, palette };
}

function main() {
  const themes = THEMES.map(buildTheme);
  const [dark, light] = themes;

  mkdirSync(OUT_DIR, { recursive: true });

  /* ---------------------------- tokens.css ------------------------------ */
  const header = `/*
 * ui-v3 design tokens — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Source of truth:
 *   dark  ->  .planning/design-project-v2/mockups/${dark.file}
 *   light ->  .planning/design-project-v2/mockups/${light.file}
 *
 * Regenerate with:  node scripts/extract-mockup-tokens.mjs
 * Every value below was counted out of the mockup CSS; see src/ui-v3/tokens.json
 * for raw counts and the derivation reason behind each semantic role.
 *
 * Dark is the DEFAULT (matches the canonical artboards). Light overrides apply
 * on [data-ui="v3"][data-theme="light"].
 */\n\n`;

  const darkLines = themeVars(dark);
  darkLines.unshift("color-scheme: dark;", "");

  // Light: emit only the tokens whose value differs from dark.
  const darkIndex = new Map();
  for (const line of themeVars(dark)) {
    const m = line.match(/^--([\w-]+):\s*([^;]+);/);
    if (m) darkIndex.set(m[1], m[2].trim());
  }
  const lightLines = ["color-scheme: light;", ""];
  const lightAll = themeVars(light);
  let section = "";
  const pending = [];
  for (const line of lightAll) {
    if (line.startsWith("/*")) {
      section = line;
      continue;
    }
    const m = line.match(/^--([\w-]+):\s*([^;]+);/);
    if (!m) continue;
    if (darkIndex.get(m[1]) === m[2].trim()) continue;
    if (section) {
      pending.push("", section);
      section = "";
    }
    pending.push(line);
  }
  lightLines.push(...pending.slice(pending[0] === "" ? 1 : 0));

  /*
   * The tokens are scoped to the v3 root, but `body` sits ABOVE that root and
   * still paints the page (overscroll, short pages). `html:has([data-ui="v3"])`
   * puts the same values on the document element ONLY on pages that actually
   * contain a v3 root, so base.css can paint the body from a token and old
   * routes never see these variables at all.
   */
  const darkSelector = '[data-ui="v3"],\nhtml:has([data-ui="v3"])';
  const lightSelector =
    '[data-ui="v3"][data-theme="light"],\nhtml:has([data-ui="v3"][data-theme="light"])';

  const css =
    header + cssBlock(darkSelector, darkLines) + "\n" + cssBlock(lightSelector, lightLines);

  writeFileSync(join(OUT_DIR, "tokens.css"), css);

  /* ---------------------------- tokens.json ----------------------------- */
  const json = {
    generatedBy: "scripts/extract-mockup-tokens.mjs",
    sources: THEMES.map((t) => `.planning/design-project-v2/mockups/${t.file}`),
    themes: Object.fromEntries(
      themes.map((t) => [
        t.name,
        {
          source: t.file,
          declarationCount: t.a.declarationCount,
          artboards: t.a.artboards,
          roles: t.roles,
          fonts: {
            roles: t.fonts.roles,
            families: t.fonts.families,
          },
          counts: {
            uniqueColors: t.a.colorTotal.size,
            paletteColorsUsed3Plus: t.palette.length,
            uniqueFontSizes: t.a.fontSizes.size,
            uniqueRadii: t.a.radii.size,
            uniqueShadows: t.a.shadows.size,
            uniqueFontFamilies: t.a.fontFamilies.size,
          },
          scales: {
            fontSizes: Object.fromEntries(t.sc.fontSizes),
            fontWeights: Object.fromEntries(t.sc.weights),
            lineHeights: Object.fromEntries(t.sc.lineHeights),
            letterSpacings: Object.fromEntries(t.sc.letterSpacings),
            radii: Object.fromEntries(t.sc.radii),
            spacing: Object.fromEntries(t.sc.spacing),
            shadows: Object.fromEntries(t.sc.shadows),
          },
          raw: {
            colorsByUsage: toObj(t.a.colorTotal),
            colorsByRole: Object.fromEntries(
              [...t.a.colorByBucket].map(([bucket, m]) => [bucket, toObj(m)]),
            ),
            fontFamilies: toObj(t.a.fontFamilies),
            fontSizesAll: toObj(t.a.fontSizes),
            radiiAll: toObj(t.a.radii),
            shadowsAll: toObj(t.a.shadows),
            spacingAll: toObj(t.a.spacing),
            gradients: toObj(t.a.gradients),
            artboardBackgrounds: toObj(t.a.boardBg),
            artboardBorders: toObj(t.a.boardBorder),
            artboardRadii: toObj(t.a.boardRadius),
          },
        },
      ]),
    ),
  };
  writeFileSync(join(OUT_DIR, "tokens.json"), JSON.stringify(json, null, 2) + "\n");

  /* ------------------------------- report -------------------------------- */
  for (const t of themes) {
    log(`\n[${t.name}] ${t.file}`);
    log(`  declarations parsed : ${t.a.declarationCount}`);
    log(`  artboards           : ${t.a.artboards.length}`);
    log(
      `  colors              : ${t.a.colorTotal.size} unique (${t.palette.length} used >=3x)`,
    );
    log(
      `  fonts               : ${t.a.fontFamilies.size} families | sizes ${t.a.fontSizes.size} | radii ${t.a.radii.size} | shadows ${t.a.shadows.size}`,
    );
    log("  roles:");
    for (const [name, r] of Object.entries(t.roles))
      log(`    --${name.padEnd(13)} ${String(r.value).padEnd(22)} (${r.count}x) ${r.why}`);
    log("  font roles:");
    for (const [role, f] of Object.entries(t.fonts.roles))
      if (f) log(`    --font-${role.padEnd(8)} ${f.name.padEnd(18)} ${f.why}`);
  }
  log(`\nwrote ${join("src", "ui-v3", "tokens.css")}`);
  log(`wrote ${join("src", "ui-v3", "tokens.json")}`);
}

main();
