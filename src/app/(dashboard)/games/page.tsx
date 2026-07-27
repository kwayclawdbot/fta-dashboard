"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m } from "@/lib/motion";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";

/**
 * THE TRAINING ROOM — the games index as a hairline LEDGER, not a card grid.
 *
 * Each game is a row: a large muted index numeral gives it identity, the title
 * carries the ask, and the right-hand mono column holds YOUR record. Nothing is
 * wrapped in a box, and the two games never sit in equal columns — a two-up grid
 * of picture cards was the exact pattern the register bans.
 *
 * ONE DARK OBJECT: the masthead field. It is the only dark surface on the index
 * (the games themselves carry their own night-island stage), which is what lets
 * it actually dominate rather than compete.
 *
 * DATA HONESTY: "Best n/10" and the last-played date come from real `game_scores`
 * rows. A game you have never played says so — it never shows a zero, and it
 * never shows a fabricated streak or rating.
 *
 * COLOUR LAW: no green/red anywhere on this surface — nothing here is a price.
 * The accent (family gold / club volt / FTA metallic) marks the play action and
 * the lock upsell, which are actions. Orange TEXT uses the gold ramp, which
 * flips at night; text-volt-* is frozen and never used.
 *
 * ADULT-FIRST (canvas v2): these are kid-facing games, and the standing rule is
 * that the kid version is DERIVED from the adult one. So the index is the same
 * display/hairline/ledger vocabulary as Live Classes and the FTA desk — no toy
 * bevels, no bubble emoji, no pulsing pings. What makes it playable is the
 * numeral, the tug-of-war art and the copy, not a second visual system.
 *
 * CANVAS V2 PASS: one annotated word in the headline, the shared focus ring and
 * press feedback on every row, and a real founding state for a member who has
 * never played (the previous version simply omitted the record line, which read
 * as a rendering gap rather than a stated absence).
 */

interface GameEntry {
  href: string;
  title: string;
  /** The one-line ask. */
  desc: string;
  /** What the rep actually trains — the adult reason to play. */
  trains: string;
  gameKey: string;
  /** Playable on the free tier. Others route to the upgrade surface. */
  freeOpen: boolean;
}

const GAMES: GameEntry[] = [
  {
    href: "/games/candle-battle",
    title: "Candle Battle",
    desc: "One candle, one battle. Watch it form live, then call the winner — buyers or sellers.",
    trains: "Reading a single bar",
    gameKey: "candle-battle",
    freeOpen: true,
  },
  {
    href: "/games/trend-or-trap",
    title: "Trend or Trap",
    desc: "A chart is just battles in a row. Read the sequence and call it: continuation, or trap?",
    trains: "Reading a sequence",
    gameKey: "trend-or-trap",
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
  const [plays, setPlays] = useState<Record<string, number>>({});
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
      const playMap: Record<string, number> = {};
      (data || []).forEach((r: { game: string; score: number; created_at: string }) => {
        bestMap[r.game] = Math.max(bestMap[r.game] || 0, r.score || 0);
        playMap[r.game] = (playMap[r.game] || 0) + 1;
        if (!lastMap[r.game]) lastMap[r.game] = r.created_at;
      });
      setBest(bestMap);
      setLast(lastMap);
      setPlays(playMap);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFree = tier === "free";
  const totalPlays = Object.values(plays).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* The one dark object on the surface. */}
      <m.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="f0-hero-field f0-grain relative px-6 py-8 sm:px-9 sm:py-11"
      >
        <Image
          src="/art/tug-of-war.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-30"
        />
        <div className="f0-hero-scrim" />
        <div className="relative">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-600">
            Training room
          </p>
          <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05]">
            Practice <span className="f0-underline-mark">Games</span>
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">
            Every price move is a tug-of-war between buyers and sellers. Ten rounds a
            session; clear 70% and the session pays XP.
          </p>
        </div>
      </m.header>

      <section>
        <h2 className="f0-section-rule mb-1">
          <span className="text-eyebrow font-display font-bold uppercase text-soft">
            The reps
          </span>
        </h2>

        <div className="f0-ledger f0-stagger">
          {GAMES.map((g, i) => {
            const locked = isFree && !g.freeOpen;
            const bestScore = best[g.gameKey];
            const played = bestScore !== undefined;
            return (
              <div key={g.href} style={{ "--i": i } as React.CSSProperties}>
                <Link
                  href={locked ? "/upgrade" : g.href}
                  className="f0-ledger-row f0-focus f0-press group"
                >
                  <span
                    aria-hidden
                    className="w-9 shrink-0 self-center text-right font-display text-display-3 font-extrabold tabular-nums text-soft sm:w-12"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1 self-center">
                    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-display text-display-3 font-extrabold tracking-tight text-ink">
                        {g.title}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                        {locked ? "Members only" : g.trains}
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[14px] leading-relaxed text-soft">
                      {g.desc}
                    </span>
                    <span className="mt-2.5 flex items-center gap-1 font-display text-[13px] font-bold text-gold-700">
                      {locked ? (
                        <>
                          <Lock className="h-3.5 w-3.5" /> Join to play
                        </>
                      ) : (
                        <>Play</>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                    </span>
                  </span>

                  <span className="shrink-0 self-center text-right">
                    {played ? (
                      <>
                        <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                          {bestScore}/10
                        </span>
                        <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
                          Best · {timeAgo(last[g.gameKey])}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block font-mono text-[15px] font-semibold text-soft">
                          —
                        </span>
                        <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
                          {locked ? "Locked" : "Not played"}
                        </span>
                      </>
                    )}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Your record — stated, never inferred. A member with no sessions gets a
          FOUNDING STATE (§0.5), not a missing line: "you have not played yet" is
          a fact worth saying, and it carries the rule that makes a session pay. */}
      <p className="f0-rule-top pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        {totalPlays > 0
          ? `${totalPlays} session${totalPlays === 1 ? "" : "s"} logged · a session is 10 rounds · 70% pays XP`
          : "No sessions logged yet · a session is 10 rounds · 70% pays XP"}
      </p>
    </div>
  );
}
