"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Trophy, Users, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { levelForXp } from "@/lib/xp";
import type { FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";

type Window = "7d" | "30d" | "all";

interface FamilyRow {
  family_id: string;
  name: string;
  tier?: FamilyTier;
  members: number;
  xp: number;
}

const WINDOWS: { id: Window; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

export default function LeaderboardPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<FamilyRow[]>([]);
  const [win, setWin] = useState<Window>("7d");
  const [myFamilyId, setMyFamilyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !myFamilyId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .single();
      setMyFamilyId(profile?.family_id || "");
    }
    const { data } = await supabase.rpc("family_xp_leaderboard", {
      p_window: win,
    });
    setRows(((data as FamilyRow[]) || []).filter((r) => r.members > 0));
    setLoading(false);
  }, [supabase, win, myFamilyId]);

  useEffect(() => {
    load();
  }, [load]);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-gold-600";
    if (rank === 2) return "text-midnight-400";
    if (rank === 3) return "text-amber-700";
    return "text-soft";
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-gold-600" />
          <h1 className="font-display text-2xl font-bold text-ink">Family XP</h1>
        </div>
        <p className="text-soft text-sm">
          Every lesson, quiz, card, and game your family earns adds up. Climb the
          board together.
        </p>
      </motion.div>

      {/* Window toggle */}
      <div className="inline-flex gap-1 mb-6 bg-white border border-sand rounded-xl p-1">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            onClick={() => setWin(w.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              win === w.id
                ? "bg-chip-amber text-gold-800"
                : "text-soft hover:text-ink"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="paper-card p-10 text-center">
          <Users className="w-8 h-8 text-soft mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-ink mb-1">
            No XP yet in this window
          </p>
          <p className="text-sm text-soft max-w-sm mx-auto">
            Complete a lesson, play a game, or review your Daily 5 to put your
            family on the board.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const rank = i + 1;
            const mine = row.family_id === myFamilyId;
            const level = levelForXp(row.xp);
            return (
              <motion.div
                key={row.family_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  mine
                    ? "border-gold-400 bg-chip-amber/40 ring-1 ring-gold-300"
                    : "border-sand bg-white"
                }`}
              >
                <span
                  className={`font-display text-lg font-bold w-7 text-center shrink-0 ${rankColor(
                    rank
                  )}`}
                >
                  {rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-ink truncate">
                      {row.name}
                    </p>
                    <TierBadge tier={row.tier || "fic"} size="xs" />
                    {rank === 1 && (
                      <Crown className="w-4 h-4 text-gold-500 shrink-0" />
                    )}
                    {mine && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold-500 text-white shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-soft">
                    {row.members} member{row.members === 1 ? "" : "s"} ·{" "}
                    {level.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg font-bold text-ink flex items-center gap-1 justify-end">
                    <Zap className="w-4 h-4 text-gold-500" />
                    {row.xp.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-soft">XP</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
