import { SeededRNG } from "./seeded-rng";
import type { OHLCV } from "./market-engine";
import type { ScenarioDefinition, Waypoint } from "./scenarios";

// Generates bars that follow a pattern's waypoint path with natural-looking noise
export function generatePatternBars(
  scenario: ScenarioDefinition,
  seed: number,
  basePrice: number = 100
): { leadIn: OHLCV[]; pattern: OHLCV[]; resolution: OHLCV[] } {
  const rng = new SeededRNG(seed);
  const baseVol = 0.015; // base per-bar noise

  // Generate lead-in bars (establish prior trend context)
  const leadIn = generateLeadIn(rng, basePrice, scenario, baseVol);
  const lastLeadInPrice =
    leadIn.length > 0 ? leadIn[leadIn.length - 1].close : basePrice;

  // Generate pattern bars via waypoint interpolation
  const pattern = generateFromWaypoints(
    rng,
    lastLeadInPrice,
    scenario.waypoints,
    baseVol
  );

  // Generate resolution bars (outcome after decision point)
  const lastPatternPrice =
    pattern.length > 0 ? pattern[pattern.length - 1].close : lastLeadInPrice;
  const resolution = generateResolution(
    rng,
    lastPatternPrice,
    scenario.resolutionBars,
    scenario.resolutionDrift,
    baseVol
  );

  // Assign sequential time indices
  let timeIdx = 0;
  for (const bar of leadIn) bar.time = timeIdx++;
  for (const bar of pattern) bar.time = timeIdx++;
  for (const bar of resolution) bar.time = timeIdx++;

  return { leadIn, pattern, resolution };
}

function generateLeadIn(
  rng: SeededRNG,
  startPrice: number,
  scenario: ScenarioDefinition,
  baseVol: number
): OHLCV[] {
  const bars: OHLCV[] = [];
  let price = startPrice;
  const count = scenario.leadInBars;

  // Determine lead-in trend from first waypoint direction
  const firstWp = scenario.waypoints[0];
  const secondWp = scenario.waypoints[1];
  const patternGoesUp = secondWp ? secondWp.priceRatio > firstWp.priceRatio : true;
  // Lead-in trends in the same direction to establish context
  const drift = patternGoesUp ? 0.002 : -0.002;

  for (let i = 0; i < count; i++) {
    const noise = rng.gaussian() * baseVol;
    const newPrice = price * (1 + drift + noise);
    bars.push(makeBar(rng, price, newPrice, baseVol, 0));
    price = newPrice;
  }

  return bars;
}

function generateFromWaypoints(
  rng: SeededRNG,
  startPrice: number,
  waypoints: Waypoint[],
  baseVol: number
): OHLCV[] {
  const bars: OHLCV[] = [];
  if (waypoints.length < 2) return bars;

  // Waypoints define relative prices (ratios to start price)
  const targetPrices = waypoints.map((wp) => startPrice * wp.priceRatio);
  let price = startPrice;

  for (let wpIdx = 0; wpIdx < waypoints.length - 1; wpIdx++) {
    const fromBar = waypoints[wpIdx].barOffset;
    const toBar = waypoints[wpIdx + 1].barOffset;
    const fromPrice = targetPrices[wpIdx];
    const toPrice = targetPrices[wpIdx + 1];
    const fromVol = waypoints[wpIdx].volatilityScale ?? 1.0;
    const toVol = waypoints[wpIdx + 1].volatilityScale ?? 1.0;
    const segBars = toBar - fromBar;

    for (let i = 0; i < segBars; i++) {
      const t = (i + 1) / segBars;
      // Smooth interpolation (ease in-out)
      const tSmooth = t * t * (3 - 2 * t);
      const targetPrice = fromPrice + (toPrice - fromPrice) * tSmooth;
      const volScale = fromVol + (toVol - fromVol) * t;

      // Pull toward target with noise
      const pullStrength = 0.3;
      const target = price + (targetPrice - price) * pullStrength;
      const noise = rng.gaussian() * baseVol * volScale;
      const newPrice = target * (1 + noise);

      bars.push(makeBar(rng, price, newPrice, baseVol * volScale, 0));
      price = newPrice;
    }
  }

  return bars;
}

function generateResolution(
  rng: SeededRNG,
  startPrice: number,
  bars: number,
  totalDrift: number,
  baseVol: number
): OHLCV[] {
  const result: OHLCV[] = [];
  let price = startPrice;
  const driftPerBar = totalDrift / bars;

  for (let i = 0; i < bars; i++) {
    // Accelerating drift (stronger toward end)
    const accel = 1 + (i / bars) * 1.5;
    const noise = rng.gaussian() * baseVol * 1.2;
    const newPrice = price * (1 + driftPerBar * accel + noise);
    result.push(makeBar(rng, price, newPrice, baseVol * 1.2, 0));
    price = newPrice;
  }

  return result;
}

function makeBar(
  rng: SeededRNG,
  prevClose: number,
  closeTarget: number,
  vol: number,
  _timeIdx: number
): OHLCV {
  const open = prevClose * (1 + rng.gaussian() * vol * 0.3);
  const close = closeTarget;
  const mid = (open + close) / 2;
  const highExtra = Math.abs(rng.gaussian() * vol * 0.5);
  const lowExtra = Math.abs(rng.gaussian() * vol * 0.5);
  const high = Math.max(open, close, mid) * (1 + highExtra);
  const low = Math.min(open, close, mid) * (1 - lowExtra);
  const volume = Math.round(30000 + Math.abs(rng.gaussian()) * 20000);

  return {
    time: 0, // assigned later
    open: r2(open),
    high: r2(high),
    low: r2(low),
    close: r2(close),
    volume,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
