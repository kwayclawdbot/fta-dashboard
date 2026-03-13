"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Play,
  BookOpen,
  Flame,
  Award,
  Eye,
  BarChart3,
  Zap,
  Clock,
  ChevronRight,
  AlertCircle,
  Users,
  Star,
  Newspaper,
  Target,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── Mock Market Data ──

interface Ticker {
  symbol: string;
  price: string;
  change: string;
  changePct: string;
  up: boolean;
}

const MARKET_TICKERS: Ticker[] = [
  { symbol: "SPY", price: "587.42", change: "+4.23", changePct: "+0.72%", up: true },
  { symbol: "QQQ", price: "512.18", change: "+6.81", changePct: "+1.35%", up: true },
  { symbol: "DIA", price: "432.56", change: "-1.12", changePct: "-0.26%", up: false },
  { symbol: "IWM", price: "218.34", change: "+2.15", changePct: "+0.99%", up: true },
  { symbol: "VIX", price: "14.23", change: "-0.87", changePct: "-5.76%", up: false },
];

interface WatchlistItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePct: string;
  up: boolean;
  volume: string;
}

const WATCHLIST: WatchlistItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: "237.45", change: "+3.21", changePct: "+1.37%", up: true, volume: "52.3M" },
  { symbol: "MSFT", name: "Microsoft", price: "468.12", change: "+5.67", changePct: "+1.23%", up: true, volume: "28.1M" },
  { symbol: "TSLA", name: "Tesla Inc.", price: "342.89", change: "-8.34", changePct: "-2.37%", up: false, volume: "89.7M" },
  { symbol: "NVDA", name: "NVIDIA", price: "892.34", change: "+12.56", changePct: "+1.43%", up: true, volume: "45.2M" },
  { symbol: "AMZN", name: "Amazon", price: "198.67", change: "+1.23", changePct: "+0.62%", up: true, volume: "38.4M" },
  { symbol: "META", name: "Meta", price: "523.45", change: "-2.11", changePct: "-0.40%", up: false, volume: "19.8M" },
];

interface Mover {
  symbol: string;
  changePct: string;
  up: boolean;
}

const TOP_GAINERS: Mover[] = [
  { symbol: "SMCI", changePct: "+12.4%", up: true },
  { symbol: "MARA", changePct: "+8.7%", up: true },
  { symbol: "RIOT", changePct: "+7.2%", up: true },
  { symbol: "PLTR", changePct: "+5.8%", up: true },
];

const TOP_LOSERS: Mover[] = [
  { symbol: "BABA", changePct: "-6.3%", up: false },
  { symbol: "NKE", changePct: "-4.1%", up: false },
  { symbol: "PFE", changePct: "-3.8%", up: false },
  { symbol: "INTC", changePct: "-3.2%", up: false },
];

interface NewsItem {
  time: string;
  headline: string;
  source: string;
  bullish: boolean | null;
}

const MOCK_NEWS: NewsItem[] = [
  { time: "11:42", headline: "Fed holds rates steady, signals potential cut in September", source: "Reuters", bullish: true },
  { time: "11:15", headline: "NVDA announces next-gen AI chip, analysts raise targets", source: "Bloomberg", bullish: true },
  { time: "10:58", headline: "US retail sales miss expectations, consumer spending slows", source: "CNBC", bullish: false },
  { time: "10:30", headline: "Bitcoin breaks $105K as institutional buying accelerates", source: "CoinDesk", bullish: true },
  { time: "09:45", headline: "TSLA recalls 200K vehicles over software issue", source: "WSJ", bullish: false },
  { time: "09:15", headline: "Weekly jobless claims fall to 3-month low", source: "Labor Dept", bullish: true },
];

interface PaperPosition {
  symbol: string;
  shares: number;
  avgCost: string;
  current: string;
  pnl: string;
  pnlPct: string;
  up: boolean;
}

const PAPER_PORTFOLIO: PaperPosition[] = [
  { symbol: "AAPL", shares: 10, avgCost: "228.50", current: "237.45", pnl: "+$89.50", pnlPct: "+3.92%", up: true },
  { symbol: "MSFT", shares: 5, avgCost: "455.00", current: "468.12", pnl: "+$65.60", pnlPct: "+2.88%", up: true },
  { symbol: "TSLA", shares: 3, avgCost: "360.00", current: "342.89", pnl: "-$51.33", pnlPct: "-4.75%", up: false },
];

// ── Helpers ──

function PriceChange({ change, pct, up }: { change: string; pct: string; up: boolean }) {
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {change} ({pct})
    </span>
  );
}

// ── Page ──

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [now, setNow] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setDisplayName(
      user.user_metadata?.display_name || user.user_metadata?.full_name || "Trader"
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .single();

    if (profile) {
      setOnboardingComplete(profile.onboarding_complete ?? false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setNow(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const marketOpen = (() => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    const mins = h * 60 + m;
    const day = d.getDay();
    return day >= 1 && day <= 5 && mins >= 570 && mins < 960; // 9:30 - 16:00 ET
  })();

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Onboarding CTA */}
      {!onboardingComplete && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex items-center gap-4 border-l-2 border-gold-400 pl-4 py-3">
          <AlertCircle className="w-5 h-5 text-gold-400 shrink-0" />
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-midnight-100">Complete Your Setup</p>
            <p className="text-xs text-midnight-400 font-body">Finish onboarding to unlock all features.</p>
          </div>
          <Link href="/onboarding" className="cta-button flex items-center gap-2 px-4 py-2 rounded-lg text-sm shrink-0">
            Complete Setup <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Top bar — terminal style */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-midnight-100">
            Trading Terminal
          </h2>
          <p className="text-xs text-midnight-500 font-mono">
            Welcome back, {displayName}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${marketOpen ? "bg-green-400/10 text-green-400" : "bg-midnight-800 text-midnight-400"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${marketOpen ? "bg-green-400 animate-pulse" : "bg-midnight-500"}`} />
            {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
          </div>
          <span className="text-midnight-400 tabular-nums">{now} ET</span>
        </div>
      </motion.div>

      {/* Market ticker strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-0 mb-4 rounded-lg border border-midnight-800/60 bg-midnight-900/60 overflow-hidden"
      >
        {MARKET_TICKERS.map((t, i) => (
          <div key={t.symbol} className={`flex-1 flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-l border-midnight-800/60" : ""}`}>
            <span className="text-xs font-mono font-bold text-midnight-200">{t.symbol}</span>
            <div className="text-right">
              <span className="text-xs font-mono text-midnight-100 block">{t.price}</span>
              <span className={`text-[10px] font-mono ${t.up ? "text-green-400" : "text-red-400"}`}>
                {t.change} {t.changePct}
              </span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left column — Watchlist + Portfolio */}
        <div className="lg:col-span-4 space-y-4">

          {/* Watchlist */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-midnight-800/60">
              <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Watchlist
              </h3>
              <span className="text-[10px] text-midnight-600 font-mono">{WATCHLIST.length} symbols</span>
            </div>
            <div>
              {/* Header row */}
              <div className="flex items-center px-4 py-1.5 text-[10px] font-mono text-midnight-600 uppercase border-b border-midnight-800/30">
                <span className="w-16">Symbol</span>
                <span className="flex-1 text-right">Price</span>
                <span className="w-24 text-right">Change</span>
                <span className="w-16 text-right">Vol</span>
              </div>
              {WATCHLIST.map((item) => (
                <div key={item.symbol} className="flex items-center px-4 py-2 border-b border-midnight-800/30 last:border-0 hover:bg-midnight-800/30 transition-colors cursor-pointer group">
                  <div className="w-16">
                    <span className="text-xs font-mono font-bold text-midnight-100 group-hover:text-gold-400 transition-colors">{item.symbol}</span>
                    <p className="text-[9px] font-mono text-midnight-600 truncate">{item.name}</p>
                  </div>
                  <span className="flex-1 text-right text-xs font-mono text-midnight-200">{item.price}</span>
                  <span className={`w-24 text-right text-[11px] font-mono ${item.up ? "text-green-400" : "text-red-400"}`}>
                    {item.changePct}
                  </span>
                  <span className="w-16 text-right text-[10px] font-mono text-midnight-500">{item.volume}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Paper Portfolio */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-midnight-800/60">
              <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Paper Portfolio
              </h3>
              <span className="text-xs font-mono text-green-400">+$103.77</span>
            </div>
            <div>
              <div className="flex items-center px-4 py-1.5 text-[10px] font-mono text-midnight-600 uppercase border-b border-midnight-800/30">
                <span className="w-14">Sym</span>
                <span className="w-10 text-right">Qty</span>
                <span className="flex-1 text-right">Avg</span>
                <span className="flex-1 text-right">Last</span>
                <span className="w-20 text-right">P&L</span>
              </div>
              {PAPER_PORTFOLIO.map((pos) => (
                <div key={pos.symbol} className="flex items-center px-4 py-2 border-b border-midnight-800/30 last:border-0">
                  <span className="w-14 text-xs font-mono font-bold text-midnight-100">{pos.symbol}</span>
                  <span className="w-10 text-right text-[11px] font-mono text-midnight-400">{pos.shares}</span>
                  <span className="flex-1 text-right text-[11px] font-mono text-midnight-400">{pos.avgCost}</span>
                  <span className="flex-1 text-right text-[11px] font-mono text-midnight-200">{pos.current}</span>
                  <div className="w-20 text-right">
                    <span className={`text-[11px] font-mono block ${pos.up ? "text-green-400" : "text-red-400"}`}>{pos.pnl}</span>
                    <span className={`text-[9px] font-mono ${pos.up ? "text-green-400/60" : "text-red-400/60"}`}>{pos.pnlPct}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-midnight-800/60">
              <Link href="/courses" className="text-[10px] font-mono text-gold-400 hover:text-gold-300 transition-colors flex items-center gap-1">
                Learn portfolio management <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Center column — Learning + News */}
        <div className="lg:col-span-5 space-y-4">

          {/* Today's Lesson spotlight */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-gold-400/20 bg-gold-400/5 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-gold-400" />
              <h3 className="text-xs font-mono font-bold text-gold-400 uppercase">Today&apos;s Lesson</h3>
            </div>
            <h4 className="font-display text-base font-semibold text-midnight-100 mb-1">Candlestick Patterns</h4>
            <p className="text-xs text-midnight-400 font-body mb-3">
              Learn to read the most important candlestick patterns — doji, hammer, engulfing — and spot reversals before they happen.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/courses/stocks-options/m2/l4"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400 text-midnight-950 text-xs font-display font-semibold hover:bg-gold-300 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Start Lesson
              </Link>
              <span className="text-[10px] text-midnight-500 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                15 min
              </span>
            </div>
          </motion.div>

          {/* News feed — terminal style */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-midnight-800/60">
              <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" />
                Market News
              </h3>
              <span className="text-[10px] text-midnight-600 font-mono">LIVE</span>
            </div>
            <div>
              {MOCK_NEWS.map((news, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-midnight-800/30 last:border-0 hover:bg-midnight-800/20 transition-colors cursor-pointer">
                  <span className="text-[10px] font-mono text-midnight-600 shrink-0 mt-0.5 tabular-nums">{news.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body text-midnight-200 leading-relaxed">{news.headline}</p>
                    <p className="text-[10px] font-mono text-midnight-600 mt-0.5">{news.source}</p>
                  </div>
                  {news.bullish !== null && (
                    <div className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${news.bullish ? "bg-green-400" : "bg-red-400"}`} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Learning tip */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4"
          >
            <div className="flex items-start gap-3">
              <Target className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-mono font-bold text-midnight-300 uppercase mb-1">Trading Tip of the Day</h4>
                <p className="text-xs text-midnight-400 font-body leading-relaxed">
                  &ldquo;Never risk more than 2% of your portfolio on a single trade. If you have $10,000, your max loss per trade should be $200. This is the #1 rule that separates successful traders from gamblers.&rdquo;
                </p>
                <p className="text-[10px] text-midnight-600 font-mono mt-1.5">— Module 3: Risk Management</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right column — Stats + Movers */}
        <div className="lg:col-span-3 space-y-4">

          {/* Your Stats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4"
          >
            <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" />
              Your Progress
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-midnight-400 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Lessons</span>
                <span className="text-sm font-mono font-bold text-midnight-100">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-midnight-400 flex items-center gap-1.5"><Flame className="w-3 h-3 text-orange-400" /> Streak</span>
                <span className="text-sm font-mono font-bold text-orange-400">12 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-midnight-400 flex items-center gap-1.5"><Award className="w-3 h-3" /> Badges</span>
                <span className="text-sm font-mono font-bold text-midnight-100">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-body text-midnight-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> Family</span>
                <span className="text-sm font-mono font-bold text-midnight-100">2 members</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-midnight-800/50">
              <Link href="/progress" className="text-[10px] font-mono text-gold-400 hover:text-gold-300 transition-colors flex items-center gap-1">
                View full progress <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>

          {/* Top Movers */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40"
          >
            <div className="px-4 py-2.5 border-b border-midnight-800/60">
              <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Market Movers
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] font-mono text-green-400/70 uppercase mb-1.5">Top Gainers</p>
                <div className="space-y-1.5">
                  {TOP_GAINERS.map((m) => (
                    <div key={m.symbol} className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-midnight-200">{m.symbol}</span>
                      <span className="text-xs font-mono text-green-400">{m.changePct}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-midnight-800/50 pt-3">
                <p className="text-[10px] font-mono text-red-400/70 uppercase mb-1.5">Top Losers</p>
                <div className="space-y-1.5">
                  {TOP_LOSERS.map((m) => (
                    <div key={m.symbol} className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-midnight-200">{m.symbol}</span>
                      <span className="text-xs font-mono text-red-400">{m.changePct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4 space-y-2"
          >
            <h3 className="text-xs font-mono font-bold text-midnight-300 uppercase mb-2">Quick Actions</h3>
            <Link href="/simulator" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body text-midnight-300 hover:bg-midnight-800/50 hover:text-midnight-100 transition-colors">
              <LineChart className="w-3.5 h-3.5 text-gold-400" />
              Trading Simulator
              <ArrowRight className="w-3 h-3 ml-auto text-midnight-600" />
            </Link>
            <Link href="/simulator/lessons" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body text-midnight-300 hover:bg-midnight-800/50 hover:text-midnight-100 transition-colors">
              <BarChart3 className="w-3.5 h-3.5 text-gold-400" />
              Pattern Practice
              <ArrowRight className="w-3 h-3 ml-auto text-midnight-600" />
            </Link>
            <Link href="/courses" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body text-midnight-300 hover:bg-midnight-800/50 hover:text-midnight-100 transition-colors">
              <BookOpen className="w-3.5 h-3.5 text-gold-400" />
              Browse Courses
              <ArrowRight className="w-3 h-3 ml-auto text-midnight-600" />
            </Link>
            <Link href="/community" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body text-midnight-300 hover:bg-midnight-800/50 hover:text-midnight-100 transition-colors">
              <Users className="w-3.5 h-3.5 text-gold-400" />
              Community Feed
              <ArrowRight className="w-3 h-3 ml-auto text-midnight-600" />
            </Link>
            <Link href="/family" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body text-midnight-300 hover:bg-midnight-800/50 hover:text-midnight-100 transition-colors">
              <Users className="w-3.5 h-3.5 text-gold-400" />
              Family Dashboard
              <ArrowRight className="w-3 h-3 ml-auto text-midnight-600" />
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
