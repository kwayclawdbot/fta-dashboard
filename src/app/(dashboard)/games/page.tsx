"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, Swords, Target, ArrowRight, Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface GameCard {
  href: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  accent: string;
  gameKey?: string;
}

const GAMES: GameCard[] = [
  {
    href: "/games/trend-or-trap",
    title: "Trend or Trap",
    desc: "Read the setup and call it: is price climbing, or is it a trap?",
    icon: TrendingUp,
    accent: "bg-chip-green text-green-700",
    gameKey: "trend-or-trap",
  },
  {
    href: "/games/candle-battle",
    title: "Candle Battle",
    desc: "One candle, one battle. Decide who won — green team or red team.",
    icon: Swords,
    accent: "bg-chip-sky text-sky-800",
    gameKey: "candle-battle",
  },
  {
    href: "/simulator/lessons",
    title: "Pattern Practice",
    desc: "Spot the pattern and make the trade call on real chart scenarios.",
    icon: Target,
    accent: "bg-chip-amber text-gold-800",
  },
];

export default function GamesHubPage() {
  const supabase = createClient();
  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("game_scores")
        .select("game, score")
        .eq("user_id", user.id);
      const map: Record<string, number> = {};
      (data || []).forEach((r: { game: string; score: number }) => {
        map[r.game] = Math.max(map[r.game] || 0, r.score || 0);
      });
      setBest(map);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-5 h-5 text-gold-600" />
          <h1 className="font-display text-2xl font-bold text-ink">Practice Games</h1>
        </div>
        <p className="text-soft text-sm">
          Quick rounds that build the same skills as the lessons. Earn XP when you
          clear 70%.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4">
        {GAMES.map((g, i) => {
          const Icon = g.icon;
          return (
            <motion.div
              key={g.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link href={g.href} className="paper-card p-6 flex flex-col h-full group">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${g.accent}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-ink mb-1">
                  {g.title}
                </h2>
                <p className="text-sm text-soft leading-relaxed flex-1">{g.desc}</p>
                <div className="flex items-center justify-between mt-4">
                  {g.gameKey && best[g.gameKey] !== undefined ? (
                    <span className="text-xs text-soft">
                      Best: {best[g.gameKey]}/10
                    </span>
                  ) : (
                    <span className="text-xs text-soft">Ready when you are</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 group-hover:text-gold-800">
                    Play <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
