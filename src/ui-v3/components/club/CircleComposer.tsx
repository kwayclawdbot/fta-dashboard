"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkClean } from "@/lib/profanity";
import { joinCircle, postCircleNote, type CircleStance } from "@/lib/circles";
import type { ClubViewerVM } from "@/ui-v3/club-data";
import styles from "./CircleComposer.module.css";

/**
 * "23 Inside Circle" — the composer footer, wired.
 *
 * ── THE WRITE ────────────────────────────────────────────────────────────────
 * `postCircleNote()` → `club_circle_notes` (circle_id, author_id, body, stance).
 * That is the SAME table the room above reads its thread from, through the same
 * helper the old app's Circle room calls. No new table, no new endpoint.
 *
 * ── THE GATE, WHICH IS THE INTERESTING PART ──────────────────────────────────
 * `club_circle_notes` INSERT is guarded by an RLS policy with three clauses
 * (migration 191): the author is the caller, the caller is not a kid, AND the
 * caller is on `club_circle_members` for this circle — plus the circle's clock
 * has not run out. A Circle is a room you are IN, not a comment box on a page.
 *
 * So this component draws four postures, one per way that predicate can fail,
 * and each one says which:
 *
 *   signed out   → the note, and a link to the composer's sign-in path
 *   kid register → the register's own read-only note
 *   not joined   → JOIN, which is a REAL write to `club_circle_members` (the
 *                  same policy allows it: self, non-kid, open circle). This is
 *                  the affordance the brief asked to be checked for — it exists,
 *                  so it is wired rather than flagged.
 *   clock out    → a closed room takes no more notes and no more joins, and the
 *                  RLS says so too. Stated, not hidden.
 *
 * The composer proper only appears when every clause is already satisfied, so a
 * member can never type a note into a box whose submit the server will refuse.
 *
 * ── THE STANCE ───────────────────────────────────────────────────────────────
 * `club_circle_notes.stance` is nullable and feeds the room's split (one stance
 * per author, their latest). It is optional here for the same reason: not every
 * message in a room is a position, and forcing one would turn a question into a
 * vote.
 */

const BODY_MAX = 1000;

const STANCES: { key: CircleStance; label: string; fill: string }[] = [
  { key: "bear", label: "Bear", fill: "#E0392B" },
  { key: "neutral", label: "Neutral", fill: "#8A8279" },
  { key: "bull", label: "Bull", fill: "#1BA94C" },
];

export default function CircleComposer({
  circleId,
  channel,
  viewer,
  joined,
  open,
}: {
  circleId: string;
  channel: string;
  viewer: ClubViewerVM | null;
  joined: boolean;
  open: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [stance, setStance] = useState<CircleStance | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ── The postures that are not a composer ─────────────────────────────── */

  if (!open) {
    return <Bar>This Circle&rsquo;s clock has run out. The thread stands as the record.</Bar>;
  }

  if (!viewer) {
    return (
      <Bar>
        <Link href="/v3/club" className={styles.barLink}>
          Sign in
        </Link>{" "}
        to add your read to this Circle.
      </Bar>
    );
  }

  if (!viewer.canPost) {
    return <Bar>{viewer.readOnlyNote}</Bar>;
  }

  if (!joined) {
    return (
      <div className={styles.composer}>
        <div className={styles.joinRow}>
          <div className={styles.joinCopy}>
            You&rsquo;re reading this Circle. Join it to post.
          </div>
          <button
            type="button"
            disabled={busy}
            className={styles.join}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              const ok = await joinCircle(createClient(), circleId);
              setBusy(false);
              if (!ok) {
                setErr("Couldn't join — try again.");
                return;
              }
              startTransition(() => router.refresh());
            }}
          >
            {busy ? "Joining…" : "Join Circle"}
          </button>
        </div>
        {err ? <p className={styles.err}>{err}</p> : null}
      </div>
    );
  }

  /* ── The composer ─────────────────────────────────────────────────────── */

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= BODY_MAX && !busy;

  async function send() {
    if (!canSend) return;
    if (!checkClean(trimmed).ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ok = await postCircleNote(createClient(), circleId, trimmed, stance);
    setBusy(false);
    if (!ok) {
      setErr("That note didn't post — try again.");
      return;
    }
    setBody("");
    setStance(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className={styles.composer}>
      {/* The optional stance. Above the field rather than inside it, because it
          qualifies the whole note and the board's composer row has no room. */}
      <div className={styles.stanceRow}>
        {STANCES.map((s) => {
          const on = stance === s.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              className={on ? styles.stanceOn : styles.stanceOff}
              style={on ? { background: s.fill, borderColor: s.fill } : undefined}
              onClick={() => setStance(on ? null : s.key)}
            >
              {s.label}
            </button>
          );
        })}
        <span className={styles.stanceHint}>{stance ? "Counts in the split" : "Optional"}</span>
      </div>

      <div className={styles.composerRow}>
        <label htmlFor="v3-circle-note" className={styles.srOnly}>
          Message # {channel}
        </label>
        <textarea
          id="v3-circle-note"
          value={body}
          rows={1}
          onChange={(e) => {
            setBody(e.target.value.slice(0, BODY_MAX));
            setErr(null);
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // room-shaped surface already trains people on.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Message # ${channel}`}
          className={styles.field}
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Post note"
          className={styles.send}
        >
          ➤
        </button>
      </div>

      {err ? <p className={styles.err}>{err}</p> : null}
    </div>
  );
}

/** The footer in a state that takes no input: one line, same box. */
function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.composer}>
      <p className={styles.bar}>{children}</p>
    </div>
  );
}
