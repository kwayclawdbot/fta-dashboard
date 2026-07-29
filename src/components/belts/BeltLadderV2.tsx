"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { LEVELS, XP, COMMUNITY_DAILY_CAP, GAME_PASS_RATIO, type Level, type XpKind } from "@/lib/xp";
import { BELTS, BELT_ORDER, beltForLevel, beltForXp, beltProgress, type Belt, type BeltKey } from "@/lib/belts";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import { ScriptTitle, Kicker, Card } from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   BELTS · board 22 (the rank ladder) — the v2 (cc canvas) render.

   The design-v2 branch of /belts. It reads the SAME real data as v1
   (BeltLadder): lifetime XP (xp_for_users), the member's own xp_events by kind,
   and the club-wide belt distribution (xp_leaderboard_individuals) — re-drawn
   to the cc board language: script "belts", a "where you stand" hero, the stack
   of belt-rung rows with the current rung as the warm orange card, the honest
   distribution paragraph, and the "how belts show up" + "what earns XP" cards.

   HONESTY (carried from v1): FIVE belts (White→Yellow→Blue→Purple→Black) derived
   from LEVELS + beltForLevel — no Green, no test gate. A belt's "gate" is its
   real XP range + degrees, NEVER a graded-call accuracy figure (that would be a
   performance claim). Share-of-club is a quiet real figure, SUPPRESSED below
   SHARE_FLOOR ranked members where it would be noise. Nothing fabricated.
   ══════════════════════════════════════════════════════════════════════════ */

interface Rung {
  belt: Belt;
  levels: Level[];
  minXp: number;
}

const RUNGS: Rung[] = (() => {
  const byBelt = new Map<BeltKey, Level[]>();
  for (const l of LEVELS) {
    const key = beltForLevel(l).belt.key;
    byBelt.set(key, [...(byBelt.get(key) ?? []), l]);
  }
  return BELT_ORDER.filter((k) => (byBelt.get(k) ?? []).length > 0).map((k) => {
    const levels = (byBelt.get(k) ?? []).sort((a, b) => a.level - b.level);
    return { belt: BELTS[k], levels, minXp: levels[0].min };
  });
})();

function gateLine(i: number): string {
  const rung = RUNGS[i];
  const from = rung.minXp;
  const next = RUNGS[i + 1];
  const range = next
    ? `${from.toLocaleString()} – ${(next.minXp - 1).toLocaleString()} XP`
    : `${from.toLocaleString()} XP +`;
  const degrees = rung.levels.length > 1 ? `${rung.levels.length} degrees` : `Level ${rung.levels[0].level}`;
  return `${range} · ${degrees}`;
}

interface EarnRow {
  kind: XpKind;
  label: string;
  rule: string;
  rate: string;
  onlyIfEarned?: boolean;
}
const EARNS: EarnRow[] = [
  { kind: "lesson", label: "Finish a lesson", rule: "Every completed lesson, once each.", rate: `${XP.LESSON} XP` },
  { kind: "quiz", label: "Pass a quiz", rule: `A perfect score pays ${XP.QUIZ_PERFECT_BONUS} XP more.`, rate: `${XP.QUIZ_PASS} XP` },
  { kind: "flashcards", label: "Clear a flashcard set", rule: "One award per set.", rate: `${XP.FLASHCARDS} XP` },
  { kind: "game", label: "Win a game round", rule: `A round under ${Math.round(GAME_PASS_RATIO * 100)}% doesn't count.`, rate: `${XP.GAME} XP` },
  { kind: "community", label: "Contribute in the Club", rule: `The first ${COMMUNITY_DAILY_CAP} posts each day.`, rate: `${XP.COMMUNITY} XP` },
  { kind: "rsvp", label: "RSVP to a live session", rule: "Once per session.", rate: `${XP.RSVP} XP` },
  { kind: "bonus", label: "Bonus", rule: "Referrals and one-off awards.", rate: "Varies", onlyIfEarned: true },
];

interface BeltState {
  xp: number;
  byKind: Partial<Record<XpKind, number>>;
  distribution: Record<BeltKey, number> | null;
  clubTotal: number;
  clubCapped: boolean;
  breakdownCapped: boolean;
}
const EVENT_PAGE = 1000;
const SHARE_FLOOR = 5;
const EMPTY: BeltState = { xp: 0, byKind: {}, distribution: null, clubTotal: 0, clubCapped: false, breakdownCapped: false };

/* ── belt disc (board 22 anatomy: dark coin, belt-color ring + belt-color bar) ─
   The artboard belt disc is NOT a solid fill — it is a dark circle wearing a
   2.5px belt-color ring with a short belt-color BAR (the physical belt strip)
   across it. The member's CURRENT rung sits on the warm ground with an orange
   ★ node clipped to the corner ("you are here"). Black's near-black hex is
   swapped to its lighter borderHex so the bar reads on the dark coin. */
function BeltDisc({ belt, size = 40, current = false, node = false, locked = false }: { belt: Belt; size?: number; current?: boolean; node?: boolean; locked?: boolean }) {
  const barColor = belt.key === "black" ? belt.borderHex : belt.hex;
  const nodeSize = Math.round(size * 0.36);
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: current ? "var(--cc-bg)" : "var(--cc-card2)",
        border: `2.5px solid ${belt.borderHex}`,
        filter: locked ? "saturate(.5) opacity(.65)" : undefined,
      }}
      aria-hidden
    >
      <span
        className="inline-block"
        style={{ width: Math.round(size * 0.42), height: Math.max(4, Math.round(size * 0.13)), borderRadius: 2, background: barColor }}
      />
      {node && (
        <span
          className="absolute grid place-items-center rounded-full font-bold"
          style={{ right: -3, bottom: -3, width: nodeSize, height: nodeSize, background: "var(--cc-orange)", border: "2px solid var(--cc-bg)", color: "var(--cc-orange-deep)", fontSize: Math.round(nodeSize * 0.55) }}
        >
          ★
        </span>
      )}
    </span>
  );
}

function Skeleton() {
  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6" aria-busy="true">
        <div className="h-9 w-28 rounded-lg motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
        <div className="h-24 w-full rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
        <div className="space-y-2 pt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[62px] rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--cc-card2)" }} />
          ))}
        </div>
        <span className="sr-only">Loading the belt ladder</span>
      </div>
    </V2Surface>
  );
}

export default function BeltLadderV2() {
  const [state, setState] = useState<BeltState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const [totalRes, eventsRes, boardRes] = await Promise.all([
        supabase.rpc("xp_for_users", { p_user_ids: [user.id] }),
        supabase.from("xp_events").select("amount, kind").eq("user_id", user.id).order("created_at", { ascending: false }).limit(EVENT_PAGE),
        supabase.rpc("xp_leaderboard_individuals", { p_window: "all", p_scope: "all" }),
      ]);

      const events = (eventsRes.data ?? []) as { amount: number; kind: XpKind }[];
      let summed = 0;
      const byKind: Partial<Record<XpKind, number>> = {};
      for (const e of events) {
        const amt = Number(e.amount) || 0;
        summed += amt;
        byKind[e.kind] = (byKind[e.kind] ?? 0) + amt;
      }
      const totalRow = ((totalRes.data ?? []) as { user_id: string; xp: number }[])[0];
      const xp = totalRow ? Number(totalRow.xp) || 0 : summed;
      const breakdownCapped = events.length >= EVENT_PAGE;

      let distribution: Record<BeltKey, number> | null = null;
      let clubTotal = 0;
      let clubCapped = false;
      const board = (boardRes.data as { rows?: { xp: number }[] } | null)?.rows;
      if (!boardRes.error && Array.isArray(board)) {
        const counts = { white: 0, yellow: 0, blue: 0, purple: 0, black: 0 } as Record<BeltKey, number>;
        for (const r of board) counts[beltForXp(Number(r.xp) || 0).belt.key] += 1;
        distribution = counts;
        clubTotal = board.length;
        clubCapped = board.length >= 100;
      }

      setState({ xp, byKind, distribution, clubTotal, clubCapped, breakdownCapped });
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  if (loading) return <Skeleton />;

  if (failed) {
    return (
      <V2Surface className="min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="p-5">
            <div className="cc-display text-[20px]" style={{ color: "var(--cc-ink)" }}>The ladder didn&apos;t load</div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              Something hiccuped on our end — nothing you&apos;ve earned is affected. Give it another go.
            </p>
            <button
              type="button"
              onClick={() => { setFailed(false); setLoading(true); void load(); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold"
              style={{ borderColor: "var(--cc-line)", border: "1px solid var(--cc-line)", background: "var(--cc-card2)", color: "var(--cc-ink)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
          </Card>
        </div>
      </V2Surface>
    );
  }

  const prog = beltProgress(state.xp);
  const currentIndex = RUNGS.findIndex((r) => r.belt.key === prog.current.belt.key);
  const dist = state.distribution;
  const everyoneOnFirstRung = !!dist && state.clubTotal > 0 && dist[RUNGS[0].belt.key] === state.clubTotal;

  function shareLabel(key: BeltKey): string | null {
    if (!dist || state.clubTotal < SHARE_FLOOR) return null;
    const n = dist[key];
    if (!n) return null;
    const pct = (n / state.clubTotal) * 100;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}% of club`;
  }

  const ringLabel = prog.next ? `${prog.toNext.toLocaleString()} XP to ${prog.next.belt.name}` : `${prog.current.belt.name} belt — maxed`;

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-20 pt-6">
        {/* ── masthead ─────────────────────────────────────────────────────── */}
        <header className="flex items-end justify-between gap-3">
          <div>
            <ScriptTitle>belts</ScriptTitle>
            <div className="mt-1">
              <Kicker tone="soft">rank earned from reps</Kicker>
            </div>
          </div>
          <Link href="/leaderboard" className="shrink-0 pb-1 text-[12px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            The ladder ›
          </Link>
        </header>

        {/* ── WHERE YOU STAND ─────────────────────────────────────────────── */}
        <Card className="cc-halo-soft flex items-center gap-4 p-4" style={{ borderColor: "var(--cc-orange)" }}>
          <BeltDisc belt={prog.current.belt} size={60} current node />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="cc-display text-[22px]" style={{ color: "var(--cc-ink)" }}>{prog.current.label}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--cc-card2)" }}>
              <div className="h-full rounded-full" style={{ width: `${prog.pct}%`, background: "var(--cc-orange)" }} />
            </div>
            <p className="mt-1.5 font-[family-name:var(--font-plex-mono)] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-orange-ink)" }}>
              {ringLabel}
            </p>
          </div>
        </Card>

        {/* ── THE LADDER ──────────────────────────────────────────────────── */}
        <section className="space-y-2 pt-1">
          {RUNGS.map((rung, i) => {
            const isCurrent = i === currentIndex;
            const earned = i <= currentIndex;
            const share = shareLabel(rung.belt.key);
            return (
              <div
                key={rung.belt.key}
                className={`flex items-center gap-3 rounded-[13px] px-[13px] py-2.5 ${earned ? "" : "opacity-[0.85]"}`}
                style={
                  isCurrent
                    ? { background: "linear-gradient(140deg,#241009 0%,var(--cc-card) 62%)", border: "1.5px solid var(--cc-orange)", boxShadow: "var(--cc-halo-soft)" }
                    : { background: "var(--cc-card)", border: "1px solid var(--cc-line)" }
                }
              >
                <BeltDisc belt={rung.belt} size={38} current={isCurrent} node={isCurrent} locked={!earned} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className="text-[13.5px] font-bold"
                      style={{ color: isCurrent || earned ? "var(--cc-ink)" : "var(--cc-soft)" }}
                    >
                      {rung.belt.name} Belt
                    </span>
                    {isCurrent && (
                      <span className="font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--cc-orange-ink)" }}>
                        — you are here
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.08em]" style={{ color: "var(--cc-dim)" }}>
                    {gateLine(i)}
                  </p>
                </div>
                {share && (
                  <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[10.5px] tabular-nums" style={{ color: "var(--cc-soft)" }}>
                    {share}
                  </span>
                )}
              </div>
            );
          })}
        </section>

        {/* distribution — told honestly at the scale it actually has */}
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {dist == null ? (
            "The club-wide share couldn't be read just now, so no rung carries a percentage — we'd rather show you nothing than a number we can't stand behind."
          ) : state.clubTotal === 0 ? (
            "Nobody is ranked yet. The shares fill in as members earn their first XP."
          ) : state.clubTotal < SHARE_FLOOR ? (
            <>
              {state.clubTotal === 1 ? "One member is" : `${state.clubTotal} members are`} ranked so far — too few for a
              share-of-club percentage to mean anything, so the ladder carries none. It starts showing shares once the
              board passes {SHARE_FLOOR.toLocaleString()} ranked members.
            </>
          ) : everyoneOnFirstRung ? (
            <>
              All {state.clubTotal.toLocaleString()} ranked {state.clubTotal === 1 ? "member is a" : "members are"}{" "}
              {RUNGS[0].belt.name} Belt{state.clubTotal === 1 ? "" : "s"} today. The rungs above are empty on purpose —
              nobody has put in the reps yet, and we&apos;d rather show you an empty ladder than a full one that isn&apos;t true.
            </>
          ) : (
            <>
              Shares are counted across {state.clubTotal.toLocaleString()} ranked member{state.clubTotal === 1 ? "" : "s"}
              {state.clubCapped ? " (the top 100 by lifetime XP)" : ""}. A rung with nobody on it carries no figure at all.
              No belt is gated on accuracy or a win rate — we don&apos;t publish either.
            </>
          )}
        </p>

        {/* ── HOW BELTS SHOW UP ───────────────────────────────────────────── */}
        <section className="space-y-2.5 pt-2">
          <Kicker tone="orange">How belts show up</Kicker>
          <Card className="p-3.5">
            <ShowUpRow disc={<BeltDisc belt={BELTS.blue} size={38} />} title="Your avatar ring" body="Belt colour rides the corner of your avatar, everywhere" />
            <div className="my-2 h-px" style={{ background: "var(--cc-line)" }} />
            <ShowUpRow
              disc={<BeltDisc belt={BELTS.black} size={38} node />}
              title={
                <span className="flex flex-wrap items-center gap-1.5">
                  Beside your name
                  <span className="inline-block rounded px-1.5 py-px text-[9.5px] font-bold" style={{ backgroundColor: BELTS.black.hex, color: BELTS.black.onHex }}>Black</span>
                </span>
              }
              body="The belt chip sits next to your name on every post"
            />
            <div className="my-2 h-px" style={{ background: "var(--cc-line)" }} />
            <ShowUpRow disc={<BeltDisc belt={BELTS.yellow} size={38} />} title="On the leaderboard" body="Your belt is spelled out beside your rank" />
          </Card>
        </section>

        {/* ── WHAT EARNS XP ───────────────────────────────────────────────── */}
        <section className="space-y-2.5 pt-2">
          <Kicker tone="orange">What earns XP</Kicker>
          <div className="space-y-2">
            {EARNS.filter((e) => !e.onlyIfEarned || (state.byKind[e.kind] ?? 0) > 0).map((e) => {
              const mine = state.byKind[e.kind] ?? 0;
              return (
                <Card key={e.kind} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>{e.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>{e.rule}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold tabular-nums" style={{ color: "var(--cc-ink)" }}>{e.rate}</span>
                    <span className="mt-0.5 block text-[8.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
                      {mine > 0 ? `${mine.toLocaleString()} earned` : "None yet"}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            Rates are the ones the app actually awards — generated from the same constants the award calls use, so they
            can&apos;t drift from what you get paid. Your own totals come straight from your XP ledger
            {state.breakdownCapped ? `, covering your most recent ${EVENT_PAGE.toLocaleString()} awards` : ""}.
          </p>
        </section>

        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-[12px] font-semibold">
          <Link href="/progress" style={{ color: "var(--cc-orange-ink)" }}>Your profile</Link>
          <Link href="/leaderboard" style={{ color: "var(--cc-orange-ink)" }}>Leaderboard</Link>
          <Link href="/missions" style={{ color: "var(--cc-orange-ink)" }}>Ways to earn today</Link>
        </div>
      </div>
    </V2Surface>
  );
}

function ShowUpRow({ disc, title, body }: { disc: ReactNode; title: ReactNode; body: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {disc}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold" style={{ color: "var(--cc-ink)" }}>{title}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--cc-soft)" }}>{body}</p>
      </div>
    </div>
  );
}
