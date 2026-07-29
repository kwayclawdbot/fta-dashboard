"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { RespectAction } from "@/components/canvas2";
import {
  REASON_BY_KEY,
  toggleRespect,
  type ChangedMindEntry,
  type ChangedMindsFeed,
  type Stance,
} from "@/lib/social/stance";
import { Card, Kicker, ScriptTitle } from "@/components/cc/ui";

/* ══════════════════════════════════════════════════════════════════════════
   CHANGED MY MIND — cc-canvas (design v2). Re-skin of ChangedMyMindClient onto
   the Cheat Code App surface: a script mark + mono kicker header, a cc-display
   argument line, each flip as a cc Card, and the near-black YOUR TURN CTA. EVERY
   behaviour is duplicated verbatim — the real stance_events feed, the optimistic+
   reconciled RESPECT toggle (kept on the real RespectAction component), the
   floored counts, the founding/empty state, the kid read-only posture.

   HONEST-DATA DECISIONS (carried over from v1's own notes):
   · CMM entries carry NO belt / xp — get_changed_minds returns display_name /
     avatar_url / role only. So authors render on the NEUTRAL Avatar primitive
     (no belt ring, no belt dot). A belt-ringed avatar here would be fabricated
     identity, so we do not use cc BeltAvatar for these rows.
   · A stance is an OPINION, not a market quote — bull/bear/neutral render as
     neutral text pills (card2 / ink), NEVER green/pink. Only the transition
     ARROW carries the brand orange.
   ══════════════════════════════════════════════════════════════════════════ */

export default function ChangedMyMindV2({
  seed,
  userId,
  isKid,
}: {
  seed: ChangedMindsFeed;
  userId: string | null;
  isKid: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChangedMindEntry[]>(seed.items ?? []);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function respect(entry: ChangedMindEntry) {
    if (!userId || isKid || busy.has(entry.id)) return;
    const was = entry.my_respect;

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

  const stats = [
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
    .join("  ·  ");

  return (
    <div className="mx-auto max-w-2xl pb-10">
      {/* ── header: one script mark + mono kicker + cc-display argument ── */}
      <ScriptTitle>club</ScriptTitle>
      <Kicker className="mt-3">Changed my mind · strong opinions, loosely held</Kicker>
      <h2 className="cc-display mt-2 max-w-[16ch] text-[clamp(24px,7.5vw,32px)] leading-[1.02] text-[var(--cc-ink)]">
        Where the Club updated its thinking
      </h2>

      {/* The club's own numbers — zeros dropped, exactly as v1. */}
      {(seed.total_flips > 0 || seed.members > 0) && stats && (
        <p
          className="mt-4 font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--cc-soft)" }}
        >
          {stats}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {items.length === 0 ? (
          /* ── founding / empty state (cc re-skin of FoundingNote) ── */
          <Card className="p-5">
            <Kicker>Nobody has flipped yet</Kicker>
            <p className="cc-display mt-2 text-[22px] leading-[1.1] text-[var(--cc-ink)]">
              The first update sets the standard.
            </p>
            <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--cc-soft)]">
              Change your stance on any company you follow, say what changed it, and it files here
              under your name. That is the whole bar — not being right first, being willing to say
              you were wrong.
            </p>
            <Link
              href="/community/compose?type=changed_mind"
              className="cc-halo mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]"
              style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
            >
              Post a change of mind
            </Link>
          </Card>
        ) : (
          <section>
            <Kicker className="mb-3">Recent updates</Kicker>
            <div className="space-y-3">
              {items.map((entry) => (
                <FlipCardV2
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

        {/* ── YOUR TURN — the single dark object on the page ──
            #141013 is a fixed near-black in BOTH themes, so the frozen orange
            (same hex across themes) is what holds on it — light warm ink for the
            claim, orange CTA. */}
        <section className="rounded-2xl p-4" style={{ background: "#141013" }}>
          <p
            className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--cc-orange)" }}
          >
            Your turn
          </p>
          <p
            className="cc-display mt-2 max-w-[20ch] text-[22px] leading-[1.15]"
            style={{ color: "#F7F3EA" }}
          >
            The Club rewards the update, not the ego.
          </p>
          <Link
            href="/community/compose?type=changed_mind"
            className="cc-halo mt-3.5 flex w-full items-center justify-center rounded-full px-4 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.1em]"
            style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
          >
            Post a change of mind
          </Link>
        </section>

        <p className="font-[family-name:var(--font-plex-mono)] text-[11px] leading-relaxed text-[var(--cc-dim)]">
          {COMMUNITY_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

/* ── neutral stance pill — NOT green/pink (a stance is an opinion). ── */
function StanceChipV2({ stance, muted = false }: { stance: Stance; muted?: boolean }) {
  const label = stance === "bull" ? "Bullish" : stance === "bear" ? "Bearish" : "Neutral";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{
        background: "var(--cc-card2)",
        border: "1px solid var(--cc-line)",
        color: muted ? "var(--cc-soft)" : "var(--cc-ink)",
      }}
    >
      {label}
    </span>
  );
}

/* ── one update — cc Card ──────────────────────────────────────────────────
   Who, on what, from where to where, and why. Avatar is the NEUTRAL primitive:
   the feed carries no belt/xp for these authors, so no belt ring is drawn. */
function FlipCardV2({
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
    <div
      className="rounded-[14px] border p-[13px]"
      style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
    >
      {/* Board-04 CMM card kicker — pink section identity mark. */}
      <span className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-down)" }}>
        Changed my mind
      </span>
      <div className="mt-2 flex items-center gap-2.5">
        {/* NEUTRAL avatar — no belt data on CMM entries (see header note). */}
        <Avatar name={entry.display_name} avatarUrl={entry.avatar_url} role={entry.role} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {entry.username ? (
              <Link
                href={`/u/${entry.username}`}
                className="text-[12.5px] font-bold text-[var(--cc-ink)] transition-colors hover:text-[var(--cc-orange-ink)]"
              >
                {name}
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-[var(--cc-ink)]">{name}</span>
            )}
            <AgeBadge role={entry.role} ageGroup={entry.age_group} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--cc-soft)]">
            <span>{timeAgo(entry.created_at)}</span>
            <span aria-hidden>·</span>
            <Link
              href={`/research/${entry.ticker.toUpperCase()}`}
              className="font-[family-name:var(--font-plex-mono)] font-bold tracking-tight text-[var(--cc-ink)] transition-colors hover:text-[var(--cc-orange-ink)]"
            >
              {entry.ticker.toUpperCase()}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.from_stance && <StanceChipV2 stance={entry.from_stance} muted />}
          {entry.from_stance && (
            <span
              aria-hidden
              className="text-[11px] font-extrabold"
              style={{ color: "var(--cc-orange-ink)" }}
            >
              →
            </span>
          )}
          <StanceChipV2 stance={entry.to_stance} />
        </div>
      </div>

      {entry.note && (
        <p className="mt-3 text-[12.5px] leading-[1.5]" style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, var(--cc-soft))" }}>{entry.note}</p>
      )}

      {entry.reason && (
        <div className="mt-3 py-0.5 pl-3" style={{ borderLeft: "3px solid var(--cc-line)" }}>
          <p
            className="font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--cc-soft)" }}
          >
            What changed
          </p>
          <p className="mt-1 text-[12px] leading-[1.45] text-[var(--cc-soft)]">
            {REASON_BY_KEY[entry.reason].label}
          </p>
        </div>
      )}

      <div
        className="mt-3 flex items-center justify-end pt-3"
        style={{ borderTop: "1px solid var(--cc-line)" }}
      >
        {/* The real RESPECT control — optimistic+reconciled toggle, count floored
            below SOCIAL_FLOORS.reactionHighlight inside the component itself. */}
        <RespectAction
          count={entry.respect_count}
          active={entry.my_respect}
          onToggle={onRespect}
          disabled={!canRespect || busy}
          size="sm"
        />
      </div>
    </div>
  );
}
