"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkClean } from "@/lib/profanity";
// CIRCLE_DAYS comes from `@/lib/circles`, NOT from the club-data re-export a
// server component would use: club-data.ts is `server-only`, so a VALUE import
// of it from this client module pulls the whole server data layer into the
// browser graph and the build refuses it. The type import below is erased at
// compile time and is therefore fine from either side.
import { openCircle, normalizeTicker, CIRCLE_DAYS } from "@/lib/circles";
import type { ClubViewerVM } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import styles from "./StartCircleScreen.module.css";

/**
 * /v3/club/circles/new — the two "Start a Circle" affordances, given somewhere
 * to go.
 *
 * ── WHY THIS SCREEN IS ALLOWED TO EXIST WITHOUT AN ARTBOARD ──────────────────
 * DESIGN-GRAMMAR §9.6 says: if a needed component does not exist, stop and flag
 * it — do not improvise a pattern. Nothing is improvised here. The Circles board
 * draws the ENTRY ("+ Start yours", "30 days on the clock") but no opener form,
 * so this screen is composed entirely from objects board 05 already defines and
 * this lane already translated: the Cancel / Post chrome, the field label, the
 * flat card, the accent publish footer, the spoken refusal. There is no new
 * colour, radius, type step or container shape. If an opener artboard later
 * lands and disagrees, the artboard wins.
 *
 * ── WHAT IT WRITES ───────────────────────────────────────────────────────────
 * `openCircle()` from `src/lib/circles.ts` — the SAME helper the old app's
 * opener calls. It inserts `club_circles` (slug, title, topic, premise, ticker,
 * created_by, expires_at = now + 30d) and then joins the opener to their own
 * room via `club_circle_members`, because a Circle with an empty roster is a
 * room nobody is standing in. Both inserts are permitted by migration 191's RLS
 * for a non-kid signed-in member. No new schema.
 *
 * ── THE CLOCK IS NOT A CHOICE ────────────────────────────────────────────────
 * `CIRCLE_DAYS` is fixed at 30 and the helper computes `expires_at` itself. The
 * screen states the consequence rather than offering a control the data model
 * does not have.
 */

const PREMISE_MAX = 240;

export default function StartCircleScreen({ viewer }: { viewer: ClubViewerVM | null }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [ticker, setTicker] = useState("");
  const [premise, setPremise] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The same floors the old opener applies, so a Circle opened from either front
  // end is the same minimum quality of object.
  const ready =
    title.trim().length >= 3 && topic.trim().length >= 2 && premise.trim().length >= 10;
  const canOpen = !!viewer && viewer.canPost && ready && !busy;

  const steps = [title.trim().length >= 3, topic.trim().length >= 2, premise.trim().length >= 10];

  async function open() {
    if (!canOpen) return;
    for (const chunk of [title, topic, premise]) {
      if (!checkClean(chunk).ok) {
        setErr("Let's keep it friendly — please reword that.");
        return;
      }
    }
    setBusy(true);
    setErr(null);

    const { slug, error } = await openCircle(createClient(), {
      title,
      topic,
      premise,
      ticker: ticker ? normalizeTicker(ticker) : null,
    });

    setBusy(false);
    if (error || !slug) {
      setErr(error ?? "That Circle didn't open.");
      return;
    }
    // Straight into the room they just opened — they are already its first
    // member, so there is nothing else to do before they can post.
    router.push(`/v3/club/circles/${slug}`);
    router.refresh();
  }

  if (!viewer || !viewer.canPost) {
    return (
      <AppShell nav={false}>
        <div className={styles.chrome}>
          <Link href="/v3/club/circles" className={styles.cancel}>
            Cancel
          </Link>
        </div>
        <header className={styles.ask}>
          <h1 className={styles.askTitle}>
            {viewer ? "Circles are for the grown-ups' side of the Club." : "Sign in to open a Circle."}
          </h1>
          <p className={styles.askCopy}>
            {viewer?.readOnlyNote ??
              "A Circle is a room with your name on it. Opening one needs an account."}
          </p>
        </header>
        <Link href="/v3/club/circles" className={styles.back}>
          Back to Circles →
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell nav={false}>
      <div className={styles.chrome}>
        <Link href="/v3/club/circles" className={styles.cancel}>
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
        <button type="button" onClick={open} disabled={!canOpen} className={styles.post}>
          {busy ? "Opening…" : "Open"}
        </button>
      </div>

      <header className={styles.ask}>
        <h1 className={styles.askTitle}>
          Open a <span className={styles.underlined}>Circle</span>.
        </h1>
        <p className={styles.askCopy}>
          One event or one thesis, {CIRCLE_DAYS} days on the clock. When it runs out the room
          closes and the thread stands as the record.
        </p>
      </header>

      <section className={styles.section}>
        <label htmlFor="v3-circle-title" className={styles.label}>
          What it&rsquo;s about
        </label>
        <div className={styles.card}>
          <input
            id="v3-circle-title"
            value={title}
            maxLength={80}
            onChange={(e) => {
              setTitle(e.target.value);
              setErr(null);
            }}
            placeholder="NVDA Earnings"
            className={styles.input}
          />
        </div>
      </section>

      <section className={styles.section}>
        <label htmlFor="v3-circle-topic" className={styles.label}>
          Topic
        </label>
        <div className={styles.card}>
          <input
            id="v3-circle-topic"
            value={topic}
            maxLength={24}
            onChange={(e) => {
              setTopic(e.target.value);
              setErr(null);
            }}
            placeholder="Semis"
            className={styles.input}
          />
          <p className={styles.note}>
            One word. It is what the Circles grid prints under the bubble.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <label htmlFor="v3-circle-ticker" className={styles.label}>
          Company
        </label>
        <div className={styles.card}>
          <input
            id="v3-circle-ticker"
            value={ticker}
            maxLength={10}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase().replace(/[^A-Z.\-$]/g, ""));
              setErr(null);
            }}
            placeholder="NVDA"
            className={`${styles.input} ${styles.mono}`}
          />
          <p className={styles.note}>
            Optional. A Circle with a company takes that company&rsquo;s colours; one without
            takes the neutral tile.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <label htmlFor="v3-circle-premise" className={styles.label}>
          The premise
        </label>
        <div className={styles.card}>
          <textarea
            id="v3-circle-premise"
            value={premise}
            rows={3}
            onChange={(e) => {
              setPremise(e.target.value.slice(0, PREMISE_MAX));
              setErr(null);
            }}
            placeholder="Blackwell demand beats guidance. Graded at close on ER day."
            className={styles.textarea}
          />
          <div className={styles.cardFoot}>
            <span className={styles.footHint}>Pinned at the top of the room</span>
            <span className={styles.counter} data-numeric>
              {premise.length} / {PREMISE_MAX}
            </span>
          </div>
        </div>
      </section>

      {err ? <p className={styles.error}>{err}</p> : null}

      <div className={styles.footer}>
        <button type="button" onClick={open} disabled={!canOpen} className={styles.publish}>
          {busy ? "Opening…" : `Open for ${CIRCLE_DAYS} days`}
        </button>
        {!canOpen && !busy ? (
          <p className={styles.refusal} role="status" aria-live="polite">
            {!steps[0]
              ? "Name the Circle"
              : !steps[1]
                ? "Give it a topic"
                : "Write the premise — a sentence the room can be held to"}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
