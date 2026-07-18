"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  RotateCcw,
  Check,
  X,
  Flame,
  Sparkles,
  ArrowRight,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  pickDailyFive,
  reviewCard,
  type DailyCard,
} from "@/lib/flashcards";
import { XP, awardXp, countXpToday } from "@/lib/xp";

export default function FlashcardsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [isKid, setIsKid] = useState(false);
  const [cards, setCards] = useState<DailyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotCount, setGotCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

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

  async function finishSession(finalGot: number, finalStreak: number) {
    setDone(true);
    // +20 XP, once per day only.
    const already = await countXpToday(supabase, userId, "flashcards");
    if (already === 0) {
      await awardXp(supabase, userId, "flashcards", XP.FLASHCARDS, "daily-5");
      setXpAwarded(XP.FLASHCARDS);
    }
    setBestStreak(finalStreak);
    setGotCount(finalGot);
  }

  async function handleResult(gotIt: boolean) {
    if (!current) return;
    const outcome = await reviewCard(supabase, userId, current, gotIt);
    const nextGot = gotCount + (gotIt ? 1 : 0);
    const nextStreak = Math.max(bestStreak, outcome.streak);
    setGotCount(nextGot);
    setBestStreak(nextStreak);

    if (index + 1 >= cards.length) {
      await finishSession(nextGot, nextStreak);
    } else {
      setFlipped(false);
      setIndex((i) => i + 1);
    }
  }

  const bigText = isKid ? "text-2xl" : "text-xl";

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No cards for this track (shouldn't happen once seeded)
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
          className="paper-card p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-chip-green flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-green-600" />
          </div>
          <h2 className={`font-display font-bold text-ink ${bigText} mb-1`}>
            {isKid ? "Nice work!" : "Daily 5 complete"}
          </h2>
          <p className="text-soft mb-6">
            You reviewed {cards.length} card{cards.length === 1 ? "" : "s"} and
            got {gotCount} on the first try.
          </p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <div>
              <p className="font-display text-2xl font-bold text-ink">
                {cards.length}
              </p>
              <p className="text-xs text-soft">Reviewed</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-gold-600 flex items-center gap-1 justify-center">
                <Flame className="w-5 h-5" /> {bestStreak}
              </p>
              <p className="text-xs text-soft">Best card streak</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-green-600">
                +{xpAwarded}
              </p>
              <p className="text-xs text-soft">
                {xpAwarded > 0 ? "XP earned" : "XP (already today)"}
              </p>
            </div>
          </div>
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

  return (
    <div className="max-w-2xl mx-auto">
      <Header isKid={isKid} />

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i < index
                ? "w-2 bg-gold-500"
                : i === index
                  ? "w-6 bg-gold-500"
                  : "w-2 bg-sand"
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.button
          key={current?.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          onClick={() => setFlipped((f) => !f)}
          className={`w-full text-left paper-card p-8 min-h-[280px] flex flex-col justify-center cursor-pointer ${
            isKid ? "bg-chip-amber/40 border-gold-300" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                flipped
                  ? "bg-chip-green text-green-700"
                  : "bg-chip-sky text-sky-800"
              }`}
            >
              {flipped ? "Answer" : "Card"} {index + 1} of {cards.length}
            </span>
            {current?.week ? (
              <span className="text-[11px] text-soft">Week {current.week}</span>
            ) : null}
          </div>

          <p
            className={`font-display font-semibold text-ink leading-snug ${
              isKid ? "text-2xl" : "text-xl"
            }`}
          >
            {flipped ? current?.back : current?.front}
          </p>

          <p className="mt-6 text-xs text-soft flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            {flipped ? "Tap to see the question again" : "Tap to reveal the answer"}
          </p>
        </motion.button>
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-6">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="cta-button w-full py-3.5 rounded-xl text-base"
          >
            Reveal answer
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResult(false)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-red-500/30 bg-red-500/5 text-red-600 font-display font-bold hover:bg-red-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
              Again
            </button>
            <button
              onClick={() => handleResult(true)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-green-500/40 bg-chip-green text-green-700 font-display font-bold hover:bg-green-500/15 transition-colors"
            >
              <Check className="w-5 h-5" />
              Got it
            </button>
          </div>
        )}
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
          ? "Five quick cards. Flip, guess, and grow your streak."
          : "Five cards a day keeps the concepts sharp. Flip to reveal, then rate yourself."}
      </p>
    </div>
  );
}
