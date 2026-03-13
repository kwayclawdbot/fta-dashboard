import { SeededRNG } from "./seeded-rng";

export interface OHLCV {
  time: number; // bar index
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EngineConfig {
  seed: number;
  startPrice: number;
  drift: number;        // annualized drift (e.g., 0.05 = 5%)
  volatility: number;   // annualized vol (e.g., 0.25 = 25%)
  momentum: number;     // momentum factor 0-1
  meanReversion: number; // mean reversion speed 0-1
  volumeBase: number;   // average volume per bar
}

export const SYMBOL_PRESETS: Record<string, EngineConfig> = {
  AAPL:  { seed: 1001, startPrice: 175, drift: 0.08, volatility: 0.22, momentum: 0.3, meanReversion: 0.05, volumeBase: 50000 },
  TSLA:  { seed: 2002, startPrice: 240, drift: 0.12, volatility: 0.45, momentum: 0.4, meanReversion: 0.03, volumeBase: 80000 },
  MSFT:  { seed: 3003, startPrice: 380, drift: 0.06, volatility: 0.18, momentum: 0.2, meanReversion: 0.08, volumeBase: 35000 },
  AMZN:  { seed: 4004, startPrice: 178, drift: 0.10, volatility: 0.28, momentum: 0.35, meanReversion: 0.04, volumeBase: 45000 },
  NVDA:  { seed: 5005, startPrice: 480, drift: 0.15, volatility: 0.40, momentum: 0.45, meanReversion: 0.02, volumeBase: 60000 },
  META:  { seed: 6006, startPrice: 350, drift: 0.09, volatility: 0.30, momentum: 0.3, meanReversion: 0.06, volumeBase: 40000 },
  SPY:   { seed: 7007, startPrice: 450, drift: 0.04, volatility: 0.12, momentum: 0.15, meanReversion: 0.10, volumeBase: 70000 },
  COIN:  { seed: 8008, startPrice: 150, drift: 0.20, volatility: 0.55, momentum: 0.5, meanReversion: 0.01, volumeBase: 30000 },
};

export class MarketEngine {
  private rng: SeededRNG;
  private config: EngineConfig;
  private bars: OHLCV[] = [];
  private lastReturn = 0;
  private meanPrice: number;

  constructor(config: EngineConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
    this.meanPrice = config.startPrice;
  }

  get barCount(): number {
    return this.bars.length;
  }

  get allBars(): OHLCV[] {
    return this.bars;
  }

  get lastPrice(): number {
    return this.bars.length > 0 ? this.bars[this.bars.length - 1].close : this.config.startPrice;
  }

  // Generate next OHLCV bar
  tick(): OHLCV {
    const { drift, volatility, momentum, meanReversion, volumeBase } = this.config;
    const prevClose = this.lastPrice;

    // Per-bar factors (assume ~252 trading days)
    const dt = 1 / 252;
    const dailyDrift = drift * dt;
    const dailyVol = volatility * Math.sqrt(dt);

    // 4-factor model
    const trendComponent = dailyDrift;
    const volatilityComponent = dailyVol * this.rng.gaussian();
    const momentumComponent = momentum * this.lastReturn;
    const meanRevComponent = meanReversion * (Math.log(this.meanPrice) - Math.log(prevClose)) * dt;

    const logReturn = trendComponent + volatilityComponent + momentumComponent + meanRevComponent;
    const close = prevClose * Math.exp(logReturn);

    // OHLCV generation
    const intraVol = dailyVol * 0.5;
    const mid = (prevClose + close) / 2;
    const open = prevClose * (1 + this.rng.gaussian() * intraVol * 0.3);
    const highExtra = Math.abs(this.rng.gaussian() * intraVol);
    const lowExtra = Math.abs(this.rng.gaussian() * intraVol);
    const high = Math.max(open, close, mid) * (1 + highExtra);
    const low = Math.min(open, close, mid) * (1 - lowExtra);

    // Volume — higher on larger moves
    const moveSize = Math.abs(logReturn) / dailyVol;
    const volumeMultiplier = 1 + moveSize * 0.5 + Math.abs(this.rng.gaussian()) * 0.3;
    const volume = Math.round(volumeBase * volumeMultiplier);

    this.lastReturn = logReturn;
    // Slowly drift mean price toward close
    this.meanPrice = this.meanPrice * 0.995 + close * 0.005;

    const bar: OHLCV = {
      time: this.bars.length,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume,
    };

    this.bars.push(bar);
    return bar;
  }

  // Generate multiple bars at once
  generateBars(count: number): OHLCV[] {
    const newBars: OHLCV[] = [];
    for (let i = 0; i < count; i++) {
      newBars.push(this.tick());
    }
    return newBars;
  }

  // Reset engine
  reset(): void {
    this.rng = new SeededRNG(this.config.seed);
    this.bars = [];
    this.lastReturn = 0;
    this.meanPrice = this.config.startPrice;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
