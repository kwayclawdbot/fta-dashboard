/**
 * Unit tests for the Kai Watch state machine (LANE A). Zero-tooling runner:
 *   node --test src/lib/alerts/watch-state.test.ts   (npm run test:watch)
 * Node strips the types; no build step.
 *
 * Covers the three behaviours the spec calls out: below-cap fires, above-cap is
 * suppressed, and steady-state emits nothing — plus the full ladder + retreats.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  deriveWatchState,
  shouldEmitTransition,
  isFeedUpdateState,
  isPushWorthyState,
  withinCadenceCap,
  WATCH_UPDATE_DAILY_CAP,
  watchUpdateCopy,
  type WatchInputs,
} from "./watch-state.ts";
import type { AlertParams } from "./types.ts";

const P = (p: AlertParams) => p;

/* ── price_cross ladder ────────────────────────────────────────────────────*/

test("price_cross climbs watching → building → near_trigger → triggered", () => {
  const params = P({ op: "above", price: 150 });
  const at = (price: number) => classify("price_cross", params, { price })!.raw;
  assert.equal(at(140), "watching"); // 0.933 of the way
  assert.equal(at(143), "building"); // 0.953
  assert.equal(at(148), "near_trigger"); // 0.987
  assert.equal(at(151), "triggered"); // cleared
});

test("price_cross below-side approaches from above", () => {
  const params = P({ op: "below", price: 100 });
  assert.equal(classify("price_cross", params, { price: 130 })!.raw, "watching");
  assert.equal(classify("price_cross", params, { price: 104 })!.raw, "building");
  assert.equal(classify("price_cross", params, { price: 101 })!.raw, "near_trigger");
  assert.equal(classify("price_cross", params, { price: 99 })!.raw, "triggered");
});

test("retreat from near_trigger becomes cooled (not invalidated) for a price watch", () => {
  const params = P({ op: "above", price: 150 });
  const d = deriveWatchState("price_cross", params, { price: 140 }, "near_trigger");
  assert.equal(d!.state, "cooled");
});

test("a cooled watch holds until it genuinely rebuilds", () => {
  const params = P({ op: "above", price: 150 });
  // still soft → stays cooled (no ping-pong to watching)
  assert.equal(deriveWatchState("price_cross", params, { price: 140 }, "cooled")!.state, "cooled");
  // rebuilds → re-engages to building
  assert.equal(deriveWatchState("price_cross", params, { price: 144 }, "cooled")!.state, "building");
});

/* ── other kinds ───────────────────────────────────────────────────────────*/

test("pct_move / vol_surge / rsi_cross / w52_break band correctly", () => {
  assert.equal(classify("pct_move", P({ pct: 5 }), { changePercent: 3 })!.raw, "building");
  assert.equal(classify("pct_move", P({ pct: 5 }), { changePercent: 4.2 })!.raw, "near_trigger");
  assert.equal(classify("pct_move", P({ pct: 5 }), { changePercent: 5.1 })!.raw, "triggered");

  assert.equal(classify("vol_surge", P({ ratio: 3 }), { volRatio: 1.9 })!.raw, "building");
  assert.equal(classify("vol_surge", P({ ratio: 3 }), { volRatio: 2.6 })!.raw, "near_trigger");
  assert.equal(classify("vol_surge", P({ ratio: 3 }), { volRatio: 3.1 })!.raw, "triggered");

  const rsi = P({ op: "below", level: 30 });
  assert.equal(classify("rsi_cross", rsi, { rsi14: 40 })!.raw, "watching");
  assert.equal(classify("rsi_cross", rsi, { rsi14: 36 })!.raw, "building");
  assert.equal(classify("rsi_cross", rsi, { rsi14: 32 })!.raw, "near_trigger");
  assert.equal(classify("rsi_cross", rsi, { rsi14: 29 })!.raw, "triggered");

  const w52 = P({ edge: "high" });
  assert.equal(classify("w52_break", w52, { dist52wHigh: 6 })!.raw, "watching");
  assert.equal(classify("w52_break", w52, { dist52wHigh: 4 })!.raw, "building");
  assert.equal(classify("w52_break", w52, { dist52wHigh: 1.5 })!.raw, "near_trigger");
  assert.equal(classify("w52_break", w52, { dist52wHigh: 0.4 })!.raw, "triggered");
});

test("sentiment collapse after near_trigger is an invalidation", () => {
  const params = P({ sentiment: "bullish", delta: 5 });
  // climbed to near_trigger (swing +4 of +5)
  assert.equal(classify("sentiment_velocity", params, { sentimentNet: 4, sentimentBase: 0 })!.raw, "near_trigger");
  // net swings hard negative → progress ~0 → invalidated
  const d = deriveWatchState("sentiment_velocity", params, { sentimentNet: -1, sentimentBase: 0 }, "near_trigger");
  assert.equal(d!.state, "invalidated");
});

test("earnings_wait parks a quiet watch with a known event coming", () => {
  const d = deriveWatchState("news_event", P({}), { hasFreshEvent: false, earningsInDays: 5 }, null);
  assert.equal(d!.state, "earnings_wait");
  // a fresh event fires (triggered), overriding the parking state
  const t = deriveWatchState("news_event", P({}), { hasFreshEvent: true, earningsInDays: 5 }, null);
  assert.equal(t!.state, "triggered");
});

test("missing inputs → null (state left unchanged, still fresh-stamped)", () => {
  const empty: WatchInputs = {};
  assert.equal(deriveWatchState("price_cross", P({ op: "above", price: 150 }), empty, "building"), null);
  assert.equal(deriveWatchState("rsi_cross", P({ level: 30 }), empty, null), null);
});

/* ── transition gating (steady-state emits nothing) ────────────────────────*/

test("shouldEmitTransition: only real changes emit; steady-state is silent", () => {
  assert.equal(shouldEmitTransition("building", "building"), false); // steady-state
  assert.equal(shouldEmitTransition("building", "near_trigger"), true);
  assert.equal(shouldEmitTransition(null, "watching"), true); // first sighting
  assert.equal(shouldEmitTransition(null, null), false);
  assert.equal(shouldEmitTransition("near_trigger", "triggered"), true);
});

test("feed-worthy vs push-worthy classification", () => {
  assert.equal(isFeedUpdateState("building"), true);
  assert.equal(isFeedUpdateState("near_trigger"), true);
  assert.equal(isFeedUpdateState("cooled"), true);
  assert.equal(isFeedUpdateState("invalidated"), true);
  assert.equal(isFeedUpdateState("earnings_wait"), true);
  assert.equal(isFeedUpdateState("watching"), false); // silent baseline
  assert.equal(isFeedUpdateState("triggered"), false); // real alert covers it

  assert.equal(isPushWorthyState("near_trigger"), true);
  assert.equal(isPushWorthyState("building"), false);
  assert.equal(isPushWorthyState("cooled"), false);
});

/* ── cadence cap (binding: max 2/day per watch) ────────────────────────────*/

test("cadence cap: below-cap fires, at/above-cap suppressed", () => {
  assert.equal(WATCH_UPDATE_DAILY_CAP, 2);
  assert.equal(withinCadenceCap(0), true); // 1st update
  assert.equal(withinCadenceCap(1), true); // 2nd update
  assert.equal(withinCadenceCap(2), false); // 3rd suppressed
  assert.equal(withinCadenceCap(5), false);
});

test("copy is plain-language, never engineering vocabulary", () => {
  const c = watchUpdateCopy("building", "NVDA", { metric: "volume 1.9× its average" });
  assert.match(c, /NVDA/);
  assert.doesNotMatch(c.toLowerCase(), /rule|trigger fired|condition met|predicate/);
});
