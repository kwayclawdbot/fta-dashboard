// Probe the structure of a Claude Design standalone canvas HTML.
// Usage: node probe.mjs "/abs/path/to/Canvas (Standalone).html"
import { chromium } from 'playwright';
import path from 'path';

const file = process.argv[2];
const target = 'file://' + encodeURI(file);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
await page.goto(target, { waitUntil: 'load', timeout: 120000 });

// wait for self-unpacking bundle
await page.waitForFunction(() => {
  const el = document.getElementById('__bundler_loading');
  const gone = !el || el.offsetParent === null || getComputedStyle(el).display === 'none';
  return gone && document.body.innerText.length > 400;
}, null, { timeout: 180000 });
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const out = { title: document.title, bodySize: { w: document.body.scrollWidth, h: document.body.scrollHeight } };
  // dump top 4 levels of DOM tree with sizes
  const lines = [];
  function walk(el, depth) {
    if (depth > 5) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 90) : '';
    lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? ' .' + cls.trim().split(/\s+/).join('.') : ''}> ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left + scrollX)},${Math.round(r.top + scrollY)} kids=${el.children.length}`);
    for (const c of el.children) walk(c, depth + 1);
  }
  walk(document.body, 0);
  out.tree = lines.slice(0, 400).join('\n');
  return out;
});

console.log(JSON.stringify(info.bodySize), info.title);
console.log(info.tree);
await browser.close();
