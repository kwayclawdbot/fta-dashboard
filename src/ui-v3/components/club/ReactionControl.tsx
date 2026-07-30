"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toggleRespect } from "@/lib/social/stance";
import type { ClubViewerVM } from "@/ui-v3/club-data";
import styles from "./ReactionControl.module.css";

/**
 * The two tap-to-answer controls on the feed: 👍 on a post, 🔥 on a flip.
 *
 * ── EACH CONTROL WRITES THE TABLE ITS OWN COUNT IS READ FROM ─────────────────
 * This is the whole design rule here, and it is why there are two write paths
 * rather than one:
 *
 *   👍 on a feed post  → `post_likes` (post_id, user_id)
 *        The number beside it comes from `getCommunityFeedSeed().likeCount`,
 *        which counts `post_likes`. Writing this tap to `object_reactions`
 *        instead — the newer, more general table — would produce a control whose
 *        count never moves on reload, because nothing reads that row.
 *
 *   🔥 on a changed-mind card → `object_reactions` as
 *        (target_type 'stance_event', reaction 'respect'), via
 *        `toggleRespect()`. `get_changed_minds` (migration 190) folds exactly
 *        that pair into `respect_count` / `my_respect`, so the count and the
 *        write agree.
 *
 * Both tables carry the same forge-proof RLS — INSERT `user_id = auth.uid()`,
 * DELETE own row only — and NEITHER carries a kid clause. That is deliberate
 * upstream policy, not an oversight: SOCIAL-OBJECTS says kids read and react
 * freely, and only AUTHORING is walled. So this control is offered to every
 * signed-in register, unlike the composer.
 *
 * ── OPTIMISM, AND WHAT HAPPENS WHEN IT IS WRONG ──────────────────────────────
 * The count and the pressed state move on the tap, before the round trip. If
 * the write comes back false the state rolls straight back — the helpers return
 * a boolean precisely so a caller can do that rather than lie about
 * persistence. A `router.refresh()` follows a successful write so the server
 * component the count came from re-reads it; the optimistic value and the
 * refreshed value are then the same number, which is what makes the count
 * survive a reload rather than just a re-render.
 */
export default function ReactionControl({
  kind,
  targetId,
  count,
  mine,
  viewer,
}: {
  /** Which of the two write paths this control is. See the note above. */
  kind: "like" | "respect";
  /** `feed_posts.id` for a like, `stance_events.id` for a respect. */
  targetId: string;
  count: number;
  mine: boolean;
  viewer: ClubViewerVM | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [on, setOn] = useState(mine);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const glyph = kind === "like" ? "👍" : "🔥";
  const label =
    kind === "like" ? (on ? "Remove your respect" : "Respect this post") : on ? "Remove your respect" : "Respect this change of mind";

  async function toggle() {
    if (busy) return;
    if (!viewer) {
      // Not a redirect: the member was reading the feed, and throwing them at a
      // login screen for a tap loses their place. The row says what is needed.
      setNote("Sign in to respect this");
      return;
    }

    const next = !on;
    setOn(next);
    setN((v) => Math.max(0, v + (next ? 1 : -1)));
    setBusy(true);
    setNote(null);

    const supabase = createClient();
    let ok = false;
    if (kind === "respect") {
      // `active` means "a row already exists" — the helper deletes when true.
      ok = await toggleRespect(supabase, targetId, viewer.id, on);
    } else if (on) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", targetId)
        .eq("user_id", viewer.id);
      ok = !error;
    } else {
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: targetId, user_id: viewer.id });
      ok = !error;
    }

    setBusy(false);
    if (!ok) {
      setOn(!next);
      setN((v) => Math.max(0, v + (next ? -1 : 1)));
      setNote("That didn't save — try again");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={label}
        className={on ? styles.on : styles.off}
      >
        <span aria-hidden="true">{glyph}</span>
        {/* A zero is printed as nothing — the same rule the cards apply to every
            other count. An engagement row filled in with the absence of
            engagement is what made a real feed look abandoned. */}
        {n > 0 ? (
          <span data-numeric>{n}</span>
        ) : null}
      </button>
      {note ? (
        <span className={styles.note} role="status">
          {note}
        </span>
      ) : null}
    </>
  );
}
