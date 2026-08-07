/**
 * CUTOVER PROOF — the eleven staged screens, shot at their OLD urls.
 *
 * This is not a side-by-side against an artboard (the lane proofs already do
 * that). It answers a different question: with the harness ON, does the OLD url
 * actually serve the v3 screen, and with it OFF does the old app come back?
 *
 * So every shot is taken at the old path — /discover, not /v3/discover — and
 * each one is asserted on `[data-ui="v3"]` being present in the DOM. A pretty
 * screenshot of the right screen at the wrong url would prove nothing.
 *
 *   V3_BASE=https://<preview-url> node scripts/v3-proof-cutover.mjs
 *
 * The harness is driven by ?v3=1 / ?v3=0 rather than the env var, so this runs
 * identically against a preview built with the flag on and one built without it.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".planning/design-project-v2/proof/cutover-preview");
const BASE = process.env.V3_BASE ?? "http://localhost:3311";
const W = 390;
const H = 844;

/** The staged wave, by OLD path. `board` is the artboard each one rebuilds. */
const SCREENS = [
  { slug: "01-home", old: "/", board: "01 Home" },
  { slug: "02-discover", old: "/discover", board: "02 Discover" },
  { slug: "15-screener", old: "/discover/screener", board: "15 Discover Screener" },
  { slug: "03-ticker", old: "/ticker/NVDA", board: "03 Ticker" },
  { slug: "12-ticker-technicals", old: "/ticker/NVDA/technicals", board: "12 Technicals" },
  { slug: "13-ticker-fundamentals", old: "/ticker/NVDA/fundamentals", board: "13 Fundamentals" },
  { slug: "14-ticker-kai", old: "/ticker/NVDA/kai", board: "14 Kai" },
  { slug: "07-you", old: "/you", board: "07 You Profile" },
  { slug: "22-belts", old: "/you/belts", board: "22 Belts" },
  { slug: "09-welcome", old: "/welcome", board: "09 Splash" },
  { slug: "10-login", old: "/login", board: "10 Login" },
  { slug: "11-pricing", old: "/pricing", board: "11 Pricing" },

  // THE REAL OLD URLS for two screens already listed above. They are shot
  // separately because a cutover is only as good as the urls it actually
  // intercepts, and these are the ones existing bookmarks and in-app links use.
  { slug: "15-screener-via-old-url", old: "/screener", board: "15 Discover Screener" },
  { slug: "03-ticker-via-research", old: "/research/NVDA", board: "03 Ticker" },
  {
    slug: "13-fundamentals-via-research-tab",
    old: "/research/NVDA?tab=fundamentals",
    board: "13 Fundamentals",
  },
];

/**
 * The v3 fonts are self-hosted through next/font, but the page still has layout
 * to settle after hydration. Same reasoning as the lane proofs: measure or shoot
 * too early and you capture a pre-settle frame that reads as a real difference.
 */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

async function shoot(ctx, screen, theme) {
  const page = await ctx.newPage();
  const url = `${BASE}${screen.old}${screen.old.includes("?") ? "&" : "?"}v3=1`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  // Force the theme where v3 actually reads it. `data-theme` lives on the SAME
  // element as `data-ui="v3"` (src/app/v3/layout.tsx), not on <html> — every
  // light override is scoped `[data-ui="v3"][data-theme="light"]`, so setting it
  // on the document root would change nothing and silently produce two
  // identical dark shots.
  await page.evaluate((t) => {
    document.querySelector('[data-ui="v3"]')?.setAttribute("data-theme", t);
  }, theme);
  await settle(page);

  const isV3 = await page.locator('[data-ui="v3"]').count();
  const file = path.join(OUT, `${screen.slug}-${theme}.png`);
  await page.screenshot({ path: file });
  await page.close();

  return {
    slug: screen.slug,
    board: screen.board,
    oldPath: screen.old,
    theme,
    status: res?.status() ?? 0,
    // The whole point of the run: the OLD url produced v3 markup.
    servedV3: isV3 > 0,
    file: path.relative(ROOT, file),
  };
}

/** With the harness OFF the same old url must NOT be v3 — otherwise the switch
 *  is not a switch and there is no way back to the old app. */
async function checkOff(ctx, screen) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${screen.old}?v3=0`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const isV3 = await page.locator('[data-ui="v3"]').count();
  await page.close();
  return isV3 === 0;
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

const results = [];
for (const theme of ["dark", "light"]) {
  // A fresh context per theme so the ?v3= cookie from one run cannot carry a
  // stale answer into the next.
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  for (const screen of SCREENS) {
    const r = await shoot(ctx, screen, theme);
    results.push(r);
    console.log(
      `${r.servedV3 ? "OK  " : "FAIL"} ${r.oldPath.padEnd(30)} ${theme.padEnd(5)} http=${r.status} -> ${r.file}`
    );
  }
  await ctx.close();
}

// The off-switch, checked once per screen (theme-independent).
const offCtx = await browser.newContext({ viewport: { width: W, height: H } });
const offResults = [];
for (const screen of SCREENS) {
  const ok = await checkOff(offCtx, screen);
  offResults.push({ oldPath: screen.old, oldAppReturns: ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${screen.old.padEnd(30)} ?v3=0 -> old app returns`);
}
await offCtx.close();
await browser.close();

await writeFile(
  path.join(OUT, "results.json"),
  JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), on: results, off: offResults }, null, 2)
);

const failedOn = results.filter((r) => !r.servedV3);
const failedOff = offResults.filter((r) => !r.oldAppReturns);
console.log(`\n${results.length} shots, ${failedOn.length} not-v3, ${failedOff.length} stuck-on-v3`);
if (failedOn.length || failedOff.length) process.exitCode = 1;
