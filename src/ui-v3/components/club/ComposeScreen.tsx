"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkClean } from "@/lib/profanity";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { setStance as writeStance, fetchStanceSummary, type Stance } from "@/lib/social/stance";
import type { ClubViewerVM } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import TickerTile from "@/ui-v3/components/TickerTile";
import styles from "./ComposeScreen.module.css";

/**
 * "05 Share your call", translated from Club Screens board 05.
 *
 * ── WHY A ROUTE AND NOT A SHEET ──────────────────────────────────────────────
 * The board draws the composer as a WHOLE PHONE SCREEN with its own status bar,
 * its own Cancel / progress / Post chrome and its own pinned publish footer —
 * the same shape it gives every other destination. That is a route, so
 * /v3/club/compose is one, and the feed's "What's your take?" row is what
 * navigates to it.
 *
 * ── WHAT IT WRITES ───────────────────────────────────────────────────────────
 * Exactly what the old app writes, through the same helpers, under the member's
 * own RLS. Nothing here is a new table, a new column or a new RPC:
 *
 *   ticker + stance → `set_ticker_stance` (migration 151) → `ticker_stances`,
 *                     and a `stance_events` row when it is a genuine flip
 *   the post itself → `feed_posts` INSERT (author_id, family_id, kind 'post',
 *                     body, ticker_tags, position, content_type)
 *   the XP          → `awardXp(…, "community", XP.COMMUNITY, postId)`, capped at
 *                     the same 3/day the old composer caps it at
 *
 * ORDER MATTERS: the stance goes first. It is the write that can legitimately be
 * refused (the RPC is kid-walled, and a real flip demands a reason), and a
 * published post claiming a change of mind that never recorded one is the exact
 * "control that does not persist" this lane exists to remove.
 *
 * ── WHAT THIS SCREEN DELIBERATELY DOES NOT CARRY ─────────────────────────────
 * The board's writing card draws a display-weight HEADLINE over the prose. The
 * v3 feed card has no headline slot — it renders `body` as one paragraph — so a
 * headline written here would be published into a card that styles it as the
 * first sentence of the prose anyway. Rather than store a distinction the feed
 * cannot show, the writing card keeps the board's box, its footer rule, its
 * bound $TICKER and its counter, and asks for the claim FIRST inside a single
 * body. When the feed card grows a headline slot, this grows the field back.
 *
 * The board also draws "Save as draft". The old composer backs that with
 * localStorage because there is no draft table; that is still true, and a second
 * browser-local draft store keyed differently from the old one would be a
 * quietly divergent second source of truth. Omitted, not faked.
 *
 * ── THE STANCE / TICKER PAIR ─────────────────────────────────────────────────
 * A stance is a position ON something, so it cannot be filed without a company;
 * and a company tagged with no position is exactly what `feed_posts.position`
 * is nullable for. The old feed composer encodes the same rule
 * (`position: finalTags.length ? position : null`), so a take with neither is a
 * perfectly good post and the screen says so rather than blocking on a ticker
 * the member never wanted to name.
 */

const BODY_MAX = 2000;
const BODY_MIN = 12;

/** Board 05's stance trio. The fills are LITERALS — a stance is never a quote,
 *  so it never borrows --positive / --negative from the price ramp. */
const STANCE_CHOICES: { key: Stance; label: string; fill: string }[] = [
  { key: "bear", label: "Bearish", fill: "#E0392B" },
  { key: "neutral", label: "Neutral", fill: "#8A8279" },
  { key: "bull", label: "Bullish", fill: "#1BA94C" },
];

/** The board's POST TYPE pill row. These four keys are the vocabulary migration
 *  190 widened `feed_posts.content_type` to accept — no key is invented here. */
const POST_TYPES: { key: string; label: string; hint: string }[] = [
  { key: "thesis", label: "Thesis", hint: "The case, and what would make it wrong." },
  { key: "risk", label: "Risk", hint: "What could break this — say it before it happens." },
  { key: "chart", label: "Chart", hint: "The level you are reading, and why it matters." },
  {
    key: "changed_mind",
    label: "Changed my mind",
    hint: "What you used to think, and what moved you.",
  },
];

interface Security {
  ticker: string;
  name: string | null;
}

export default function ComposeScreen({ viewer }: { viewer: ClubViewerVM | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [draftTicker, setDraftTicker] = useState("");
  /** The symbol we have COMMITTED to resolving. */
  const [query, setQuery] = useState("");
  /**
   * Both async reads STAMP their answer with the request that produced it, so
   * "resolving" is DERIVED rather than set inside an effect. That is what makes
   * it impossible for a previous company's stance to render for one frame under
   * a newly typed symbol.
   */
  const [resolved, setResolved] = useState<{ q: string; row: Security | null } | null>(null);
  const [priorStance, setPriorStance] = useState<{ t: string; s: Stance | null } | null>(null);

  const [stance, setStance] = useState<Stance | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  /* ── Resolve the company ───────────────────────────────────────────────
     Against `screener_metrics`, the same universe BOTH old composers validate
     against, so a symbol that cannot enter the graph is refused here rather
     than silently dropped at insert time. */
  useEffect(() => {
    if (!query) return;
    let live = true;
    supabase
      .from("screener_metrics")
      .select("ticker, name")
      .eq("ticker", query)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        const row = (data ?? null) as { ticker: string; name: string | null } | null;
        setResolved({ q: query, row });
      });
    return () => {
      live = false;
    };
  }, [supabase, query]);

  /* The symbol commits itself ~500ms after typing stops; Enter and blur still
     commit immediately. Waiting for an Enter the screen never asked for is how
     the old composer used to strand people on a grey Post button. */
  useEffect(() => {
    const raw = draftTicker.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (!raw || raw === query) return;
    const t = setTimeout(() => setQuery(raw), 500);
    return () => clearTimeout(t);
  }, [draftTicker, query]);

  const answered = resolved?.q === query;
  const security = answered ? (resolved?.row ?? null) : null;
  const resolving = !!query && !answered;
  const notFound = !!query && answered && security === null;

  /* ── Do they already hold a position on this name? ─────────────────────
     Only to know whether the stance write is a FIRST call or a FLIP: a flip
     needs a reason, and this screen does not collect one (the board has no
     reason row — the old /community/compose destination owns that taxonomy).
     So a flip is stated and sent to that destination rather than filed here
     under a reason nobody picked. */
  const securityTicker = security?.ticker ?? null;
  useEffect(() => {
    if (!securityTicker) return;
    let live = true;
    fetchStanceSummary(supabase, securityTicker).then((s) => {
      if (!live) return;
      setPriorStance({ t: securityTicker, s: s.my_stance });
      setStance((cur) => cur ?? s.my_stance);
    });
    return () => {
      live = false;
    };
  }, [supabase, securityTicker]);

  const prior = priorStance?.t === securityTicker ? priorStance.s : null;
  const isFlip = !!prior && !!stance && prior !== stance;

  const trimmed = body.trim();
  const steps = [trimmed.length >= BODY_MIN, !!security, !!stance];
  const canPost =
    !!viewer &&
    viewer.canPost &&
    trimmed.length >= BODY_MIN &&
    body.length <= BODY_MAX &&
    // A stance without a company is not a position; a company without a stance
    // is a perfectly good tag.
    !(stance && !security) &&
    !isFlip &&
    !posting;

  const commitTicker = useCallback((raw: string) => {
    setQuery(raw.trim().toUpperCase().replace(/[^A-Z.]/g, ""));
  }, []);

  async function publish() {
    if (!canPost || !viewer) return;
    if (!checkClean(trimmed).ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setPosting(true);
    setErr(null);

    // 1 · the stance, first — see the header note on ordering.
    if (security && stance && !prior) {
      const res = await writeStance(supabase, security.ticker, stance, null, null);
      if (!res.ok && res.reason !== "kid_walled") {
        setPosting(false);
        setErr("Couldn't record your stance — try again.");
        return;
      }
    }

    // 2 · the post.
    const { data, error } = await supabase
      .from("feed_posts")
      .insert({
        author_id: viewer.id,
        family_id: viewer.familyId,
        kind: "post",
        body: trimmed,
        ticker_tags: security ? [security.ticker] : [],
        position: security ? stance : null,
        content_type: type,
      })
      .select("id")
      .single();

    if (error || !data) {
      setPosting(false);
      setErr("Your take didn't go through. Please try again.");
      return;
    }

    // 3 · the XP, under the same daily cap the old composer applies. `awardXp`
    //     swallows its own errors, so this is deliberately not gated on — the
    //     post has already landed and a silent XP miss must never lose it.
    const today = await countXpToday(supabase, viewer.id, "community");
    if (today < 3) {
      await awardXp(supabase, viewer.id, "community", XP.COMMUNITY, data.id);
    }

    // The feed is a server component; refresh() is what makes the new row show
    // up on it rather than a stale cached render.
    router.push("/v3/club");
    router.refresh();
  }

  /* ── Postures that are not a composer ─────────────────────────────────── */
  if (!viewer) {
    return (
      <Gate
        title="Sign in to post your take."
        copy="The Club reads for anyone. Filing a call needs a name on it."
      />
    );
  }
  if (!viewer.canPost) {
    return <Gate title="Calls are for the grown-ups' side of the Club." copy={viewer.readOnlyNote} />;
  }

  return (
    <AppShell nav={false}>
      {/* ── Cancel / progress / Post ───────────────────────────────────────
          The rail counts the three real declarations, so it is a status line
          rather than the board's decorative 2-of-3. */}
      <div className={styles.chrome}>
        <Link href="/v3/club" className={styles.cancel}>
          Cancel
        </Link>
        <div
          className={styles.rail}
          role="status"
          aria-label={`${steps.filter(Boolean).length} of 3 complete`}
        >
          {steps.map((on, i) => (
            <span key={i} aria-hidden className={on ? styles.railOn : styles.railOff} />
          ))}
        </div>
        <button type="button" onClick={publish} disabled={!canPost} className={styles.post}>
          {posting ? "Posting…" : "Post"}
        </button>
      </div>

      {/* ── The ask ─────────────────────────────────────────────────────── */}
      <header className={styles.ask}>
        <div className={styles.marker} aria-hidden="true">
          be specific!
        </div>
        <h1 className={styles.askTitle}>
          What&rsquo;s <span className={styles.underlined}>your take</span>
          {security ? ` on ${security.ticker}?` : "?"}
        </h1>
        <p className={styles.askCopy}>Your take helps power better signals for the whole Club.</p>
      </header>

      {/* ── 1 · the company and the call ────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.label}>The company</div>
        {security ? (
          <div className={styles.card}>
            <div className={styles.companyRow}>
              <TickerTile ticker={security.ticker} size="lg" />
              <div className={styles.companyName}>
                <div className={styles.symbol}>{security.ticker}</div>
                <div className={styles.issuer}>{security.name || "Listed security"}</div>
              </div>
              <button
                type="button"
                className={styles.change}
                onClick={() => {
                  setDraftTicker("");
                  setQuery("");
                  setPriorStance(null);
                  setStance(null);
                }}
              >
                Change
              </button>
            </div>

            <div className={styles.stanceRow}>
              {STANCE_CHOICES.map((c) => {
                const on = stance === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    className={on ? styles.stanceOn : styles.stanceOff}
                    style={on ? { background: c.fill, borderColor: c.fill } : undefined}
                    onClick={() => {
                      setStance(c.key);
                      setErr(null);
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* A flip is a real event with a required reason, and this screen
                collects no reason, so it refuses rather than filing an
                unexplained reversal.

                This used to hand off to /community/compose — the old Changed My
                Mind flow. That handoff is gone with the CMM retirement: v3 does
                not send a member into old chrome to finish a v3 action. The
                refusal stands on its own until v3 grows its own reason step. */}
            {isFlip ? (
              <p className={styles.note}>
                You already hold a position on {security.ticker}. Changing it is a recorded
                flip and needs a reason, which this screen can&rsquo;t take yet — keep your
                standing position for now.
              </p>
            ) : prior ? (
              <p className={styles.note}>Your standing position on this name.</p>
            ) : !stance ? (
              <p className={styles.note}>
                Optional. Take one and the Club counts you in the split on this name.
              </p>
            ) : null}
          </div>
        ) : (
          <div className={styles.card}>
            <label htmlFor="v3-ticker" className={styles.srOnly}>
              Ticker symbol
            </label>
            <input
              id="v3-ticker"
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
              className={styles.tickerInput}
            />
            <p className={styles.note}>
              {resolving
                ? "Checking the symbol…"
                : notFound
                  ? `We don't carry ${draftTicker} — check the symbol, or leave it off.`
                  : "Optional. One company per take — it binds the post to that name's thread."}
            </p>
          </div>
        )}
      </section>

      {/* ── 2 · post type ───────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.label}>Post type</div>
        <div className={styles.pills}>
          {POST_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              className={type === t.key ? styles.pillOn : styles.pillOff}
              onClick={() => setType(type === t.key ? null : t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {type ? (
          <p className={styles.note}>{POST_TYPES.find((t) => t.key === type)?.hint}</p>
        ) : null}
      </section>

      {/* ── 3 · the writing ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.label}>Your take</div>
        <div className={styles.card}>
          <label htmlFor="v3-body" className={styles.srOnly}>
            Your take
          </label>
          <textarea
            id="v3-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value.slice(0, BODY_MAX));
              setErr(null);
            }}
            rows={7}
            placeholder="Lead with the claim, then the evidence you ran — or ask the Club the question you're stuck on."
            className={styles.bodyInput}
          />
          <div className={styles.cardFoot}>
            <span className={styles.footTicker} data-numeric>
              {security ? `$${security.ticker}` : "—"}
            </span>
            <span className={styles.counter} data-numeric>
              {body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      {err ? <p className={styles.error}>{err}</p> : null}

      <div className={styles.footer}>
        <button type="button" onClick={publish} disabled={!canPost} className={styles.publish}>
          {posting ? "Publishing…" : "Publish to the Club"}
        </button>

        {/* The refusal, spoken. A grey button that will not say why is the
            thing this replaces. */}
        {!canPost && !posting ? (
          <p className={styles.refusal} role="status" aria-live="polite">
            {trimmed.length < BODY_MIN
              ? "Write your take first."
              : stance && !security
                ? "A stance needs a company — name one, or drop the stance."
                : isFlip
                  ? "Changing a standing position needs a reason."
                  : "Not ready yet."}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

/** The two non-composer postures, drawn as the same object so neither reads as
 *  an error page. */
function Gate({ title, copy }: { title: string; copy: string | null }) {
  return (
    <AppShell nav={false}>
      <div className={styles.chrome}>
        <Link href="/v3/club" className={styles.cancel}>
          Cancel
        </Link>
      </div>
      <header className={styles.ask}>
        <h1 className={styles.askTitle}>{title}</h1>
        {copy ? <p className={styles.askCopy}>{copy}</p> : null}
      </header>
      <Link href="/v3/club" className={styles.back}>
        Back to the Club →
      </Link>
    </AppShell>
  );
}
