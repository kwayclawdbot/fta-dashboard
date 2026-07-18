"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, GAME_PASS_RATIO } from "@/lib/xp";
import type { GameRound } from "./types";
import { fallbackCandle, fallbackSeries } from "./chartGen";

const ROUNDS_PER_SESSION = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shared session engine for the animated games. Deliberately preserves the
 * original GameSession behaviour EXACTLY:
 *   - 10 rounds, running correct count = the DB `score`
 *   - inserts one game_scores row per finished session
 *   - awards XP.GAME (10) only when score/rounds >= 70%, ref `${game}-${ts}`
 * `points` is a cosmetic combo/speed tally for the UI only — never persisted.
 */
export function useGameRounds(game: string) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0); // correct count -> DB score
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [points, setPoints] = useState(0); // cosmetic combo points
  const [done, setDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const scoreRef = useRef(0);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase
      .from("game_items")
      .select("id, prompt, answer, why, chart_data")
      .eq("game", game);
    const prepared = ((data as GameRound[]) || []).map((r) => {
      if (!r.chart_data) {
        r.chart_data =
          game === "candle-battle"
            ? fallbackCandle(r.id, r.answer)
            : fallbackSeries(r.id, r.answer);
      }
      return r;
    });
    setRounds(shuffle(prepared).slice(0, ROUNDS_PER_SESSION));
    setLoading(false);
  }, [supabase, game]);

  useEffect(() => {
    load();
  }, [load]);

  const current = rounds[index];

  /** Record the outcome of the current round (does not advance). */
  const recordResult = useCallback((correct: boolean, bonus = 0) => {
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setStreak((st) => {
        const ns = st + 1;
        setBestStreak((b) => Math.max(b, ns));
        // combo: base 10 + streak kicker + speed bonus
        setPoints((p) => p + 10 + Math.min(ns - 1, 5) * 2 + bonus);
        return ns;
      });
    } else {
      setStreak(0);
    }
  }, []);

  /** Advance to the next round, or finalize the session (persist + XP). */
  const advance = useCallback(async () => {
    if (index + 1 >= rounds.length) {
      const finalScore = scoreRef.current;
      const passed = finalScore / rounds.length >= GAME_PASS_RATIO;
      setDone(true);
      if (userId) {
        await supabase.from("game_scores").insert({
          user_id: userId,
          game,
          score: finalScore,
          rounds: rounds.length,
        });
        if (passed) {
          await awardXp(supabase, userId, "game", XP.GAME, `${game}-${Date.now()}`);
          setXpAwarded(XP.GAME);
        }
      }
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, rounds.length, userId, supabase, game]);

  const replay = useCallback(() => {
    scoreRef.current = 0;
    setRounds((r) => shuffle(r));
    setIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setDone(false);
    setXpAwarded(0);
  }, []);

  return {
    loading,
    userId,
    rounds,
    index,
    current,
    score,
    streak,
    bestStreak,
    points,
    done,
    xpAwarded,
    total: rounds.length,
    recordResult,
    advance,
    replay,
  };
}
