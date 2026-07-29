// Probe board-level structure: labels + inner frame.
import { chromium } from 'playwright';
const file = process.argv[2];
const idx = parseInt(process.argv[3] || '0', 10);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
await page.goto('file://' + encodeURI(file), { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => {
  const el = document.getElementById('__bundler_loading');
  const gone = !el || el.offsetParent === null || getComputedStyle(el).display === 'none';
  return gone && document.body.innerText.length > 400;
}, null, { timeout: 180000 });
await page.waitForTimeout(3000);

const res = await page.evaluate((idx) => {
  // header area text
  const root = document.querySelector('#dc-root');
  const grid = root.querySelector('div > div > div').children[1];
  const header = root.querySelector('div > div > div').children[0];
  const boards = [...grid.children];
  const b = boards[idx];
  const lines = [];
  function walk(el, depth) {
    if (depth > 4) return;
    const r = el.getBoundingClientRect();
    const cls = (typeof el.className === 'string') ? el.className.slice(0, 120) : '';
    const txt = el.children.length === 0 ? JSON.stringify((el.innerText || '').slice(0, 60)) : '';
    lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${cls ? ' class="' + cls + '"' : ''}> ${Math.round(r.width)}x${Math.round(r.height)} ${txt}`);
    for (const c of el.children) walk(c, depth + 1);
  }
  walk(b, 0);
  return {
    headerText: header.innerText,
    boardCount: boards.length,
    labels: boards.map(x => (x.innerText || '').split('\n').slice(0, 2).join(' | ')),
    tree: lines.join('\n'),
    styleTagCount: document.querySelectorAll('style').length,
  };
}, idx);
console.log('HEADER:', res.headerText);
console.log('BOARDS:', res.boardCount);
res.labels.forEach((l, i) => console.log(String(i).padStart(2, '0'), l));
console.log('\n--- TREE board', idx, '---\n' + res.tree);
await browser.close();
