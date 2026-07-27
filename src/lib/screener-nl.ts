import type { CustomFilters } from "@/lib/screener";

/**
 * parseScreenerQuery — a small, deterministic "Screen in plain English" parser
 * (canvas artboard 09). It maps natural phrases onto the SAME CustomFilters the
 * filter panel produces, so a parsed query is indistinguishable from a
 * hand-built screen (and the active-filter chips already narrate what it did).
 *
 * Deliberately NOT an LLM: this runs instantly, offline, and never hallucinates
 * a filter the UI can't render. Graceful degrade is the whole contract — if a
 * query matches nothing recognisable, `matched` is empty and the caller falls
 * back to a plain keyword search on `q`. Recognised fragments are removed as we
 * go; whatever a caller wants to treat as leftover keyword search is returned.
 */

export interface ParsedScreen {
  filters: Partial<CustomFilters>;
  matched: string[]; // human-readable list of what was understood
  leftover: string; // unconsumed text (for keyword fallback)
}

// Sector synonyms → the 11 canonical sectors (screener-sectors.ts).
const SECTOR_WORDS: { re: RegExp; sector: string; label: string }[] = [
  { re: /\b(semi(conductor)?s?|chips?|gpu)\b/, sector: "Technology", label: "Technology (semis)" },
  { re: /\b(tech|software|saas|it)\b/, sector: "Technology", label: "Technology" },
  { re: /\b(biotech|pharma(ceutical)?s?|health\s?care|health|medical|drug)\b/, sector: "Healthcare", label: "Healthcare" },
  { re: /\b(banks?|financials?|finance|insurance|fintech)\b/, sector: "Financials", label: "Financials" },
  { re: /\b(energy|oil|gas|solar|renewables?)\b/, sector: "Energy", label: "Energy" },
  { re: /\b(retail|consumer\s?discretionary|apparel|autos?|restaurants?)\b/, sector: "Consumer Discretionary", label: "Consumer Discretionary" },
  { re: /\b(staples?|consumer\s?staples|food|beverage)\b/, sector: "Consumer Staples", label: "Consumer Staples" },
  { re: /\b(industrials?|manufactur\w*|aerospace|defense|defence)\b/, sector: "Industrials", label: "Industrials" },
  { re: /\b(materials?|mining|metals?|gold|chemicals?)\b/, sector: "Materials", label: "Materials" },
  { re: /\b(real\s?estate|reits?)\b/, sector: "Real Estate", label: "Real Estate" },
  { re: /\b(utilit\w+)\b/, sector: "Utilities", label: "Utilities" },
  { re: /\b(media|telecom\w*|communication\w*|entertainment)\b/, sector: "Communication Services", label: "Communication Services" },
];

function dollars(s: string): number | null {
  // "$60", "60", "2b", "2 billion", "500m", "1.5b"
  const m = s.match(/\$?\s*([\d,.]+)\s*(b(illion)?|m(illion)?|k)?/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("b")) n *= 1_000_000_000;
  else if (unit.startsWith("m")) n *= 1_000_000;
  else if (unit.startsWith("k")) n *= 1_000;
  return n;
}

export function parseScreenerQuery(input: string): ParsedScreen {
  const filters: Partial<CustomFilters> = {};
  const matched: string[] = [];
  let text = ` ${input.toLowerCase()} `;
  const consume = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // ── Sector (first match wins) ──
  for (const s of SECTOR_WORDS) {
    if (s.re.test(text)) {
      filters.sector = s.sector;
      matched.push(s.label);
      consume(new RegExp(s.re, "g"));
      break;
    }
  }

  // ── Security type ──
  if (/\betfs?\b/.test(text)) {
    filters.type = "etf";
    matched.push("ETFs");
    consume(/\betfs?\b/g);
  } else if (/\b(common\s?stocks?|stocks?\s?only|no\s?etfs?)\b/.test(text)) {
    filters.type = "common";
    matched.push("Common stocks");
    consume(/\b(common\s?stocks?|stocks?\s?only|no\s?etfs?)\b/g);
  }

  // ── Price bounds: "under/below $60", "over/above $10", "between $5 and $50" ──
  const between = text.match(/\bbetween\s+\$?([\d,.]+)\s+and\s+\$?([\d,.]+)/);
  if (between) {
    const lo = dollars(between[1]);
    const hi = dollars(between[2]);
    if (lo != null) filters.minPrice = Math.min(lo, hi ?? lo);
    if (hi != null) filters.maxPrice = Math.max(lo ?? hi, hi);
    matched.push(`Price $${filters.minPrice}–$${filters.maxPrice}`);
    consume(/\bbetween\s+\$?[\d,.]+\s+and\s+\$?[\d,.]+/g);
  } else {
    const under = text.match(/\b(under|below|less\s?than|cheaper\s?than|<)\s*\$?\s*([\d,.]+)/);
    if (under) {
      const v = dollars(under[2]);
      if (v != null) {
        filters.maxPrice = v;
        matched.push(`Price ≤ $${v}`);
        consume(/\b(under|below|less\s?than|cheaper\s?than|<)\s*\$?\s*[\d,.]+/g);
      }
    }
    const over = text.match(/\b(over|above|more\s?than|greater\s?than|>)\s*\$?\s*([\d,.]+)/);
    if (over) {
      const v = dollars(over[2]);
      if (v != null) {
        filters.minPrice = v;
        matched.push(`Price ≥ $${v}`);
        consume(/\b(over|above|more\s?than|greater\s?than|>)\s*\$?\s*[\d,.]+/g);
      }
    }
  }

  // ── Market cap language ──
  if (/\b(mega\s?cap|large\s?cap|big\s?cap)\b/.test(text)) {
    filters.minMcap = 10_000_000_000;
    matched.push("Large cap");
    consume(/\b(mega\s?cap|large\s?cap|big\s?cap)\b/g);
  } else if (/\b(small\s?cap|micro\s?cap|small\s?companies)\b/.test(text)) {
    filters.maxMcap = 2_000_000_000;
    matched.push("Small cap");
    consume(/\b(small\s?cap|micro\s?cap|small\s?companies)\b/g);
  }

  // ── Volume ──
  if (/\b(rising|high|unusual|surging|heavy|big)\s+volume\b|\bvolume\s+(surge|spike)\b/.test(text)) {
    filters.minVolRatio = 1.5;
    matched.push("Volume ≥ 1.5×");
    consume(/\b(rising|high|unusual|surging|heavy|big)\s+volume\b/g);
    consume(/\bvolume\s+(surge|spike)\b/g);
  }

  // ── Momentum / RSI (advanced; applies for FTA — harmless otherwise) ──
  if (/\boversold\b/.test(text)) {
    filters.rsiMax = 30;
    matched.push("Oversold (RSI ≤ 30)");
    consume(/\boversold\b/g);
  }
  if (/\b(overbought|very\s?strong)\b/.test(text)) {
    filters.rsiMin = 70;
    matched.push("Strong (RSI ≥ 70)");
    consume(/\b(overbought|very\s?strong)\b/g);
  }
  if (/\bnear\s+(a\s+)?(52[-\s]?week\s+)?high(s)?\b|\bbreaking\s+out\b/.test(text)) {
    filters.nearHigh = true;
    matched.push("Near 52w high");
    consume(/\bnear\s+(a\s+)?(52[-\s]?week\s+)?high(s)?\b/g);
    consume(/\bbreaking\s+out\b/g);
  }
  if (/\bnear\s+(a\s+)?(52[-\s]?week\s+)?low(s)?\b/.test(text)) {
    filters.nearLow = true;
    matched.push("Near 52w low");
    consume(/\bnear\s+(a\s+)?(52[-\s]?week\s+)?low(s)?\b/g);
  }

  // ── % moves: "up 10% this month", "up 5% today" ──
  const up = text.match(/\bup\s+([\d.]+)\s?%\s*(today|this\s?week|this\s?month|1d|1w|1m)?/);
  if (up) {
    const pct = parseFloat(up[1]);
    const win = (up[2] || "").replace(/\s/g, "");
    if (!isNaN(pct)) {
      if (win === "thismonth" || win === "1m") { filters.minChg1m = pct; matched.push(`1m ≥ ${pct}%`); }
      else if (win === "thisweek" || win === "1w") { filters.minChg5d = pct; matched.push(`5d ≥ ${pct}%`); }
      else { filters.minChg1d = pct; matched.push(`1d ≥ ${pct}%`); }
      consume(/\bup\s+[\d.]+\s?%\s*(today|this\s?week|this\s?month|1d|1w|1m)?/g);
    }
  }

  // Strip common filler so leftover is a clean keyword fallback.
  const leftover = text
    .replace(/\b(with|and|that|are|is|the|a|an|stocks?|companies|show\s?me|find|screen(er)?|for|in|of|near|to|by)\b/g, " ")
    .replace(/[^a-z0-9.\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { filters, matched, leftover };
}
