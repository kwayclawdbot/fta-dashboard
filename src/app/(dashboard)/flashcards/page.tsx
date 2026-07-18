"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { Layers, RotateCcw, Check, X, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { pickDailyFive, reviewCard, type DailyCard } from "@/lib/flashcards";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { weekTheme } from "@/lib/games/art";
import Burst from "@/components/games/Burst";
import StreakFlame from "@/components/games/StreakFlame";

export default function FlashcardsPage() {
  const supabase = createClient();
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [isKid, setIsKid] = useState(false);
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
    const track = profile?.age_group || profile?.track || "adults";
    setIsKid(profile?.role === "child" && track === "kids");
    const daily = await pickDailyFive(supabase, user.id, track);
    setCards(daily);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

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

    // let the card fly off, then advance
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
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (cards.length === 0 && !done) {
    return (
      <div className="max-w-2xl mx-auto">
        <Header isKid={isKid} />
        <div className="paper-card p-10 text-center">
          <Sparkles className="w-8 h-8 text-gold-500 mx-auto mb-3" />
          <p className="font-display text-lg font-semibold text-ink mb-1">
            {isKid ? "All caught up!" : "Nothing due right now"}
          </p>
          <p className="text-soft text-sm max-w-sm mx-auto">
            {isKid
              ? "You reviewed everything for today. Come back tomorrow for 5 more."
              : "You have reviewed all your cards for today. New cards unlock as your reviews come due."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <Header isKid={isKid} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="paper-card p-8 text-center relative overflow-hidden"
        >
          <Burst count={26} power={150} />
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-chip-green flex items-center justify-center mx-auto mb-4"
          >
            <Check className="w-8 h-8 text-green-600" />
          </motion.div>
          <h2 className={`font-display font-bold text-ink ${isKid ? "text-2xl" : "text-xl"} mb-1`}>
            {isKid ? "You did it!" : "Daily 5 complete"}
          </h2>
          <p className="text-soft mb-6">
            You reviewed {cards.length} card{cards.length === 1 ? "" : "s"} and got {gotCount} on the
            first try.
          </p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <div>
              <p className="font-display text-2xl font-bold text-ink">{cards.length}</p>
              <p className="text-xs text-soft">Reviewed</p>
            </div>
            <div>
              <div className="flex justify-center">
                <StreakFlame streak={bestStreak} size={26} showZero />
              </div>
              <p className="text-xs text-soft mt-1">Best card streak</p>
            </div>
            <div>
              <motion.p
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
                className="font-display text-2xl font-bold text-green-600"
              >
                +{xpAwarded}
              </motion.p>
              <p className="text-xs text-soft">{xpAwarded > 0 ? "XP earned" : "XP (already today)"}</p>
            </div>
          </div>
          <p className="text-sm text-soft mb-6">
            {dueTomorrow > 0
              ? `${dueTomorrow} card${dueTomorrow === 1 ? "" : "s"} will come back tomorrow to lock it in.`
              : "Every card leveled up — nothing due tomorrow. Nice."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/progress"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-sand text-ink text-sm font-medium hover:bg-paper"
            >
              See progress
            </Link>
            <Link
              href="/dashboard"
              className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              {isKid ? "Back to Kids Corner" : "Back home"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const spring = isKid
    ? { type: "spring" as const, stiffness: 320, damping: 16 }
    : { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div className="max-w-2xl mx-auto">
      <Header isKid={isKid} />

      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i < index ? "w-2 bg-gold-500" : i === index ? "w-6 bg-gold-500" : "w-2 bg-sand"
            }`}
          />
        ))}
      </div>

      {/* card stack */}
      <div className="relative mx-auto" style={{ perspective: 1400, minHeight: isKid ? 380 : 340 }}>
        {/* peeking cards behind */}
        {[2, 1].map((depth) => {
          const peek = cards[index + depth];
          if (!peek) return null;
          const t = weekTheme(peek.week);
          return (
            <div
              key={`peek-${peek.id}`}
              className={`absolute inset-x-0 top-0 rounded-2xl border bg-white ${t.ring}`}
              style={{
                transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`,
                zIndex: 1,
                height: isKid ? 360 : 320,
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
              style={{ height: isKid ? 360 : 320 }}
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
              {/* drag hint trails */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
                <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-500 opacity-0 sm:opacity-60">
                  ← Again
                </span>
                <span className="rounded-full bg-chip-green px-2 py-1 text-[10px] font-bold text-green-700 opacity-0 sm:opacity-60">
                  Got it →
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* actions */}
      <div className="mt-6">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="cta-button w-full min-h-[52px] rounded-xl text-base"
          >
            {isKid ? "Flip the card" : "Reveal answer"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResult(false)}
              disabled={busy}
              className="flex items-center justify-center gap-2 min-h-[52px] rounded-xl border-2 border-red-500/30 bg-red-500/5 text-red-600 font-display font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              {isKid ? "Try again" : "Again"}
            </button>
            <button
              onClick={() => handleResult(true)}
              disabled={busy}
              className="flex items-center justify-center gap-2 min-h-[52px] rounded-xl border-2 border-green-500/40 bg-chip-green text-green-700 font-display font-bold hover:bg-green-500/15 transition-colors disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {isKid ? "Nailed it!" : "Got it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- the 3D collectible card ---------- */
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
  const t = weekTheme(card.week);
  const bigText = isKid ? "text-2xl" : "text-xl";

  const faceBase =
    "absolute inset-0 rounded-2xl border bg-white overflow-hidden flex flex-col " + t.ring;

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
          <div className="flex-1 flex items-center justify-center px-6 py-5 text-center">
            <p className={`font-display font-semibold text-ink leading-snug ${bigText}`}>
              {card.front}
            </p>
          </div>
          <div className="px-5 pb-4 text-xs text-soft flex items-center gap-1.5 justify-center">
            <RotateCcw className="w-3.5 h-3.5" />
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
          <div className="flex-1 flex items-center justify-center px-6 py-5 text-center">
            <p className={`font-display font-semibold text-ink leading-snug ${isKid ? "text-xl" : "text-lg"}`}>
              {card.back}
            </p>
          </div>
          <div className="px-5 pb-4 flex items-center justify-center">
            {card.source ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${t.chip}`}>
                {card.source}
              </span>
            ) : (
              <span className="text-xs text-soft">Tap to flip back</span>
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
      <div className="absolute inset-0 px-4 flex items-center justify-between">
        <span className="font-display text-sm font-extrabold text-white drop-shadow">
          {face}
        </span>
        <div className="flex items-center gap-2">
          {card.week ? (
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-ink">
              Week {card.week}
            </span>
          ) : null}
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-white">
            {t.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function Header({ isKid }: { isKid: boolean }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-5 h-5 text-gold-600" />
        <h1 className="font-display text-2xl font-bold text-ink">Daily 5</h1>
      </div>
      <p className="text-soft text-sm">
        {isKid
          ? "Five collectible cards. Flip, guess, and grow your streak."
          : "Five cards a day keeps the concepts sharp. Flip to reveal, then rate yourself — or swipe."}
      </p>
    </div>
  );
}
