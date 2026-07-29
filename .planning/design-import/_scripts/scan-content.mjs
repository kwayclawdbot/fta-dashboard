// Scans extracted board texts for (a) mock data and (b) compliance-flagged content.
// Prints a per-board candidate ledger used to author DELTA.md.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..');

const RULES = [
  ['SCALE', /^\s*[\d,.]+[KM]?\s*(members|online|listening|watching|replies|families|opinions|traders|people|posts|joined|talking|here|in room)/i],
  ['SCALE', /\b\d{1,3},\d{3}\b/],
  ['PERF', /\b(accuracy|win rate|hit rate|track record|returns?)\b/i],
  ['DIRECTIVE', /^\s*(BUY|SELL|SHORT|STRONG BUY|ACCUMULATE|TAKE PROFIT|ENTRY|TARGET|STOP)\s*$/i],
  ['OPTIONS', /\b(option|options|calls?|puts?|strike|IV|theta|delta|leverage|margin)\b/i],
  ['PRICE', /^\s*\$[\d,.]+/],
  ['PCT', /^\s*[▲▼+\-]?\s*[\d.]+%\s*$/],
  ['XP', /\b(XP|belt|streak|level)\b/i],
  ['PERSON', /\b(Marcus|Maya|Jordan|Sofia|Dev|Priya|Elena|Tariq|Nina|Leo|Ava|Zoe|Sam|Kai)\b/],
  ['TIME', /\b\d+\s?(m|min|h|hr|d|w)\s+ago\b/i],
  ['PRICELVL', /\b\d+\.\d{2}\b/],
];

for (const key of ['app-dark', 'family', 'club-screens']) {
  const raw = JSON.parse(fs.readFileSync(path.join(R, key, '_raw.json'), 'utf8'));
  console.log(`\n################ ${key}`);
  for (const b of raw.boards) {
    const hits = new Map();
    for (const t of b.texts) {
      for (const [tag, re] of RULES) if (re.test(t)) {
        if (!hits.has(tag)) hits.set(tag, new Set());
        hits.get(tag).add(t.slice(0, 46));
      }
    }
    console.log(`\n== ${b.slug} — ${b.label}`);
    console.log(`   ALL: ${b.texts.join(' ¦ ').slice(0, 900)}`);
    for (const [tag, s] of hits) console.log(`   [${tag}] ${[...s].slice(0, 14).join(' ¦ ')}`);
  }
}
