"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { deriveRegister } from "@/lib/register";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { TickerTile } from "@/components/canvas2";
import {
  CIRCLE_DAYS,
  listCircles,
  normalizeTicker,
  openCircle,
  timeLeft,
  type CircleListRow,
} from "@/lib/circles";
import { EmptyLine, TextAction } from "@/components/f0/parts";
import {
  BoardCard,
  PresenceLine,
  SectionLabel,
} from "@/app/(dashboard)/community/board";

/* ══════════════════════════════════════════════════════════════════════════
   CIRCLES — the list (canvas v2, App board 16). Route: /circles.

   A Circle is a breakout room around ONE event or ONE thesis, on a hard
   30-day clock. Backed by migration 190 (club_circles / club_circle_members /
   club_circle_notes) — every title, roster count and clock on this screen is a
   real row. Nothing is seeded.

   WHAT THE CANVAS SHOWS THAT WE DO NOT:
     · "1.8K" in a room. Production has a handful of members; the count here is
       whatever the roster actually holds, and a Circle nobody has joined says
       so in words.
     · "graded at month end". Grading a member's calls is a performance claim
       (plan §0.1). A closed Circle keeps its thread as the record — that is the
       receipt, and it is not a scoreboard.
     · Eight saturated topic tiles. The identity object is the TickerTile when a
       Circle is bound to an equity, and the topic word otherwise. One accent,
       per the colour law; the tile field is achromatic by design.

   SCHEMA GATE: migration 190 ships in the same commit but is applied out of
   band. Until it lands, the reads answer "relation does not exist" and this
   surface renders a STATED absence — not an empty room that looks real.
   ══════════════════════════════════════════════════════════════════════════ */

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-10" aria-busy="true">
      <div className="space-y-3">
        <span className="block h-2.5 w-28 animate-pulse rounded bg-sand" />
        <span className="block h-9 w-44 animate-pulse rounded bg-sand" />
        <span className="block h-4 w-80 animate-pulse rounded bg-sand" />
      </div>
      <div className="f0-ledger">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="f0-ledger-row">
            <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-sand" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-40 animate-pulse rounded bg-sand" />
              <span className="block h-2.5 w-28 animate-pulse rounded bg-sand" />
            </span>
            <span className="h-4 w-12 shrink-0 animate-pulse rounded bg-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One Circle as a CARD — the Club's unit, so a Circle sits in the same system
 *  as everything else the member just walked past. The clock is the loudest
 *  thing after the name. */
function CircleRow({ c }: { c: CircleListRow }) {
  const left = timeLeft(c.expires_at);
  return (
    <Link
      href={`/circles/${c.slug}`}
      className="group flex items-center gap-3 rounded-[14px] border border-sand bg-card p-3.5 transition-colors hover:border-gold-300"
    >
      {c.ticker ? (
        <span className="shrink-0 self-center">
          <TickerTile ticker={c.ticker} size="sm" showDelta={false} />
        </span>
      ) : (
        <span
          className="f0-tile-field grid h-11 w-11 shrink-0 place-items-center self-center rounded-[10px] font-display text-[15px] font-black"
          aria-hidden
        >
          {c.topic.slice(0, 1).toUpperCase()}
        </span>
      )}

      <span className="min-w-0 flex-1 self-center">
        <span className="block truncate font-display text-[15px] font-bold text-ink">
          {c.title}
        </span>
        <span className="mt-1 block truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-soft">
          {c.topic} ·{" "}
          {left ? (
            <span className="text-gold-700">{left} left</span>
          ) : (
            <span>clock ran out</span>
          )}{" "}
          · {c.members} in
        </span>
      </span>

      <span className="shrink-0 self-center text-right">
        <span className="block font-mono text-[14px] font-semibold tabular-nums text-ink">
          {c.notes === 0 ? "—" : c.notes.toLocaleString()}
        </span>
        <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
          Notes
        </span>
      </span>
    </Link>
  );
}

/* ── the opener ──────────────────────────────────────────────────────────── */

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

  const field =
    "w-full bg-transparent pb-2 text-[15px] text-ink placeholder:text-soft/70 f0-rule-bottom focus:outline-none focus:border-gold-600";

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

export default function CirclesSurface() {
  const router = useRouter();
  const [rows, setRows] = useState<CircleListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingSchema, setMissingSchema] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isKid, setIsKid] = useState(false);
  const [composing, setComposing] = useState(false);

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
      const { rows: found, missingSchema: gone } = await listCircles(supabase);
      setRows(found);
      setMissingSchema(gone);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton />;

  const now = new Date();
  const open = rows.filter((r) => timeLeft(r.expires_at, now) !== null);
  const closed = rows.filter((r) => timeLeft(r.expires_at, now) === null);

  return (
    <div className="cc-app-screen mx-auto max-w-[760px] space-y-6 px-[18px] pb-20 pt-[18px] sm:rounded-[26px] sm:border sm:border-[#2A2530]">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="script-mark text-[34px] leading-none text-[#F4F0EC]">club</h1>
            <PresenceLine>
              {rows.length > 0
                ? `${rows.length} ${rows.length === 1 ? "Circle" : "Circles"} on the clock`
                : "Breakout rooms, 30 days each"}
            </PresenceLine>
          </div>
          {!isKid && (
            <button type="button" onClick={() => setComposing((value) => !value)} className="rounded-full bg-[#FF7A1A] px-3 py-2 text-[10px] font-bold text-[#0D0B0E]">
              + Start a Circle
            </button>
          )}
        </div>
        <p className="mt-3.5 max-w-[52ch] text-[12.5px] leading-relaxed text-soft">
          Breakout rooms around one event or one thesis. Every Circle runs a
          30-day clock — when it ends the room closes and the thread stands as
          the record.
        </p>
      </div>

      {failed ? (
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
      ) : missingSchema ? (
        /* Stated absence, not a fake room: the tables aren't provisioned here. */
        <EmptyLine
          title="Circles aren't switched on yet"
          body="The room layer hasn't been provisioned on this deployment. As soon as it is, every Circle opened will show up here."
        />
      ) : (
        <>
          {/* ── OPEN ──────────────────────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionLabel
              action={isKid ? undefined : composing ? "Never mind" : "Start a Circle"}
              onAction={() => setComposing((v) => !v)}
            >
              Open now
            </SectionLabel>

            {composing && !isKid && (
              <OpenForm
                onOpened={(slug) => {
                  setComposing(false);
                  router.push(`/circles/${slug}`);
                }}
              />
            )}

            {open.length === 0 ? (
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
            ) : (
              <div className="f0-stagger space-y-3">
                {open.map((c, i) => (
                  <div key={c.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <CircleRow c={c} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── CLOSED ────────────────────────────────────────────────────── */}
          {closed.length > 0 && (
            <section className="space-y-5">
              <SectionLabel>Clock ran out</SectionLabel>
              <div className="space-y-3">
                {closed.map((c) => (
                  <CircleRow key={c.id} c={c} />
                ))}
              </div>
              <p className="text-[13px] leading-relaxed text-soft">
                A closed Circle keeps its thread. Nobody is scored on it — the record is the
                point.
              </p>
            </section>
          )}

          {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionLabel>How a Circle works</SectionLabel>
            <p className="max-w-xl text-[14px] leading-relaxed text-soft">
              One event or one thesis per room, {CIRCLE_DAYS} days on the clock, no extensions.
              Join to post; leave whenever. Your stance inside a Circle belongs to that room&apos;s
              premise — it doesn&apos;t move your standing position on the ticker.
              {isKid
                ? " Circles are a grown-up room: you can read every one of them, but posting stays in your Family Circle."
                : ""}
            </p>
            {/* The canonical community disclaimer, byte-identical. */}
            <p className="max-w-xl text-[12.5px] leading-relaxed text-soft">
              {COMMUNITY_DISCLAIMER}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
