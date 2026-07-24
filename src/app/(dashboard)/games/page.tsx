"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m } from "@/lib/motion";
import { ArrowRight, Gamepad2, Trophy, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";

interface GameCard {
  href: string;
  title: string;
  desc: string;
  art: string;
  bar: string;
  gameKey?: string;
  scored: boolean; // shows best out of 10
  /** Playable on the free tier. Others show a "FIC members" locked card. */
  freeOpen: boolean;
}

const GAMES: GameCard[] = [
  {
    href: "/games/candle-battle",
    title: "Candle Battle",
    desc: "One candle, one battle. Watch it form live, then call the winner — green team or red team.",
    art: "/art/tug-of-war.jpg",
    bar: "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(220,38,38,0.75))",
    gameKey: "candle-battle",
    scored: true,
    freeOpen: true,
  },
  {
    href: "/games/trend-or-trap",
    title: "Trend or Trap",
    desc: "A chart is just battles in a row. Read the pattern and call it: climbing higher, or a trap?",
    art: "/art/levelup-story.jpg",
    bar: "linear-gradient(135deg, rgba(251,191,36,0.9), rgba(217,119,6,0.8))",
    gameKey: "trend-or-trap",
    scored: true,
    freeOpen: false,
  },
];

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function GamesHubPage() {
  const supabase = createClient();
  const [best, setBest] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Record<string, string>>({});
  const [tier, setTier] = useState<FamilyTier>("fic");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .single();
      getClubTier(supabase, profile?.family_id).then(setTier);
      const { data } = await supabase
        .from("game_scores")
        .select("game, score, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const bestMap: Record<string, number> = {};
      const lastMap: Record<string, string> = {};
      (data || []).forEach((r: { game: string; score: number; created_at: string }) => {
        bestMap[r.game] = Math.max(bestMap[r.game] || 0, r.score || 0);
        if (!lastMap[r.game]) lastMap[r.game] = r.created_at;
      });
      setBest(bestMap);
      setLast(lastMap);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFree = tier === "free";

  return (
    <div className="max-w-4xl mx-auto">
      {/* hero */}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card overflow-hidden mb-6"
      >
        <div className="relative h-36 sm:h-44">
          <Image
            src="/art/tug-of-war.jpg"
            alt="A tug-of-war between the green team and the red team"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 max-w-md">
            <div className="flex items-center gap-2 mb-1">
              <Gamepad2 className="w-5 h-5 text-gold-600" />
              <h1 className="font-display text-2xl font-bold text-ink">Practice Games</h1>
            </div>
            <p className="text-soft text-sm leading-relaxed">
              Every price move is a tug-of-war. Play quick rounds to train your eye — clear 70% to
              earn XP.
            </p>
          </div>
        </div>
      </m.div>

      <div className="grid sm:grid-cols-2 gap-4">
        {GAMES.map((g, i) => {
          const locked = isFree && !g.freeOpen;
          return (
          <m.div
            key={g.href}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              href={locked ? "/upgrade" : g.href}
              className="paper-card overflow-hidden flex flex-col h-full group hover:shadow-[var(--shadow-lift)] transition-shadow"
            >
              <div className="relative h-28">
                <Image src={g.art} alt="" fill className="object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: g.bar, opacity: locked ? 0.4 : 0.7 }}
                />
                {locked && <div className="absolute inset-0 bg-midnight-950/45" />}
                <h2 className="absolute bottom-3 left-4 font-display text-lg font-extrabold text-white drop-shadow">
                  {g.title}
                </h2>
                {locked && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-midnight-950/70 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-white ring-1 ring-white/20">
                    <Lock className="w-2.5 h-2.5" /> FIC members
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <p className="text-sm text-soft leading-relaxed flex-1">{g.desc}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-soft inline-flex items-center gap-1.5">
                    {locked ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-gold-600" /> Members only
                      </>
                    ) : g.gameKey && best[g.gameKey] !== undefined ? (
                      <>
                        <Trophy className="w-3.5 h-3.5 text-gold-600" />
                        Best {best[g.gameKey]}/10
                        {last[g.gameKey] && (
                          <span className="text-soft/70">· {timeAgo(last[g.gameKey])}</span>
                        )}
                      </>
                    ) : g.scored ? (
                      "Not played yet"
                    ) : (
                      "Open the simulator"
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 group-hover:text-gold-800">
                    {locked ? (
                      <>Join FIC <ArrowRight className="w-4 h-4" /></>
                    ) : (
                      <>Play <ArrowRight className="w-4 h-4" /></>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          </m.div>
          );
        })}
      </div>
    </div>
  );
}
