"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Target,
  Zap,
  BarChart3,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoringComponent {
  name: string;
  maxPoints: number;
  description: string;
}

interface Scanner {
  id: string;
  name: string;
  alertType: string;
  description: string;
  direction: "bullish" | "bearish" | "neutral";
  category: string;
  schedule: string;
  tier: string;
  minScore: number;
  preFilter: string[];
  scoringComponents: ScoringComponent[];
  maxPossibleScore: number;
}

// ---------------------------------------------------------------------------
// Scanner Data (extracted from source code)
// ---------------------------------------------------------------------------

const SCANNERS: Scanner[] = [
  // ── Daily Breakout ──────────────────────────────────────────────
  {
    id: "breakout",
    name: "Daily Breakout Scanner",
    alertType: "breakout",
    description:
      "Detects ATH/near-ATH breakouts with volume confirmation. Two-pass pipeline: EODHD bulk pre-screen then full scoring for top ~15 candidates.",
    direction: "bullish",
    category: "Daily Breakout",
    schedule: "6:00 AM EST (pre-market)",
    tier: "Basic / Pro / VIP",
    minScore: 65,
    preFilter: [
      "Price >= $2",
      "Avg volume >= 500K (20-day)",
      "Volume ratio >= 1.5x",
      "Daily change > 0%",
      "Price within 5% of 60-day high",
      "Market cap >= $500M",
    ],
    scoringComponents: [
      { name: "ATH Proximity", maxPoints: 30, description: "Distance from all-time high (5-year). NEW_ATH=30, within 1%=28, within 3%=22, within 5%=16, within 10%=8, within 20%=3" },
      { name: "Band Breakout (BB Position)", maxPoints: 25, description: "Bollinger Band position. Above upper band=25, upper half scales 10-25, lower half scales 0-10" },
      { name: "Volume Ratio", maxPoints: 25, description: "Current volume vs 20-day avg. >=3x=25, >=2x=18-25, >=1.5x=12-18, >=1x=0-12" },
      { name: "RSI Sweet Spot", maxPoints: 20, description: "RSI(14) scoring. 55-70=+20 (confirmed uptrend), 50-55=+12, 70-80=+8, 40-50=+4, >80=-10 (overbought), <40=-10 (weak)" },
      { name: "CCA Bonus", maxPoints: 15, description: "Cheat Code Algo confluence bonus. SuperTrend + Squeeze + Swing alignment, capped at +/-15" },
      { name: "Premarket Gap Bonus", maxPoints: 8, description: "Gap up from prior close. >=3%=+8, >=2%=+5, >=1%=+3" },
      { name: "Sector Heat Adjustment", maxPoints: 5, description: "Market bias sector rotation score, positive for hot sectors, negative for cold" },
    ],
    maxPossibleScore: 128,
  },
  {
    id: "pattern",
    name: "Pattern Formation Scanner",
    alertType: "pattern",
    description:
      "Detects chart pattern completions and confirmations using pattern_engine. Scores based on pattern confidence, type, volume, freshness, and resistance room.",
    direction: "bullish",
    category: "Daily Breakout",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "Pro / VIP",
    minScore: 50,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "20-day price range >= 5% (enough volatility)",
      "Top 30 by volume ratio",
    ],
    scoringComponents: [
      { name: "Pattern Confidence", maxPoints: 30, description: "Pattern engine confidence score (0-1) scaled to 0-30. Higher confidence = stronger score" },
      { name: "Pattern Type Bonus", maxPoints: 12, description: "Continuation patterns (bull flag, pennant, ascending triangle)=12, reversal (inv H&S, double bottom, cup & handle)=10, other=6" },
      { name: "Volume on Breakout", maxPoints: 20, description: "Volume vs 20-day avg. >=2x=20, >=1.5x=15, >=1.2x=8, <1.2x=3" },
      { name: "Breakout Freshness", maxPoints: 12, description: "Price proximity to entry zone. At/above entry=12, within 3%=6, else=2" },
      { name: "Multiple Confirming Patterns", maxPoints: 8, description: ">=2 bullish patterns=8, 1 pattern >70% confidence=4" },
      { name: "Resistance Room", maxPoints: 8, description: "Distance to next resistance level. Range -5 to +8 points" },
      { name: "RSI Confirmation", maxPoints: 8, description: "RSI 50-70=8 (ideal), 40-50 or 70-80=4" },
      { name: "CCA Confluence", maxPoints: 5, description: "Cheat Code Algo master signal. BUY=+5, SELL=-5" },
    ],
    maxPossibleScore: 103,
  },
  {
    id: "reversal",
    name: "Reversal Scanner",
    alertType: "reversal",
    description:
      "Detects oversold stocks setting up for trend reversals using CCA V5 reversal indicators: reversal bands, SuperTrend flips, swing oscillator, squeeze momentum transitions.",
    direction: "bullish",
    category: "Daily Breakout",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "Pro / VIP",
    minScore: 55,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "RSI <= 40 (oversold)",
      "Price below 20-SMA",
      "Top 30 by lowest RSI",
    ],
    scoringComponents: [
      { name: "Reversal Band Zone", maxPoints: 25, description: "CCA reversal bands. Capitulation=25, extreme_down=20, extended_down=12, neutral=3" },
      { name: "SuperTrend Flip", maxPoints: 15, description: "Recent buy signal=15, trend=1 (bullish)=8" },
      { name: "Swing Oscillator", maxPoints: 15, description: "Cross up from oversold (<-10)=15, oversold + rising=10, oversold=5" },
      { name: "Squeeze Phase Transition", maxPoints: 10, description: "Bear-to-bull transition=10, weak_bull=6, strong_bear weakening=4" },
      { name: "52W Low Proximity", maxPoints: 15, description: "Distance from 52-week low. <=5%=15, <=10%=10, <=15%=7, <=20%=3" },
      { name: "Volume Surge", maxPoints: 10, description: "Volume vs avg. >=2x=10, >=1.5x=7, >=1.2x=3" },
      { name: "RSI Depth", maxPoints: 10, description: "Lower RSI = more oversold. <25=10, <30=7, <35=4, else=2" },
      { name: "Resistance Room", maxPoints: 8, description: "Distance to next resistance. Range -5 to +8 points" },
      { name: "Hindicator / Caution Bonus", maxPoints: 5, description: "CCA hindicator bullish=+3, caution_buy=+3 (capped at 5)" },
    ],
    maxPossibleScore: 113,
  },
  {
    id: "cheatcode",
    name: "Cheat Code Scanner",
    alertType: "cheatcode",
    description:
      "Detects CCA V5 signal changes: SuperTrend flips, squeeze momentum transitions, swing oscillator crossovers with volume + technical confirmation. Skips CHOPPY regime.",
    direction: "bullish",
    category: "Daily Breakout",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "Pro / VIP",
    minScore: 55,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "Recent SuperTrend buy OR sell signal (last 3 bars)",
      "Market regime != CHOPPY",
      "Top 25 by volume ratio",
    ],
    scoringComponents: [
      { name: "SuperTrend Signal", maxPoints: 20, description: "Fresh buy/sell in last 2 bars=20, in last 5 bars=12, bullish trend=5" },
      { name: "Squeeze Momentum Phase", maxPoints: 20, description: "Bear-to-bull transition=20, aligned phase=10, weakening=6" },
      { name: "Swing Oscillator", maxPoints: 15, description: "Cross up from deep oversold (<-10)=15, cross up=10, rising=4" },
      { name: "EMA Cloud Alignment", maxPoints: 10, description: "Fast + slow EMA bullish=10, fast only=5" },
      { name: "Multi-Indicator Confluence", maxPoints: 10, description: "All 3 indicators aligned=10, 2 of 3=5" },
      { name: "Volume Surge", maxPoints: 12, description: ">=2x=12, >=1.5x=8, >=1.2x=4" },
      { name: "RSI Confirmation", maxPoints: 10, description: "Bullish: 50-70=10, 40-50=5, >80=-3. Bearish: 30-50=10, <20=-3" },
      { name: "52W High Proximity", maxPoints: 8, description: "Distance from 52W high. <5%=8, <10%=5, <20%=3" },
      { name: "Resistance Room", maxPoints: 8, description: "Distance to next resistance. Range -5 to +8" },
      { name: "BB Position", maxPoints: 7, description: "Above upper BB=7, above mid=4 (bullish). Below lower=7 (bearish)" },
    ],
    maxPossibleScore: 120,
  },

  // ── Intraday ────────────────────────────────────────────────────
  {
    id: "orb",
    name: "Opening Range Breakout (ORB)",
    alertType: "orb",
    description:
      "Detects stocks breaking above their 15-minute opening range (9:30-9:45 AM). Two-stage: EODHD bulk pre-screen for top 50 movers, then 5m bar ORB scoring.",
    direction: "bullish",
    category: "Intraday",
    schedule: "~10:05 AM EST",
    tier: "Pro / VIP",
    minScore: 50,
    preFilter: [
      "Daily change >= +0.5%",
      "Price >= $5",
      "Top 50 movers by change %",
      "Avg volume >= 300K",
      "Must have confirmed ORB breakout above range high",
    ],
    scoringComponents: [
      { name: "ORB Breakout Quality", maxPoints: 30, description: "Extension above opening range high. >3%=30, >2%=25, >1%=20, >0.5%=15, >0%=10. No breakout=skip" },
      { name: "Volume Confirmation", maxPoints: 25, description: "Breakout bar volume vs avg intraday bar. >=3x=25, >=2x=20, >=1.5x=15, >=1.2x=8" },
      { name: "Relative Volume Pace", maxPoints: 15, description: "Intraday pace vs daily avg. >=3x=15, >=2x=10, >=1.5x=7, >=1x=3" },
      { name: "VWAP Alignment", maxPoints: 10, description: "Price above VWAP. >1%=10, >0.5%=7, >0%=4" },
      { name: "Range Quality", maxPoints: 10, description: "Tighter opening range = cleaner breakout. 0.5-1.5%=10, 1.5-2.5%=7, 2.5-4%=4" },
      { name: "Resistance Room", maxPoints: 8, description: "Distance to next resistance level. Range -5 to +8" },
      { name: "Momentum Follow-through", maxPoints: 7, description: "% of bars staying above OR high after break. >=80%=7, >=60%=5, >=40%=3" },
    ],
    maxPossibleScore: 105,
  },
  {
    id: "intraday",
    name: "Intraday ICT/SMC Scanner",
    alertType: "intraday",
    description:
      "ICT/SMC-foundation adaptive scanner. Uses Fair Value Gaps, Order Blocks, liquidity sweeps, structure breaks plus VWAP/ORB/volume/momentum. Adapts long/short based on market regime.",
    direction: "neutral",
    category: "Intraday",
    schedule: "12:00 PM & 2:00 PM EST",
    tier: "Pro / VIP",
    minScore: 50,
    preFilter: [
      "Price >= $5",
      "Abs daily change >= 1%",
      "Regime-adaptive selection: bullish=70% longs / bearish=70% shorts / neutral=50/50",
      "Top 40 movers",
      "Bullish: avg vol >= 300K / Bearish: avg vol >= 150K",
    ],
    scoringComponents: [
      { name: "FVG Proximity", maxPoints: 15, description: "ICT/SMC: In FVG zone=15, within 1.5%=10, within 3%=5, FVG as support/resistance=8" },
      { name: "Order Block Zone", maxPoints: 15, description: "ICT/SMC: In OB zone=15, near OB=8" },
      { name: "Liquidity Sweep", maxPoints: 10, description: "Stop hunt reversal detected in direction=10" },
      { name: "Structure Break (BOS/CHoCH)", maxPoints: 10, description: "Market structure break aligned with direction=10" },
      { name: "VWAP Position", maxPoints: 15, description: "Bullish: >1.5% above=15, >0.5%=10, >0%=5, reclaim bonus +5. Bearish inverted" },
      { name: "ORB Status", maxPoints: 15, description: "Above ORB (bullish) or below ORB (bearish)=8 + 3*extension %, capped at 15" },
      { name: "Relative Volume", maxPoints: 10, description: "Intraday pace vs daily avg. >=2.5x=10, >=1.5x=7, >=1x=3" },
      { name: "Momentum (HOD/LOD)", maxPoints: 10, description: "At HOD/LOD=+7, positive slope in direction=+3" },
    ],
    maxPossibleScore: 100,
  },

  // ── Bearish ─────────────────────────────────────────────────────
  {
    id: "bearish_orb",
    name: "Bearish ORB Scanner",
    alertType: "bearish_orb",
    description:
      "Mirror of ORB scanner for opening range BREAKDOWNS (short setups). Detects stocks breaking below the 15-min opening range low with volume + VWAP confirmation.",
    direction: "bearish",
    category: "Bearish",
    schedule: "~10:05 AM EST",
    tier: "Pro / VIP",
    minScore: 50,
    preFilter: [
      "Daily change <= -0.5% (losers)",
      "Price >= $5",
      "Top 50 losers by change %",
      "Avg volume >= 300K",
      "Must have confirmed ORB breakdown below range low",
    ],
    scoringComponents: [
      { name: "ORB Breakdown Quality", maxPoints: 30, description: "Extension below opening range low. >3%=30, >2%=25, >1%=20, >0.5%=15, >0%=10. No breakdown=skip" },
      { name: "Volume Confirmation", maxPoints: 25, description: "Breakdown bar volume vs avg intraday bar. >=3x=25, >=2x=20, >=1.5x=15, >=1.2x=8" },
      { name: "Relative Volume Pace", maxPoints: 15, description: "Intraday pace vs daily avg. >=3x=15, >=2x=10, >=1.5x=7, >=1x=3" },
      { name: "VWAP Alignment (Below)", maxPoints: 10, description: "Price below VWAP. <-1%=10, <-0.5%=7, <0%=4" },
      { name: "Range Quality", maxPoints: 10, description: "Tighter opening range = cleaner breakdown. 0.5-1.5%=10, 1.5-2.5%=7, 2.5-4%=4" },
      { name: "Momentum Follow-through", maxPoints: 7, description: "% of bars staying below OR low after break. >=80%=7, >=60%=5, >=40%=3" },
    ],
    maxPossibleScore: 97,
  },
  {
    id: "breakdown",
    name: "Breakdown Scanner",
    alertType: "breakdown",
    description:
      "Purely technical bearish scanner. Mirror of breakout scanner inverted: breaking below supports, 52W lows, high volume on decline, bearish CCA. No fundamentals.",
    direction: "bearish",
    category: "Bearish",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "Pro / VIP",
    minScore: 55,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "Daily change < -0.5%",
      "Volume ratio >= 1.3x",
      "Within 5% of 52-week low",
      "Top 15 by proximity to 52W low",
    ],
    scoringComponents: [
      { name: "52W Low Proximity", maxPoints: 30, description: "Distance from 52-week low. At/below=30, <=1%=28, <=3%=22, <=5%=16, <=10%=8, <=20%=3" },
      { name: "Band Breakdown (BB Position)", maxPoints: 25, description: "Below lower BB=25, below mid scales 10-25, above mid scales 0-10 (inverted)" },
      { name: "Volume on Decline", maxPoints: 25, description: "Red day required. >=3x volume=25, >=2x=18, >=1.5x=12" },
      { name: "RSI Breakdown Sweet Spot", maxPoints: 20, description: "30-45=20 (confirmed downtrend), 20-30=12, 45-50=8, <20=-10 (too oversold), >60=-10 (not in downtrend)" },
      { name: "CCA Bearish Bonus", maxPoints: 15, description: "Inverted CCA bonus. Bearish CCA = positive score (up to +15), bullish CCA = penalty (-5)" },
      { name: "Gap Down Bonus", maxPoints: 8, description: "Gap below prior close. <=-3%=8, <=-2%=5, <=-1%=3" },
      { name: "Bearish Pattern Bonus", maxPoints: 8, description: "H&S, double top, bear flag, descending triangle, rising wedge. >=50% conf=8, >=35%=5" },
    ],
    maxPossibleScore: 131,
  },
  {
    id: "bearish_reversal",
    name: "Bearish Reversal Scanner",
    alertType: "bearish_reversal",
    description:
      "Overbought reversal scanner. Mirror of bullish reversal: extreme RSI, blow-off reversal bands, bearish engulfing candles, SuperTrend sell signals, volume divergence at highs.",
    direction: "bearish",
    category: "Bearish",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "Pro / VIP",
    minScore: 55,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "RSI >= 70 (overbought)",
      "Price above 20-SMA",
      "Top 40 by highest RSI",
    ],
    scoringComponents: [
      { name: "Reversal Band Zone", maxPoints: 25, description: "CCA reversal bands. Blow-off top=25, extreme_up=20, extended_up=12, neutral=3" },
      { name: "SuperTrend Sell Signal", maxPoints: 15, description: "Recent sell signal=15, bearish trend (-1)=8" },
      { name: "Swing OB Cross Down", maxPoints: 15, description: "Cross down from overbought (>30)=15, any cross down=10, overbought=5" },
      { name: "Squeeze Transition", maxPoints: 10, description: "Bull-to-bear transition=10, weak_bear=6, prolonged strong_bear=4" },
      { name: "52W High Rejection", maxPoints: 15, description: "Within 3% of 52W high + red day=15, within 5% + red=10, within 3%=7, within 10% + red=3" },
      { name: "Bearish Engulfing", maxPoints: 10, description: "Full engulfing candle=10, partial engulfing=5" },
      { name: "RSI Extreme", maxPoints: 10, description: ">=85=10, >=80=7, >=75=4, >=70=2" },
      { name: "Volume Divergence", maxPoints: 8, description: "Price up but volume declining (5-bar comparison)=8, below avg volume + price up=5" },
      { name: "Hindicator / Caution Bonus", maxPoints: 5, description: "CCA hindicator bearish=+3, caution_sell=+2 (capped at 5). Strong bull momentum deduction=-5" },
    ],
    maxPossibleScore: 113,
  },

  // ── Fundamental ─────────────────────────────────────────────────
  {
    id: "long_idea",
    name: "Long Idea Scanner",
    alertType: "long_idea",
    description:
      "Fundamental-based long-term investment scanner. Strong earnings, revenue growth, institutional accumulation (dark pool + insider buying), healthy uptrend. Technicals < 20%.",
    direction: "bullish",
    category: "Fundamental",
    schedule: "Saturday morning (weekly)",
    tier: "VIP",
    minScore: 55,
    preFilter: [
      "Price >= $10",
      "Avg volume >= 300K",
      "Price above 200-SMA (structurally healthy)",
      "Top 50 by proximity to 52W high",
    ],
    scoringComponents: [
      { name: "Earnings Strength", maxPoints: 15, description: "Quarterly earnings growth. >20%=15, >15%=12, >10%=8, >5%=5, >0%=2" },
      { name: "Revenue Growth", maxPoints: 10, description: "Quarterly revenue growth. >15%=10, >10%=7, >5%=5, >0%=2" },
      { name: "Valuation / DCF", maxPoints: 12, description: "PEG 0-1=+6, EV/EBITDA <12=+4, P/B <3=+3, Forward PE <15=+3 (capped at 12)" },
      { name: "Profitability", maxPoints: 8, description: "Profit margin >20%=5, >15%=3. ROE >20%=+3 (capped at 8)" },
      { name: "Analyst Upside", maxPoints: 8, description: "Price below analyst target. >15%=8, >10%=5, >5%=3" },
      { name: "Growth Trajectory", maxPoints: 5, description: "Next year EPS > current EPS=5, revenue + earnings growing=3" },
      { name: "Dark Pool Accumulation", maxPoints: 13, description: "Ask-side % of DP prints. >70%=13, >60%=8, >55%=4" },
      { name: "Insider Buying", maxPoints: 13, description: "Unique insider buyers. >=3=13, >=2=9, 1 buy >$500K=5" },
      { name: "Weekly/Daily Trend", maxPoints: 10, description: "SuperTrend bullish=+5, squeeze bull phase=+3, above SMA50+200=+2" },
      { name: "Trend Structure", maxPoints: 8, description: "Golden cross (SMA50 > SMA200)=+5, within 10% of 52W high=+3" },
    ],
    maxPossibleScore: 102,
  },
  {
    id: "short_idea",
    name: "Short Idea Scanner",
    alertType: "short_idea",
    description:
      "Fundamental-based bearish scanner. Deteriorating earnings, declining revenue, insider selling, bearish dark pool distribution. Technicals < 20% of score.",
    direction: "bearish",
    category: "Fundamental",
    schedule: "Saturday morning (weekly)",
    tier: "VIP",
    minScore: 55,
    preFilter: [
      "Price >= $5",
      "Avg volume >= 500K",
      "Price below 200-SMA (structural weakness)",
      "Top 50 by proximity to 52W low",
    ],
    scoringComponents: [
      { name: "Earnings Weakness", maxPoints: 15, description: "Quarterly earnings growth negative=15, <5%=8. Negative EPS adds +5 (capped)" },
      { name: "Revenue Decline", maxPoints: 10, description: "Quarterly revenue growth negative=10, <2%=5" },
      { name: "Valuation / DCF", maxPoints: 12, description: "Negative EBITDA=+8, EV/EBITDA >30=+6, P/B >10=+4, P/S >15=+4, declining EPS est=+4 (capped at 12)" },
      { name: "Profitability Collapse", maxPoints: 8, description: "Negative profit margin=8, <3%=5. Negative ROE=+3 (capped at 8)" },
      { name: "Analyst Downside", maxPoints: 8, description: "Price above analyst target. >20%=8, >10%=5, >5%=3" },
      { name: "Short Interest", maxPoints: 5, description: "Short ratio >8=5, >5=3, >3=2" },
      { name: "Dark Pool Selling", maxPoints: 13, description: "Ask-side % of DP prints. <30%=13 (distribution), <40%=8, <45%=4" },
      { name: "Insider Selling", maxPoints: 13, description: "Unique insider sellers. >=3=13, >=2=9, 1 sell >$500K=5" },
      { name: "Weekly/Daily Trend", maxPoints: 10, description: "SuperTrend bearish=+5, squeeze bear phase=+3, below SMA50+200=+2" },
      { name: "52W Low Proximity", maxPoints: 8, description: "At/below 52W low=8, <=5%=6, <=10%=3" },
    ],
    maxPossibleScore: 102,
  },
  {
    id: "darkpool_insider",
    name: "Dark Pool / Insider Scanner",
    alertType: "darkpool_insider",
    description:
      "Detects unusual institutional activity. Combines Unusual Whales dark pool data with EODHD insider transactions. API-driven scanner on ~50 curated liquid tickers.",
    direction: "neutral",
    category: "Fundamental",
    schedule: "6:00 AM EST (with breakout scanner)",
    tier: "VIP",
    minScore: 45,
    preFilter: [
      "Curated watchlist: ~40 mega-cap + recent breakout candidates",
      "Max 50 tickers scanned",
      "Requires Unusual Whales API key",
    ],
    scoringComponents: [
      { name: "DP Block Size", maxPoints: 25, description: "Largest dark pool print as % of ADV. >5%=25, >2%=18, >1%=10, >0.5%=5" },
      { name: "DP Premium", maxPoints: 20, description: "Total dark pool premium. >$50M=20, >$20M=15, >$10M=10, >$5M=5" },
      { name: "DP Side Bias", maxPoints: 10, description: "% of volume at ask (buying). >70%=10, >60%=6, >55%=3" },
      { name: "Insider Buy Cluster", maxPoints: 25, description: "Unique insiders buying (30 days). >=3=25, >=2=18, 1 buy >$500K=10, any buy=5" },
      { name: "Insider Buy Value", maxPoints: 10, description: "Total insider buy value. >$5M=10, >$1M=7, >$500K=5, >$100K=3" },
      { name: "Resistance Room", maxPoints: 8, description: "Distance to next resistance. Range -5 to +8" },
      { name: "Volume Trend", maxPoints: 7, description: "3-day avg vs 20-day avg. >1.3x=7, >1.1x=4" },
    ],
    maxPossibleScore: 105,
  },
];

// ---------------------------------------------------------------------------
// Category grouping and colors
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Daily Breakout", color: "text-emerald-400", bgColor: "bg-emerald-400/10", borderColor: "border-emerald-400/20" },
  { name: "Intraday", color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/20" },
  { name: "Bearish", color: "text-red-400", bgColor: "bg-red-400/10", borderColor: "border-red-400/20" },
  { name: "Fundamental", color: "text-amber-400", bgColor: "bg-amber-400/10", borderColor: "border-amber-400/20" },
];

function directionColor(dir: string) {
  if (dir === "bullish") return "text-emerald-400";
  if (dir === "bearish") return "text-red-400";
  return "text-blue-400";
}

function directionBg(dir: string) {
  if (dir === "bullish") return "bg-emerald-400/10";
  if (dir === "bearish") return "bg-red-400/10";
  return "bg-blue-400/10";
}

function directionBorder(dir: string) {
  if (dir === "bullish") return "border-emerald-400/30";
  if (dir === "bearish") return "border-red-400/30";
  return "border-blue-400/30";
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ScoreBar({ component, maxOfAll }: { component: ScoringComponent; maxOfAll: number }) {
  const pct = (component.maxPoints / maxOfAll) * 100;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-48 shrink-0 text-sm text-zinc-300 truncate" title={component.name}>
        {component.name}
      </div>
      <div className="flex-1 h-4 bg-zinc-800 rounded-sm overflow-hidden relative">
        <div
          className="h-full rounded-sm bg-gradient-to-r from-amber-500/80 to-amber-400/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-14 text-right text-sm font-mono text-amber-400">
        {component.maxPoints}pts
      </div>
    </div>
  );
}

function ScannerCard({ scanner }: { scanner: Scanner }) {
  const [expanded, setExpanded] = useState(false);
  const maxComponent = Math.max(...scanner.scoringComponents.map((c) => c.maxPoints));

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${directionBorder(scanner.direction)} bg-zinc-900/60`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <div className="shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-100">{scanner.name}</span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${directionBg(scanner.direction)} ${directionColor(scanner.direction)}`}
            >
              {scanner.direction.toUpperCase()}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {scanner.alertType}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{scanner.description}</p>
        </div>
        <div className="shrink-0 flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-zinc-500">MIN SCORE</div>
            <div className="text-lg font-mono font-bold text-amber-400">{scanner.minScore}</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-zinc-500">MAX</div>
            <div className="text-sm font-mono text-zinc-400">{scanner.maxPossibleScore}</div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4 space-y-5">
          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-800/50 rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Schedule
              </div>
              <div className="text-sm text-zinc-200">{scanner.schedule}</div>
            </div>
            <div className="bg-zinc-800/50 rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Tier
              </div>
              <div className="text-sm text-zinc-200">{scanner.tier}</div>
            </div>
            <div className="bg-zinc-800/50 rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
                <Target className="w-3 h-3" /> Min Score
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold">{scanner.minScore}</div>
            </div>
            <div className="bg-zinc-800/50 rounded px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Max Possible
              </div>
              <div className="text-sm font-mono text-zinc-200">{scanner.maxPossibleScore}</div>
            </div>
          </div>

          {/* Pre-filter */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
              Stage 1 Pre-filter
            </h4>
            <ul className="space-y-1">
              {scanner.preFilter.map((f, i) => (
                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 shrink-0">&#x2022;</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Scoring Breakdown */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
              Scoring Breakdown
            </h4>
            <div className="space-y-0.5">
              {scanner.scoringComponents.map((c, i) => (
                <ScoreBar key={i} component={c} maxOfAll={maxComponent} />
              ))}
            </div>
          </div>

          {/* Scoring detail table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium text-xs uppercase">
                    Component
                  </th>
                  <th className="text-right py-2 px-2 text-zinc-500 font-medium text-xs uppercase w-20">
                    Max Pts
                  </th>
                  <th className="text-left py-2 px-2 text-zinc-500 font-medium text-xs uppercase">
                    Logic
                  </th>
                </tr>
              </thead>
              <tbody>
                {scanner.scoringComponents.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 px-2 text-zinc-200 font-medium">{c.name}</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-400">{c.maxPoints}</td>
                    <td className="py-2 px-2 text-zinc-400 text-xs">{c.description}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-700">
                  <td className="py-2 px-2 text-zinc-100 font-bold">TOTAL MAX</td>
                  <td className="py-2 px-2 text-right font-mono text-amber-400 font-bold">
                    {scanner.maxPossibleScore}
                  </td>
                  <td className="py-2 px-2 text-zinc-500 text-xs">
                    Clamped to 0-100 in final output
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScannersPage() {
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredScanners = SCANNERS.filter((s) => {
    if (filterCategory && s.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.alertType.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Activity className="w-6 h-6 text-amber-400" />
          Scanner Scoring Systems
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          All 12 scanners with complete scoring breakdowns, pre-filter criteria, and thresholds.
        </p>
      </div>

      {/* Summary comparison table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">Scanner Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/40">
                <th className="text-left py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Scanner</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Direction</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Category</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Min Score</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Max Score</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Components</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Schedule</th>
                <th className="text-center py-2 px-3 text-zinc-500 text-xs font-medium uppercase">Tier</th>
              </tr>
            </thead>
            <tbody>
              {SCANNERS.map((s) => {
                const catMeta = CATEGORIES.find((c) => c.name === s.category);
                return (
                  <tr key={s.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="py-2 px-3 text-zinc-200 font-medium whitespace-nowrap">{s.name}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs font-mono ${directionColor(s.direction)}`}>
                        {s.direction === "bullish" ? (
                          <TrendingUp className="w-4 h-4 inline" />
                        ) : s.direction === "bearish" ? (
                          <TrendingDown className="w-4 h-4 inline" />
                        ) : (
                          <Activity className="w-4 h-4 inline" />
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${catMeta?.bgColor ?? ""} ${catMeta?.color ?? "text-zinc-400"}`}>
                        {s.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-amber-400 font-bold">{s.minScore}</td>
                    <td className="py-2 px-3 text-center font-mono text-zinc-400">{s.maxPossibleScore}</td>
                    <td className="py-2 px-3 text-center font-mono text-zinc-500">{s.scoringComponents.length}</td>
                    <td className="py-2 px-3 text-center text-xs text-zinc-500 whitespace-nowrap">{s.schedule}</td>
                    <td className="py-2 px-3 text-center text-xs text-zinc-400">{s.tier}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search scanners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              !filterCategory
                ? "border-amber-500/50 text-amber-400 bg-amber-400/10"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                filterCategory === cat.name
                  ? `${cat.borderColor} ${cat.color} ${cat.bgColor}`
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="ml-auto px-3 py-1.5 text-xs rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* Scanner cards by category */}
      {CATEGORIES.filter((cat) => !filterCategory || cat.name === filterCategory).map((cat) => {
        const categoryScanners = filteredScanners.filter((s) => s.category === cat.name);
        if (categoryScanners.length === 0) return null;
        return (
          <div key={cat.name} className="space-y-3">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${cat.color} flex items-center gap-2`}>
              <span className={`w-2 h-2 rounded-full ${cat.bgColor} border ${cat.borderColor}`} />
              {cat.name}
              <span className="text-zinc-600 font-normal">({categoryScanners.length})</span>
            </h2>
            <div className="space-y-3">
              {categoryScanners.map((scanner) =>
                expandAll ? (
                  <ExpandedScannerCard key={scanner.id} scanner={scanner} />
                ) : (
                  <ScannerCard key={scanner.id} scanner={scanner} />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Always-expanded version used when "Expand All" is active.
 */
function ExpandedScannerCard({ scanner }: { scanner: Scanner }) {
  const maxComponent = Math.max(...scanner.scoringComponents.map((c) => c.maxPoints));

  return (
    <div
      className={`border rounded-lg overflow-hidden ${directionBorder(scanner.direction)} bg-zinc-900/60`}
    >
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-zinc-100">{scanner.name}</span>
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded ${directionBg(scanner.direction)} ${directionColor(scanner.direction)}`}
          >
            {scanner.direction.toUpperCase()}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {scanner.alertType}
          </span>
          <span className="ml-auto text-lg font-mono font-bold text-amber-400">
            MIN {scanner.minScore}
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{scanner.description}</p>
      </div>

      {/* Content */}
      <div className="border-t border-zinc-800 px-5 py-4 space-y-5">
        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-800/50 rounded px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Schedule
            </div>
            <div className="text-sm text-zinc-200">{scanner.schedule}</div>
          </div>
          <div className="bg-zinc-800/50 rounded px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Tier
            </div>
            <div className="text-sm text-zinc-200">{scanner.tier}</div>
          </div>
          <div className="bg-zinc-800/50 rounded px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
              <Target className="w-3 h-3" /> Min Score
            </div>
            <div className="text-sm font-mono text-amber-400 font-bold">{scanner.minScore}</div>
          </div>
          <div className="bg-zinc-800/50 rounded px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Max Possible
            </div>
            <div className="text-sm font-mono text-zinc-200">{scanner.maxPossibleScore}</div>
          </div>
        </div>

        {/* Pre-filter */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
            Stage 1 Pre-filter
          </h4>
          <ul className="space-y-1">
            {scanner.preFilter.map((f, i) => (
              <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5 shrink-0">&#x2022;</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Score bars */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-semibold">
            Scoring Breakdown
          </h4>
          <div className="space-y-0.5">
            {scanner.scoringComponents.map((c, i) => (
              <ScoreBar key={i} component={c} maxOfAll={maxComponent} />
            ))}
          </div>
        </div>

        {/* Scoring detail table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 px-2 text-zinc-500 font-medium text-xs uppercase">
                  Component
                </th>
                <th className="text-right py-2 px-2 text-zinc-500 font-medium text-xs uppercase w-20">
                  Max Pts
                </th>
                <th className="text-left py-2 px-2 text-zinc-500 font-medium text-xs uppercase">
                  Logic
                </th>
              </tr>
            </thead>
            <tbody>
              {scanner.scoringComponents.map((c, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="py-2 px-2 text-zinc-200 font-medium">{c.name}</td>
                  <td className="py-2 px-2 text-right font-mono text-amber-400">{c.maxPoints}</td>
                  <td className="py-2 px-2 text-zinc-400 text-xs">{c.description}</td>
                </tr>
              ))}
              <tr className="border-t border-zinc-700">
                <td className="py-2 px-2 text-zinc-100 font-bold">TOTAL MAX</td>
                <td className="py-2 px-2 text-right font-mono text-amber-400 font-bold">
                  {scanner.maxPossibleScore}
                </td>
                <td className="py-2 px-2 text-zinc-500 text-xs">
                  Clamped to 0-100 in final output
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
