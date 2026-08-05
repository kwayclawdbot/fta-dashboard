"use client";

import { useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   FOLLOW — the profile header's follow affordance, built to Club Screens
   board 09. An accent pill in the header's own style: when the viewer does not
   follow yet it wears the mode accent (club orange / family gold / FTA metal)
   with a "+" glyph — action colour by law; once following it becomes a quiet
   neutral outline so the standing state is not screaming for attention.

   The follower count sits under it as a plain sentence, the count in ink.

   Optimistic: the label, the fill and the count flip the instant the member
   taps, then the write goes to /api/follow/[username] (POST to follow, DELETE
   to unfollow). A failed write rolls all three back to the truth. The button
   is never rendered for the member's own profile (the page omits it), so there
   is no self-follow path to guard here beyond the API's own check.
   ══════════════════════════════════════════════════════════════════════════ */

export default function FollowButton({
  username,
  initialFollowing,
  initialFollowers,
}: {
  username: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !following;

    // Optimistic: flip label, fill and count together.
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    setPending(true);

    try {
      const res = await fetch(`/api/follow/${encodeURIComponent(username)}`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("follow failed");
    } catch {
      // Roll back to the truth on any failure.
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={following}
        className={
          following
            ? "club-b-card f0-focus f0-press inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-[13px] font-bold text-ink transition-colors"
            : "cta-button f0-focus f0-press inline-flex items-center gap-1.5 rounded-full py-2 pl-2 pr-4 text-[13px]"
        }
      >
        {!following && (
          <span
            className="grid h-[22px] w-[22px] place-items-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--accent-on) 22%, transparent)" }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        )}
        {following ? "Following" : "Follow"}
      </button>
      <p className="text-[11.5px] text-soft">
        <span className="font-mono font-semibold tabular-nums text-ink">
          {followers.toLocaleString()}
        </span>{" "}
        {followers === 1 ? "member follows" : "members follow"}
      </p>
    </div>
  );
}
