"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkClean } from "@/lib/profanity";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import {
  PostTypeControl,
  POST_TYPE_BY_KEY,
  StanceControl,
  TickerTile,
  type PostType,
} from "@/components/canvas2";
import { SectionRule } from "@/components/f0/parts";
import {
  CHANGE_REASONS,
  fetchStanceSummary,
  setStance as writeStance,
  type ChangeReasonKey,
  type Stance,
  type StanceSummary,
} from "@/lib/social/stance";

/* ══════════════════════════════════════════════════════════════════════════
   SHARE YOUR CALL — the structured composer. Canvas v2, Club Screens 05.

   ── WHAT "STRUCTURED" ACTUALLY BUYS ──────────────────────────────────────
   Three declarations, all required, all stored as columns rather than guessed
   from prose later:
     COMPANY  → feed_posts.ticker_tags, validated against the securities
                universe so an invented symbol can never enter the graph
     STANCE   → feed_posts.position AND, when it is a genuine change, a
                stance_events row (migration 151) so the call lands on the
                Changed My Mind destination under the member's name
     TYPE     → feed_posts.content_type, widened to the canvas vocabulary by
                migration 190
   The 2,000-character body is the LAST field, deliberately. The canvas has the
   same order and it is the right one: the declarations are cheap and they frame
   the writing, so asking for them first produces a better post than asking for
   them after the member has already written whatever came to mind.

   ── WHY THE FEED COMPOSER IS LEFT ALONE ──────────────────────────────────
   Not every message in a club is a call. Forcing a stance onto "does anyone know
   when NVDA reports" would make members stop posting, and a club that only
   accepts theses becomes a publication. The inline composer stays a text box;
   this destination is where a CALL goes, and it is the only path that can write
   a stance flip.

   ── COMPLIANCE ───────────────────────────────────────────────────────────
   Bullish / Neutral / Bearish is a COMMUNITY STANCE — the member's, stated by
   the member, about their own thinking. It is never rendered as the app's
   instruction and there is no BUY anywhere on this screen. Equities only: there
   is no options type, no options room, no options anything in Club surfaces.

   ── WHAT THE CANVAS DREW THAT DID NOT SURVIVE ────────────────────────────
   · "Save as draft". There is no draft table. A button that discards the
     member's writing while claiming to save it is worse than no button.
   · A three-dot progress bar filled to 2/3 regardless of state. Ours reflects
     the three real declarations, so it is a status, not decoration.
   · Green "Bullish". Green is PRICE; StanceControl is lime-keyed by law.
   ══════════════════════════════════════════════════════════════════════════ */

const BODY_MAX = 2000;
const HEADLINE_MAX = 120;

function isPostType(v: string | null): v is PostType {
  return v === "thesis" || v === "risk" || v === "chart" || v === "changed_mind";
}

interface Security {
  ticker: string;
  name: string | null;
  chg1d: number | null;
}

export default function ShareYourCallClient({
  userId,
  familyId,
  isKid,
  initialTicker,
  initialType,
}: {
  userId: string | null;
  familyId: string | null;
  isKid: boolean;
  initialTicker: string | null;
  initialType: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [draftTicker, setDraftTicker] = useState(initialTicker ?? "");
  /** The symbol we have COMMITTED to looking up (blur / Enter / a ?ticker= link). */
  const [query, setQuery] = useState(initialTicker ?? "");
  /**
   * Both async reads STAMP their answer with the request that produced it, so
   * `resolving` / `summaryLoading` are DERIVED rather than set inside an effect.
   * Beyond the lint rule, this is what guarantees a previous company's stance
   * split can never render for a frame under a newly typed symbol.
   */
  const [resolved, setResolved] = useState<{ q: string; row: Security | null } | null>(null);
  const [stanceAnswer, setStanceAnswer] = useState<{ t: string; s: StanceSummary } | null>(null);

  const [stance, setStance] = useState<Stance | null>(null);
  const [type, setType] = useState<PostType | null>(
    isPostType(initialType) ? initialType : null
  );
  const [reason, setReason] = useState<ChangeReasonKey | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const tickerInput = useRef<HTMLInputElement>(null);

  /* ── Resolve the company ──────────────────────────────────────────────
     Against screener_metrics, the same universe the feed composer validates
     against. An unresolved symbol is stated plainly rather than accepted and
     silently dropped at insert time. */
  useEffect(() => {
    if (!query) return;
    let live = true;
    supabase
      .from("screener_metrics")
      .select("ticker, name, chg_1d")
      .eq("ticker", query)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        const row = (data ?? null) as {
          ticker: string;
          name: string | null;
          chg_1d: number | null;
        } | null;
        setResolved({
          q: query,
          row: row ? { ticker: row.ticker, name: row.name, chg1d: row.chg_1d } : null,
        });
      });
    return () => {
      live = false;
    };
  }, [supabase, query]);

  const answered = resolved?.q === query;
  const security = answered ? (resolved?.row ?? null) : null;
  const resolving = !!query && !answered;
  const notFound = !!query && answered && security === null;

  const commitTicker = useCallback((raw: string) => {
    setQuery(raw.trim().toUpperCase().replace(/[^A-Z.]/g, ""));
  }, []);

  /* ── The club's split on this name ────────────────────────────────────
     Real counts from get_ticker_stance_summary, handed to StanceControl, which
     withholds the split below SOCIAL_FLOORS.debateStance. The control renders
     its SKELETON while the read is in flight rather than a selector that claims
     nothing is chosen — loading is not empty. */
  const securityTicker = security?.ticker ?? null;
  useEffect(() => {
    if (!securityTicker) return;
    let live = true;
    fetchStanceSummary(supabase, securityTicker).then((s) => {
      if (!live) return;
      setStanceAnswer({ t: securityTicker, s });
      setStance((cur) => cur ?? s.my_stance);
    });
    return () => {
      live = false;
    };
  }, [supabase, securityTicker]);

  const summary = stanceAnswer?.t === securityTicker ? stanceAnswer.s : null;
  const summaryLoading = !!security && !summary;

  const priorStance = summary?.my_stance ?? null;
  const isFlip = !!priorStance && !!stance && priorStance !== stance;
  const needsReason = isFlip || type === "changed_mind";
  // "Changed my mind" is only true if there was a mind to change. Saying so is
  // better than quietly filing a first-ever call as a reversal.
  const noPriorForFlip = type === "changed_mind" && !!security && !summaryLoading && !priorStance;

  const steps = [!!security, !!stance && !!type, body.trim().length >= 40];
  const done = steps.filter(Boolean).length;

  const canPublish =
    !!userId &&
    !isKid &&
    !!security &&
    !!stance &&
    !!type &&
    !!headline.trim() &&
    !!body.trim() &&
    body.length <= BODY_MAX &&
    !(needsReason && !reason) &&
    !noPriorForFlip &&
    !posting;

  async function publish() {
    if (!canPublish || !security || !stance || !type || !userId) return;
    const hook = headline.trim();
    const text = body.trim();
    for (const chunk of [hook, text]) {
      if (!checkClean(chunk).ok) {
        setErr("Let's keep it friendly — please reword that.");
        return;
      }
    }
    setPosting(true);
    setErr(null);

    // The stance write comes FIRST: it is the one that can be refused (the flow
    // is kid-walled inside the RPC and a genuine flip requires a reason), and a
    // published post claiming a change of mind that never recorded one would be
    // the exact "control that does not persist" this lane exists to eliminate.
    if (!priorStance || isFlip) {
      const res = await writeStance(supabase, security.ticker, stance, isFlip ? reason : null, null);
      if (!res.ok && res.reason !== "kid_walled") {
        setPosting(false);
        setErr(
          res.reason === "reason_required"
            ? "Pick what changed your mind."
            : "Couldn't record your stance — try again."
        );
        return;
      }
    }

    const composed = `${hook}\n\n${text}`;
    const { data, error } = await supabase
      .from("feed_posts")
      .insert({
        author_id: userId,
        family_id: familyId,
        kind: "post",
        body: composed,
        ticker_tags: [security.ticker],
        position: stance,
        content_type: type,
      })
      .select("id")
      .single();

    if (error || !data) {
      setPosting(false);
      setErr("Your call didn't go through. Please try again.");
      return;
    }

    const today = await countXpToday(supabase, userId, "community");
    if (today < 3) await awardXp(supabase, userId, "community", XP.COMMUNITY, data.id);

    router.push(type === "changed_mind" ? "/community/changed-my-mind" : "/community");
    router.refresh();
  }

  /* ── Read-only postures ───────────────────────────────────────────────── */
  if (isKid) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pt-2">
        <h1 className="font-display text-display-2 font-extrabold text-ink">
          Calls are for the grown-ups&apos; side of the Club.
        </h1>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-soft">
          You can read every call the Club files and see who changed their mind. Posting one
          opens up later, with your family.
        </p>
        <Link href="/community" className="inline-flex font-display text-[14px] font-bold text-gold-700">
          Back to the Club
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7 pb-10">
      {/* ── Modal chrome: leave / progress / commit ────────────────────────
          The progress rail counts the three REAL declarations. It is a status
          line, not the canvas's decorative 2-of-3. */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <Link
          href="/community"
          className="font-display text-[13px] font-semibold text-soft transition-colors hover:text-ink"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-1.5" role="status" aria-label={`${done} of 3 steps complete`}>
          {steps.map((on, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-[3px] w-7 rounded-full transition-colors ${on ? "bg-accent" : "bg-sand"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="f0-focus font-display text-[13px] font-extrabold text-gold-700 transition-colors hover:text-gold-600 disabled:opacity-40"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>

      {/* ── The ask ───────────────────────────────────────────────────────
          ONE phrase carries the emphasis, via f0-underline-mark. */}
      <header>
        <h1 className="max-w-[15ch] font-display text-display-1 font-extrabold leading-[0.98] text-ink">
          What&apos;s <span className="f0-underline-mark">your call</span>
          {security ? ` on ${security.ticker}?` : "?"}
        </h1>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-soft">
          Your take helps power better signals for the whole Club.
        </p>
      </header>

      {/* ── 1 · the company ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionRule>The company</SectionRule>
        {security ? (
          <div className="flex items-center gap-3">
            <TickerTile
              ticker={security.ticker}
              changePct={security.chg1d}
              size="md"
              showDelta
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-extrabold text-ink">{security.ticker}</p>
              <p className="truncate text-[13px] text-soft">{security.name || "Listed security"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftTicker("");
                setQuery("");
                setStanceAnswer(null);
                setStance(null);
                setTimeout(() => tickerInput.current?.focus(), 0);
              }}
              className="f0-focus shrink-0 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-soft transition-colors hover:text-ink"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="call-ticker" className="sr-only">
              Ticker symbol
            </label>
            <input
              id="call-ticker"
              ref={tickerInput}
              value={draftTicker}
              onChange={(e) => {
                setDraftTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ""));
                setQuery("");
              }}
              onBlur={() => commitTicker(draftTicker)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTicker(draftTicker);
                }
              }}
              maxLength={8}
              placeholder="NVDA"
              className="f0-focus w-full border-b border-sand bg-transparent pb-2 font-mono text-[24px] font-bold uppercase tracking-tight text-ink placeholder:text-soft/60 focus:outline-none"
            />
            <p className="mt-2 text-[12.5px] leading-snug text-soft">
              {resolving
                ? "Checking the symbol…"
                : notFound
                  ? `We don't carry ${draftTicker} — check the symbol, or pick a company the Club follows.`
                  : "One company per call. It binds the post to that name's thread and the Club's stance on it."}
            </p>
          </div>
        )}
      </section>

      {/* ── 2 · the call ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionRule>Your stance</SectionRule>
        <StanceControl
          value={stance}
          onChange={(s) => {
            setStance(s);
            setErr(null);
          }}
          counts={
            summary ? { bull: summary.bull, bear: summary.bear, neutral: summary.neutral } : null
          }
          loading={!!security && summaryLoading}
          disabled={!security}
          ariaLabel={security ? `Your stance on ${security.ticker}` : "Your stance"}
          emptyHint={
            security
              ? "Pick a stance. You can change it later — the Club rewards the update."
              : "Name the company first."
          }
        />
      </section>

      <section className="space-y-3">
        <SectionRule>Post type</SectionRule>
        <PostTypeControl
          value={type}
          onChange={(t) => {
            setType(t);
            setErr(null);
          }}
          ariaLabel="What kind of call is this"
        />
      </section>

      {/* ── the reason taxonomy, only when something actually changed ─────── */}
      {noPriorForFlip && (
        <p className="border-l-2 border-sand py-1 pl-4 text-[14px] leading-relaxed text-soft">
          You haven&apos;t taken a position on{" "}
          <span className="font-semibold text-ink">{security?.ticker}</span> yet, so this is your
          first call rather than a change of mind. Pick another type — the Club will hold you to
          this one, and the update will mean more when it comes.
        </p>
      )}

      {needsReason && !noPriorForFlip && security && (
        <section className="space-y-3">
          <SectionRule>What changed</SectionRule>
          <div className="flex flex-wrap gap-2">
            {CHANGE_REASONS.map((r) => {
              const on = reason === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setReason(r.key);
                    setErr(null);
                  }}
                  className={`f0-chip f0-press f0-focus font-display text-[11px] font-bold uppercase tracking-[0.1em] ${
                    on ? "f0-chip-on" : "text-soft"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12.5px] leading-snug text-soft">
            A closed list on purpose — it is what makes the Club&apos;s reversals readable at a
            glance instead of a wall of paragraphs.
          </p>
        </section>
      )}

      {/* ── 3 · the writing ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionRule>The call</SectionRule>
        <label htmlFor="call-headline" className="sr-only">
          One-line hook
        </label>
        <input
          id="call-headline"
          value={headline}
          onChange={(e) => {
            setHeadline(e.target.value);
            setErr(null);
          }}
          maxLength={HEADLINE_MAX}
          placeholder="Lead with the claim, in one line"
          className="f0-focus w-full bg-transparent font-display text-[19px] font-extrabold leading-tight tracking-tight text-ink placeholder:font-bold placeholder:text-soft/70 focus:outline-none"
        />
        <label htmlFor="call-body" className="sr-only">
          Your call
        </label>
        <textarea
          id="call-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value.slice(0, BODY_MAX));
            setErr(null);
          }}
          rows={8}
          placeholder={
            type
              ? POST_TYPE_BY_KEY[type].hint
              : "The evidence you ran, the level you are reading, or what would make you wrong."
          }
          className="f0-focus w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-soft focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3 f0-rule-top pt-2.5">
          <span className="font-mono text-[11px] tracking-tight text-soft">
            {security ? (
              <>
                <span className="text-teal-600 dark:text-teal-300">$</span>
                {security.ticker}
              </>
            ) : (
              "—"
            )}
          </span>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              body.length > BODY_MAX - 100 ? "text-ink" : "text-soft"
            }`}
          >
            {body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
          </span>
        </div>
      </section>

      {err && <p className="font-body text-[13px] font-semibold text-ink">{err}</p>}

      <button
        type="button"
        onClick={publish}
        disabled={!canPublish}
        className="f0-focus f0-press w-full rounded-xl bg-volt-500 px-4 py-4 font-display text-[13px] font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-volt-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-volt-600"
      >
        {posting ? "Publishing…" : "Publish to the Club"}
      </button>

      <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
    </div>
  );
}
