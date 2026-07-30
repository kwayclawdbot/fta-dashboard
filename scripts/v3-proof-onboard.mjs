/**
 * Side-by-side proof for the ui-v3 onboarding lane (boards 09, 10, 11).
 *
 * Same shape as scripts/v3-proof-discover.mjs: shoot the artboard element out of
 * the mockup file, shoot the route at 390x844 off the dev server, compose them
 * into one labelled image. Both themes.
 *
 *   V3_BASE=http://localhost:3109 node scripts/v3-proof-onboard.mjs
 *
 * ONE DIFFERENCE FROM THE OTHER LANES. /v3/welcome is a splash that advances to
 * sign-in on its own after 1400ms, so the usual "settle for 3s then shoot" would
 * photograph the login screen instead. The fix is not to shorten the settle —
 * fallback font metrics are exactly the trap grammar §11.2 warns about — but to
 * WARM the page first so `document.fonts.ready` resolves on the real faces, then
 * shoot inside the hold. The script asserts the URL is still the splash at
 * shutter time and fails loudly if it is not, so a silent wrong-screen capture
 * cannot be mistaken for a passing proof.
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".planning/design-project-v2/proof");
const BASE = process.env.V3_BASE ?? "http://localhost:3109";
const W = 390;
const H = 844;
const SCALE = 2;

const MOCK = {
  dark: path.join(ROOT, ".planning/design-project-v2/mockups/Cheat Code App.dc.html"),
  light: path.join(ROOT, ".planning/design-project-v2/mockups/Cheat Code App Light.dc.html"),
};

const SCREENS = [
  { slug: "onboard-splash", label: "09 Splash", route: "/v3/welcome", transient: true },
  { slug: "onboard-login", label: "10 Login", route: "/v3/login" },
  { slug: "onboard-pricing", label: "11 Pricing", route: "/v3/pricing" },
];

/**
 * The mockups pull four Google faces over the network. Captured early they
 * silently render in a fallback and EVERY measured height is wrong, which reads
 * as a mismatch in the component (grammar §11.2).
 */
async function settleFonts(page, extra = 3000) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(extra);
}

async function shotArtboard(browser, theme, label, file) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1200 },
    deviceScaleFactor: SCALE,
  });
  await page.goto(`file://${MOCK[theme]}`);
  await settleFonts(page);
  await page.locator(`[data-screen-label="${label}"]`).screenshot({ path: file });
  await page.close();
}

async function shotRoute(browser, theme, screen, file, fullFile) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();

  // Warm the route so the self-hosted next/font faces are in the HTTP cache and
  // document.fonts.ready resolves on the real metrics rather than a fallback.
  await page.goto(`${BASE}${screen.route}`, { waitUntil: "networkidle" });
  await settleFonts(page, screen.transient ? 500 : 3000);

  if (screen.transient) {
    // Second visit, shot inside the splash's own hold.
    await page.goto(`${BASE}${screen.route}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
  }

  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (theme === "light") {
    await page.evaluate(() => {
      document.querySelector('[data-ui="v3"]')?.setAttribute("data-theme", "light");
    });
  }

  const url = new URL(page.url()).pathname;
  if (url !== screen.route) {
    throw new Error(
      `shutter fired on ${url}, expected ${screen.route} — the capture would be the wrong screen`
    );
  }

  await page.screenshot({ path: file });
  await page.screenshot({ path: fullFile, fullPage: true });
  await context.close();
}

async function compose(browser, theme, label, left, right, file) {
  const page = await browser.newPage({
    viewport: { width: W * 2 + 60, height: H + 74 },
    deviceScaleFactor: SCALE,
  });
  const bg = theme === "light" ? "#F7F4EF" : "#0D0B0E";
  const fg = theme === "light" ? "#1A1614" : "#F4F0EC";
  const uri = async (p) => `data:image/png;base64,${(await readFile(p)).toString("base64")}`;
  await page.setContent(`
    <div style="background:${bg};color:${fg};font:600 12px/1 monospace;
                padding:18px 20px;display:flex;gap:20px;align-items:flex-start">
      <div><div style="margin-bottom:10px">ARTBOARD · ${label} · ${theme}</div>
        <img src="${await uri(left)}" width="${W}" height="${H}"></div>
      <div><div style="margin-bottom:10px">/v3 · ${label} · ${theme}</div>
        <img src="${await uri(right)}" width="${W}" height="${H}"></div>
    </div>`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const screen of SCREENS) {
  for (const theme of ["dark", "light"]) {
    const art = path.join(OUT, `${screen.slug}-artboard-${theme}.png`);
    const live = path.join(OUT, `${screen.slug}-v3-${theme}.png`);
    const full = path.join(OUT, `${screen.slug}-v3-${theme}-full.png`);
    const sbs = path.join(OUT, `${screen.slug}-sbs-${theme}.png`);
    await shotArtboard(browser, theme, screen.label, art);
    await shotRoute(browser, theme, screen, live, full);
    await compose(browser, theme, screen.label, art, live, sbs);
    console.log("proof:", path.relative(ROOT, sbs));
  }
}

await browser.close();
