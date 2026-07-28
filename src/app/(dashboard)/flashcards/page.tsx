"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { RotateCcw, Check, X, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  pickDailyFive,
  pickSetCards,
  listSets,
  reviewCard,
  cardThemeWeek,
  type DailyCard,
  type SetSummary,
} from "@/lib/flashcards";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { weekTheme } from "@/lib/games/art";
import CandleRenderer from "@/components/games/CandleRenderer";
import Burst from "@/components/games/Burst";
import StreakFlame from "@/components/games/StreakFlame";
import { DisplayHead, Meter, EmptyLine, TextAction } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";

/* ══════════════════════════════════════════════════════════════════════════
   FLASHCARDS — recall practice, drawn in the BOARD's card language.

   Three states, one vocabulary:
     · PICKER  — display masthead, ONE tinted accent object (`.club-b-warm`)
                 carrying the Daily 5, how sharp the deck currently is (a Meter
                 with the percentage right-aligned, exactly as the board draws
                 its progress rows) and the round orange action orb; then every
                 set as a white `.club-b-card` row. The previous version was a
                 dark obsidian field over a hairline ledger — the earlier
                 system, and before that a grid of legacy card tiles.
     · SESSION — the card IS the object, so it takes the board's own geometry:
                 `.club-b-card` faces (14px radius, sand hairline) with the
                 storybook art header, which is the deck's identity.
     · DONE    — the tinted result card: what you reviewed, your best streak and
                 the XP, in translucent `.club-b-chip` wells.

   COLOUR LAW: green/red = price, so "Got it" / "Again" are differentiated by
   WEIGHT, not by hue — Got it is the solid accent action, Again is a hairline
   card button. Correct/incorrect in a recall drill is NOT a price and never
   touches the price ramp.

   REAL DATA ONLY: the "deck sharp" percentage is derived from the sets the RPC
   actually returned (cards not currently due ÷ cards in the deck). With no sets
   there is no percentage and the card says what it can instead — it never
   prints a flattering 100%.

   THEMES: fills ride `bg-accent` (--accent-solid) and their type rides
   `--accent-on`, so the deck is warm gold in Family Mode, orange in the Club and
   metallic on the FTA desk with no fork and no `dark:` variant.

   ADULT-FIRST: this is used by kids and by adults from the same deck. The
   register does not soften for kids — only the COPY changes (`isKid`). No
   bubble chrome, no bevels; the card is a card because of the flip and the art
   header, not because of a toy border.

   XP IS UNTOUCHED: `finishSession` still gates on `countXpToday(..., "flashcards")`
   and still calls `awardXp(..., "flashcards", XP.FLASHCARDS, "daily-5")` exactly
   once a day, and `reviewCard` still owns the SRS write per card.
   ══════════════════════════════════════════════════════════════════════════ */

type Mode = "picker" | "session";

export default function FlashcardsPage() {
  const supabase = createClient();
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [userId, setUserId] = useState("");
  const [track, setTrack] = useState("adults");
  const [isKid, setIsKid] = useState(false);

  const [mode, setMode] = useState<Mode>("picker");
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [sessionLabel, setSessionLabel] = useState("Daily 5");
  const [isDaily, setIsDaily] = useState(true);

  const [cards, setCards] = useState<DailyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [gotCount, setGotCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [dueTomorrow, setDueTomorrow] = useState(0);
  const [done, setDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadPicker = useCallback(
    async (uid: string, tk: string) => {
      const { sets, totalDue } = await listSets(supabase, uid, tk);
      setSets(sets);
      setTotalDue(totalDue);
    },
    [supabase]
  );

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, track")
      .eq("id", user.id)
      .single();
    const tk = profile?.age_group || profile?.track || "adults";
    setTrack(tk);
    setIsKid(profile?.role === "child" && tk === "kids");
    await loadPicker(user.id, tk);
    setLoading(false);
  }, [supabase, loadPicker]);

  useEffect(() => {
    load();
  }, [load]);

  function resetSession() {
    setIndex(0);
    setFlipped(false);
    setExitDir(null);
    setGotCount(0);
    setBestStreak(0);
    setDueTomorrow(0);
    setDone(false);
    setXpAwarded(0);
    setBusy(false);
  }

  async function startDaily() {
    setStarting(true);
    const daily = await pickDailyFive(supabase, userId, track);
    setCards(daily);
    setSessionLabel("Daily 5");
    setIsDaily(true);
    resetSession();
    setMode("session");
    setStarting(false);
  }

  async function startSet(set: SetSummary) {
    setStarting(true);
    const list = await pickSetCards(supabase, userId, track, set.slug);
    setCards(list);
    setSessionLabel(set.title);
    setIsDaily(false);
    resetSession();
    setMode("session");
    setStarting(false);
  }

  async function backToPicker() {
    setMode("picker");
    resetSession();
    await loadPicker(userId, track);
  }

  const current = cards[index];

  async function finishSession(finalGot: number, finalStreak: number, finalDue: number) {
    setDone(true);
    const already = await countXpToday(supabase, userId, "flashcards");
    if (already === 0) {
      await awardXp(supabase, userId, "flashcards", XP.FLASHCARDS, "daily-5");
      setXpAwarded(XP.FLASHCARDS);
    }
    setBestStreak(finalStreak);
    setGotCount(finalGot);
    setDueTomorrow(finalDue);
  }

  async function handleResult(gotIt: boolean) {
    if (!current || busy) return;
    setBusy(true);
    setExitDir(gotIt ? "right" : "left");
    const outcome = await reviewCard(supabase, userId, current, gotIt);
    const nextGot = gotCount + (gotIt ? 1 : 0);
    const nextStreak = Math.max(bestStreak, outcome.streak);
    const nextDue = dueTomorrow + (gotIt ? 0 : 1);
    setGotCount(nextGot);
    setBestStreak(nextStreak);
    setDueTomorrow(nextDue);

    setTimeout(
      async () => {
        if (index + 1 >= cards.length) {
          await finishSession(nextGot, nextStreak, nextDue);
        } else {
          setFlipped(false);
          setIndex((i) => i + 1);
        }
        setBusy(false);
      },
      reduce ? 60 : 340
    );
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (busy) return;
    if (info.offset.x > 90) handleResult(true);
    else if (info.offset.x < -90) handleResult(false);
  }

  /* LOADING ≠ EMPTY (§0.4). Shaped like the picker — masthead, the Daily 5
     card, then the set cards — so it never reads as "you have no sets". */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-8 pb-16" aria-busy="true">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-sand/60" />
          <div className="h-11 w-56 rounded bg-sand/60" />
          <div className="h-4 w-full max-w-sm rounded bg-sand/40" />
        </div>
        <div className="club-b-warm h-44" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="club-b-card flex items-center gap-4 px-4 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-sand/60" />
                <div className="h-3 w-3/4 rounded bg-sand/40" />
              </div>
              <div className="h-4 w-16 shrink-0 rounded bg-sand/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- SET PICKER ---------------- */
  if (mode === "picker") {
    /* How sharp the deck currently is: cards NOT due ÷ cards in the deck. Both
       numbers come from `listSets`, so this is a real read — with no sets there
       is no percentage at all rather than a flattering 100%. */
    const deckSize = sets.reduce((n, s) => n + s.count, 0);
    const sharpPct =
      deckSize > 0
        ? Math.max(0, Math.min(100, Math.round(((deckSize - totalDue) / deckSize) * 100)))
        : null;

    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <DisplayHead
          eyebrow="Recall practice"
          title=""
          mark="Flashcards"
          lede={
            isKid
              ? "Flip a card, make your guess, grow your streak. Five a day keeps it all sharp."
              : "Run your Daily 5 for a fast sweep across everything, or drill one set until it's automatic."
          }
        />

        {/* THE ONE TINTED OBJECT — the Daily 5 and how sharp the deck is. */}
        <section className="club-b-warm f0-grain px-5 py-5" aria-labelledby="daily-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                Today
                <span className="text-accent"> · five minutes</span>
              </p>
              <h2
                id="daily-5"
                className="mt-2 font-display text-display-2 font-extrabold leading-[1.05] text-ink"
              >
                Daily 5
              </h2>
              <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-soft">
                {totalDue > 0
                  ? `${totalDue} card${totalDue === 1 ? "" : "s"} are due across every set — five minutes closes them out.`
                  : "Five cards pulled across all your sets to keep every concept sharp."}
              </p>
            </div>

            {/* The count that makes the ask concrete. `totalDue` is a real read
                from `listSets`; with nothing due it says so rather than
                printing a zero that looks like a failure. */}
            <div className="club-b-chip shrink-0 px-3 py-2 text-right">
              <p className="font-mono text-[16px] font-semibold leading-none tabular-nums text-ink">
                {totalDue}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                Due now
              </p>
            </div>
          </div>

          {/* The board's progress row: a bar with the percentage right-aligned. */}
          {sharpPct != null && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  Deck sharp
                </span>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-accent">
                  {sharpPct}%
                </span>
              </div>
              <Meter pct={sharpPct} />
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={startDaily}
              disabled={starting}
              className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-60"
            >
              {starting ? "Dealing…" : "Start the Daily 5"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Sets — white cards on the paper, never a tile grid. */}
        {sets.length === 0 ? (
          <EmptyLine
            title="No sets yet"
            body="Card sets appear here as your program unlocks them — nothing is listed until it has real cards behind it."
            action={
              <TextAction href="/courses">
                Go to Learn <ArrowRight className="h-3.5 w-3.5" />
              </TextAction>
            }
          />
        ) : (
          <BoardSection
            id="flash-sets"
            label="Study sets"
            mark="drill one"
            sub="Work a single set until the answers come without thinking."
          >
            <div className="mt-4 space-y-3">
              {sets.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => startSet(s)}
                  disabled={starting}
                  className="club-b-card f0-focus f0-press flex w-full items-center gap-4 px-4 py-4 text-left disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] font-bold text-ink">
                      {s.title}
                    </span>
                    <span className="mt-0.5 block max-w-[52ch] text-[13px] leading-snug text-soft">
                      {s.blurb}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[13px] font-semibold tabular-nums text-soft">
                      {s.count} cards
                    </span>
                    {s.due > 0 && (
                      <span className="mt-0.5 block font-mono text-[11px] font-semibold tabular-nums text-accent">
                        {s.due} due
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-soft" />
                </button>
              ))}
            </div>
          </BoardSection>
        )}
      </div>
    );
  }

  /* ---------------- SESSION ---------------- */
  if (cards.length === 0 && !done) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <SessionHeader label={sessionLabel} onBack={backToPicker} />
        <EmptyLine
          title={isKid ? "All caught up!" : "Nothing due in this set"}
          body={
            isKid
              ? "You reviewed everything here for today. Try another set, or come back tomorrow."
              : "You have reviewed all of these cards for today. New cards unlock as your reviews come due."
          }
          action={
            <TextAction onClick={backToPicker}>
              <ChevronLeft className="h-3.5 w-3.5" /> Back to sets
            </TextAction>
          }
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <SessionHeader label={sessionLabel} onBack={backToPicker} />
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="club-b-warm f0-grain relative px-5 py-6 sm:px-6"
        >
          <Burst count={26} power={150} />
          <div className="relative">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              Session
              <span className="text-accent"> complete</span>
            </p>
            <h2 className="mt-2 font-display text-display-2 font-extrabold leading-[1.05] text-ink">
              {isKid ? "You did it!" : sessionLabel}
            </h2>
            <p className="mt-2.5 max-w-[46ch] text-[15px] leading-relaxed text-soft">
              You reviewed {cards.length} card{cards.length === 1 ? "" : "s"} and
              got {gotCount} on the first try.
            </p>

            {/* Measures — translucent wells on the tinted card, as drawn. */}
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="club-b-chip inline-flex items-baseline gap-1.5 px-3 py-1.5">
                <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                  {cards.length}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                  Reviewed
                </span>
              </span>
              <span className="club-b-chip inline-flex items-center gap-1.5 px-3 py-1.5">
                <StreakFlame streak={bestStreak} size={20} showZero />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                  Best streak
                </span>
              </span>
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
                className="club-b-chip inline-flex items-baseline gap-1.5 px-3 py-1.5"
              >
                <span
                  className={`font-mono text-[14px] font-semibold tabular-nums ${
                    xpAwarded > 0 ? "text-accent" : "text-soft"
                  }`}
                >
                  +{xpAwarded}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                  {xpAwarded > 0 ? "XP earned" : "XP (already today)"}
                </span>
              </motion.span>
            </div>

            <p className="mt-5 max-w-[46ch] text-[13px] leading-relaxed text-soft">
              {dueTomorrow > 0
                ? `${dueTomorrow} card${dueTomorrow === 1 ? "" : "s"} come back tomorrow to lock it in.`
                : "Every card leveled up — nothing due tomorrow. Nice."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/progress"
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
              >
                See progress
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={backToPicker}
                className="f0-focus f0-press inline-flex items-center gap-2 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
              >
                <ChevronLeft className="h-4 w-4" /> Back to sets
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    );
  }

  const spring = isKid
    ? { type: "spring" as const, stiffness: 320, damping: 16 }
    : { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader
        label={sessionLabel}
        onBack={backToPicker}
        sub={isDaily ? undefined : "Study set"}
      />

      {/* progress dots */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < index ? "w-1.5 bg-accent" : i === index ? "w-6 bg-accent" : "w-1.5 bg-sand"
            }`}
          />
        ))}
      </div>

      {/* card stack */}
      <div className="relative mx-auto" style={{ perspective: 1400, minHeight: isKid ? 420 : 380 }}>
        {[2, 1].map((depth) => {
          const peek = cards[index + depth];
          if (!peek) return null;
          return (
            <div
              key={`peek-${peek.id}`}
              className="club-b-card absolute inset-x-0 top-0"
              style={{
                transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`,
                zIndex: 1,
                height: isKid ? 400 : 360,
                opacity: 0.6 - depth * 0.15,
                boxShadow: "var(--shadow-soft)",
              }}
            />
          );
        })}

        <AnimatePresence>
          {current && (
            <motion.div
              key={current.id}
              className="absolute inset-x-0 top-0 z-10 cursor-grab active:cursor-grabbing"
              style={{ height: isKid ? 400 : 360 }}
              drag={busy ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={onDragEnd}
              initial={{ scale: 0.94, y: 8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : {
                      x: exitDir === "right" ? 460 : exitDir === "left" ? -460 : 0,
                      rotate: exitDir === "right" ? 16 : exitDir === "left" ? -16 : 0,
                      opacity: 0,
                      transition: { duration: 0.32 },
                    }
              }
              transition={spring}
            >
              <FlipCard
                card={current}
                flipped={flipped}
                onFlip={() => !busy && setFlipped((f) => !f)}
                isKid={isKid}
                reduce={!!reduce}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* actions — weight, not hue, separates the two calls */}
      <div className="mt-6">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="f0-focus f0-press min-h-[52px] w-full rounded-full bg-accent font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
          >
            {isKid ? "Flip the card" : "Reveal answer"}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleResult(false)}
              disabled={busy}
              className="f0-focus f0-press flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-sand bg-card font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-ink transition-colors hover:border-accent disabled:opacity-50"
            >
              <X className="h-5 w-5" />
              {isKid ? "Try again" : "Again"}
            </button>
            <button
              onClick={() => handleResult(true)}
              disabled={busy}
              className="f0-focus f0-press flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-accent font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              {isKid ? "Nailed it!" : "Got it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- the collectible card ---------- */
function FlipCard({
  card,
  flipped,
  onFlip,
  isKid,
  reduce,
}: {
  card: DailyCard;
  flipped: boolean;
  onFlip: () => void;
  isKid: boolean;
  reduce: boolean;
}) {
  const t = weekTheme(cardThemeWeek(card));
  const bigText = isKid ? "text-[26px]" : "text-[22px]";
  const hasVisual = !!card.visual;

  // The face IS a board card: 14px radius, sand hairline, card ground — so the
  // object you study is drawn from the same vocabulary as everything around it.
  // The storybook art header carries the set's identity, not a coloured border.
  const faceBase =
    "club-b-card absolute inset-0 flex flex-col overflow-hidden";

  return (
    <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }} onClick={onFlip}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* FRONT */}
        <div className={faceBase} style={{ backfaceVisibility: "hidden", boxShadow: "var(--shadow-lift)" }}>
          <CardHeader t={t} card={card} face="Question" />
          {hasVisual ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-3">
              <div className="night-island w-full p-3">
                <CandleRenderer
                  candles={card.visual!.candles}
                  revealed={card.visual!.candles.length}
                  levels={card.visual!.levels}
                  height={card.visual!.candles.length <= 3 ? 150 : 168}
                />
              </div>
              <p className="mt-3 text-center text-[14px] text-soft">{card.front}</p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-5 text-center">
              <p className={`font-display font-extrabold leading-snug text-ink ${bigText}`}>
                {card.front}
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5 px-5 pb-4 font-mono text-[11px] text-soft">
            <RotateCcw className="h-3.5 w-3.5" />
            {isKid ? "Tap to flip" : "Tap to reveal the answer"}
          </div>
        </div>

        {/* BACK */}
        <div
          className={faceBase}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          <CardHeader t={t} card={card} face="Answer" />
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-5 text-center">
            {hasVisual && (
              <p className="mb-2 font-display text-[24px] font-extrabold text-ink">
                {card.visual!.name}
              </p>
            )}
            <p
              className={
                hasVisual
                  ? "max-w-[42ch] text-[14px] leading-relaxed text-soft"
                  : `font-display font-bold leading-snug text-ink ${isKid ? "text-[22px]" : "text-[19px]"}`
              }
            >
              {card.back}
            </p>
          </div>
          <div className="flex items-center justify-center px-5 pb-4">
            {card.source ? (
              <span className="f0-chip inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] text-soft">
                {card.source}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-soft">Tap to flip back</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CardHeader({
  t,
  card,
  face,
}: {
  t: ReturnType<typeof weekTheme>;
  card: DailyCard;
  face: string;
}) {
  return (
    <div className="relative h-20 shrink-0">
      <Image src={t.img} alt="" fill className="object-cover" />
      <div className="absolute inset-0" style={{ background: t.bar, opacity: 0.72 }} />
      {/* Type sits on artwork, so it is theme-invariant white by design. */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <span className="text-eyebrow font-display font-bold uppercase text-white drop-shadow">
          {face}
        </span>
        <div className="flex items-center gap-2">
          {card.week ? (
            <span className="rounded-full bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white">
              Week {card.week}
            </span>
          ) : null}
          <span className="rounded-full bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white">
            {t.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function SessionHeader({
  label,
  onBack,
  sub,
}: {
  label: string;
  onBack: () => void;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <button
        onClick={onBack}
        className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-soft transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> All sets
      </button>
      <h1 className="mt-3 font-display text-display-2 font-extrabold leading-[1.05] text-ink">
        {label}
      </h1>
      {sub ? <p className="mt-1.5 font-mono text-[12px] text-soft">{sub}</p> : null}
    </div>
  );
}
