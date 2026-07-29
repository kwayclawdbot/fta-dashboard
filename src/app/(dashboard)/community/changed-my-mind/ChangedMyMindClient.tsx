"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { RespectAction } from "@/components/canvas2";
import { FoundingNote } from "../parts";
import {
  BoardCard,
  BoardMasthead,
  BoardTabs,
  Marker,
  SectionLabel,
  StanceChip,
  type BoardTab,
} from "../board";
import {
  REASON_BY_KEY,
  toggleRespect,
  type ChangedMindEntry,
  type ChangedMindsFeed,
} from "@/lib/social/stance";
import { designV2Enabled } from "@/lib/design-flag";
import ChangedMyMindV2 from "./ChangedMyMindV2";

/* ══════════════════════════════════════════════════════════════════════════
   CHANGED MY MIND — Club Screens 03, built as drawn.

   Top to bottom, exactly the board: THE CLUB masthead, the tab strip with
   CHANGED MY MIND lit, the argument set as a headline with ONE word lassoed,
   the marker note in the top-right corner, then the updates as white cards —
   avatar, name, "6h · TSLA", the BEAR → BULL chips, the note, the quoted rule
   block, and the reaction row with RESPECT on the right. It closes on the
   near-black YOUR TURN field with the orange CTA.

   ── THE ARGUMENT THE SCREEN HAS TO MAKE ──────────────────────────────────
   Every other feed rewards being right, loudly, early. This one publishes the
   moment a member said "I was wrong, and here is what changed it" — and it has
   to read as status, not confession. That is why the reaction is RESPECT and not
   a like: a like on a reversal is ambiguous (do you agree with the new position,
   or approve of the update?) and RESPECT is not.

   TWO THINGS THE BOARD DRAWS THAT THE DATA CANNOT BACK:
     · "WHAT I SAID BEFORE" quoting the member's previous claim. Nothing stores
       the old note — stance_events keeps the old STANCE and the reason. The
       block keeps its drawn shape and carries WHAT CHANGED, which is real.
     · "♡ 92 · 💬 41" on a club with a handful of flips. Counts are floored;
       RespectAction withholds its own below SOCIAL_FLOORS.reactionHighlight.

   FOUNDING STATE: production has almost no flips. The zero case is the most
   honest version of the page's own argument, so it gets the full editorial
   treatment and an invitation. The masthead, the argument and the CTA render in
   BOTH states; only the ledger swaps.
   ══════════════════════════════════════════════════════════════════════════ */

const TABS: BoardTab[] = [
  { id: "feed", label: "Feed", href: "/community" },
  { id: "discussions", label: "Discussions", href: "/community?mode=discussions" },
  { id: "cmm", label: "Changed my mind" },
  { id: "lounge", label: "Lounge", href: "/community?mode=lounge" },
  { id: "live", label: "Live", href: "/community?mode=live" },
];

export default function ChangedMyMindClient({
  seed,
  userId,
  isKid,
}: {
  seed: ChangedMindsFeed;
  userId: string | null;
  /** Kids read the moments but never react (mirrors the flow's own kid wall). */
  isKid: boolean;
}) {
  // ── design v2 flag dispatch ──────────────────────────────────────────────
  // Flag OFF (default / production) → v1 body below runs unchanged. Flag ON →
  // the cc-canvas re-skin, same props, same backend calls. Build-constant, so
  // the early return is stable across renders.
  if (designV2Enabled()) return <ChangedMyMindV2 seed={seed} userId={userId} isKid={isKid} />;

  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChangedMindEntry[]>(seed.items ?? []);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function respect(entry: ChangedMindEntry) {
    if (!userId || isKid || busy.has(entry.id)) return;
    const was = entry.my_respect;

    // Optimistic, then reconciled: a reaction that silently fails to persist is
    // the exact defect this lane was sent to fix, so a failed write is rolled
    // back rather than left looking saved.
    setBusy((b) => new Set(b).add(entry.id));
    setItems((list) =>
      list.map((it) =>
        it.id === entry.id
          ? { ...it, my_respect: !was, respect_count: it.respect_count + (was ? -1 : 1) }
          : it
      )
    );
    const ok = await toggleRespect(supabase, entry.id, userId, was);
    if (!ok) {
      setItems((list) =>
        list.map((it) =>
          it.id === entry.id
            ? { ...it, my_respect: was, respect_count: it.respect_count + (was ? 1 : -1) }
            : it
        )
      );
    }
    setBusy((b) => {
      const n = new Set(b);
      n.delete(entry.id);
      return n;
    });
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <BoardMasthead title="The Club" />

      <div className="mt-4">
        <BoardTabs tabs={TABS} active="cmm" onSelect={() => {}} ariaLabel="The Club" />
      </div>

      {/* ── The argument ─────────────────────────────────────────────────
          ONE word carries the emphasis (f0-circle-mark) — the system's own
          lasso, mode-correct through --accent-solid — with the board's marker
          note pinned to the right of it. Not a masthead + lede pair: this page
          has an argument, and an argument is a sentence. */}
      <header className="relative mt-6 pr-24 sm:pr-32">
        <h2 className="max-w-[13ch] font-display text-[clamp(24px,7.5vw,30px)] font-black leading-[1.02] tracking-[-0.035em] text-ink">
          Where the Club <span className="f0-circle-mark">updated</span> its thinking.
        </h2>
        <Marker className="absolute right-0 top-0 text-right" rotate={-9}>
          {"strong opinions,\nloosely held"}
        </Marker>
      </header>

      {/* The club's own numbers, stated. Zeros are dropped rather than printed —
          "0 members" on a page about members changing their minds is the single
          worst thing this surface could say. */}
      {(seed.total_flips > 0 || seed.members > 0) && (
        <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft">
          {[
            seed.total_flips > 0
              ? `${seed.total_flips.toLocaleString()} ${seed.total_flips === 1 ? "update" : "updates"}`
              : null,
            seed.members > 0
              ? `${seed.members.toLocaleString()} ${seed.members === 1 ? "member" : "members"}`
              : null,
            seed.tickers > 0
              ? `${seed.tickers.toLocaleString()} ${seed.tickers === 1 ? "name" : "names"}`
              : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {items.length === 0 ? (
          <BoardCard className="px-3.5">
            <FoundingNote
              eyebrow="Nobody has flipped yet"
              headline="The first update sets the standard."
              body="Change your stance on any company you follow, say what changed it, and it files here under your name. That is the whole bar — not being right first, being willing to say you were wrong."
              action={
                <Link
                  href="/community/compose?type=changed_mind"
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-volt-500 px-4 py-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
                >
                  Post a change of mind
                </Link>
              }
            />
          </BoardCard>
        ) : (
          <section>
            <SectionLabel>Recent updates</SectionLabel>
            <div className="space-y-3">
              {items.map((entry) => (
                <FlipCard
                  key={entry.id}
                  entry={entry}
                  canRespect={!!userId && !isKid}
                  busy={busy.has(entry.id)}
                  onRespect={() => respect(entry)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── The line the whole feature is built around ──────────────────
            The single dark object on the page, drawn as board 03 draws it: the
            orange YOUR TURN eyebrow, the claim, and the full-width CTA. */}
        <section className="rounded-[16px] bg-[#14110F] p-4">
          {/* text-volt-300 deliberately: the volt ramp is FROZEN across themes and
              this field is near-black in both, so a frozen orange is the only one
              that holds. text-gold-700 would flip with the PAGE and drop to ~3:1
              on the field in light mode. */}
          <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-volt-300">
            Your turn
          </p>
          <p className="mt-2 max-w-[20ch] font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#F7F3EA]">
            The Club rewards the update, not the ego.
          </p>
          <Link
            href="/community/compose?type=changed_mind"
            className="mt-3.5 flex w-full items-center justify-center rounded-[8px] bg-volt-500 px-4 py-3.5 font-display text-[12px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
          >
            Post a change of mind
          </Link>
        </section>

        <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
      </div>
    </div>
  );
}

/* ── one update ───────────────────────────────────────────────────────────
   The drawn card: who, on what, from where to where, and why. The "why" is the
   reason taxonomy — a closed vocabulary, which is what makes this feed readable
   at a glance instead of a wall of paragraphs. */
function FlipCard({
  entry,
  canRespect,
  busy,
  onRespect,
}: {
  entry: ChangedMindEntry;
  canRespect: boolean;
  busy: boolean;
  onRespect: () => void;
}) {
  const name = entry.display_name || "Member";
  return (
    <BoardCard>
      <div className="flex items-center gap-2.5">
        <Avatar name={entry.display_name} avatarUrl={entry.avatar_url} role={entry.role} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {entry.username ? (
              <Link
                href={`/u/${entry.username}`}
                className="font-display text-[13px] font-bold text-ink transition-colors hover:text-gold-700"
              >
                {name}
              </Link>
            ) : (
              <span className="font-display text-[13px] font-bold text-ink">{name}</span>
            )}
            <AgeBadge role={entry.role} ageGroup={entry.age_group} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-soft">
            <span>{timeAgo(entry.created_at)}</span>
            <span aria-hidden>·</span>
            <Link
              href={`/research/${entry.ticker.toUpperCase()}`}
              className="font-mono font-bold tracking-tight text-ink underline decoration-teal-500/40 decoration-2 underline-offset-[3px] transition-colors hover:decoration-teal-500"
            >
              {entry.ticker.toUpperCase()}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.from_stance && <StanceChip stance={entry.from_stance} muted />}
          {entry.from_stance && (
            <span aria-hidden className="font-display text-[11px] font-extrabold text-gold-700">
              →
            </span>
          )}
          <StanceChip stance={entry.to_stance} />
        </div>
      </div>

      {entry.note && (
        <p className="mt-3 text-[13.5px] leading-[1.5] text-ink">{entry.note}</p>
      )}

      {entry.reason && (
        <div className="mt-3 border-l-[3px] border-sand py-0.5 pl-3">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
            What changed
          </p>
          <p className="mt-1 text-[12px] leading-[1.45] text-soft">
            {REASON_BY_KEY[entry.reason].label}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-sand pt-3">
        <RespectAction
          count={entry.respect_count}
          active={entry.my_respect}
          onToggle={onRespect}
          disabled={!canRespect || busy}
          size="sm"
        />
      </div>
    </BoardCard>
  );
}
