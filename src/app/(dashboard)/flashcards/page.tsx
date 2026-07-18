"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { Layers, RotateCcw, Check, X, ArrowRight, Sparkles, Zap, ChevronLeft } from "lucide-react";
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
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  /* ---------------- SET PICKER ---------------- */
  if (mode === "picker") {
    return (
      <div className="max-w-3xl mx-auto">
        <PickerHeader isKid={isKid} />

        {/* Daily 5 — the prominent quick action, across ALL sets */}
        <button
          onClick={startDaily}
          disabled={starting}
          className="cta-button w-full rounded-2xl p-5 mb-6 flex items-center gap-4 text-left disabled:opacity-60"
        >
          <span className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-lg font-bold leading-tight">Daily 5</span>
            <span className="block text-sm opacity-90">
              {totalDue > 0
                ? `${totalDue} card${totalDue === 1 ? "" : "s"} due — your quick daily review across every set`
                : "Five cards to keep every concept sharp, pulled across all your sets"}
            </span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wide text-soft mb-3">Choose a set</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {sets.map((s, i) => (
            <motion.button
              key={s.slug}
              onClick={() => startSet(s)}
              disabled={starting}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="paper-card overflow-hidden flex flex-col text-left group hover:shadow-[var(--shadow-lift)] transition-shadow disabled:opacity-60"
            >
              <SetThumb set={s} />
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-ink">{s.title}</h2>
                  {s.due > 0 ? (
                    <span className="shrink-0 rounded-full bg-chip-green px-2 py-0.5 text-[11px] font-bold text-green-700">
                      {s.due} due
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-soft leading-relaxed mt-1 flex-1">{s.blurb}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-soft">{s.count} cards</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 group-hover:text-gold-800">
                    Study <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- SESSION ---------------- */
  if (cards.length === 0 && !done) {
    return (
      <div className="max-w-2xl mx-auto">
        <SessionHeader label={sessionLabel} onBack={backToPicker} />
        <div className="paper-card p-10 text-center">
          <Sparkles className="w-8 h-8 text-gold-500 mx-auto mb-3" />
          <p className="font-display text-lg font-semibold text-ink mb-1">
            {isKid ? "All caught up!" : "Nothing due in this set"}
          </p>
          <p className="text-soft text-sm max-w-sm mx-auto mb-6">
            {isKid
              ? "You reviewed everything here for today. Try another set or come back tomorrow."
              : "You have reviewed all of these cards for today. New cards unlock as your reviews come due."}
          </p>
          <button
            onClick={backToPicker}
            className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Back to sets
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <SessionHeader label={sessionLabel} onBack={backToPicker} />
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
            {isKid ? "You did it!" : `${sessionLabel} complete`}
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
            <button
              onClick={backToPicker}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-sand text-ink text-sm font-medium hover:bg-paper"
            >
              <ChevronLeft className="w-4 h-4" /> Back to sets
            </button>
            <Link
              href="/progress"
              className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              See progress
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
      <SessionHeader label={sessionLabel} onBack={backToPicker} sub={isDaily ? undefined : "Study set"} />

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
      <div className="relative mx-auto" style={{ perspective: 1400, minHeight: isKid ? 420 : 380 }}>
        {[2, 1].map((depth) => {
          const peek = cards[index + depth];
          if (!peek) return null;
          const t = weekTheme(cardThemeWeek(peek));
          return (
            <div
              key={`peek-${peek.id}`}
              className={`absolute inset-x-0 top-0 rounded-2xl border bg-white ${t.ring}`}
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

/* ---------- picker set thumbnail ---------- */
function SetThumb({ set }: { set: SetSummary }) {
  const t = weekTheme(set.themeWeek);
  if (set.preview) {
    const compact = set.preview.candles.length <= 3;
    return (
      <div className="relative h-28 night-island rounded-none flex items-center justify-center px-3">
        <div className="w-full">
          <CandleRenderer
            candles={set.preview.candles}
            revealed={set.preview.candles.length}
            levels={set.preview.levels}
            height={compact ? 104 : 112}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-28">
      <Image src={t.img} alt="" fill className="object-cover" />
      <div className="absolute inset-0" style={{ background: t.bar, opacity: 0.55 }} />
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
  const t = weekTheme(cardThemeWeek(card));
  const bigText = isKid ? "text-2xl" : "text-xl";
  const hasVisual = !!card.visual;

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
          {hasVisual ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-3">
              <div className="w-full night-island p-3">
                <CandleRenderer
                  candles={card.visual!.candles}
                  revealed={card.visual!.candles.length}
                  levels={card.visual!.levels}
                  height={card.visual!.candles.length <= 3 ? 150 : 168}
                />
              </div>
              <p className="mt-3 text-sm text-soft text-center">{card.front}</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 py-5 text-center">
              <p className={`font-display font-semibold text-ink leading-snug ${bigText}`}>
                {card.front}
              </p>
            </div>
          )}
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
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-5 text-center">
            {hasVisual && (
              <p className={`font-display font-extrabold text-ink mb-2 ${isKid ? "text-2xl" : "text-2xl"}`}>
                {card.visual!.name}
              </p>
            )}
            <p
              className={`font-display font-semibold text-ink leading-snug ${
                hasVisual ? "text-sm text-soft font-medium" : isKid ? "text-xl" : "text-lg"
              }`}
            >
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
        <span className="font-display text-sm font-extrabold text-white drop-shadow">{face}</span>
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

function PickerHeader({ isKid }: { isKid: boolean }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-5 h-5 text-gold-600" />
        <h1 className="font-display text-2xl font-bold text-ink">Flashcards</h1>
      </div>
      <p className="text-soft text-sm">
        {isKid
          ? "Pick a deck of collectible cards. Flip, guess, and grow your streak."
          : "Pick a set to study, or run your Daily 5 for a quick review across everything."}
      </p>
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
        className="inline-flex items-center gap-1 text-sm text-soft hover:text-ink mb-2"
      >
        <ChevronLeft className="w-4 h-4" /> All sets
      </button>
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-gold-600" />
        <h1 className="font-display text-2xl font-bold text-ink">{label}</h1>
      </div>
      {sub ? <p className="text-soft text-sm">{sub}</p> : null}
    </div>
  );
}
