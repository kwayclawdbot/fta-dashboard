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
  CHANGE_REASONS,
  fetchStanceSummary,
  setStance as writeStance,
  type ChangeReasonKey,
  type Stance,
  type StanceSummary,
} from "@/lib/social/stance";
import { Card, Kicker, ScriptTitle, TickerBadge, Delta } from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   SHARE YOUR CALL — cc-canvas (design v2). Re-skin of ShareYourCallClient onto
   the Cheat Code App surface: ScriptTitle "share", a cc-display ask, mono
   Kicker section labels (THE COMPANY · POST TYPE · WHAT CHANGED · THE CALL),
   and cc Card / token surfaces. EVERY behaviour is duplicated verbatim from the
   v1 client — same state, same effects, same backend writes, same gates, same
   XP beat, same draft. Only the markup changes.

   COMPLIANCE, preserved from v1: Bullish / Neutral / Bearish is a COMMUNITY
   STANCE — the member's opinion, not a market quote. It is NEVER coloured
   green/pink here. The stance trio renders neutral (card2 / ink), and the
   SELECTED stance takes a subtle ORANGE ring to mean "your choice" — orange as
   authoring-selection, not as a directional signal. No BUY, equities only.
   ══════════════════════════════════════════════════════════════════════════ */

const BODY_MAX = 2000;
const HEADLINE_MAX = 120;
const DRAFT_KEY = "cc-club-call-draft";

/** The stance trio, cc register: labels only — a stance is never a quote, and
 *  here it is never a market colour either. Selected = orange "your choice"
 *  ring (see the compliance note above), the rest neutral. */
const STANCE_CHOICES_V2: { key: Stance; label: string }[] = [
  { key: "bear", label: "Bearish" },
  { key: "neutral", label: "Neutral" },
  { key: "bull", label: "Bullish" },
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

export default function ShareYourCallV2({
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
  const [query, setQuery] = useState(initialTicker ?? "");
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

  /* The award beat is parked, then navigated once done — identical to v1. */
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

  /* ── Save as draft — local to this browser (v1 behaviour verbatim). ── */
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    if (typeof window === "undefined") return;
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

  /* ── Resolve the company against screener_metrics (verbatim). ── */
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

  useEffect(() => {
    const raw = draftTicker.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (!raw || raw === query) return;
    const t = setTimeout(() => setQuery(raw), 500);
    return () => clearTimeout(t);
  }, [draftTicker, query]);

  /* ── The club's split on this name — real counts, floored (verbatim). ── */
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

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }

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

    toast("Your call is live in the Club.");
    setPendingNav(dest);
  }

  /* ── Kid read-only posture (cc register) ─────────────────────────────── */
  if (isKid) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pt-2">
        <Kicker>Share your call</Kicker>
        <ScriptTitle className="mt-1">share</ScriptTitle>
        <h1 className="cc-display text-[26px] leading-[1.05] text-[var(--cc-ink)]">
          Calls are for the grown-ups&apos; side of the Club.
        </h1>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-[var(--cc-soft)]">
          You can read every call the Club files and see who changed their mind. Posting one
          opens up later, with your family.
        </p>
        <Link
          href="/community"
          className="inline-flex text-[14px] font-bold"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          Back to the Club
        </Link>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-2xl space-y-7 pb-10">
      {xpAward.overlay}

      {/* ── chrome: leave / progress / commit ── */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <Link
          href="/community"
          className="text-[13px] font-semibold text-[var(--cc-soft)] transition-colors hover:text-[var(--cc-ink)]"
        >
          Cancel
        </Link>
        <div
          className="flex items-center gap-1.5"
          role="status"
          aria-label={`${done} of 3 steps complete`}
        >
          {steps.map((on, i) => (
            <span
              key={i}
              aria-hidden
              className="h-[3px] w-7 rounded-full transition-colors"
              style={{ background: on ? "var(--cc-orange)" : "var(--cc-line)" }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="text-[13px] font-extrabold transition-opacity disabled:opacity-40"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>

      {/* ── the ask ── */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <ScriptTitle>share</ScriptTitle>
          <Kicker tone="soft" className="shrink-0">
            be specific
          </Kicker>
        </div>
        <h1 className="cc-display max-w-[15ch] text-[clamp(26px,8vw,34px)] leading-[1.0] text-[var(--cc-ink)]">
          What&apos;s your call
          {security ? (
            <>
              {" on "}
              <span style={{ color: "var(--cc-orange-ink)" }}>{security.ticker}</span>?
            </>
          ) : (
            "?"
          )}
        </h1>
        <p className="max-w-[42ch] text-[15px] leading-relaxed text-[var(--cc-soft)]">
          Your take helps power better signals for the whole Club.
        </p>
      </header>

      {/* ── 1 · the company + the call ── */}
      <section className="space-y-3">
        <Kicker>The company</Kicker>
        {security ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <TickerBadge symbol={security.ticker} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-[var(--cc-ink)]">
                  {security.ticker}
                </p>
                <p className="truncate text-[11px] text-[var(--cc-soft)]">
                  {security.name || "Listed security"}
                </p>
              </div>
              {/* chg_1d is real market data (screener_metrics) → coloured green/pink
                  per the market-truth law; this is a quote, not the stance. */}
              {security.chg1d != null && <Delta pct={security.chg1d} />}
              <button
                type="button"
                onClick={() => {
                  setDraftTicker("");
                  setQuery("");
                  setStanceAnswer(null);
                  setStance(null);
                  setTimeout(() => tickerInput.current?.focus(), 0);
                }}
                className="cc-mono shrink-0 transition-colors hover:text-[var(--cc-ink)]"
                style={{ color: "var(--cc-soft)", fontSize: 10 }}
              >
                Change
              </button>
            </div>
            {/* The stance trio — neutral, NOT green/pink. Selected takes a subtle
                orange "your choice" ring (authoring-selection, not a market
                signal). This is the hard compliance point of the surface. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STANCE_CHOICES_V2.map((c) => {
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
                    className="rounded-[10px] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
                    style={
                      on
                        ? {
                            background:
                              "color-mix(in srgb, var(--cc-orange) 14%, transparent)",
                            border: "1px solid var(--cc-orange)",
                            color: "var(--cc-ink)",
                          }
                        : {
                            background: "var(--cc-card2)",
                            border: "1px solid var(--cc-line)",
                            color: "var(--cc-soft)",
                          }
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {summary &&
              summary.bull + summary.bear + summary.neutral >= SOCIAL_FLOORS.debateStance && (
                <p
                  className="mt-2.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: "var(--cc-soft)" }}
                >
                  Club: {summary.bull} bull · {summary.neutral} neutral · {summary.bear} bear
                </p>
              )}
            {!stance && (
              <p className="mt-2.5 text-[12.5px] leading-snug text-[var(--cc-soft)]">
                Pick a stance. You can change it later — the Club rewards the update.
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-4">
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
              className="w-full bg-transparent pb-2 font-[family-name:var(--font-plex-mono)] text-[24px] font-bold uppercase tracking-tight text-[var(--cc-ink)] focus:outline-none"
              style={{ borderBottom: "1px solid var(--cc-line)" }}
            />
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--cc-soft)]">
              {resolving
                ? "Checking the symbol…"
                : notFound
                  ? `We don't carry ${draftTicker} — check the symbol, or pick a company the Club follows.`
                  : "One company per call. It binds the post to that name's thread and the Club's stance on it."}
            </p>
          </Card>
        )}
      </section>

      {/* ── 2 · post type — cc pill row (SubTabs grammar) ── */}
      <section className="space-y-3">
        <Kicker>Post type</Kicker>
        <div className="flex flex-wrap gap-1.5">
          {POST_TYPES.map((t) => {
            const on = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setType(t.key);
                  setErr(null);
                }}
                className="rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={
                  on
                    ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                    : {
                        background: "var(--cc-card2)",
                        color: "var(--cc-soft)",
                        border: "1px solid var(--cc-line)",
                      }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {type && (
          <p className="text-[12.5px] leading-snug text-[var(--cc-soft)]">
            {POST_TYPE_BY_KEY[type].hint}
          </p>
        )}
      </section>

      {/* ── the reason taxonomy, only when something actually changed ── */}
      {noPriorForFlip && (
        <p
          className="py-1 pl-4 text-[14px] leading-relaxed text-[var(--cc-soft)]"
          style={{ borderLeft: "2px solid var(--cc-line)" }}
        >
          You haven&apos;t taken a position on{" "}
          <span className="font-semibold text-[var(--cc-ink)]">{security?.ticker}</span> yet, so
          this is your first call rather than a change of mind. Pick another type — the Club will
          hold you to this one, and the update will mean more when it comes.
        </p>
      )}

      {needsReason && !noPriorForFlip && security && (
        <section className="space-y-3">
          <Kicker>What changed</Kicker>
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
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors"
                  style={
                    on
                      ? { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
                      : {
                          background: "var(--cc-card2)",
                          color: "var(--cc-soft)",
                          border: "1px solid var(--cc-line)",
                        }
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12.5px] leading-snug text-[var(--cc-soft)]">
            A closed list on purpose — it is what makes the Club&apos;s reversals readable at a
            glance instead of a wall of paragraphs.
          </p>
        </section>
      )}

      {/* ── 3 · the writing ── */}
      <section className="space-y-3">
        <Kicker>The call</Kicker>
        <Card className="p-4">
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
            className="w-full bg-transparent text-[17px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--cc-ink)] focus:outline-none"
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
            className="mt-2 w-full resize-none bg-transparent text-[13px] leading-[1.55] text-[var(--cc-ink)] focus:outline-none"
          />
          <div
            className="mt-3 flex items-center justify-between gap-3 pt-3"
            style={{ borderTop: "1px solid var(--cc-line)" }}
          >
            <span className="font-[family-name:var(--font-plex-mono)] text-[12px] tracking-tight text-[var(--cc-soft)]">
              {security ? (
                <>
                  <span style={{ color: "var(--cc-orange-ink)" }}>$</span>
                  {security.ticker}
                </>
              ) : (
                "—"
              )}
            </span>
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
              style={{ color: body.length > BODY_MAX - 100 ? "var(--cc-ink)" : "var(--cc-soft)" }}
            >
              {body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
            </span>
          </div>
        </Card>
      </section>

      {err && <p className="text-[13px] font-semibold text-[var(--cc-ink)]">{err}</p>}

      <div>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className={`${canPublish ? "cc-halo" : ""} w-full rounded-full px-5 py-4 text-[13px] font-extrabold uppercase tracking-[0.12em] transition-opacity disabled:cursor-not-allowed disabled:opacity-40`}
          style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
        >
          {posting ? "Publishing…" : "Publish to the Club"}
        </button>

        {!canPublish && !posting && (
          <div className="mt-2.5" role="status" aria-live="polite">
            {allRequirementsMet ? (
              <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--cc-soft)]">
                {!userId
                  ? "Sign in to file this call"
                  : "Pick another post type — this is your first call on this name"}
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--cc-soft)]">
                {requirements.map((r, i) => (
                  <span key={r.label} className="inline-flex items-center gap-2">
                    {i > 0 && (
                      <span aria-hidden style={{ color: "var(--cc-dim)" }}>
                        ·
                      </span>
                    )}
                    <span style={r.done ? { color: "var(--cc-ink)" } : undefined}>
                      <span aria-hidden className="mr-1">
                        {r.done ? "✓" : "○"}
                      </span>
                      {r.label}
                      <span className="sr-only">{r.done ? " — done" : " — still needed"}</span>
                    </span>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* SAVE AS DRAFT — real, local to this browser. The button says where it
            went, exactly as v1. */}
        <button
          type="button"
          onClick={saveDraft}
          disabled={!headline.trim() && !body.trim() && !security}
          className="mt-3 block w-full text-center text-[12px] font-semibold transition-opacity disabled:opacity-40"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          {draftNote ?? "Save as draft"}
        </button>
      </div>

      <p className="font-[family-name:var(--font-plex-mono)] text-[11px] leading-relaxed text-[var(--cc-dim)]">
        {COMMUNITY_DISCLAIMER}
      </p>
    </div>
  );
}
