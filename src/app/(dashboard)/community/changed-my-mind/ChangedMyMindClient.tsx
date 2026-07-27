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
import { SectionRule } from "@/components/f0/parts";
import {
  REASON_BY_KEY,
  STANCE_META,
  toggleRespect,
  type ChangedMindEntry,
  type ChangedMindsFeed,
} from "@/lib/social/stance";

/* ══════════════════════════════════════════════════════════════════════════
   CHANGED MY MIND — the destination. Canvas v2, Club Screens 03.

   ── THE ARGUMENT THE SCREEN HAS TO MAKE ──────────────────────────────────
   Every other feed in every other product rewards being right, loudly, early.
   This one publishes the moment a member said "I was wrong, and here is what
   changed it" — and it has to make that read as status, not as a confession.
   The whole design is in service of that one inversion, which is why the page
   leads with an editorial line rather than a list header, and why the reaction
   is RESPECT and not a like: a like on a reversal is ambiguous (do you agree
   with the new position, or approve of the update?), and RESPECT is not.

   ── WHAT THE CANVAS DREW THAT DID NOT SURVIVE ────────────────────────────
   · Handwritten Caveat annotations ("strong opinions, loosely held"). The app
     ships three typefaces and a script face is not one of them; faking one with
     an italic serif reads as a stock template, and adding a fourth font for two
     words is not a trade worth making. The line survives as a mono aside — the
     system's own voice for a margin note.
   · Green "BULL" / grey "BEAR" pills. Green is PRICE. Stance is COMMUNITY
     SENTIMENT and rides the lime ramp through STANCE_META, where direction is
     carried by the label and the ▲▼ mark rather than by hue.
   · "♡ 92 · 💬 41" on a club with a handful of flips. Counts are floored
     (RespectAction withholds its own below SOCIAL_FLOORS.reactionHighlight).

   ── FOUNDING STATE (plan §0.5) ───────────────────────────────────────────
   Production has almost no flips. The zero case is not an error state here — it
   is the most honest version of the page's own argument, so it gets the full
   editorial treatment and an invitation, not a shrug. The masthead and the CTA
   render in BOTH states; only the ledger swaps.
   ══════════════════════════════════════════════════════════════════════════ */

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
    <div className="mx-auto max-w-2xl space-y-7 pb-10">
      {/* ── The editorial line ───────────────────────────────────────────
          ONE word carries the emphasis (f0-circle-mark), which is the system's
          answer to the canvas's lassoed ellipse and is mode-correct through
          --accent-solid. Not a masthead + lede pair: this page has an argument,
          and an argument is a sentence. */}
      <header className="pt-1">
        <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
          The Club
        </p>
        <h1 className="mt-3 max-w-[13ch] font-display text-display-1 font-extrabold leading-[0.95] text-ink">
          Where the Club{" "}
          <span className="f0-circle-mark">updated</span> its thinking.
        </h1>
        <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-soft">
          Strong opinions, loosely held
        </p>
      </header>

      {/* The club's own numbers, stated. Zeros are dropped rather than printed —
          "0 members" on a page about members changing their minds is the single
          worst thing this surface could say. */}
      {(seed.total_flips > 0 || seed.members > 0) && (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft">
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

      {items.length === 0 ? (
        <FoundingNote
          eyebrow="Nobody has flipped yet"
          headline="The first update sets the standard."
          body="Change your stance on any company you follow, say what changed it, and it files here under your name. That is the whole bar — not being right first, being willing to say you were wrong."
          action={
            <Link
              href="/community/compose?type=changed_mind"
              className="inline-flex items-center gap-1.5 rounded-full bg-volt-500 px-4 py-2 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-transform hover:-translate-y-px hover:bg-volt-600 active:translate-y-0 motion-reduce:hover:translate-y-0 dark:bg-volt-600"
            >
              Post a change of mind
            </Link>
          }
        />
      ) : (
        <section className="space-y-5">
          <SectionRule>Recent updates</SectionRule>
          <div className="f0-ledger">
            {items.map((entry) => (
              <FlipEntry
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

      {/* ── The line the whole feature is built around ────────────────────
          The single dark object on the page, so it carries the argument
          without a second heavy field competing with it. */}
      <section className="f0-hero-field px-5 py-6">
        {/* text-volt-300 deliberately: the volt ramp is FROZEN across themes,
            and this field is obsidian in both, so a frozen orange is the only
            one that holds. text-gold-700 would flip with the PAGE and drop to
            ~3:1 on the field in light mode. The body line takes the field's own
            cream (.f0-hero-field sets color) rather than restating it. */}
        <p className="font-display text-eyebrow font-bold uppercase text-volt-300">
          Your turn
        </p>
        <p className="mt-2.5 max-w-[20ch] font-display text-[22px] font-extrabold leading-[1.15] tracking-tight">
          The Club rewards the update, not the ego.
        </p>
        <Link
          href="/community/compose?type=changed_mind"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-volt-500 px-4 py-3.5 font-display text-[12px] font-extrabold uppercase tracking-[0.12em] text-night-950 transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0"
        >
          Post a change of mind
        </Link>
      </section>

      <p className="text-[11px] leading-relaxed text-soft">{COMMUNITY_DISCLAIMER}</p>
    </div>
  );
}

/* ── one update ───────────────────────────────────────────────────────────
   The object with identity: who, on what, from where to where, and why. The
   "why" is the reason taxonomy — a closed vocabulary, which is what makes this
   feed readable at a glance instead of a wall of paragraphs. */
function FlipEntry({
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
  const from = entry.from_stance ? STANCE_META[entry.from_stance] : null;
  const to = STANCE_META[entry.to_stance];
  const name = entry.display_name || "Member";

  return (
    <article className="f0-ledger-row gap-3">
      <span className="shrink-0 self-start pt-0.5">
        <Avatar name={entry.display_name} avatarUrl={entry.avatar_url} role={entry.role} size="sm" />
      </span>

      <div className="min-w-0 flex-1 self-start">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {entry.username ? (
            <Link
              href={`/u/${entry.username}`}
              className="font-display text-[14px] font-bold text-ink transition-colors hover:text-gold-700"
            >
              {name}
            </Link>
          ) : (
            <span className="font-display text-[14px] font-bold text-ink">{name}</span>
          )}
          <AgeBadge role={entry.role} ageGroup={entry.age_group} />
          <Link
            href={`/research/${entry.ticker.toUpperCase()}`}
            className="font-mono text-[11px] font-bold tracking-tight text-ink underline decoration-teal-500/40 decoration-2 underline-offset-[3px] transition-colors hover:decoration-teal-500"
          >
            <span className="text-teal-600 dark:text-teal-300">$</span>
            {entry.ticker.toUpperCase()}
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
            {timeAgo(entry.created_at)}
          </span>
        </div>

        {/* The flip itself. Two stance marks and an arrow — the smallest thing
            that says "this moved", and it survives greyscale because ▲/▼ and
            the words differ, not just the tint. */}
        <p className="mt-2 flex flex-wrap items-center gap-2">
          {from && <StanceMark stance={from} muted />}
          <span aria-hidden className="font-display text-[13px] font-extrabold text-gold-700">
            →
          </span>
          <StanceMark stance={to} />
          {entry.reason && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              {REASON_BY_KEY[entry.reason].label}
            </span>
          )}
        </p>

        {entry.note && (
          <p className="mt-2.5 border-l-2 border-sand pl-3 text-[14px] leading-relaxed text-ink">
            {entry.note}
          </p>
        )}

        <div className="mt-2.5">
          <RespectAction
            count={entry.respect_count}
            active={entry.my_respect}
            onToggle={onRespect}
            disabled={!canRespect || busy}
            size="sm"
          />
        </div>
      </div>
    </article>
  );
}

/** A stance as a mark, not a pill: direction glyph + word, on the lime ramp. */
function StanceMark({
  stance,
  muted = false,
}: {
  stance: (typeof STANCE_META)[keyof typeof STANCE_META];
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
        muted ? "bg-sand text-soft" : stance.chip
      }`}
    >
      <span aria-hidden>{stance.mark}</span>
      {stance.label}
    </span>
  );
}
