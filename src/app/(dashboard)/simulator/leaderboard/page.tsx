"use client";

import { useState, useEffect, useCallback } from "react";
import { m as mm } from "@/lib/motion";
import { Crown, Trophy, TrendingUp, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  portfolioValue: number;
  returnPct: number;
  winRate: number;
  totalTrades: number;
  rank: number;
}

type Period = "all" | "week";

export default function SimLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<Period>("all");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get family members' portfolios
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .single();

      if (!profile?.family_id) {
        setLoading(false);
        return;
      }

      // Get all family members
      const { data: familyMembers } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("family_id", profile.family_id);

      if (!familyMembers) {
        setLoading(false);
        return;
      }

      // Get portfolios
      const { data: portfolios } = await supabase
        .from("sim_portfolios")
        .select("*")
        .in("user_id", familyMembers.map((m) => m.id));

      const leaderboard: LeaderboardEntry[] = (portfolios || [])
        .map((p) => {
          const member = familyMembers.find((m) => m.id === p.user_id);
          const balance = Number(p.balance);
          const startingBalance = Number(p.starting_balance);
          const totalPnl = Number(p.total_pnl);
          const portfolioValue = balance + totalPnl;
          const returnPct =
            startingBalance > 0
              ? Math.round(((portfolioValue - startingBalance) / startingBalance) * 10000) / 100
              : 0;
          const winRate =
            p.total_trades > 0
              ? Math.round((p.winning_trades / p.total_trades) * 100)
              : 0;

          return {
            userId: p.user_id,
            displayName: member?.display_name || "Unknown",
            portfolioValue,
            returnPct,
            winRate,
            totalTrades: p.total_trades,
            rank: 0,
          };
        })
        .sort((a, b) => b.returnPct - a.returnPct)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      setEntries(leaderboard);
    } catch {
      // tables may not exist
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard, period]);

  const rankColors = ["", "text-gold-400", "text-midnight-200", "text-orange-400"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-midnight-100">
            Simulator Leaderboard
          </h1>
          <p className="text-xs text-midnight-400">
            Family members ranked by portfolio return
          </p>
        </div>
        <div className="flex gap-1 bg-midnight-900 border border-midnight-700/50 rounded-lg p-0.5">
          <button
            onClick={() => setPeriod("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              period === "all"
                ? "bg-gold-400/15 text-gold-400"
                : "text-midnight-400 hover:text-midnight-200"
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setPeriod("week")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              period === "week"
                ? "bg-gold-400/15 text-gold-400"
                : "text-midnight-400 hover:text-midnight-200"
            }`}
          >
            This Week
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-8 text-center">
          <Trophy className="w-8 h-8 text-midnight-600 mx-auto mb-3" />
          <p className="text-sm text-midnight-400">
            No simulator portfolios yet. Start trading to appear on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-midnight-700/50 text-midnight-400">
                <th className="text-left py-3 px-4 font-medium w-16">Rank</th>
                <th className="text-left py-3 px-4 font-medium">Trader</th>
                <th className="text-right py-3 px-4 font-medium">Portfolio</th>
                <th className="text-right py-3 px-4 font-medium">Return</th>
                <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Trades</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <mm.tr
                  key={entry.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border-b border-midnight-800/50 ${
                    entry.userId === currentUserId ? "bg-gold-400/5" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {entry.rank === 1 && (
                        <Crown className="w-4 h-4 text-gold-400" />
                      )}
                      <span
                        className={`font-bold ${
                          rankColors[entry.rank] || "text-midnight-500"
                        }`}
                      >
                        #{entry.rank}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold-400/15 flex items-center justify-center text-gold-400 text-[11px] font-bold font-display">
                        {entry.displayName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <span className="text-midnight-100 font-medium">
                        {entry.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-midnight-200">
                    ${entry.portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      entry.returnPct >= 0 ? "text-green-400" : "text-red-500"
                    }`}
                  >
                    {entry.returnPct >= 0 ? "+" : ""}
                    {entry.returnPct}%
                  </td>
                  <td className="py-3 px-4 text-right text-midnight-300 hidden sm:table-cell">
                    {entry.totalTrades > 0 ? `${entry.winRate}%` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-midnight-400 hidden sm:table-cell">
                    {entry.totalTrades}
                  </td>
                </mm.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
