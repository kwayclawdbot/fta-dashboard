"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkClean } from "@/lib/profanity";
import { toast } from "@/components/ui/Toast";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { XP, awardXp, countXpToday, getUserXp } from "@/lib/xp";
import {
  POST_TYPES,
  POST_TYPE_BY_KEY,
  useXpAward,
  type PostType,
} from "@/components/canvas2";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import {
  BoardCard,
  Marker,
  Pill,
  PillRow,
  SectionLabel,
  TickerMark,
} from "../board";
import {
  CHANGE_REASONS,
  fetchStanceSummary,
  setStance as writeStance,
  type ChangeReasonKey,
  type Stance,
  type StanceSummary,
} from "@/lib/social/stance";
import { designV2Enabled } from "@/lib/design-flag";
import ShareYourCallV2 from "./ShareYourCallV2";

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

   ── THE BOARD, BUILT ─────────────────────────────────────────────────────
   Cancel / progress / Post across the top, the ask with the underlined phrase
   and the "be specific!" marker, the company card with the Bearish · Neutral ·
   Bullish trio, the POST TYPE pill row, the writing card with its footer rule,
   and PUBLISH TO THE CLUB over Save as draft. Two notes on the drawing:

   · SAVE AS DRAFT is real, and local. There is no draft table, so the draft is
     written to this browser, restored the next time the composer opens, and
     cleared the moment the call publishes. The button says where it went.
   · THE PROGRESS RAIL reflects the three real declarations rather than sitting
     at a decorative 2-of-3, so it is a status line.
   ══════════════════════════════════════════════════════════════════════════ */

const BODY_MAX = 2000;
const HEADLINE_MAX = 120;
const DRAFT_KEY = "cc-club-call-draft";

/** The stance trio as board 05 draws it: the picked one takes a solid field.
 *  Literals, not the price tokens — a stance is never a quote. */
const STANCE_CHOICES: { key: Stance; label: string; fill: string }[] = [
  { key: "bear", label: "Bearish", fill: "#E0392B" },
  { key: "neutral", label: "Neutral", fill: "#8A8279" },
  { key: "bull", label: "Bullish", fill: "#1BA94C" },
];

interface CallDraft {
  ticker: string;
  stance: Stance | null;
  type: PostType | null;
  headline: string;
  body: string;
}

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
  // ── design v2 flag dispatch ──────────────────────────────────────────────
  // Flag OFF (default / production) → the v1 body below runs unchanged. Flag ON
  // → the cc-canvas re-skin, same props in, same backend calls. Build-constant
  // (NEXT_PUBLIC_* is inlined) so this early return is stable across renders.
  if (designV2Enabled())
    return (
      <ShareYourCallV2
        userId={userId}
        familyId={familyId}
        isKid={isKid}
        initialTicker={initialTicker}
        initialType={initialType}
      />
    );

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

  /* ── The award moment, and why the route waits for it ─────────────────────
     Filing a call banks XP, and this composer navigates away the instant the
     write lands — so the member never saw the number move. Firing the award
     and pushing in the same breath would be worse than silence: the overlay
     would be unmounted mid-count-up.

     So the destination is PARKED here, the beat plays, and the push happens
     when the beat is over. `playing` covers both lengths the primitive can
     run (chip only, or chip plus the belt ceremony) and the reduced-motion
     collapse, without this file knowing any of those durations. */
  const xpAward = useXpAward();
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const awardPlaying = xpAward.playing;
  useEffect(() => {
    if (!pendingNav || awardPlaying) return;
    router.push(pendingNav);
    router.refresh();
  }, [pendingNav, awardPlaying, router]);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const tickerInput = useRef<HTMLInputElement>(null);

  /* ── Save as draft (board 05) ─────────────────────────────────────────
     Local to this browser. Restored once, on mount, and only into fields the
     member has not already been handed by a ?ticker= / ?type= deep link — a
     link should always beat a stale draft. */
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    if (typeof window === "undefined") return;
    // Deferred past the commit ON PURPOSE: localStorage does not exist during
    // the server render, so restoring inside the render pass (or synchronously
    // in the effect body) would hand the client different markup than the
    // server produced. One microtask later the DOM is already hydrated.
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw) as CallDraft;
        if (!initialTicker && d.ticker) {
          setDraftTicker(d.ticker);
          setQuery(d.ticker);
        }
        if (d.stance) setStance(d.stance);
        if (!isPostType(initialType) && d.type) setType(d.type);
        if (d.headline) setHeadline(d.headline);
        if (d.body) setBody(d.body);
        setDraftNote("Draft restored — saved on this device");
      } catch {
        /* a corrupt draft is simply not restored */
      }
    });
  }, [initialTicker, initialType]);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft: CallDraft = {
      ticker: (query || draftTicker || "").toUpperCase(),
      stance,
      type,
      headline,
      body,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftNote("Saved on this device");
    } catch {
      setDraftNote("Couldn't save the draft in this browser");
    }
  }, [query, draftTicker, stance, type, headline, body]);

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

  /* ── The symbol commits itself ────────────────────────────────────────
     The composer used to wait for an Enter it never asked for: typing NVDA and
     looking at the screen produced nothing — no company, no stance control, and
     a PUBLISH button that stayed grey without saying why. Typing now commits on
     its own ~500ms after the member stops, and Enter / blur still commit
     immediately, so the fast paths that already worked are untouched. */
  useEffect(() => {
    const raw = draftTicker.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (!raw || raw === query) return;
    const t = setTimeout(() => setQuery(raw), 500);
    return () => clearTimeout(t);
  }, [draftTicker, query]);

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

  /* ── What is still missing ────────────────────────────────────────────
     PUBLISH is refused for several genuinely different reasons and used to
     state none of them — a grey button and no sentence. This reads the SAME
     gates canPublish reads, in the order the screen asks for them, with the
     satisfied ones ticked. A status line, under the button, not a tooltip. */
  const requirements: { label: string; done: boolean }[] = [
    { label: "Pick a company", done: !!security },
    { label: "Take a stance", done: !!stance },
    { label: "Choose a post type", done: !!type },
    { label: "Write your call", done: !!headline.trim() && !!body.trim() },
    ...(needsReason && !noPriorForFlip
      ? [{ label: "Say what changed", done: !!reason }]
      : []),
  ];
  const allRequirementsMet = requirements.every((r) => r.done);

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
      toast("Your call didn't go through. Please try again.", "error");
      return;
    }

    // The call is filed — the local draft has done its job.
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }

    // Read the lifetime total BEFORE the write and again after, so the belt
    // beat only plays on a belt that was really crossed — and so a write that
    // quietly failed (awardXp swallows its own errors) is never celebrated.
    const dest = type === "changed_mind" ? "/community/changed-my-mind" : "/community";
    const today = await countXpToday(supabase, userId, "community");
    if (today < 3) {
      const xpBefore = await getUserXp(supabase, userId);
      await awardXp(supabase, userId, "community", XP.COMMUNITY, data.id);
      const xpAfter = await getUserXp(supabase, userId);
      if (xpAfter > xpBefore) {
        xpAward.fire({
          amount: xpAfter - xpBefore,
          xpBefore,
          xpAfter,
          reason: "Call filed",
        });
      }
    }

    // The composer navigates away on success, so the card that confirmed the
    // write is gone before it can be read. The toast survives the route change.
    toast("Your call is live in the Club.");
    // Parked, not pushed — the effect above navigates once the beat is done
    // (immediately, when no XP was banked and there is no beat to wait for).
    setPendingNav(dest);
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
    <div className="relative mx-auto max-w-2xl space-y-7 pb-10">
      {/* The award beat plays over the composer the member just filed, which
          is the last thing they were looking at. It draws nothing until the
          XP actually lands. */}
      {xpAward.overlay}

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
          ONE phrase carries the emphasis, via f0-underline-mark, with board 05's
          marker note pinned to the right of it. */}
      <header className="relative pr-24">
        <Marker className="absolute right-0 top-0 text-[21px]" rotate={7}>
          be specific!
        </Marker>
        <h1 className="max-w-[15ch] font-display text-[clamp(26px,8vw,32px)] font-black leading-[1.0] tracking-[-0.035em] text-ink">
          What&apos;s <span className="f0-underline-mark">your call</span>
          {security ? ` on ${security.ticker}?` : "?"}
        </h1>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-soft">
          Your take helps power better signals for the whole Club.
        </p>
      </header>

      {/* ── 1 · the company + the call ─────────────────────────────────────
          Board 05 draws these as ONE card: the black ticker mark, the symbol and
          company name, and the Bearish / Neutral / Bullish trio on the right. The
          fills are literals rather than the price tokens, so a stance can never
          be confused with a quote by the stylesheet. */}
      <section className="space-y-3">
        <SectionLabel>The company</SectionLabel>
        {security ? (
          <BoardCard>
            <div className="flex flex-wrap items-center gap-3">
              <TickerMark ticker={security.ticker} size={34} radius={10} tone="up" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[14px] font-extrabold text-ink">{security.ticker}</p>
                <p className="truncate text-[11px] text-soft">{security.name || "Listed security"}</p>
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
                className="f0-focus shrink-0 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-soft transition-colors hover:text-ink"
              >
                Change
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STANCE_CHOICES.map((c) => {
                const on = stance === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    disabled={summaryLoading}
                    onClick={() => {
                      setStance(c.key);
                      setErr(null);
                    }}
                    className={`f0-focus f0-press rounded-[8px] px-3 py-2 font-display text-[11px] font-bold transition-colors disabled:opacity-50 ${
                      on ? "text-white" : "border border-sand text-soft hover:text-ink"
                    }`}
                    style={on ? { background: c.fill } : undefined}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {/* The club's split on this name — REAL counts, withheld below the
                social floor so a 1-0-1 "split" is never dressed up as a signal. */}
            {summary &&
              summary.bull + summary.bear + summary.neutral >= SOCIAL_FLOORS.debateStance && (
                <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
                  Club: {summary.bull} bull · {summary.neutral} neutral · {summary.bear} bear
                </p>
              )}
            {!stance && (
              <p className="mt-2.5 text-[12.5px] leading-snug text-soft">
                Pick a stance. You can change it later — the Club rewards the update.
              </p>
            )}
          </BoardCard>
        ) : (
          <BoardCard>
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
          </BoardCard>
        )}
      </section>

      {/* ── 2 · post type — board 05's pill row ────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel>Post type</SectionLabel>
        <PillRow>
          {POST_TYPES.map((t) => (
            <Pill
              key={t.key}
              active={type === t.key}
              onClick={() => {
                setType(t.key);
                setErr(null);
              }}
            >
              {t.label}
            </Pill>
          ))}
        </PillRow>
        {type && <p className="text-[12.5px] leading-snug text-soft">{POST_TYPE_BY_KEY[type].hint}</p>}
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
          <SectionLabel>What changed</SectionLabel>
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

      {/* ── 3 · the writing ───────────────────────────────────────────────
          Board 05 draws the body as a white card: the hook set in display
          weight, the prose under it, and the card's own footer rule carrying the
          bound $TICKER and the counter. */}
      <section className="space-y-3">
        <SectionLabel>The call</SectionLabel>
        <BoardCard>
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
            className="f0-focus w-full bg-transparent font-display text-[17px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink placeholder:font-bold placeholder:text-soft/70 focus:outline-none"
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
            className="f0-focus mt-2 w-full resize-none bg-transparent text-[13px] leading-[1.55] text-ink placeholder:text-soft focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-sand pt-3">
            <span className="font-mono text-[12px] tracking-tight text-soft">
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
        </BoardCard>
      </section>

      {err && <p className="font-body text-[13px] font-semibold text-ink">{err}</p>}

      <div>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="f0-focus f0-press w-full rounded-[9px] bg-volt-500 px-4 py-4 font-display text-[13px] font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-volt-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {posting ? "Publishing…" : "Publish to the Club"}
        </button>

        {/* The refusal, spoken. Only while the button is actually refusing. */}
        {!canPublish && !posting && (
          <div className="mt-2.5" role="status" aria-live="polite">
            {allRequirementsMet ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
                {!userId
                  ? "Sign in to file this call"
                  : "Pick another post type — this is your first call on this name"}
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
                {requirements.map((r, i) => (
                  <span key={r.label} className="inline-flex items-center gap-2">
                    {i > 0 && (
                      <span aria-hidden className="text-soft/60">
                        ·
                      </span>
                    )}
                    <span className={r.done ? "text-ink" : undefined}>
                      <span aria-hidden className="mr-1">
                        {r.done ? "✓" : "○"}
                      </span>
                      {r.label}
                      <span className="sr-only">
                        {r.done ? " — done" : " — still needed"}
                      </span>
                    </span>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* SAVE AS DRAFT. The board draws it and it is real: the draft is written
            to this browser, restored the next time the composer opens, and
            cleared the moment the call publishes. There is no draft table, so it
            says plainly that it is on this device rather than claiming a server
            it does not have. */}
        <button
          type="button"
          onClick={saveDraft}
          disabled={!headline.trim() && !body.trim() && !security}
          className="f0-focus mt-3 block w-full text-center font-display text-[12px] font-semibold text-gold-700 transition-colors hover:text-gold-600 disabled:opacity-40"
        >
          {draftNote ?? "Save as draft"}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
    </div>
  );
}
