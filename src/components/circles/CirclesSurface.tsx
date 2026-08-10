"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { deriveRegister } from "@/lib/register";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { TickerTile } from "@/components/canvas2";
import {
  CIRCLE_DAYS,
  joinCircle,
  listCircles,
  normalizeTicker,
  openCircle,
  timeLeft,
  type CircleListRow,
} from "@/lib/circles";
import Avatar from "@/components/Avatar";
import { EmptyLine, TextAction } from "@/components/f0/parts";
import { BoardCard, TickerMark } from "@/app/(dashboard)/community/board";
import { CircleRing } from "@/app/(dashboard)/community/ClubCommunityScreen";
import { useAppMode } from "@/lib/useAppMode";

/* ══════════════════════════════════════════════════════════════════════════
   CIRCLES — the list. Route: /circles. CLUB-TERMINAL-STYLE law, built to the
   owner's Aug-7 mockup board's CIRCLES phone, object for object:

     · header: CIRCLES (white bold caps) + violet "Create Circle" on the right
       (the violet action is --kai-blue; kids never see it — opening a Circle
       stays an adult act, exactly as before).
     · the NEON RING ROW — the same segmented conic rings the club COMMUNITY
       screen draws (imported from ClubCommunityScreen, one component, one
       drawing), each carrying a REAL open Circle: its ticker mark or initial,
       its name, and the live countdown ("8d left"). No open Circle → no row.
     · ACTIVE · LIVE NOW · JOINED tabs with the violet 2px underline.
         Active   — every room with the clock still running.
         Live Now — rooms with a note posted in the last 24 hours (a real read
                    of club_circle_notes; the mockup's presence badge has no
                    presence source, so recent thread activity is the honest
                    signal we do have — stated adaptation).
         Joined   — rooms this member's own club_circle_members row is in.
     · LEDGER ROWS in the mockup's anatomy: logo tile · name · "N members"
       activity line · the real member-avatar cluster · mono countdown ·
       violet Join pill · chevron. Every count and every face is a real row;
       the mockup's "Very active" grades are replaced by the measured thread
       reading ("N notes" / "active today") and omitted when there is none.

   EVERYTHING KEPT: the OpenForm (now behind "Create Circle"), the kid
   read-only wall, the missing-schema stated absence, the failed-load retry,
   the closed-rooms record, the how-it-works copy and the canonical community
   disclaimer, byte-identical. Joining from a row writes through the same
   joinCircle() the room screen uses — same table, same RLS.
   ══════════════════════════════════════════════════════════════════════════ */

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl" aria-busy="true">
      <div className="flex items-center justify-between">
        <span className="block h-4 w-24 animate-pulse rounded bg-sand" />
        <span className="block h-4 w-20 animate-pulse rounded bg-sand" />
      </div>
      <div className="mt-6 flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="h-[64px] w-[64px] shrink-0 animate-pulse rounded-full bg-sand" />
        ))}
      </div>
      <div className="mt-7 flex gap-6">
        <span className="block h-3.5 w-14 animate-pulse rounded bg-sand" />
        <span className="block h-3.5 w-16 animate-pulse rounded bg-sand/70" />
        <span className="block h-3.5 w-14 animate-pulse rounded bg-sand/70" />
      </div>
      <div className="mt-4 divide-y divide-sand/70">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-4">
            <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-sand" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-40 animate-pulse rounded bg-sand" />
              <span className="block h-2.5 w-28 animate-pulse rounded bg-sand/70" />
            </span>
            <span className="h-7 w-14 shrink-0 animate-pulse rounded-full bg-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── one member face on a row's cluster ──────────────────────────────────── */

interface Face {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/* ── one Circle as the mockup's ledger row ───────────────────────────────── */

function CircleLedgerRow({
  c,
  faces,
  joined,
  liveToday,
  canJoin,
  joinBusy,
  onJoin,
}: {
  c: CircleListRow;
  faces: Face[];
  joined: boolean;
  liveToday: boolean;
  canJoin: boolean;
  joinBusy: boolean;
  onJoin: () => void;
}) {
  const left = timeLeft(c.expires_at);
  const closed = left === null;
  return (
    <div className="flex items-center gap-3 py-3.5">
      {/* identity tile + name + the measured activity line — the row's door */}
      <Link
        href={`/circles/${c.slug}`}
        className="f0-focus flex min-w-0 flex-1 items-center gap-3 rounded-lg"
      >
        {c.ticker ? (
          <span className="shrink-0">
            <TickerTile ticker={c.ticker} size="sm" showDelta={false} />
          </span>
        ) : (
          <span
            className="f0-tile-field grid h-11 w-11 shrink-0 place-items-center rounded-[10px] font-display text-[15px] font-black"
            aria-hidden
          >
            {c.topic.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-semibold text-ink">
            {c.title}
          </span>
          <span className="mt-1 block truncate text-[11.5px] text-soft">
            {c.members === 1 ? "1 member" : `${c.members.toLocaleString()} members`}
            {c.notes > 0 && (
              <> · {c.notes === 1 ? "1 note" : `${c.notes.toLocaleString()} notes`}</>
            )}
            {liveToday && <span className="text-sentiment"> · active today</span>}
            {closed && <> · clock ran out</>}
          </span>
        </span>
      </Link>

      {/* the real member faces — no roster read, no cluster */}
      {faces.length > 0 && (
        <span className="f0-stack hidden shrink-0 sm:flex" aria-hidden>
          {faces.slice(0, 4).map((f) => (
            <Avatar key={f.id} name={f.display_name} avatarUrl={f.avatar_url} size="xs" />
          ))}
        </span>
      )}

      {/* the clock, mono */}
      {left && (
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-soft">
          {left} left
        </span>
      )}

      {/* the violet Join pill — the same write the room screen makes */}
      {joined ? (
        <span className="shrink-0 rounded-full border border-sand px-3.5 py-1.5 font-display text-[11.5px] font-bold text-soft">
          In
        </span>
      ) : (
        canJoin &&
        !closed && (
          <button
            type="button"
            onClick={onJoin}
            disabled={joinBusy}
            className="f0-focus f0-press shrink-0 rounded-full bg-kai-blue-soft px-4 py-1.5 font-display text-[12px] font-bold text-kai-blue transition-opacity disabled:opacity-50"
          >
            {joinBusy ? "…" : "Join"}
          </button>
        )
      )}

      <Link
        href={`/circles/${c.slug}`}
        aria-label={`Open ${c.title}`}
        className="f0-focus shrink-0 rounded-full text-soft/70 transition-colors hover:text-ink"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/* ── the opener (unchanged form, now behind "Create Circle") ─────────────── */

function OpenForm({ onOpened }: { onOpened: (slug: string) => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [ticker, setTicker] = useState("");
  const [premise, setPremise] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    title.trim().length >= 3 && topic.trim().length >= 2 && premise.trim().length >= 10;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { slug, error: err } = await openCircle(supabase, {
      title,
      topic,
      premise,
      ticker: ticker ? normalizeTicker(ticker) : null,
    });
    setBusy(false);
    if (err || !slug) {
      setError(err ?? "That Circle didn't open.");
      return;
    }
    onOpened(slug);
  }

  // CLUB-TERMINAL-STYLE sweep 2026-08-10: the club render gets a raised-well
  // input (rounded card well, accent focus) instead of the legacy gold-hover
  // underline; the family string below is byte-identical.
  const isClub = useAppMode() === "club";
  const field = isClub
    ? "w-full rounded-[10px] border border-sand bg-card px-3 py-2 text-[15px] text-ink placeholder:text-soft/70 focus:outline-none focus:border-accent"
    : "w-full bg-transparent pb-2 text-[15px] text-ink placeholder:text-soft/70 f0-rule-bottom focus:outline-none focus:border-gold-600";

  return (
    <BoardCard className="space-y-6">
      <div>
        <label
          htmlFor="circle-title"
          className="text-eyebrow font-display font-bold uppercase text-soft"
        >
          What is it about
        </label>
        <input
          id="circle-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nvidia earnings"
          className={`f0-focus mt-2 ${field}`}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="min-w-[9rem] flex-1">
          <label
            htmlFor="circle-topic"
            className="text-eyebrow font-display font-bold uppercase text-soft"
          >
            Topic
          </label>
          <input
            id="circle-topic"
            value={topic}
            maxLength={24}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Semis"
            className={`f0-focus mt-2 ${field}`}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <label
            htmlFor="circle-ticker"
            className="text-eyebrow font-display font-bold uppercase text-soft"
          >
            Ticker (optional)
          </label>
          <input
            id="circle-ticker"
            value={ticker}
            maxLength={11}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="NVDA"
            className={`f0-focus mt-2 font-mono ${field}`}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="circle-premise"
          className="text-eyebrow font-display font-bold uppercase text-soft"
        >
          The premise
        </label>
        <textarea
          id="circle-premise"
          value={premise}
          maxLength={280}
          rows={3}
          onChange={(e) => setPremise(e.target.value)}
          placeholder="One line the room exists to argue about."
          className={`f0-focus mt-2 resize-none ${field}`}
        />
        <p className="mt-2 text-[12px] text-soft">
          {premise.trim().length}/280 · the clock starts at {CIRCLE_DAYS} days and cannot be
          extended.
        </p>
      </div>

      {error && <p className="text-[13px] leading-snug text-ink">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || busy}
        className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2 font-display text-[14px] font-bold uppercase tracking-[0.08em] text-night-950 disabled:opacity-45"
      >
        {busy ? "Opening…" : "Open the Circle"}
      </button>
    </BoardCard>
  );
}

/* ── surface ─────────────────────────────────────────────────────────────── */

type CirclesTab = "active" | "live" | "joined";

const TABS: { id: CirclesTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "live", label: "Live Now" },
  { id: "joined", label: "Joined" },
];

export default function CirclesSurface() {
  const router = useRouter();
  const [rows, setRows] = useState<CircleListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingSchema, setMissingSchema] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isKid, setIsKid] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<CirclesTab>("active");

  const [myJoined, setMyJoined] = useState<Set<string>>(() => new Set());
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set());
  const [facesByCircle, setFacesByCircle] = useState<Record<string, Face[]>>({});
  const [joinBusy, setJoinBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meId = user?.id ?? null;
      setSignedIn(!!user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, age_group, track")
          .eq("id", user.id)
          .maybeSingle();
        setIsKid(deriveRegister(profile ?? {}) === "kid");
      }
      const { rows: found, missingSchema: gone } = await listCircles(supabase);
      setRows(found);
      setMissingSchema(gone);

      // The row anatomy's real signals — memberships (faces + Joined tab) and
      // the last day of thread activity (Live Now). Each degrades to absence:
      // a failed read renders no cluster and an honest empty tab, never a
      // fabricated face or count.
      if (found.length > 0) {
        try {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const [memsRes, notesRes] = await Promise.all([
            supabase
              .from("club_circle_members")
              .select("circle_id, member_id, joined_at")
              .order("joined_at", { ascending: true })
              .limit(400),
            supabase
              .from("club_circle_notes")
              .select("circle_id")
              .gte("created_at", dayAgo)
              .limit(400),
          ]);
          const mems = (memsRes.data ?? []) as {
            circle_id: string;
            member_id: string;
          }[];
          setLiveIds(
            new Set(
              ((notesRes.data ?? []) as { circle_id: string }[]).map((n) => n.circle_id)
            )
          );
          setMyJoined(
            new Set(mems.filter((m) => m.member_id === meId).map((m) => m.circle_id))
          );

          const perCircle = new Map<string, string[]>();
          for (const m of mems) {
            const list = perCircle.get(m.circle_id) ?? [];
            if (list.length < 5) {
              list.push(m.member_id);
              perCircle.set(m.circle_id, list);
            }
          }
          const wanted = [...new Set([...perCircle.values()].flat())].slice(0, 60);
          if (wanted.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", wanted);
            const byId = new Map<string, Face>();
            for (const p of (profs ?? []) as Face[]) byId.set(p.id, p);
            const map: Record<string, Face[]> = {};
            for (const [cid, ids] of perCircle) {
              map[cid] = ids
                .map((id) => byId.get(id))
                .filter((f): f is Face => !!f);
            }
            setFacesByCircle(map);
          }
        } catch {
          /* faces + tabs degrade to absence */
        }
      }
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(c: CircleListRow) {
    if (isKid || joinBusy || myJoined.has(c.id)) return;
    setJoinBusy(c.id);
    const ok = await joinCircle(createClient(), c.id);
    setJoinBusy(null);
    if (ok) {
      setMyJoined((prev) => new Set(prev).add(c.id));
      setRows((prev) =>
        prev.map((r) => (r.id === c.id ? { ...r, members: r.members + 1 } : r))
      );
    }
  }

  const now = new Date();
  const open = useMemo(
    () => rows.filter((r) => timeLeft(r.expires_at, now) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );
  const closed = useMemo(
    () => rows.filter((r) => timeLeft(r.expires_at, now) === null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  const shown = useMemo(() => {
    if (tab === "live") return open.filter((r) => liveIds.has(r.id));
    if (tab === "joined") return rows.filter((r) => myJoined.has(r.id));
    return open;
  }, [tab, open, rows, liveIds, myJoined]);

  if (loading) return <Skeleton />;

  const canJoin = signedIn && !isKid;

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* ── the mockup's header: CIRCLES + the violet Create Circle ──────── */}
      <header className="flex h-9 items-center justify-between">
        <h1 className="font-display text-[15px] font-black uppercase tracking-[0.24em] text-ink">
          Circles
        </h1>
        {!isKid && !missingSchema && !failed && (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="f0-focus font-display text-[13px] font-bold text-kai-blue transition-opacity hover:opacity-80"
          >
            {composing ? "Never mind" : "Create Circle"}
          </button>
        )}
      </header>

      {failed ? (
        <div className="mt-8">
          <EmptyLine
            title="Circles didn't load"
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
      ) : missingSchema ? (
        /* Stated absence, not a fake room: the tables aren't provisioned here. */
        <div className="mt-8">
          <EmptyLine
            title="Circles aren't switched on yet"
            body="The room layer hasn't been provisioned on this deployment. As soon as it is, every Circle opened will show up here."
          />
        </div>
      ) : (
        <>
          {composing && !isKid && (
            <div className="mt-5">
              <OpenForm
                onOpened={(slug) => {
                  setComposing(false);
                  router.push(`/circles/${slug}`);
                }}
              />
            </div>
          )}

          {/* ── the neon ring row — every open Circle, soonest clock first ── */}
          {open.length > 0 && (
            <div className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {open.slice(0, 12).map((c, i) => {
                const left = timeLeft(c.expires_at);
                return (
                  <CircleRing
                    key={c.id}
                    index={i}
                    title={c.ticker ?? c.title}
                    sub={left ? `${left} left` : "closing"}
                    href={`/circles/${c.slug}`}
                    face={
                      c.ticker ? (
                        <TickerMark ticker={c.ticker} size={40} radius={20} />
                      ) : (
                        <span className="font-display text-[15px] font-black uppercase text-ink">
                          {c.title.slice(0, 1)}
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          )}

          {/* ── Active · Live Now · Joined — the violet underline tabs ────── */}
          <div
            role="tablist"
            aria-label="Circles"
            className="mt-6 flex gap-7 border-b border-sand"
          >
            {TABS.map((t) => {
              const on = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={`f0-focus relative pb-2.5 font-display text-[14px] transition-colors ${
                    on ? "font-bold text-kai-blue" : "font-semibold text-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                  {on && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-kai-blue"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── the ledger ─────────────────────────────────────────────────── */}
          {shown.length === 0 ? (
            <div className="mt-6">
              {tab === "live" ? (
                <EmptyLine
                  title="No room is live right now"
                  body="A Circle shows up here the moment someone posts to its thread — activity in the last 24 hours counts as live."
                />
              ) : tab === "joined" ? (
                <EmptyLine
                  title="You haven't joined a Circle"
                  body={
                    isKid
                      ? "You can read every Circle in the Club. Posting stays in your Family Circle."
                      : "Join a room from the list and it lives here. Reading is open to every member either way."
                  }
                />
              ) : (
                <EmptyLine
                  title="No Circle is open"
                  body={
                    isKid
                      ? "Nobody in the Club has opened a room yet. When a grown-up in the Club starts one, you'll be able to read along here."
                      : "Nobody has opened a room yet — which means the first one is yours. Pick one event or one thesis, put 30 days on it, and see who stands with you."
                  }
                  action={
                    isKid ? undefined : (
                      <TextAction onClick={() => setComposing(true)}>
                        Start the first Circle
                      </TextAction>
                    )
                  }
                />
              )}
            </div>
          ) : (
            <div className="mt-1 divide-y divide-sand/70">
              {shown.map((c) => (
                <CircleLedgerRow
                  key={c.id}
                  c={c}
                  faces={facesByCircle[c.id] ?? []}
                  joined={myJoined.has(c.id)}
                  liveToday={liveIds.has(c.id)}
                  canJoin={canJoin}
                  joinBusy={joinBusy === c.id}
                  onJoin={() => void join(c)}
                />
              ))}
            </div>
          )}

          {/* ── CLOSED — the record stands ─────────────────────────────────── */}
          {tab === "active" && closed.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
                Clock ran out
              </h2>
              <div className="mt-2 divide-y divide-sand/70">
                {closed.map((c) => (
                  <CircleLedgerRow
                    key={c.id}
                    c={c}
                    faces={facesByCircle[c.id] ?? []}
                    joined={myJoined.has(c.id)}
                    liveToday={false}
                    canJoin={false}
                    joinBusy={false}
                    onJoin={() => {}}
                  />
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-soft">
                A closed Circle keeps its thread. Nobody is scored on it — the record is the
                point.
              </p>
            </section>
          )}

          {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
          <section className="mt-10">
            <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              How a Circle works
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-soft">
              One event or one thesis per room, {CIRCLE_DAYS} days on the clock, no extensions.
              Join to post; leave whenever. Your stance inside a Circle belongs to that room&apos;s
              premise — it doesn&apos;t move your standing position on the ticker.
              {isKid
                ? " Circles are a grown-up room: you can read every one of them, but posting stays in your Family Circle."
                : ""}
            </p>
            {/* The canonical community disclaimer, byte-identical. */}
            <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-soft">
              {COMMUNITY_DISCLAIMER}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
