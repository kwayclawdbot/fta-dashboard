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
import {
  DisplayHead,
  SectionRule,
  Ledger,
  EmptyLine,
  TextAction,
} from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   FLASHCARDS — recall practice.

   Two states, one surface language:
     · PICKER  — masthead, ONE obsidian field (Daily 5, the quick action), then
                 every set as a hairline ledger row. The old version was a
                 two-column grid of `paper-card` tiles — the exact pattern the
                 register bans.
     · SESSION — the card is the object. Its faces are `bg-card`, a semantic
                 token (they were `bg-white`, a white slab with invisible type
                 on the dark theme), and the art header keeps the storybook
                 imagery because it IS the card's identity.

   COLOUR LAW: green/red = price, so "Got it" / "Again" are differentiated by
   WEIGHT, not by hue — Got it is the solid volt action, Again is a hairline
   outline. Volt orange also carries the meter, the dots and every CTA.
   Behaviour (SRS scheduling, once-a-day XP, streaks) is untouched.
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

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-8 pb-16">
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-sand/60" />
          <div className="h-11 w-56 rounded bg-sand/60" />
        </div>
        <div className="h-44 rounded-[1.5rem] bg-sand/40" />
        <div className="h-32 rounded bg-sand/30" />
      </div>
    );
  }

  /* ---------------- SET PICKER ---------------- */
  if (mode === "picker") {
    return (
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        <DisplayHead
          eyebrow="Recall practice"
          title="Flashcards"
          lede={
            isKid
              ? "Flip a card, make your guess, grow your streak. Five a day keeps it all sharp."
              : "Run your Daily 5 for a fast sweep across everything, or drill one set until it's automatic."
          }
        />

        {/* Daily 5 — the one dark object on this surface */}
        <section className="f0-hero-field f0-grain p-6 sm:p-7">
          <p className="text-eyebrow font-display font-bold uppercase text-volt-400">
            Today
          </p>
          <h2 className="mt-2 font-display text-display-2 font-extrabold leading-[1.05] text-[#F7F3EA]">
            Daily 5
          </h2>
          <p className="mt-2.5 max-w-[46ch] text-[15px] leading-relaxed text-[#F7F3EA]/70">
            {totalDue > 0
              ? `${totalDue} card${totalDue === 1 ? "" : "s"} are due across every set — five minutes closes them out.`
              : "Five cards pulled across all your sets to keep every concept sharp."}
          </p>
          <button
            onClick={startDaily}
            disabled={starting}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {starting ? "Dealing…" : "Start the Daily 5"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        {/* Sets — hairline rows, never a tile grid */}
        <section className="space-y-4">
          <SectionRule>Study sets</SectionRule>
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
            <Ledger>
              {sets.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => startSet(s)}
                  disabled={starting}
                  className="f0-ledger-row w-full justify-between text-left disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] font-bold text-ink">
                      {s.title}
                    </span>
                    <span className="mt-0.5 block max-w-[52ch] text-[13px] leading-snug text-soft">
                      {s.blurb}
                    </span>
                  </span>
                  <span className="shrink-0 self-center text-right">
                    <span className="block font-mono text-[13px] font-semibold tabular-nums text-soft">
                      {s.count} cards
                    </span>
                    {s.due > 0 && (
                      <span className="mt-0.5 block font-display text-[12px] font-bold text-gold-700">
                        {s.due} due
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-soft" />
                </button>
              ))}
            </Ledger>
          )}
        </section>
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
          className="f0-hero-field f0-grain p-6 text-center sm:p-8"
        >
          <Burst count={26} power={150} />
          <div className="relative">
            <p className="text-eyebrow font-display font-bold uppercase text-volt-400">
              Session complete
            </p>
            <h2 className="mt-2 font-display text-display-2 font-extrabold text-[#F7F3EA]">
              {isKid ? "You did it!" : sessionLabel}
            </h2>
            <p className="mx-auto mt-2.5 max-w-[46ch] text-[15px] leading-relaxed text-[#F7F3EA]/70">
              You reviewed {cards.length} card{cards.length === 1 ? "" : "s"} and
              got {gotCount} on the first try.
            </p>

            {/* Measures — hairline-separated, no boxes */}
            <div className="mt-7 flex items-stretch justify-center">
              <div className="px-5">
                <p className="font-display text-display-3 font-extrabold tabular-nums text-[#F7F3EA]">
                  {cards.length}
                </p>
                <p className="mt-1 text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                  Reviewed
                </p>
              </div>
              <div className="border-l border-white/15 px-5">
                <div className="flex justify-center">
                  <StreakFlame streak={bestStreak} size={26} showZero />
                </div>
                <p className="mt-1 text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                  Best streak
                </p>
              </div>
              <div className="border-l border-white/15 px-5">
                <motion.p
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
                  className="font-display text-display-3 font-extrabold tabular-nums text-[#F7F3EA]"
                >
                  +{xpAwarded}
                </motion.p>
                <p className="mt-1 text-eyebrow font-display font-bold uppercase text-[#F7F3EA]/55">
                  {xpAwarded > 0 ? "XP earned" : "XP (already today)"}
                </p>
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-[46ch] text-[13px] leading-relaxed text-[#F7F3EA]/60">
              {dueTomorrow > 0
                ? `${dueTomorrow} card${dueTomorrow === 1 ? "" : "s"} come back tomorrow to lock it in.`
                : "Every card leveled up — nothing due tomorrow. Nice."}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/progress"
                className="inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                See progress
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={backToPicker}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 font-display text-[14px] font-bold text-[#F7F3EA]/80 transition-colors hover:text-[#F7F3EA]"
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
              i < index ? "w-1.5 bg-volt-500" : i === index ? "w-6 bg-volt-500" : "w-1.5 bg-sand"
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
              className="absolute inset-x-0 top-0 rounded-2xl border border-sand bg-card"
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
            className="min-h-[52px] w-full rounded-full bg-volt-500 font-display text-[15px] font-bold text-white transition-transform active:scale-[0.99]"
          >
            {isKid ? "Flip the card" : "Reveal answer"}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => handleResult(false)}
              disabled={busy}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-sand font-display text-[15px] font-bold text-ink transition-colors hover:border-gold-500 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
              {isKid ? "Try again" : "Again"}
            </button>
            <button
              onClick={() => handleResult(true)}
              disabled={busy}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-volt-500 font-display text-[15px] font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50"
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

  // Faces use the semantic card token (they were bg-white → a white slab with
  // unreadable type on the dark theme) and a sand hairline; the storybook art
  // header carries the set's identity instead of a coloured border.
  const faceBase =
    "absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-sand bg-card";

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
              <span className="inline-flex items-center rounded-full border border-sand px-2.5 py-1 font-mono text-[11px] text-soft">
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
        className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> All sets
      </button>
      <h1 className="mt-3 font-display text-display-2 font-extrabold leading-[1.05] text-ink">
        {label}
      </h1>
      {sub ? <p className="mt-1.5 font-mono text-[12px] text-soft">{sub}</p> : null}
    </div>
  );
}
