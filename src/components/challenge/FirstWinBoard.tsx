"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TickerTile } from "@/components/canvas2";
import { DisplayHead, SectionRule } from "@/components/f0/parts";
import { postArtifact } from "@/lib/challenge/state";
import type { ChallengeState } from "@/lib/challenge/types";

/**
 * DAY 0 — the first win. One mission, under fifteen minutes: name a company from
 * your own life, write one sentence on why, post it. A completed artifact inside
 * thirty minutes of signup is the strongest activation signal we have
 * (CHALLENGE-PRESEASON-PLAN) — so this board is deliberately the shortest one in
 * the journey and the only thing on it is the thing.
 *
 * REAL WRITES, in one server call (`challenge_post_artifact`):
 *   • a row in `challenge_artifacts` (day 0, kind 'first_pick')
 *   • a REAL community post in `feed_posts` — the same feed everyone reads, not
 *     a shadow one, and it is linked back so the artifact is clickable
 *   • a REAL row in `family_watchlist` — "pick your first watchlist stock" has
 *     to leave a watchlist behind or the mission was theatre
 *   • the day-0 share step + the +50 XP, ref-deduped in `xp_events`
 *
 * TICKER: `TickerTile` from the canvas2 barrel. The price is whatever
 * `screener_metrics` actually holds; an unknown ticker renders `changePct: null`
 * → "—", never a fabricated 0.00%. NOTHING here renders a verdict: no BUY badge,
 * no rating, no "good pick" — the copy praises the HABIT, never the choice.
 */

interface Suggestion {
  ticker: string;
  name: string | null;
  price: number | null;
  chg: number | null;
}

export default function FirstWinBoard({
  state,
  suggestions,
  todayCount,
}: {
  state: ChallengeState;
  /** Seeded server-side from screener_metrics — no client fetch on first paint. */
  suggestions: Suggestion[];
  /** Real count of day-0 artifacts posted today. Null = unavailable. */
  todayCount: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const done = Boolean(state.member?.day0_completed_at);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [manual, setManual] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticker = picked?.ticker ?? manual.trim().toUpperCase();
  const canPost = ticker.length >= 1 && why.trim().length >= 8 && !busy;

  const submit = useCallback(async () => {
    if (!canPost) return;
    setBusy(true);
    setError(null);
    const body = `My first watchlist pick: $${ticker} — ${why.trim()}`;
    const res = await postArtifact(supabase, {
      day: 0,
      kind: "first_pick",
      body,
      ticker,
      company: picked?.name ?? null,
      payload: { why: why.trim() },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "That didn't save. Try once more.");
      return;
    }
    router.push("/challenge/hq");
  }, [canPost, ticker, why, picked, supabase, router]);

  if (done) {
    return (
      <div className="f0-stagger space-y-8">
        <DisplayHead
          eyebrow="Your first mission"
          title="First win"
          mark="done"
          lede="Your pick is on your watchlist and in the community. That is the whole habit — you'll repeat it every week from here."
        />
        <a
          href="/challenge/hq"
          className="cta-button f0-focus f0-press inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px]"
        >
          Go to your HQ <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="f0-stagger space-y-9">
      <DisplayHead
        eyebrow="Your first mission · ~15 min"
        title="Pick your first watchlist"
        mark="stock"
        lede="A company from your own life. Companies you actually use are where nearly every investor starts."
      />

      {/* 1 — the company */}
      <section className="space-y-4">
        <SectionRule>1 · Pick a company from your life</SectionRule>

        {suggestions.length > 0 ? (
          <div
            role="radiogroup"
            aria-label="Pick a company"
            className="flex flex-wrap gap-3"
          >
            {suggestions.map((s) => (
              <button
                key={s.ticker}
                type="button"
                role="radio"
                aria-checked={picked?.ticker === s.ticker}
                onClick={() => {
                  setPicked(s);
                  setManual("");
                }}
                className={`f0-focus f0-press rounded-xl ${
                  picked?.ticker === s.ticker ? "f0-tile-lead" : ""
                }`}
              >
                <TickerTile
                  ticker={s.ticker}
                  changePct={s.chg}
                  mark={s.name ? s.name.slice(0, 1) : undefined}
                  size="md"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="border-l-2 border-sand py-1 pl-4 text-[15px] leading-relaxed text-soft">
            The company list isn&rsquo;t loaded yet — type any ticker below and
            it still counts.
          </p>
        )}

        <label className="block">
          <span className="text-eyebrow font-display font-bold uppercase text-soft">
            Or type a ticker
          </span>
          <input
            value={manual}
            onChange={(e) => {
              setManual(e.target.value.toUpperCase().slice(0, 6));
              setPicked(null);
            }}
            placeholder="NVDA"
            className="f0-focus mt-2 w-full max-w-[180px] rounded-md bg-sand/60 px-3 py-2 font-mono text-[15px] font-semibold uppercase tracking-wide text-ink placeholder:text-soft/60"
          />
        </label>
      </section>

      {/* 2 — the sentence */}
      <section className="space-y-4">
        <SectionRule>2 · One sentence — why this one?</SectionRule>
        <textarea
          rows={3}
          maxLength={500}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Every AI product I use runs on their chips."
          className="f0-focus w-full resize-none rounded-lg bg-sand/50 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-soft/70"
        />
        <p className="text-[13px] text-soft">
          Your own words beat a good-sounding reason every time. Nobody is
          grading it.
        </p>
      </section>

      {/* 3 — post it */}
      <section className="space-y-4">
        <SectionRule>3 · Post it to the community</SectionRule>
        {error && (
          <p className="border-l-2 border-sand py-1 pl-4 text-[14px] text-soft">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canPost}
          className="cta-button f0-focus f0-press inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] disabled:opacity-45"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Post my first pick
          <span className="font-mono text-[13px] opacity-80">· +50 XP</span>
        </button>

        {todayCount != null && todayCount > 0 && (
          <p className="text-[13px] text-soft">
            {todayCount === 1
              ? "One first pick posted today — yours makes two."
              : `${todayCount.toLocaleString()} first picks posted today — see what everyone chose once you post.`}
          </p>
        )}
        <p className="text-[13px] text-soft">
          Education, not financial advice. Adding a company to a watchlist is
          practice — nothing is bought and no money is at risk.
        </p>
      </section>
    </div>
  );
}
