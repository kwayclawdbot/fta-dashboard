// Positional light↔dark pairing: walks both canvases in lockstep and records
// (dark hex, light hex) at every identical node path + paint role.
// Emits ../TOKEN-MAP-POSITIONAL.json consumed by crosscheck.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openCanvas } from './lib.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECT = () => {
  function rgbToHex(v) {
    const m = v.match(/^rgba?\(([^)]+)\)$/); if (!m) return v;
    const p = m[1].split(',').map(s => s.trim()); const [r, g, b] = p.slice(0, 3).map(Number);
    const a = p.length > 3 ? Number(p[3]) : 1;
    const h = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    return a === 1 ? h : h + '/' + a;
  }
  const root = document.querySelector('#dc-root') || document.body;
  let best = null, bestN = 0;
  for (const el of root.querySelectorAll('div')) {
    const n = [...el.children].filter(c => { const r = c.getBoundingClientRect(); return r.width >= 330 && r.width <= 600 && r.height >= 500; }).length;
    if (n > bestN) { bestN = n; best = el; }
  }
  const boards = [...best.children].filter(c => { const r = c.getBoundingClientRect(); return r.width >= 330 && r.width <= 600 && r.height >= 500; });
  const rec = [];
  function walk(el, p) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const bg = rgbToHex(cs.backgroundColor);
    if (bg !== '#000000/0') rec.push([p, 'bg', bg]);
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) hasText = true;
    if (hasText) rec.push([p, 'text', rgbToHex(cs.color)]);
    if (cs.borderTopWidth !== '0px') rec.push([p, 'border-t', rgbToHex(cs.borderTopColor)]);
    if (cs.borderLeftWidth !== '0px') rec.push([p, 'border-l', rgbToHex(cs.borderLeftColor)]);
    if (cs.borderBottomWidth !== '0px') rec.push([p, 'border-b', rgbToHex(cs.borderBottomColor)]);
    if (cs.borderRightWidth !== '0px') rec.push([p, 'border-r', rgbToHex(cs.borderRightColor)]);
    [...el.children].forEach((c, i) => walk(c, p + '/' + i + c.tagName));
  }
  boards.forEach((b, i) => walk(b, 'B' + i));
  return rec;
};

const files = {
  dark: '/Users/kwaysclawd/Desktop/Cheat Code App (Standalone).html',
  light: '/Users/kwaysclawd/Desktop/Cheat Code App Light (Standalone).html',
};
const data = {};
for (const [k, f] of Object.entries(files)) {
  const { browser, page } = await openCanvas(f);
  data[k] = await page.evaluate(COLLECT);
  await browser.close();
  console.log(k, data[k].length, 'paint records');
}
const lmap = new Map(data.light.map(([p, r, c]) => [p + '|' + r, c]));
const pairs = new Map(); // dark -> Map(light -> count)
let missing = 0;
for (const [p, r, c] of data.dark) {
  const l = lmap.get(p + '|' + r);
  if (!l) { missing++; continue; }
  if (!pairs.has(c)) pairs.set(c, new Map());
  const m = pairs.get(c); m.set(l, (m.get(l) || 0) + 1);
}
const out = [...pairs.entries()].map(([d, m]) => ({
  dark: d,
  light: [...m.entries()].sort((a, b) => b[1] - a[1]).map(([hex, n]) => ({ hex, n })),
  total: [...m.values()].reduce((a, b) => a + b, 0),
})).sort((a, b) => b.total - a.total);
fs.writeFileSync(path.resolve(__dirname, '../TOKEN-MAP-POSITIONAL.json'), JSON.stringify({ missingPaths: missing, pairs: out }, null, 2));
console.log('unpaired dark paint records:', missing);
console.log(out.slice(0, 40).map(o => `${o.dark.padEnd(14)} -> ${o.light.map(l => l.hex + '×' + l.n).join(', ')}`).join('\n'));
