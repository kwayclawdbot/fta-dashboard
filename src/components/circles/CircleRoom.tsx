"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { deriveRegister } from "@/lib/register";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import ProfileLink from "@/components/ProfileLink";
import { StanceControl, TickerTile } from "@/components/canvas2";
import {
  getCircleRoom,
  joinCircle,
  leaveCircle,
  postCircleNote,
  timeLeft,
  type CircleRoom as Room,
  type CircleStance,
} from "@/lib/circles";
import { EmptyLine, TextAction } from "@/components/f0/parts";
import {
  BoardCard,
  BoardMasthead,
  SectionLabel,
} from "@/app/(dashboard)/community/board";

/* ══════════════════════════════════════════════════════════════════════════
   ONE CIRCLE — the room (canvas v2, App board 16 → detail). /circles/[slug].

   The room is: a premise, a clock, a roster, and a thread. Join to post, leave
   whenever, and when the clock runs out the room goes read-only with its thread
   intact. Every row is a real read of migration 190's tables.

   NO SCORE. The canvas grades a room's calls at month end. We publish neither
   accuracy nor a win rate (plan §0.1) — what the room reports is PARTICIPATION
   (who is in it, how much they wrote) and CONVICTION (the bear/neutral/bull
   split, one position per member, withheld under the social floor so a 1–0–1
   "split" is never dressed up as a signal).

   COLOUR: the stance rail is lime (community sentiment) via L0's StanceControl;
   the clock and the post action are orange (brand + action). No price colour
   appears here — the room holds opinions, not quotes.
   ══════════════════════════════════════════════════════════════════════════ */

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-9" aria-busy="true">
      <span className="block h-2.5 w-24 animate-pulse rounded bg-sand" />
      <span className="block h-9 w-64 animate-pulse rounded bg-sand" />
      <span className="block h-16 w-full animate-pulse rounded bg-sand" />
      <div className="f0-ledger">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="f0-ledger-row">
            <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-sand" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-32 animate-pulse rounded bg-sand" />
              <span className="block h-2.5 w-full animate-pulse rounded bg-sand" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STANCE_WORD: Record<CircleStance, string> = {
  bear: "Bearish",
  neutral: "Neutral",
  bull: "Bullish",
};

export default function CircleRoomSurface({ slug }: { slug: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingSchema, setMissingSchema] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isKid, setIsKid] = useState(false);

  const [stance, setStance] = useState<CircleStance | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, age_group, track")
          .eq("id", user.id)
          .maybeSingle();
        setIsKid(deriveRegister(profile ?? {}) === "kid");
      }
      const { room: found, missingSchema: gone } = await getCircleRoom(supabase, slug);
      setRoom(found);
      setMissingSchema(gone);
      setNotFound(!gone && !found);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton />;

  const back = (
    <Link
      href="/circles"
      className="f0-focus inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Circles
    </Link>
  );

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10">
        {back}
        <EmptyLine
          title="This Circle didn't load"
          body="Something hiccuped on our end. Nothing was lost — give it another go."
          action={
            <TextAction
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </TextAction>
          }
        />
      </div>
    );
  }

  if (missingSchema) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10">
        {back}
        <EmptyLine
          title="Circles aren't switched on yet"
          body="The room layer hasn't been provisioned on this deployment."
        />
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10">
        {back}
        <EmptyLine
          title="No Circle here"
          body="This room either never existed or was never opened under that name."
          action={<TextAction href="/circles">See what is open</TextAction>}
        />
      </div>
    );
  }

  const { circle, roster, notes, split, joined } = room;
  const left = timeLeft(circle.expires_at);
  const closed = left === null;
  const canPost = joined && !closed && !isKid;
  const ready = body.trim().length > 0;

  async function toggleMembership() {
    if (busy || closed || isKid || !room) return;
    setBusy(true);
    const supabase = createClient();
    const ok = joined
      ? await leaveCircle(supabase, room.circle.id)
      : await joinCircle(supabase, room.circle.id);
    setBusy(false);
    if (ok) await load();
  }

  async function submitNote() {
    if (!ready || busy || !room) return;
    setBusy(true);
    setPostError(null);
    const supabase = createClient();
    const ok = await postCircleNote(supabase, room.circle.id, body, stance);
    setBusy(false);
    if (!ok) {
      setPostError("That note didn't post. Check you're still in the Circle and try again.");
      return;
    }
    setBody("");
    await load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-9 pb-16">
      {back}

      {/* ── THE PREMISE ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-start gap-4">
          {circle.ticker && (
            <span className="shrink-0">
              <TickerTile ticker={circle.ticker} size="md" showDelta={false} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold-700">
              {circle.topic}
            </p>
            <div className="mt-2">
              <BoardMasthead title={circle.title} />
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink">{circle.premise}</p>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
          {closed ? (
            <>
              Clock ran out{" "}
              {new Date(circle.expires_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              · thread stands as the record
            </>
          ) : (
            <>
              <span className="text-gold-700">{left} left</span> on the clock · no extensions
            </>
          )}
        </p>
      </section>

      {/* ── THE ROOM ─────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionLabel
          action={closed || isKid ? undefined : busy ? "…" : joined ? "Leave" : "Join this Circle"}
          onAction={toggleMembership}
        >
          In the room
        </SectionLabel>

        {roster.length === 0 ? (
          <EmptyLine
            title="Nobody is standing here yet"
            body={
              isKid
                ? "When members join, you'll see them here."
                : "Be the first in. A Circle with one member is still a Circle — it just needs someone to say the first thing."
            }
          />
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* --f0-stack-ring already defaults to --paper, which is the
                surface behind this stack. */}
            <span className="f0-stack">
              {roster.slice(0, 8).map((p) => (
                <Avatar
                  key={p.id}
                  name={p.display_name}
                  avatarUrl={p.avatar_url}
                  xp={p.xp}
                  size="md"
                />
              ))}
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
              {roster.length} in the room
              {roster.length > 8 ? ` · showing 8` : ""}
            </p>
          </div>
        )}
      </section>

      {/* ── WHERE THE ROOM STANDS ────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel>Where the room stands</SectionLabel>
        <StanceControl
          value={stance}
          onChange={(s) => setStance(s)}
          counts={split}
          disabled={!canPost}
          ariaLabel={`Your stance in ${circle.title}`}
          emptyHint={
            canPost
              ? "Pick a stance for this room's premise. It stays here — it doesn't move your standing position on the ticker."
              : null
          }
        />
      </section>

      {/* ── YOUR NOTE ────────────────────────────────────────────────────── */}
      {canPost && (
        <section className="space-y-4">
          <SectionLabel>Add to the thread</SectionLabel>
          <textarea
            value={body}
            maxLength={2000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What do you actually think, and what would change your mind?"
            className="f0-focus f0-rule-bottom w-full resize-none bg-transparent pb-2 text-[15px] leading-relaxed text-ink placeholder:text-soft/70 focus:outline-none focus:border-gold-600"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] tabular-nums text-soft">
              {body.trim().length}/2000
            </p>
            <button
              type="button"
              onClick={submitNote}
              disabled={!ready || busy}
              className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2 font-display text-[14px] font-bold uppercase tracking-[0.08em] text-night-950 disabled:opacity-45"
            >
              {busy ? "Posting…" : "Post to the Circle"}
            </button>
          </div>
          {postError && <p className="text-[13px] leading-snug text-ink">{postError}</p>}
        </section>
      )}

      {!canPost && !closed && !isKid && !joined && (
        <p className="text-[13px] leading-relaxed text-soft">
          Join the Circle to add to the thread. Reading is open to every member.
        </p>
      )}
      {isKid && (
        <p className="text-[13px] leading-relaxed text-soft">
          You can read every Circle in the Club. Posting stays in your Family Circle.
        </p>
      )}

      {/* ── THE THREAD ───────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionLabel>The thread</SectionLabel>
        {notes.length === 0 ? (
          <EmptyLine
            title="Nothing said yet"
            body={
              canPost
                ? "The premise is up there. Say the first thing and the room has somewhere to start."
                : "No member has written in this Circle."
            }
          />
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <BoardCard key={n.id} className="flex items-start gap-3">
                <span className="shrink-0 self-start pt-0.5">
                  <Avatar
                    name={n.author?.display_name}
                    avatarUrl={n.author?.avatar_url}
                    xp={n.author?.xp ?? 0}
                    size="md"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <ProfileLink
                      username={n.author?.username ?? null}
                      className="max-w-[10rem] truncate font-display text-[14px] font-bold text-ink"
                    >
                      {n.author?.display_name || "Member"}
                    </ProfileLink>
                    <BeltBadge rank={beltForXp(n.author?.xp ?? 0)} size="xs" />
                    {n.stance && (
                      <span className="bg-sentiment-soft rounded px-1.5 py-px font-display text-[10px] font-bold uppercase tracking-[0.1em] text-sentiment">
                        {STANCE_WORD[n.stance]}
                      </span>
                    )}
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-soft">
                      {when(n.created_at)}
                    </span>
                  </span>
                  <span className="mt-1.5 block whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                    {n.body}
                  </span>
                </span>
              </BoardCard>
            ))}
          </div>
        )}
      </section>

      {/* The canonical community disclaimer, byte-identical. */}
      <p className="f0-rule-top max-w-xl pt-5 text-[12.5px] leading-relaxed text-soft">
        {COMMUNITY_DISCLAIMER}
      </p>
    </div>
  );
}
