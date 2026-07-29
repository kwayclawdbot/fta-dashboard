// Mechanical extractor for Claude Design standalone canvases.
// Usage: node extract.mjs <canvasKey> "/abs/path/file.html"
// Writes: ../<canvasKey>/<NN-slug>/{render.png,dom.html,spec.md}
//         ../<canvasKey>/TOKENS.md  ../<canvasKey>/_raw.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openCanvas, slugify } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, '..');

const key = process.argv[2];
const file = process.argv[3];
if (!key || !file) { console.error('usage: extract.mjs <key> <file>'); process.exit(1); }

const { browser, page } = await openCanvas(file);

// ---------------------------------------------------------------- collect
const collected = await page.evaluate(() => {
  const DEFAULTS = {
    marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
    borderTopLeftRadius: '0px', borderTopRightRadius: '0px',
    borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px',
    boxShadow: 'none', backgroundImage: 'none', opacity: '1', transform: 'none',
    textTransform: 'none', overflow: 'visible', letterSpacing: 'normal',
    position: 'static', zIndex: 'auto', textAlign: 'start', fontStyle: 'normal',
    whiteSpace: 'normal', flexDirection: 'row', flexWrap: 'nowrap', gap: 'normal',
    justifyContent: 'normal', alignItems: 'normal', textDecorationLine: 'none',
    backdropFilter: 'none', filter: 'none', mixBlendMode: 'normal', objectFit: 'fill',
    gridTemplateColumns: 'none', gridTemplateRows: 'none', flexGrow: '0', flexShrink: '1',
    flexBasis: 'auto', alignSelf: 'auto', wordBreak: 'normal', columnGap: 'normal', rowGap: 'normal',
  };
  const TRANSPARENT = ['rgba(0, 0, 0, 0)', 'transparent'];

  function rgbToHex(v) {
    if (!v) return v;
    const m = v.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return v;
    const p = m[1].split(',').map(s => s.trim());
    const [r, g, b] = p.slice(0, 3).map(Number);
    const a = p.length > 3 ? Number(p[3]) : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    return a === 1 ? hex.toUpperCase() : hex.toUpperCase() + '/' + a;
  }
  function normColorsIn(str) {
    if (!str) return str;
    return str.replace(/rgba?\([^)]+\)/g, (m) => rgbToHex(m));
  }

  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.replace(/\s+/g, ' ').trim();
  }

  function styleOf(el, parentCS) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = {};
    const put = (k, v) => { if (v != null && v !== '' && v !== DEFAULTS[k]) o[k] = v; };

    // box
    o._box = `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`;
    put('display', cs.display === 'block' ? null : cs.display);
    if (cs.display.includes('flex') || cs.display.includes('grid')) {
      put('flexDirection', cs.flexDirection);
      put('flexWrap', cs.flexWrap);
      put('alignItems', cs.alignItems);
      put('justifyContent', cs.justifyContent);
      put('justifyItems', cs.justifyItems === 'legacy' || cs.justifyItems === 'normal' ? null : cs.justifyItems);
      put('alignContent', cs.alignContent === 'normal' ? null : cs.alignContent);
      put('gridTemplateColumns', cs.gridTemplateColumns);
      put('gridTemplateRows', cs.gridTemplateRows);
      put('gridAutoFlow', cs.gridAutoFlow === 'row' ? null : cs.gridAutoFlow);
      put('gridAutoColumns', cs.gridAutoColumns === 'auto' ? null : cs.gridAutoColumns);
    }
    put('justifySelf', cs.justifySelf === 'auto' || cs.justifySelf === 'normal' ? null : cs.justifySelf);
    if (cs.gridColumn && cs.gridColumn !== 'auto' && cs.gridColumn !== 'auto / auto') o.gridColumn = cs.gridColumn;
    if (cs.gridRow && cs.gridRow !== 'auto' && cs.gridRow !== 'auto / auto') o.gridRow = cs.gridRow;
    put('order', cs.order === '0' ? null : cs.order);
    // scroll rails
    if (cs.scrollSnapType && cs.scrollSnapType !== 'none') o.scrollSnapType = cs.scrollSnapType;
    if (cs.scrollSnapAlign && cs.scrollSnapAlign !== 'none') o.scrollSnapAlign = cs.scrollSnapAlign;
    // truncation
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') o.lineClamp = cs.webkitLineClamp;
    put('textOverflow', cs.textOverflow === 'clip' ? null : cs.textOverflow);
    // image / background painting
    if (el.tagName === 'IMG' || cs.backgroundImage !== 'none') {
      put('objectFit', cs.objectFit);
      put('objectPosition', cs.objectPosition === '50% 50%' ? null : cs.objectPosition);
      put('backgroundSize', cs.backgroundSize === 'auto' ? null : cs.backgroundSize);
      put('backgroundPosition', cs.backgroundPosition === '0% 0%' ? null : cs.backgroundPosition);
      put('backgroundRepeat', cs.backgroundRepeat === 'repeat' ? null : cs.backgroundRepeat);
      put('backgroundClip', cs.backgroundClip === 'border-box' ? null : cs.backgroundClip);
    }
    if (cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color) o.textFillColor = rgbToHex(cs.webkitTextFillColor);
    put('textShadow', normColorsIn(cs.textShadow) === 'none' ? null : normColorsIn(cs.textShadow));
    if (cs.outlineStyle && cs.outlineStyle !== 'none') o.outline = `${cs.outlineWidth} ${cs.outlineStyle} ${rgbToHex(cs.outlineColor)}`;
    const g = cs.gap && cs.gap !== 'normal' ? cs.gap : null;
    if (g && g !== '0px') o.gap = g;
    // explicit sizing from inline/computed
    const inline = el.getAttribute('style') || '';
    for (const prop of ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'flex', 'aspect-ratio']) {
      const m = inline.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
      if (m) o['css:' + prop] = m[1].trim();
    }
    put('flexGrow', cs.flexGrow); put('flexShrink', cs.flexShrink);
    put('flexBasis', cs.flexBasis); put('alignSelf', cs.alignSelf);

    // spacing
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    if (pad.some(v => v !== '0px')) o.padding = pad.join(' ');
    const mar = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft];
    if (mar.some(v => v !== '0px')) o.margin = mar.join(' ');

    // paint
    if (!TRANSPARENT.includes(cs.backgroundColor)) o.background = rgbToHex(cs.backgroundColor);
    put('backgroundImage', normColorsIn(cs.backgroundImage));
    put('boxShadow', normColorsIn(cs.boxShadow));
    put('opacity', cs.opacity);
    put('transform', cs.transform);
    put('backdropFilter', cs.backdropFilter);
    put('filter', cs.filter);
    put('mixBlendMode', cs.mixBlendMode);

    // border
    const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
    if (bw.some(v => v !== '0px')) {
      const bc = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].map(rgbToHex);
      const bs = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
      const uniform = bw.every(v => v === bw[0]) && bc.every(v => v === bc[0]) && bs.every(v => v === bs[0]);
      o.border = uniform ? `${bw[0]} ${bs[0]} ${bc[0]}`
        : `T:${bw[0]} ${bs[0]} ${bc[0]} R:${bw[1]} ${bs[1]} ${bc[1]} B:${bw[2]} ${bs[2]} ${bc[2]} L:${bw[3]} ${bs[3]} ${bc[3]}`;
    }
    const br = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    if (br.some(v => v !== '0px')) o.radius = br.every(v => v === br[0]) ? br[0] : br.join(' ');
    put('overflow', cs.overflow);
    if (cs.position !== 'static') {
      o.position = cs.position;
      const ins = ['top', 'right', 'bottom', 'left'].map(k => cs[k]).join(' ');
      if (ins !== 'auto auto auto auto') o.inset = ins;
      put('zIndex', cs.zIndex);
    }

    // type — only when it differs from parent (inheritance dedupe)
    const tf = {
      fontFamily: cs.fontFamily.replace(/"/g, '').split(',')[0].trim(),
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
      textTransform: cs.textTransform, textAlign: cs.textAlign,
      color: rgbToHex(cs.color), textDecorationLine: cs.textDecorationLine,
      whiteSpace: cs.whiteSpace,
    };
    o._type = tf;
    o._typeDiff = {};
    for (const k in tf) {
      if (!parentCS || parentCS[k] !== tf[k]) {
        if (tf[k] !== DEFAULTS[k] || (parentCS && parentCS[k] !== tf[k])) o._typeDiff[k] = tf[k];
      }
    }
    return { o, tf, r };
  }

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE']);

  function walk(el, parentTF, depth, out) {
    if (SKIP_TAGS.has(el.tagName)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const { o, tf, r } = styleOf(el, parentTF);
    const node = {
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' && el.className.trim()) ? el.className.trim() : null,
      id: el.id || null,
      text: ownText(el) || null,
      allText: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null,
      style: o,
      x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height),
      kids: [],
    };
    if (el.tagName === 'IMG') { node.src = (el.getAttribute('src') || '').slice(0, 80); node.alt = el.getAttribute('alt'); }
    if (el.tagName === 'SVG' || el.tagName === 'svg') node.svg = el.outerHTML.slice(0, 400);
    for (const c of el.children) {
      const k = walk(c, tf, depth + 1, out);
      if (k) node.kids.push(k);
    }
    return node;
  }

  // find boards
  const root = document.querySelector('#dc-root') || document.body;
  let grid = null;
  const cands = [...root.querySelectorAll('div')];
  // grid = element with >=2 children that are phone-frame-sized
  let best = null, bestN = 0;
  for (const el of cands) {
    const n = [...el.children].filter(c => {
      const r = c.getBoundingClientRect();
      return r.width >= 330 && r.width <= 600 && r.height >= 500;
    }).length;
    if (n > bestN) { bestN = n; best = el; }
  }
  grid = best;
  const boardEls = [...grid.children].filter(c => {
    const r = c.getBoundingClientRect();
    return r.width >= 330 && r.width <= 600 && r.height >= 500;
  });

  // header text (canvas title/subtitle)
  const headerEl = grid.previousElementSibling;

  const boards = boardEls.map((b, i) => {
    // frame = tallest child; label = the other
    const kids = [...b.children];
    let frame = kids.reduce((a, c) => (c.getBoundingClientRect().height > (a ? a.getBoundingClientRect().height : 0) ? c : a), null) || b;
    const labelEl = kids.find(c => c !== frame);
    const rawLabel = (labelEl ? labelEl.innerText : (b.innerText || '')).replace(/\s+/g, ' ').trim();
    b.setAttribute('data-dcx-board', String(i));
    frame.setAttribute('data-dcx-frame', String(i));
    const fr = frame.getBoundingClientRect();
    return {
      index: i,
      label: rawLabel,
      labelStyle: labelEl ? styleOf(labelEl, null).o : null,
      frameW: Math.round(fr.width), frameH: Math.round(fr.height),
      tree: walk(frame, null, 0, null),
      html: frame.outerHTML,
      texts: (() => {
        const t = [];
        const tw = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
        let n; while ((n = tw.nextNode())) { const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (v) t.push(v); }
        return t;
      })(),
    };
  });

  return {
    title: document.title,
    header: headerEl ? headerEl.innerText.replace(/\n{2,}/g, '\n').trim() : '',
    canvasBg: rgbToHex(getComputedStyle(document.body).backgroundColor),
    fontFaces: [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch (e) { return []; } })
      .filter(r => r.type === 5).map(r => r.style.fontFamily + ' ' + r.style.fontWeight).slice(0, 40),
    boards,
  };
});

// ---------------------------------------------------------------- tokens
function collectTokens(boards) {
  const colors = new Map();   // hex -> {count, roles:Set}
  const types = new Map();    // sig -> {count, def}
  const radii = new Map();
  const spaces = new Map();
  const shadows = new Map();
  const bump = (m, k, extra) => {
    if (!k) return; const e = m.get(k) || { count: 0, roles: new Set() };
    e.count++; if (extra) e.roles.add(extra); m.set(k, e);
  };
  function visit(n) {
    const s = n.style;
    if (s.background) bump(colors, s.background, 'bg');
    if (s.border) String(s.border).match(/#[0-9A-F]{6}(\/[\d.]+)?/g)?.forEach(c => bump(colors, c, 'border'));
    if (s.backgroundImage) String(s.backgroundImage).match(/#[0-9A-F]{6}(\/[\d.]+)?/g)?.forEach(c => bump(colors, c, 'gradient'));
    if (s.boxShadow) String(s.boxShadow).match(/#[0-9A-F]{6}(\/[\d.]+)?/g)?.forEach(c => bump(colors, c, 'shadow'));
    if (n.text && s._type) bump(colors, s._type.color, 'text');
    if (s.radius) String(s.radius).split(' ').forEach(r => bump(radii, r));
    if (s.gap) String(s.gap).split(' ').forEach(r => bump(spaces, r, 'gap'));
    if (s.padding) String(s.padding).split(' ').forEach(r => { if (r !== '0px') bump(spaces, r, 'pad'); });
    if (s.boxShadow) bump(shadows, s.boxShadow);
    if (n.text && s._type) {
      const t = s._type;
      const sig = [t.fontFamily, t.fontSize, t.fontWeight, t.letterSpacing, t.lineHeight, t.textTransform].join('|');
      const e = types.get(sig) || { count: 0, def: t, samples: [] };
      e.count++; if (e.samples.length < 3) e.samples.push(n.text.slice(0, 34));
      types.set(sig, e);
    }
    n.kids.forEach(visit);
  }
  boards.forEach(b => visit(b.tree));

  // name colors by hue family + lightness step (deterministic, self-describing)
  const colorList = [...colors.entries()].sort((a, b) => b[1].count - a[1].count);
  const names = new Map();
  const taken = new Map();
  const HUES = [[15, 'red'], [40, 'orange'], [55, 'amber'], [70, 'yellow'], [90, 'lime'], [150, 'green'],
  [175, 'teal'], [195, 'cyan'], [235, 'blue'], [260, 'indigo'], [285, 'violet'], [320, 'magenta'], [345, 'pink'], [361, 'red']];
  function hueName(h) { for (const [max, n] of HUES) if (h < max) return n; return 'red'; }
  function stepOf(l) {
    const steps = [[4, '950'], [10, '900'], [16, '850'], [23, '800'], [31, '700'], [40, '600'], [50, '500'],
    [60, '400'], [70, '300'], [80, '200'], [90, '100'], [96, '50'], [101, '0']];
    for (const [max, s] of steps) if (l < max) return s;
    return '0';
  }
  for (const [hexA] of colorList) {
    const [hex, alpha] = hexA.split('/');
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    let h = 0;
    if (d !== 0) {
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let base = (s < 0.08) ? `neutral-${stepOf(l * 100)}` : `${hueName(h)}-${stepOf(l * 100)}`;
    if (alpha) base += `a${String(Math.round(Number(alpha) * 100)).padStart(2, '0')}`;
    const n = (taken.get(base) || 0) + 1; taken.set(base, n);
    names.set(hexA, n === 1 ? base : `${base}-${String.fromCharCode(96 + n)}`);
  }
  // name types by size desc
  const typeList = [...types.entries()].sort((a, b) => parseFloat(b[1].def.fontSize) - parseFloat(a[1].def.fontSize) || b[1].count - a[1].count);
  const typeNames = new Map();
  typeList.forEach(([sig], i) => typeNames.set(sig, 'ty' + (i + 1)));
  const radList = [...radii.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  const radNames = new Map();
  radList.forEach(([v], i) => radNames.set(v, 'r' + (i + 1)));

  return { colors: colorList, names, types: typeList, typeNames, radii: radList, radNames, spaces: [...spaces.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])), shadows: [...shadows.entries()].sort((a, b) => b[1].count - a[1].count) };
}

const T = collectTokens(collected.boards);

// ---------------------------------------------------------------- spec render
const MOCKRE = /(\d[\d,]*\s*(members|online|listening|replies|families|watching|posts?|traders?|people)|\$\s?\d|\d+(\.\d+)?%|\+\d|\-\d|\d{1,3},\d{3}|\d+\s?(min|hr|h|d|w)\s?ago|\bago\b)/i;

function nameFor(n, i) {
  if (n.text) return JSON.stringify(n.text.slice(0, 44));
  if (n.allText) return '“' + n.allText.slice(0, 40) + '…”';
  if (n.tag === 'img') return 'img';
  if (n.tag === 'svg') return 'svg';
  return `block[${i}]`;
}

function styleLine(n, tokenized) {
  const s = n.style, parts = [];
  const cx = (hex) => tokenized && T.names.has(hex) ? `T.${T.names.get(hex)}` : hex;
  const push = (k, v) => v && parts.push(`${k}: ${v}`);
  push('box', s._box);
  push('display', s.display);
  push('dir', s.flexDirection);
  push('wrap', s.flexWrap);
  push('align', s.alignItems);
  push('justify', s.justifyContent);
  push('justify-items', s.justifyItems);
  push('align-content', s.alignContent);
  push('grid-cols', s.gridTemplateColumns);
  push('grid-rows', s.gridTemplateRows);
  push('grid-auto-flow', s.gridAutoFlow);
  push('grid-auto-cols', s.gridAutoColumns);
  push('grid-col', s.gridColumn);
  push('grid-row', s.gridRow);
  push('justify-self', s.justifySelf);
  push('order', s.order);
  push('gap', s.gap);
  push('scroll-snap-type', s.scrollSnapType);
  push('scroll-snap-align', s.scrollSnapAlign);
  push('line-clamp', s.lineClamp);
  push('text-overflow', s.textOverflow);
  push('object-fit', s.objectFit);
  push('object-position', s.objectPosition);
  push('bg-size', s.backgroundSize);
  push('bg-position', s.backgroundPosition);
  push('bg-repeat', s.backgroundRepeat);
  push('bg-clip', s.backgroundClip);
  push('outline', s.outline);
  for (const k of Object.keys(s)) if (k.startsWith('css:')) push(k.slice(4), s[k]);
  if (s.flexGrow) push('flex-grow', s.flexGrow);
  if (s.flexShrink && s.flexShrink !== '1') push('flex-shrink', s.flexShrink);
  if (s.flexBasis && s.flexBasis !== 'auto') push('flex-basis', s.flexBasis);
  if (s.alignSelf) push('self', s.alignSelf);
  push('pad', s.padding);
  push('margin', s.margin);
  if (s.background) push('bg', cx(s.background));
  if (s.backgroundImage) push('bg-image', tokenized ? String(s.backgroundImage).replace(/#[0-9A-F]{6}(\/[\d.]+)?/g, m => cx(m)) : s.backgroundImage);
  if (s.border) push('border', tokenized ? String(s.border).replace(/#[0-9A-F]{6}(\/[\d.]+)?/g, m => cx(m)) : s.border);
  if (s.radius) push('radius', s.radius + (T.radNames.has(String(s.radius)) ? ` (T.${T.radNames.get(String(s.radius))})` : ''));
  if (s.boxShadow) push('shadow', tokenized ? String(s.boxShadow).replace(/#[0-9A-F]{6}(\/[\d.]+)?/g, m => cx(m)) : s.boxShadow);
  if (s.textShadow) push('text-shadow', tokenized ? String(s.textShadow).replace(/#[0-9A-F]{6}(\/[\d.]+)?/g, m => cx(m)) : s.textShadow);
  if (s.textFillColor) push('text-fill', cx(s.textFillColor));
  push('opacity', s.opacity);
  push('transform', s.transform);
  push('backdrop', s.backdropFilter);
  push('filter', s.filter);
  push('blend', s.mixBlendMode);
  push('overflow', s.overflow);
  if (s.position) push('position', `${s.position}${s.inset ? ' [' + s.inset + ']' : ''}${s.zIndex ? ' z' + s.zIndex : ''}`);

  // type
  const td = s._typeDiff || {};
  const tparts = [];
  if (td.color) tparts.push(`color ${cx(td.color)}`);
  if (td.fontFamily) tparts.push(td.fontFamily);
  if (td.fontSize) tparts.push(td.fontSize);
  if (td.fontWeight) tparts.push('w' + td.fontWeight);
  if (td.fontStyle && td.fontStyle !== 'normal') tparts.push(td.fontStyle);
  if (td.letterSpacing && td.letterSpacing !== 'normal') tparts.push('ls ' + td.letterSpacing);
  if (td.lineHeight) tparts.push('lh ' + td.lineHeight);
  if (td.textTransform && td.textTransform !== 'none') tparts.push(td.textTransform);
  if (td.textAlign && td.textAlign !== 'start') tparts.push('align-' + td.textAlign);
  if (td.textDecorationLine && td.textDecorationLine !== 'none') tparts.push(td.textDecorationLine);
  if (td.whiteSpace && td.whiteSpace !== 'normal') tparts.push(td.whiteSpace);
  if (tparts.length) parts.push('type: ' + tparts.join(' / '));
  if (n.text && s._type) {
    const sig = [s._type.fontFamily, s._type.fontSize, s._type.fontWeight, s._type.letterSpacing, s._type.lineHeight, s._type.textTransform].join('|');
    if (T.typeNames.has(sig)) parts.push(`scale: T.${T.typeNames.get(sig)}`);
  }
  return parts.join(' · ');
}

function renderSpec(board, canvasTitle, slug) {
  const L = [];
  L.push(`# ${board.label}`);
  L.push('');
  L.push(`Canvas: **${canvasTitle}** · board index ${board.index} · slug \`${slug}\``);
  L.push(`Frame: **${board.frameW}×${board.frameH}px** (design width ${board.frameW}px — port at 390px logical, scale ratios).`);
  L.push('');
  L.push(`![render](./render.png)`);
  L.push('');
  L.push('> Style values are EXACT computed values from the canvas. `T.*` = canvas token, resolved in');
  L.push('> the Tokens appendix at the bottom of this file. Text marked `(MOCK)` must not ship as drawn —');
  L.push('> see `../../DELTA.md` for its substitution rule.');
  L.push('');
  L.push('## Tree');
  L.push('');
  const usedColors = new Set(), usedTypes = new Set(), usedRadii = new Set();
  function walk(n, depth, i) {
    const ind = '  '.repeat(depth);
    const nm = nameFor(n, i);
    const line = styleLine(n, true);
    // record token usage
    (line.match(/T\.[a-z0-9-]+/g) || []).forEach(t => {
      const n = t.slice(2);
      if (/^ty\d+$/.test(n)) usedTypes.add(n);
      else if (/^r\d+$/.test(n)) usedRadii.add(n);
      else usedColors.add(n);
    });
    const mock = n.text && MOCKRE.test(n.text) ? ' **(MOCK)**' : '';
    L.push(`${ind}- **${nm}**${mock} → \`<${n.tag}>\``);
    if (line) L.push(`${ind}  - ${line}`);
    if (n.text) L.push(`${ind}  - text: ${JSON.stringify(n.text)}`);
    if (n.src) L.push(`${ind}  - img src: \`${n.src}\``);
    if (n.svg) L.push(`${ind}  - svg: \`${n.svg.replace(/`/g, "'").slice(0, 300)}\``);
    n.kids.forEach((k, j) => walk(k, depth + 1, j));
  }
  walk(board.tree, 0, 0);

  L.push('');
  L.push('## Tokens used in this board');
  L.push('');
  L.push('| token | value | role |');
  L.push('| --- | --- | --- |');
  for (const [hex, e] of T.colors) {
    const nm = T.names.get(hex);
    if (usedColors.has(nm)) L.push(`| T.${nm} | \`${hex}\` | ${[...e.roles].join(', ')} |`);
  }
  for (const [sig, e] of T.types) {
    const nm = T.typeNames.get(sig);
    if (usedTypes.has(nm)) {
      const d = e.def;
      L.push(`| T.${nm} | ${d.fontFamily} ${d.fontSize}/${d.lineHeight} w${d.fontWeight} ls:${d.letterSpacing}${d.textTransform !== 'none' ? ' ' + d.textTransform : ''} | type scale |`);
    }
  }
  for (const [v] of T.radii) {
    const nm = T.radNames.get(v);
    if (usedRadii.has(nm)) L.push(`| T.${nm} | \`${v}\` | radius |`);
  }
  L.push('');
  return L.join('\n');
}

function prettify(html) {
  // insert newlines between tags, then indent
  let s = html.replace(/></g, '>\n<');
  const lines = s.split('\n');
  let d = 0; const out = [];
  const VOID = /^<(img|br|hr|input|meta|link|source|path|circle|rect|line|polyline|polygon|ellipse|use|stop)\b/i;
  for (let ln of lines) {
    ln = ln.trim();
    if (!ln) continue;
    if (/^<\//.test(ln)) d = Math.max(0, d - 1);
    out.push('  '.repeat(d) + ln);
    if (/^<[^/!?]/.test(ln) && !/\/>$/.test(ln) && !VOID.test(ln) && !/<\/[a-zA-Z-]+>$/.test(ln)) d++;
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- write
const outDir = path.join(OUT_ROOT, key);
fs.mkdirSync(outDir, { recursive: true });

const index = [];
for (const b of collected.boards) {
  const m = b.label.match(/^(\d+)\s*(.*)$/);
  const num = m ? m[1].padStart(2, '0') : String(b.index + 1).padStart(2, '0');
  const rest = m ? m[2] : b.label;
  const slug = `${num}-${slugify(rest) || 'board'}`;
  const dir = path.join(outDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'dom.html'), prettify(b.html));
  fs.writeFileSync(path.join(dir, 'spec.md'), renderSpec(b, collected.header.split('\n')[0] || key, slug));
  const el = await page.$(`[data-dcx-frame="${b.index}"]`);
  await el.screenshot({ path: path.join(dir, 'render.png') });
  index.push({ slug, label: b.label, num, title: rest, texts: b.texts, w: b.frameW, h: b.frameH });
  console.log('  ✓', slug, `${b.frameW}x${b.frameH}`);
}

// TOKENS.md
{
  const L = [`# Tokens — ${key}`, '', `Source: \`${path.basename(file)}\``, `Canvas heading: ${JSON.stringify(collected.header.split('\n').slice(0, 2).join(' — '))}`, `Canvas background: \`${collected.canvasBg}\``, '', '## Colour palette', '', '| token | hex | uses | roles |', '| --- | --- | --- | --- |'];
  for (const [hex, e] of T.colors) L.push(`| ${T.names.get(hex)} | \`${hex}\` | ${e.count} | ${[...e.roles].join(', ')} |`);
  L.push('', '## Type scale', '', '| token | family | size | weight | letter-spacing | line-height | transform | uses | samples |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [sig, e] of T.types) {
    const d = e.def;
    L.push(`| ${T.typeNames.get(sig)} | ${d.fontFamily} | ${d.fontSize} | ${d.fontWeight} | ${d.letterSpacing} | ${d.lineHeight} | ${d.textTransform} | ${e.count} | ${e.samples.map(s => '`' + s.replace(/\|/g, '\\|') + '`').join(' ')} |`);
  }
  L.push('', '## Radius scale', '', '| token | value | uses |', '| --- | --- | --- |');
  for (const [v, e] of T.radii) L.push(`| ${T.radNames.get(v)} | \`${v}\` | ${e.count} |`);
  L.push('', '## Spacing steps (gap + padding)', '', '| value | uses | roles |', '| --- | --- | --- |');
  for (const [v, e] of T.spaces) L.push(`| \`${v}\` | ${e.count} | ${[...e.roles].join(', ')} |`);
  L.push('', '## Shadows', '', '| value | uses |', '| --- | --- |');
  for (const [v, e] of T.shadows) L.push(`| \`${v}\` | ${e.count} |`);
  L.push('');
  fs.writeFileSync(path.join(outDir, 'TOKENS.md'), L.join('\n'));
}

fs.writeFileSync(path.join(outDir, '_raw.json'), JSON.stringify({
  key, file, header: collected.header, canvasBg: collected.canvasBg,
  boards: index,
  tokens: {
    colors: T.colors.map(([hex, e]) => ({ token: T.names.get(hex), hex, count: e.count, roles: [...e.roles] })),
    types: T.types.map(([sig, e]) => ({ token: T.typeNames.get(sig), ...e.def, count: e.count, samples: e.samples })),
    radii: T.radii.map(([v, e]) => ({ token: T.radNames.get(v), v, count: e.count })),
  },
}, null, 2));

console.log(`DONE ${key}: ${collected.boards.length} boards`);
await browser.close();
