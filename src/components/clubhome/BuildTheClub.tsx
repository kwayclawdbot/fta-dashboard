"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Share2, Trophy } from "lucide-react";
import { SectionLabel, clubFeedback } from "./parts";
import type { InviteResponse } from "@/lib/clubhome/contract";

/**
 * §4 Build the Club — the invite / growth mechanics (adults + teens only; kids
 * excluded upstream). Personal ref link with copy + native share, XP-reward
 * recognition (Founding Builder framing), and a top-builders competition ledger.
 * Volt = action. Rendered as a designed invite ledger object, never a plain card
 * grid. `embedded` drops the section chrome when it sits inside the founding
 * Collective as the centerpiece.
 */

export default function BuildTheClub({
  invite,
  embedded = false,
}: {
  invite: InviteResponse | null;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  // Graceful fallback: the invite endpoint isn't live yet. As the founding
  // centerpiece the growth engine must still offer its action, so route to the
  // existing referrals surface rather than vanishing.
  if (!invite) {
    if (!embedded) return null;
    return (
      <div>
        <p className="text-[15px] leading-relaxed text-soft">
          Bring the first person into your Club — every invite earns XP and makes the network smarter.
        </p>
        <Link
          href="/referrals"
          className="cta-button mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm active:scale-[0.97]"
        >
          <Share2 className="h-4 w-4" />
          Invite a friend
        </Link>
      </div>
    );
  }

  const url = invite.url || `https://cheatcode.com/r/${invite.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clubFeedback.linkCopied();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the field is selectable as fallback */
    }
  }

  async function share() {
    const data = {
      title: "Join me in the Cheat Code Club",
      text: "I'm learning to invest with the Cheat Code Club. Come join the network:",
      url,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
        clubFeedback.invited();
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    void copy();
  }

  const leaders = invite.leaderboard ?? [];
  const showLeaderboard = (invite.floorMet ?? leaders.length >= 3) && leaders.length > 0;

  const body = (
    <>
      {/* Recognition line — Founding Builder framing, scale-aware */}
      <p className="text-[15px] leading-relaxed text-soft">
        {invite.activatedCount > 0 ? (
          <>
            You&apos;ve brought{" "}
            <span className="font-semibold text-ink">
              {invite.activatedCount} {invite.activatedCount === 1 ? "member" : "members"}
            </span>{" "}
            into the Club and earned{" "}
            <span className="font-mono font-semibold text-volt-700">
              {invite.xpEarned.toLocaleString()} XP
            </span>
            . Every mind you bring makes the Club smarter.
          </>
        ) : (
          <>Bring the first person into your Club — every invite earns XP and makes the network smarter.</>
        )}
      </p>

      {/* Invite link — a designed ledger row, mono code, copy + share */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-sand bg-paper px-3 py-2.5">
          <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-wide text-volt-600">
            Your link
          </span>
          <span className="truncate font-mono text-sm text-ink">{url.replace(/^https?:\/\//, "")}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sand bg-card px-3.5 py-2.5 text-sm font-semibold text-ink transition-transform hover:border-volt-400 active:scale-[0.97]"
          >
            {copied ? <Check className="h-4 w-4 text-volt-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={share}
            className="cta-button inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm active:scale-[0.97]"
          >
            <Share2 className="h-4 w-4" />
            Invite
          </button>
        </div>
      </div>

      {/* Top-builders competition ledger — numbered, hairline rows, "You" lit */}
      {showLeaderboard && (
        <div className="mt-5 border-t border-sand pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-volt-600" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-volt-700">
              Top builders
            </span>
          </div>
          <ol className="divide-y divide-sand">
            {leaders.slice(0, 5).map((l, i) => (
              <li
                key={`${l.name}-${i}`}
                className={`flex items-center gap-3 py-2 ${l.you ? "font-semibold" : ""}`}
              >
                <span className="w-5 font-mono text-xs font-bold tabular-nums text-soft">{i + 1}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${l.you ? "text-volt-700" : "text-ink"}`}>
                  {l.name}
                  {l.you && (
                    <span className="ml-2 rounded-full bg-volt-500/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-700">
                      you
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-ink">{l.count}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <section aria-label="Build the Club" className="club-field-volt rounded-2xl p-5 sm:p-7">
      <SectionLabel tone="volt">Build the Club</SectionLabel>
      <div className="mt-4">{body}</div>
    </section>
  );
}
