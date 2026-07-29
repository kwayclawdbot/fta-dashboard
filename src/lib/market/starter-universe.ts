/**
 * A small, stable liquid-market universe used only when the nightly Screener
 * and Club snapshot tables have not populated yet. The identities below are
 * reference data; prices and day moves are always joined from the live market
 * quote service. We never manufacture community scores, watcher counts, market
 * caps, technicals, or sentiment for these rows.
 */
export interface StarterMarketName {
  ticker: string;
  name: string;
  exchange: "NASDAQ" | "NYSE" | "NYSE Arca";
  type: "common" | "etf";
  sector: string | null;
}

export const STARTER_MARKET_UNIVERSE: readonly StarterMarketName[] = [
  { ticker: "NVDA", name: "NVIDIA", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "AAPL", name: "Apple", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon", exchange: "NASDAQ", type: "common", sector: "Consumer Cyclical" },
  { ticker: "GOOGL", name: "Alphabet", exchange: "NASDAQ", type: "common", sector: "Communication Services" },
  { ticker: "META", name: "Meta Platforms", exchange: "NASDAQ", type: "common", sector: "Communication Services" },
  { ticker: "TSLA", name: "Tesla", exchange: "NASDAQ", type: "common", sector: "Consumer Cyclical" },
  { ticker: "AMD", name: "Advanced Micro Devices", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "AVGO", name: "Broadcom", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "NFLX", name: "Netflix", exchange: "NASDAQ", type: "common", sector: "Communication Services" },
  { ticker: "PLTR", name: "Palantir Technologies", exchange: "NASDAQ", type: "common", sector: "Technology" },
  { ticker: "JPM", name: "JPMorgan Chase", exchange: "NYSE", type: "common", sector: "Financial Services" },
  { ticker: "BAC", name: "Bank of America", exchange: "NYSE", type: "common", sector: "Financial Services" },
  { ticker: "XOM", name: "Exxon Mobil", exchange: "NYSE", type: "common", sector: "Energy" },
  { ticker: "WMT", name: "Walmart", exchange: "NYSE", type: "common", sector: "Consumer Defensive" },
  { ticker: "COST", name: "Costco", exchange: "NASDAQ", type: "common", sector: "Consumer Defensive" },
  { ticker: "DIS", name: "Walt Disney", exchange: "NYSE", type: "common", sector: "Communication Services" },
  { ticker: "NKE", name: "Nike", exchange: "NYSE", type: "common", sector: "Consumer Cyclical" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "etf", sector: null },
  { ticker: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", type: "etf", sector: null },
] as const;

export const STARTER_MARKET_TICKERS = STARTER_MARKET_UNIVERSE.map(
  (name) => name.ticker
);
