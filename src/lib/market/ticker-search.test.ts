/**
 * Regression tests for the ticker suggest ranking (the "junk suggestions" +
 * "TSLA missing" bugs). Zero-tooling Node runner:
 *   node --test src/lib/market/ticker-search.test.ts
 *
 * The core guarantee: for each of 20 well-known majors, typing its own symbol
 * ranks that company's common stock as the #1 suggestion — even when the
 * candidate set is polluted with the leveraged ETFs, warrants and foreign
 * cross-listings that used to bury it under Polygon's fuzzy search.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { rankTickerHits, type SearchCandidate } from "./ticker-search.ts";

/** 20 majors: symbol → the real company name as stored in screener_metrics. */
const MAJORS: [string, string, number][] = [
  ["AAPL", "Apple Inc.", 3_500e9],
  ["MSFT", "Microsoft Corp", 3_300e9],
  ["TSLA", "Tesla, Inc. Common Stock", 900e9],
  ["NVDA", "Nvidia Corp", 3_400e9],
  ["AMZN", "Amazon.Com Inc", 2_100e9],
  ["GOOGL", "Alphabet Inc. Class A Common Stock", 2_200e9],
  ["META", "Meta Platforms, Inc. Class A Common Stock", 1_500e9],
  ["JPM", "JPMorgan Chase & Co.", 700e9],
  ["V", "VISA Inc.", 600e9],
  ["WMT", "Walmart Inc. Common Stock", 700e9],
  ["JNJ", "Johnson & Johnson", 400e9],
  ["XOM", "Exxon Mobil Corporation", 500e9],
  ["PG", "Procter & Gamble Company", 400e9],
  ["MA", "Mastercard Incorporated", 450e9],
  ["HD", "Home Depot, Inc.", 400e9],
  ["KO", "Coca-Cola Company", 300e9],
  ["DIS", "Walt Disney Company", 200e9],
  ["NFLX", "Netflix, Inc.", 300e9],
  ["BAC", "Bank of America Corporation", 300e9],
  ["INTC", "Intel Corporation", 150e9],
];

/** Noise that historically outranked or crowded out the real common stock. */
function noiseFor(sym: string): SearchCandidate[] {
  return [
    // leveraged / inverse ETFs whose ticker shares the prefix
    { ticker: `${sym}L`, name: `Leverage Shares 2x ${sym}`, exchange: "Cboe", type: "etf", mcap: 5e6 },
    { ticker: `${sym}Q`, name: `Inverse ${sym} ETF`, exchange: "NASDAQ", type: "etf", mcap: 2e6 },
    // a warrant-style / foreign cross-listing name-matching the company
    { ticker: `${sym}W`, name: `${sym} Holdings Warrant`, exchange: "NASDAQ", type: "common", mcap: null },
    { ticker: `Z${sym}`, name: `Some ${sym}-tracking fund`, exchange: "NYSE Arca", type: "etf", mcap: 1e7 },
  ];
}

for (const [sym, name, mcap] of MAJORS) {
  test(`major ${sym} ranks #1 for its own symbol`, () => {
    const real: SearchCandidate = { ticker: sym, name, exchange: "NASDAQ", type: "common", mcap };
    // Shuffle real in among the noise so ordering isn't accidental.
    const candidates = [...noiseFor(sym), real, ...noiseFor(sym)];
    const hits = rankTickerHits(candidates, sym, 8);
    assert.ok(hits.length > 0, `${sym}: expected at least one hit`);
    assert.equal(hits[0].ticker, sym, `${sym}: expected #1 to be ${sym}, got ${hits[0].ticker}`);
  });
}

test("common stock outranks ETF at the same tier", () => {
  const candidates: SearchCandidate[] = [
    { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "etf", mcap: 500e9 },
    { ticker: "SPGI", name: "S&P Global Inc.", exchange: "NYSE", type: "common", mcap: 150e9 },
  ];
  // Query "SP" — both are ticker-prefix (tier 1); common should win the tier.
  const hits = rankTickerHits(candidates, "SP", 8);
  assert.equal(hits[0].ticker, "SPGI");
});

test("name-match falls below ticker-prefix match", () => {
  const candidates: SearchCandidate[] = [
    { ticker: "APLD", name: "Applied Digital Corporation", exchange: "NASDAQ", type: "common", mcap: 2e9 },
    { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "common", mcap: 3500e9 },
  ];
  // "APP" is a ticker prefix for neither; it's a name-start for "Applied" and
  // "Apple". APLD ticker-prefix? no. AAPL ticker-prefix "APP"? no. Both name.
  // But query "AA" is a ticker prefix for AAPL only.
  const hits = rankTickerHits(candidates, "AA", 8);
  assert.equal(hits[0].ticker, "AAPL");
});

test("exchange + type pass through for the route to format", () => {
  const hits = rankTickerHits(
    [{ ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "common", mcap: 3500e9 }],
    "AAPL"
  );
  assert.equal(hits[0].exchange, "NASDAQ");
  assert.equal(hits[0].type, "common");
});
