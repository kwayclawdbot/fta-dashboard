// Shared helpers for design-canvas extraction.
import { chromium } from 'playwright';

export async function openCanvas(file, { width = 1800 } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.goto('file://' + encodeURI(file), { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('__bundler_loading');
    const gone = !el || el.offsetParent === null || getComputedStyle(el).display === 'none';
    return gone && document.body.innerText.length > 400;
  }, null, { timeout: 240000 });
  await page.waitForTimeout(3500);
  // let webfonts settle
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(500);
  return { browser, page };
}

// Returns the board wrapper elements: children of the grid container that are
// phone-frame sized (>=320px wide, >=500px tall).
export const BOARD_FINDER = () => {
  const root = document.querySelector('#dc-root') || document.body;
  const all = [...root.querySelectorAll('div')];
  const cand = all.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 330 || r.width > 560) return false;
    if (r.height < 520) return false;
    // must have a phone-ish child or be direct grid child
    return true;
  });
  // keep outermost only
  const out = cand.filter(el => !cand.some(o => o !== el && o.contains(el)));
  out.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ta = ra.top + scrollY, tb = rb.top + scrollY;
    if (Math.abs(ta - tb) > 40) return ta - tb;
    return ra.left - rb.left;
  });
  return out;
};

export function slugify(s) {
  return s.toLowerCase()
    .replace(/[·•]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
