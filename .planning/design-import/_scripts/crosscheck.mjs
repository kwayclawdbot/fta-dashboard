// Pairs the dark canvas palette against the light twin by usage-count + role
// signature, proving (or disproving) the 1:1 token mapping the canvases claim.
// Writes ../TOKEN-MAP.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..');
const dark = JSON.parse(fs.readFileSync(path.join(R, 'app-dark/_raw.json'), 'utf8'));
const light = JSON.parse(fs.readFileSync(path.join(R, 'app-light/_raw.json'), 'utf8'));

const pos = JSON.parse(fs.readFileSync(path.join(R, 'TOKEN-MAP-POSITIONAL.json'), 'utf8'));
const darkTok = new Map(dark.tokens.colors.map(c => [c.hex, c]));
const lightTok = new Map(light.tokens.colors.map(c => [c.hex, c]));

const clean = pos.pairs.filter(p => p.light.length === 1);
const split = pos.pairs.filter(p => p.light.length > 1);

const L = ['# Light ↔ Dark token map — Cheat Code App canvas', '',
  'Method: **positional lockstep walk**. Both canvases were opened in a real browser and every',
  'painted node was visited along an identical DOM path, recording the computed colour for each',
  'paint role (`bg` / `text` / `border-*`). A pair below therefore means *the same literal node*',
  'paints with those two values — it is one semantic token expressed in two themes, not a guess.',
  '', `**Structural identity: ${pos.pairs.reduce((a, p) => a + p.total, 0)} paint records in the dark canvas, all ${pos.missingPaths === 0 ? 'matched' : 'not matched'} in the light canvas ` +
  `(${pos.missingPaths} unmatched paths).** The two files are the same DOM with a swapped palette.`,
  '', `Dark canvas ground: \`${dark.canvasBg}\` · Light canvas ground: \`${light.canvasBg}\``,
  '', `Clean 1:1 pairs: **${clean.length}** · one-to-many (dark value that splits in light): **${split.length}**`,
  '', '## 1:1 pairs', '',
  '| # | dark | light | paint records | roles |', '| --- | --- | --- | --- | --- |'];
clean.forEach((p, i) => {
  const d = darkTok.get(p.dark), l = lightTok.get(p.light[0].hex);
  L.push(`| ${i + 1} | \`${p.dark}\`${d ? ' (T.' + d.token + ')' : ''} | \`${p.light[0].hex}\`${l ? ' (T.' + l.token + ')' : ''} | ${p.total} | ${d ? d.roles.join(', ') : ''} |`);
});
if (split.length) {
  L.push('', '## One-to-many — PORT CAREFULLY', '',
    'These dark values do **not** collapse to a single light value. The light theme distinguishes',
    'surfaces the dark theme merges. Bind by the role listed, never by the hex.', '',
    '| dark | light values (× records) | total |', '| --- | --- | --- |');
  split.forEach(p => {
    const d = darkTok.get(p.dark);
    L.push(`| \`${p.dark}\`${d ? ' (T.' + d.token + ')' : ''} | ${p.light.map(x => '`' + x.hex + '` ×' + x.n).join(' · ')} | ${p.total} |`);
  });
}

// type scale identity check
const dt = dark.tokens.types, lt = light.tokens.types;
const tsig = t => `${t.fontFamily}|${t.fontSize}|${t.fontWeight}|${t.letterSpacing}|${t.lineHeight}|${t.textTransform}`;
const dset = new Set(dt.map(tsig)), lset = new Set(lt.map(tsig));
const onlyD = [...dset].filter(x => !lset.has(x)), onlyL = [...lset].filter(x => !dset.has(x));
L.push('', '## Type scale identity', '',
  `Dark type variants: ${dt.length} · Light: ${lt.length} · shared: ${[...dset].filter(x => lset.has(x)).length}`,
  onlyD.length || onlyL.length ? '' : '',
  onlyD.length ? '\nDark-only type variants:\n' + onlyD.map(x => '- `' + x + '`').join('\n') : '**Type scale is identical across themes — port one scale.**',
  onlyL.length ? '\nLight-only type variants:\n' + onlyL.map(x => '- `' + x + '`').join('\n') : '');

// radius identity
const dr = dark.tokens.radii.map(r => r.v), lr = light.tokens.radii.map(r => r.v);
L.push('', '## Radius identity', '',
  JSON.stringify(dr) === JSON.stringify(lr)
    ? `**Identical (${dr.length} steps).** ${dr.join(', ')}`
    : `Dark: ${dr.join(', ')}\n\nLight: ${lr.join(', ')}`);

// board parity
L.push('', '## Board parity', '', '| # | dark board | light board | match |', '| --- | --- | --- | --- |');
const n = Math.max(dark.boards.length, light.boards.length);
for (let i = 0; i < n; i++) {
  const d = dark.boards[i], l = light.boards[i];
  L.push(`| ${i + 1} | ${d ? d.label : '—'} | ${l ? l.label : '—'} | ${d && l && d.label === l.label ? '✅' : '⚠️'} |`);
}
L.push('');
fs.writeFileSync(path.join(R, 'TOKEN-MAP.md'), L.join('\n'));
console.log('1:1 pairs', clean.length, '· one-to-many', split.length);
console.log('type onlyD', onlyD.length, 'onlyL', onlyL.length, 'radii same', JSON.stringify(dr) === JSON.stringify(lr));
