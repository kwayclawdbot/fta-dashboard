/**
 * Side-by-side proof for the ui-v3 Discover lane.
 *
 * For each artboard: screenshot the mockup element from the file:// mockup, the
 * route at 390x844 from the dev server, and compose the two into one image with
 * a labelled gutter. Runs both themes.
 *
 *   node scripts/v3-proof-discover.mjs
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".planning/design-project-v2/proof");
const BASE = process.env.V3_BASE ?? "http://localhost:3101";
const W = 390;
const H = 844;
const SCALE = 2;

const MOCK = {
  dark: path.join(ROOT, ".planning/design-project-v2/mockups/Cheat Code App.dc.html"),
  light: path.join(ROOT, ".planning/design-project-v2/mockups/Cheat Code App Light.dc.html"),
};

const SCREENS = [
  { slug: "discover", label: "02 Discover", route: "/v3/discover" },
  { slug: "discover-screener", label: "15 Discover Screener", route: "/v3/discover/screener" },
];

async function shotArtboard(browser, theme, label, file) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1200 },
    deviceScaleFactor: SCALE,
  });
  await page.goto(`file://${MOCK[theme]}`);
  await page.waitForTimeout(1200); // webfonts
  const el = page.locator(`[data-screen-label="${label}"]`);
  await el.screenshot({ path: file });
  await page.close();
}

async function shotRoute(browser, theme, route, file, fullFile) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  // The dev server's floating Next.js badge is not part of the screen.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (theme === "light") {
    await page.evaluate(() => {
      document.querySelector('[data-ui="v3"]')?.setAttribute("data-theme", "light");
    });
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: file }); // viewport-clipped: the artboard's own box
  await page.screenshot({ path: fullFile, fullPage: true });
  await page.close();
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
    await shotRoute(browser, theme, screen.route, live, full);
    await compose(browser, theme, screen.label, art, live, sbs);
    console.log("proof:", path.relative(ROOT, sbs));
  }
}

await browser.close();
