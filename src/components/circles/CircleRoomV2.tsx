"use client";

/**
 * ONE CIRCLE — v2 canvas (Cheat Code App board 23 "INSIDE A CIRCLE"), a re-skin
 * of CircleRoom into the cc token system. Rendered ONLY when designV2Enabled();
 * the v1 body stays byte-identical when the flag is off. Same state machine,
 * same handlers (getCircleRoom / joinCircle / leaveCircle / postCircleNote),
 * same reads — no number is invented and the withheld-split floor is preserved.
 *
 * FIDELITY PASS (board 23 anatomy — a CHAT ROOM, not a card column):
 *   header bar   ← back · 38px conic clock-ring avatar · title 14.5/800 · meta
 *                (⏳ real countdown · N members) · Join/Leave pill — raised bg.
 *   channel      one active "# takes" pill (this room is single-channel).
 *   thesis bar   orange-tint pinned bar: 📌 + "Circle thesis:" + circle.premise
 *                (the schema has no separate pinned field — the pin IS the
 *                premise; nothing fabricated).
 *   presence     belt-ringed roster stack + "N in the room".
 *   stance       compact neutral bear/neutral/bull pills (real split, withheld
 *                under SOCIAL_FLOORS so a tiny split is never surfaced).
 *   thread       COMPACT card-less message rows: 36px belt-ring avatar, name in
 *                belt colour, filled belt chip, mono time, 13px/1.5 body, neutral
 *                stance chip — the board's row anatomy, every field real.
 *   composer     bottom bar (border-top, raised): pill input + orange ➤ send.
 *
 * DELIBERATELY OMITTED (board 23 draws these; no backend exists, so faking them
 * would be a lie — spec §6.7 "omit rather than fake"):
 *   · #charts / #receipts / 🔊 live channels — the room is single-channel.
 *   · "312 online" presence, typing indicators — no realtime layer.
 *   · Kai auto-note ("sentiment +6 pts") — no agent writes into a Circle.
 *   · reaction pills (🔥/🐂 counts), reply-thread quote blocks, chart
 *     attachments — the note schema carries none of these.
 *   · composer attach (+/📈) — no upload wire.
 * And NO score/accuracy: circles are not graded.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { deriveRegister } from "@/lib/register";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { beltForXp } from "@/lib/belts";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import ProfileLink from "@/components/ProfileLink";
import { Kicker, Card, BeltAvatar, BELT_COLORS } from "@/components/cc/ui";
import {
  getCircleRoom,
  joinCircle,
  leaveCircle,
  postCircleNote,
  timeLeft,
  CIRCLE_DAYS,
  type CircleRoom as Room,
  type CirclePerson,
  type CircleStance,
} from "@/lib/circles";

/* ── helpers ───────────────────────────────────────────────────────────────── */

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Orange sweep = fraction of the 30-day clock still left (real, from expires_at). */
function clockPct(expiresAt: string, now = Date.now()): number {
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return 0;
  const total = CIRCLE_DAYS * 86_400_000;
  return Math.max(0, Math.min(100, (ms / total) * 100));
}

/** Board-23 header avatar: a conic clock ring around the ticker/topic initial. */
function ConicAvatar({
  pct,
  size,
  inner,
  dim = false,
}: {
  pct: number;
  size: number;
  inner: ReactNode;
  dim?: boolean;
}) {
  const insetPx = Math.max(2, Math.round(size * 0.05));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${dim ? "var(--cc-dim)" : "var(--cc-orange)"} 0 ${pct}%, var(--cc-line) ${pct}% 100%)`,
        }}
      />
      <div
        className="grid place-items-center rounded-full font-extrabold"
        style={{
          position: "absolute",
          inset: insetPx,
          background: "var(--cc-card2)",
          border: "2px solid var(--cc-card)",
          color: dim ? "var(--cc-dim)" : "var(--cc-ink)",
          fontSize: Math.round(size * 0.4),
          boxSizing: "border-box",
        }}
      >
        {inner}
      </div>
    </div>
  );
}

const STANCE_WORD: Record<CircleStance, string> = {
  bear: "Bearish",
  neutral: "Neutral",
  bull: "Bullish",
};

/** Left → right is the direction axis, exactly as the v1 StanceControl. */
const STANCE_ORDER: CircleStance[] = ["bear", "neutral", "bull"];

function initialsFor(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

/* ── local cc helpers ──────────────────────────────────────────────────────── */

function EmptyNote({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="cc-display text-[16px] font-bold" style={{ color: "var(--cc-ink)" }}>
        {title}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        {body}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

function TextAction({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls = "inline-flex items-center gap-1.5 text-[13px] font-semibold";
  const style = { color: "var(--cc-orange-ink)" };
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

/**
 * cc stance pills — the neutral opinion selector. Direction is carried by LABEL
 * and left→right POSITION, never by hue (a stance is not a quote). The selected
 * pill takes a subtle orange ring; counts are shown only once the room clears
 * SOCIAL_FLOORS.debateStance, so a tiny split is never surfaced as a signal.
 */
function StancePills({
  value,
  onChange,
  counts,
  disabled,
  emptyHint,
}: {
  value: CircleStance | null;
  onChange: (s: CircleStance) => void;
  counts: Record<CircleStance, number>;
  disabled: boolean;
  emptyHint: string | null;
}) {
  const total = STANCE_ORDER.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const showCounts = total >= SOCIAL_FLOORS.debateStance;
  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Your stance in this Circle">
        {STANCE_ORDER.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(s)}
              className="flex-1 rounded-xl px-3 py-2 text-center transition-colors disabled:cursor-default"
              style={{
                background: "var(--cc-card)",
                border: active ? "1.5px solid var(--cc-orange)" : "1px solid var(--cc-line)",
                boxShadow: active ? "var(--cc-halo-soft)" : undefined,
                opacity: disabled && !active ? 0.6 : 1,
              }}
            >
              <span
                className="block text-[12.5px] font-bold"
                style={{ color: active ? "var(--cc-orange-ink)" : "var(--cc-ink)" }}
              >
                {STANCE_WORD[s]}
              </span>
              {showCounts && (
                <span
                  className="mt-0.5 block font-[family-name:var(--font-plex-mono)] text-[11px] tabular-nums"
                  style={{ color: "var(--cc-dim)" }}
                >
                  {counts[s] ?? 0}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {emptyHint && !value && (
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {emptyHint}
        </p>
      )}
    </div>
  );
}

/* ── skeleton ──────────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-4" aria-busy="true">
      <div
        className="flex items-center gap-3 rounded-2xl border p-4"
        style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
      >
        <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: "var(--cc-card2)" }} />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="block h-3.5 w-40 rounded" style={{ background: "var(--cc-card2)" }} />
          <span className="block h-2.5 w-32 rounded" style={{ background: "var(--cc-card2)" }} />
        </span>
      </div>
      <div className="mt-6 space-y-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: "var(--cc-card2)" }} />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3 w-32 rounded" style={{ background: "var(--cc-card2)" }} />
              <span className="block h-2.5 w-full rounded" style={{ background: "var(--cc-card2)" }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── surface ─────────────────────────────────────────────────────────────── */

export default function CircleRoomV2({ slug }: { slug: string }) {
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
      className="inline-flex items-center gap-1.5 text-[13px] font-bold transition-colors"
      style={{ color: "var(--cc-soft)" }}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Circles
    </Link>
  );

  const shell = "mx-auto max-w-2xl px-4";

  if (failed) {
    return (
      <div className={`${shell} space-y-6 py-10`}>
        {back}
        <EmptyNote
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
      <div className={`${shell} space-y-6 py-10`}>
        {back}
        <EmptyNote
          title="Circles aren't switched on yet"
          body="The room layer hasn't been provisioned on this deployment."
        />
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className={`${shell} space-y-6 py-10`}>
        {back}
        <EmptyNote
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
  const headInitial = (circle.ticker ?? circle.topic).slice(0, 1).toUpperCase();

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

  const membershipAction = closed || isKid ? null : busy ? "…" : joined ? "Leave" : "Join";

  return (
    <div className={`${shell} pb-16 pt-4`}>
      {/* ── HEADER BAR — raised, board-23 chrome ──────────────────────────── */}
      <div
        className="rounded-2xl border p-3.5"
        style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/circles"
            aria-label="Back to Circles"
            className="shrink-0"
            style={{ color: "var(--cc-soft)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ConicAvatar
            pct={closed ? 0 : clockPct(circle.expires_at)}
            size={38}
            inner={headInitial}
            dim={closed}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-extrabold" style={{ color: "var(--cc-ink)" }}>
              {circle.title}
            </div>
            <div className="mt-px truncate text-[9.5px]" style={{ color: "var(--cc-soft)" }}>
              {closed ? (
                <span className="font-[family-name:var(--font-plex-mono)]" style={{ color: "var(--cc-dim)" }}>
                  clock ran out{" "}
                  {new Date(circle.expires_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : (
                <span className="font-[family-name:var(--font-plex-mono)]" style={{ color: "var(--cc-orange-ink)" }}>
                  ⏳ {left}
                </span>
              )}{" "}
              · {roster.length.toLocaleString()} {roster.length === 1 ? "member" : "members"}
            </div>
          </div>
          {membershipAction && (
            <button
              type="button"
              onClick={toggleMembership}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors"
              style={
                joined
                  ? {
                      background: "var(--cc-card2)",
                      border: "1px solid var(--cc-line)",
                      color: "var(--cc-soft)",
                    }
                  : { background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }
              }
            >
              {membershipAction}
            </button>
          )}
        </div>

        {/* channel — single active # takes (this room is single-channel) */}
        <div className="mt-3 flex gap-1.5">
          <span
            className="rounded-[14px] px-3 py-[5px] text-[10.5px] font-extrabold"
            style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
          >
            # takes
          </span>
        </div>
      </div>

      {/* ── PINNED THESIS BAR — the premise IS the pin (nothing fabricated) ── */}
      <div
        className="mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "color-mix(in srgb, var(--cc-orange) 8%, transparent)" }}
      >
        <span aria-hidden className="text-[11px] leading-5">
          📌
        </span>
        <p className="flex-1 text-[10.5px] leading-[1.5]" style={{ color: "var(--cc-soft)" }}>
          <strong style={{ color: "var(--cc-orange-ink)" }}>Circle thesis:</strong>{" "}
          <span style={{ color: "var(--cc-ink)" }}>{circle.premise}</span>
        </p>
      </div>

      {/* ── IN THE ROOM (presence stack) ──────────────────────────────────── */}
      {roster.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex -space-x-2">
            {roster.slice(0, 8).map((p: CirclePerson) => (
              <span key={p.id} style={{ boxShadow: "0 0 0 2px var(--cc-bg)" }} className="rounded-full">
                <BeltAvatar
                  initials={initialsFor(p.display_name)}
                  belt={beltForXp(p.xp).belt.key}
                  size={30}
                />
              </span>
            ))}
          </span>
          <span
            className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "var(--cc-soft)" }}
          >
            {roster.length} in the room
            {roster.length > 8 ? " · showing 8" : ""}
          </span>
        </div>
      )}

      {/* ── WHERE THE ROOM STANDS (stance) ────────────────────────────────── */}
      <section className="mt-5 space-y-3">
        <Kicker tone="soft">Where the room stands</Kicker>
        <StancePills
          value={stance}
          onChange={(s) => setStance(s)}
          counts={split}
          disabled={!canPost}
          emptyHint={
            canPost
              ? "Pick a stance for this room's premise. It stays here — it doesn't move your standing position on the ticker."
              : null
          }
        />
      </section>

      {/* ── THE THREAD — compact, card-less message rows ──────────────────── */}
      <section className="mt-7 space-y-4">
        <Kicker tone="soft">The thread</Kicker>
        {notes.length === 0 ? (
          <EmptyNote
            title="Nothing said yet"
            body={
              canPost
                ? "The premise is pinned up top. Say the first thing and the room has somewhere to start."
                : "No member has written in this Circle."
            }
          />
        ) : (
          <div className="flex flex-col gap-[14px]">
            {notes.map((n) => {
              const xp = n.author?.xp ?? 0;
              const rank = beltForXp(xp);
              const beltKey = rank.belt.key;
              const beltColor = BELT_COLORS[beltKey] ?? BELT_COLORS.white;
              return (
                <div key={n.id} className="flex gap-2.5">
                  <span className="shrink-0">
                    <BeltAvatar
                      initials={initialsFor(n.author?.display_name)}
                      belt={beltKey}
                      size={36}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      <ProfileLink
                        username={n.author?.username ?? null}
                        className="max-w-[10rem] truncate text-[12.5px] font-bold"
                      >
                        <span style={{ color: beltColor }}>
                          {n.author?.display_name || "Member"}
                        </span>
                      </ProfileLink>
                      <span
                        className="rounded-[3px] px-1 py-px font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase"
                        style={{ background: beltColor, color: "var(--cc-orange-deep)" }}
                      >
                        {rank.short}
                      </span>
                      {n.stance && (
                        <span
                          className="rounded-[3px] px-1 py-px font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase"
                          style={{
                            background: "var(--cc-card2)",
                            border: "1px solid var(--cc-line)",
                            color: "var(--cc-soft)",
                          }}
                        >
                          {STANCE_WORD[n.stance]}
                        </span>
                      )}
                      <span
                        className="font-[family-name:var(--font-plex-mono)] text-[9px]"
                        style={{ color: "var(--cc-dim)" }}
                      >
                        {when(n.created_at)}
                      </span>
                    </div>
                    <p
                      className="mt-[3px] whitespace-pre-wrap text-[13px] leading-[1.5]"
                      style={{ color: "var(--cc-ink)" }}
                    >
                      {n.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── COMPOSER BAR — pill input + orange send ➤ (real post wire) ────── */}
      {canPost && (
        <div
          className="mt-7 rounded-2xl border p-3"
          style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
        >
          <div className="flex items-end gap-2.5">
            <textarea
              value={body}
              maxLength={2000}
              rows={1}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message # takes"
              className="min-h-[40px] flex-1 resize-none rounded-[20px] px-3.5 py-2.5 text-[12.5px] leading-relaxed focus:outline-none"
              style={{
                background: "var(--cc-card2)",
                border: "1px solid var(--cc-line)",
                color: "var(--cc-ink)",
              }}
            />
            <button
              type="button"
              onClick={submitNote}
              disabled={!ready || busy}
              aria-label={busy ? "Posting" : "Post to the Circle"}
              className="cc-halo grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-extrabold disabled:opacity-45"
              style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
            >
              {busy ? "…" : "➤"}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 pl-1">
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums"
              style={{ color: "var(--cc-soft)" }}
            >
              {body.trim().length}/2000
            </span>
            {postError && (
              <span className="text-[11px] leading-snug" style={{ color: "var(--cc-down)" }}>
                {postError}
              </span>
            )}
          </div>
        </div>
      )}

      {!canPost && !closed && !isKid && !joined && (
        <p className="mt-6 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          Join the Circle to add to the thread. Reading is open to every member.
        </p>
      )}
      {isKid && (
        <p className="mt-6 text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          You can read every Circle in the Club. Posting stays in your Family Circle.
        </p>
      )}

      {/* The canonical community disclaimer, byte-identical. */}
      <p
        className="mt-8 max-w-xl pt-5 text-[12.5px] leading-relaxed"
        style={{ borderTop: "1px solid var(--cc-line)", color: "var(--cc-soft)" }}
      >
        {COMMUNITY_DISCLAIMER}
      </p>
    </div>
  );
}
