"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { m } from "@/lib/motion";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { useAppMode } from "@/lib/useAppMode";
import { DisplayHead } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";

/**
 * THE TRAINING ROOM — the games index, drawn in the BOARD's card language.
 *
 * FORM (board 01): display masthead, ONE tinted accent object (`.club-b-warm`)
 * carrying your record and the rule that makes a session pay, then the games
 * themselves as white `.club-b-card` tiles — art tile for identity, the ask, and
 * your best in the right-hand mono column. The previous version built the index
 * from the hairline ledger vocabulary under a full-bleed dark hero; the dark
 * island now belongs only to the games themselves, which are the immersive
 * moment. An index is not.
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
 * ADULT-FIRST: these are kid-facing games, and the standing rule is that the kid
 * version is DERIVED from the adult one. So the index speaks the same card
 * vocabulary as Club Home — no toy bevels, no bubble emoji, no pulsing pings.
 * What makes it playable is the art tile and the copy, not a second system.
 *
 * ACCESS: the free-tier lock is unchanged — `freeOpen` still decides whether a
 * card plays or routes to /upgrade, and the deeper route re-checks server-side.
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
  /** The game's identity tile — its own art, not a generic glyph. */
  art: string;
}

const GAMES: GameEntry[] = [
  {
    href: "/games/candle-battle",
    title: "Candle Battle",
    desc: "One candle, one battle. Watch it form live, then call the winner — buyers or sellers.",
    trains: "Reading a single bar",
    gameKey: "candle-battle",
    freeOpen: true,
    art: "/art/tug-of-war.jpg",
  },
  {
    href: "/games/trend-or-trap",
    title: "Trend or Trap",
    desc: "A chart is just battles in a row. Read the sequence and call it: continuation, or trap?",
    trains: "Reading a sequence",
    gameKey: "trend-or-trap",
    freeOpen: false,
    art: "/art/levelup-story.jpg",
  },
];

/* The viewer's clock as an EXTERNAL STORE, bucketed to the hour. "Last played"
   is relative to the VIEWER's wall clock, which the server cannot know, and a
   component may not read an impure function during render — `timeAgo` called
   Date.now() and was invoked straight from JSX, which is that violation one step
   removed. The snapshot must be stable between calls or React spins, hence the
   hour bucket; "3 days ago" needs nothing finer. Server snapshot is null, and
   `timeAgo` then returns the absolute date — a true statement, never a guess. */
const HOUR_MS = 3_600_000;
const CLOCK_SUBSCRIBE = () => () => {};
const CLOCK_CLIENT = () => Math.floor(Date.now() / HOUR_MS);
const CLOCK_SERVER = () => null;

/** Pure once the clock is handed in. */
function timeAgo(iso: string, nowHour: number | null): string {
  const abs = new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (nowHour == null) return abs;
  const d = new Date(iso).getTime();
  const days = Math.floor((nowHour * HOUR_MS - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return abs;
}

export default function GamesHubPage() {
  // CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): club
  // gets the caps masthead, white-caps section head and terminal hub cards
  // (dark card, mono record rail). Same real game_scores reads, same free-tier
  // lock, same links; the game engines are untouched and the family/kid render
  // is byte-identical.
  const isClub = useAppMode() === "club";
  const supabase = createClient();
  const [best, setBest] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Record<string, string>>({});
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [tier, setTier] = useState<FamilyTier>("fic");
  const nowHour = useSyncExternalStore(CLOCK_SUBSCRIBE, CLOCK_CLIENT, CLOCK_SERVER);

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
    /* CLUB: uneven terminal rhythm via section margins below — no uniform
       space-y stack. FAMILY: original wrapper, byte-identical. */
    <div className={isClub ? "mx-auto max-w-3xl" : "mx-auto max-w-3xl space-y-8"}>
      <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        {isClub ? (
          <header>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
              Training room
            </p>
            <h1 className="mt-2 font-display text-[clamp(28px,8vw,34px)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink">
              Games
            </h1>
            <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
              Every price move is a tug-of-war between buyers and sellers. Ten
              rounds a session; clear 70% and the session pays XP.
            </p>
          </header>
        ) : (
          <DisplayHead
            eyebrow="Training room"
            title="Practice"
            mark="Games"
            lede="Every price move is a tug-of-war between buyers and sellers. Ten rounds a session; clear 70% and the session pays XP."
          />
        )}
      </m.div>

      {/* THE ONE TINTED OBJECT — your record, stated and never inferred. A
          member with no sessions gets a FOUNDING STATE (§0.5), not a missing
          line: "you have not played yet" is a fact worth saying, and it carries
          the rule that makes a session pay. */}
      <section
        className={
          isClub
            ? "mt-6 rounded-[16px] border border-sand bg-card px-5 py-5"
            : "club-b-warm f0-grain px-5 py-5"
        }
        aria-label="Your record"
      >
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              Your record
              <span className="text-accent"> in the room</span>
            </p>
            <p
              className={
                isClub
                  ? "mt-2 font-mono text-[28px] font-bold leading-none tabular-nums text-ink"
                  : "mt-2 font-display text-display-2 font-extrabold leading-none tabular-nums text-ink"
              }
            >
              {totalPlays}
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-soft">
              {totalPlays === 1 ? "Session logged" : "Sessions logged"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <span className="club-b-chip inline-flex items-baseline gap-1.5 px-2.5 py-1">
              <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                10
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                Rounds
              </span>
            </span>
            <span className="club-b-chip inline-flex items-baseline gap-1.5 px-2.5 py-1">
              <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                70%
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                Pays XP
              </span>
            </span>
          </div>
        </div>
      </section>

      {(() => {
        const repsList = (
        <div className="f0-stagger mt-4 space-y-3">
          {GAMES.map((g, i) => {
            const locked = isFree && !g.freeOpen;
            const bestScore = best[g.gameKey];
            const played = bestScore !== undefined;
            return (
              <div
                key={g.href}
                style={{ "--i": i } as React.CSSProperties}
                className="relative"
              >
                {!isClub && (
                <span className="club-b-pip absolute -left-[7px] -top-[7px] z-10" aria-hidden>
                  {i + 1}
                </span>
                )}
                <Link
                  href={locked ? "/upgrade" : g.href}
                  className={
                    isClub
                      ? "f0-focus f0-press group flex items-start gap-4 rounded-[14px] border border-sand bg-card px-4 py-4"
                      : "club-b-card f0-focus f0-press group flex items-start gap-4 px-4 py-4"
                  }
                >
                  {/* Identity tile — the game's own art, at the board's tile
                      geometry. `locked` dims it honestly rather than hiding it. */}
                  <span
                    className={`relative block h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[12px] border border-sand ${
                      locked ? "opacity-55 grayscale" : ""
                    }`}
                    aria-hidden
                  >
                    <Image
                      src={g.art}
                      alt=""
                      fill
                      sizes="52px"
                      priority={i === 0}
                      className="object-cover"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-display text-[17px] font-extrabold tracking-tight text-ink">
                        {g.title}
                      </span>
                      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                        {locked ? "Members only" : g.trains}
                      </span>
                    </span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-soft">
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

                  <span className="shrink-0 text-right">
                    {played ? (
                      <>
                        <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                          {bestScore}/10
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
                          Best · {timeAgo(last[g.gameKey], nowHour)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block font-mono text-[15px] font-semibold text-soft">
                          —
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
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
        );
        return isClub ? (
          <section className="mt-7" aria-labelledby="games-reps">
            <h2
              id="games-reps"
              className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
            >
              The reps
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft">
              Short sessions. Each one trains a different read.
            </p>
            {repsList}
          </section>
        ) : (
          <BoardSection
            id="games-reps"
            label="The reps"
            mark="pick one"
            sub="Short sessions. Each one trains a different read."
          >
            {repsList}
          </BoardSection>
        );
      })()}
    </div>
  );
}
