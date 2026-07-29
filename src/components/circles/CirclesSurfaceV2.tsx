"use client";

/**
 * CIRCLES — v2 canvas (Cheat Code App board 16 "CIRCLES"), re-skin of
 * CirclesSurface into the cc token system. Rendered ONLY when designV2Enabled()
 * is on; the v1 body stays byte-identical when the flag is off. Same state,
 * same handlers, same reads (listCircles / openCircle) — nothing is fetched
 * that v1 didn't fetch, and no count on this screen is invented.
 *
 * FIDELITY PASS (board 16 anatomy):
 *   Kaushan "club" wordmark + orange "+ Start a Circle" pill · presentational
 *   FEED / CIRCLES(active) / LIVE sub-tab labels · a soft intro line · then the
 *   Circles as a 3-COLUMN GRID OF CONIC-PROGRESS-RING TILES (not a card list):
 *   each tile = a 96px conic ring (orange fills the fraction of the 30-day clock
 *   still left — real, from expires_at), an inner disc with the ticker/topic
 *   initial, an 11px title, and a 9px "topic · Xd Xh · members" meta with the
 *   countdown in orange mono. The last tile is the dashed green-ring "Start
 *   yours" affordance (→ the same openCircle composer).
 *
 * HONEST DATA (unchanged from v1):
 *   · No score. A closed Circle keeps its thread as the record — circles are not
 *     graded, and this screen shows no accuracy/win-rate. (The board's "receipts
 *     get graded" line is NOT reproduced — nothing here is scored.)
 *   · The member count is whatever the roster holds; no "1.8K" illustration.
 *   · schema-missing → a STATED absence, not a fabricated empty room.
 *   · FEED / LIVE sub-tabs are presentational labels (this surface is Circles);
 *     no route is invented behind them.
 */

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { deriveRegister } from "@/lib/register";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import { Kicker, ScriptTitle, Card } from "@/components/cc/ui";
import {
  CIRCLE_DAYS,
  listCircles,
  normalizeTicker,
  openCircle,
  timeLeft,
  type CircleListRow,
} from "@/lib/circles";

/* ── conic clock ring (board 16 tile avatar) ──────────────────────────────────
   Orange sweeps the fraction of the 30-day clock STILL LEFT — computed from the
   real expires_at, never illustrated. inset ring + inner disc reproduce the
   board's ring-around-avatar exactly, in cc tokens. */

function clockPct(expiresAt: string, now = Date.now()): number {
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return 0;
  const total = CIRCLE_DAYS * 86_400_000;
  return Math.max(0, Math.min(100, (ms / total) * 100));
}

function ConicAvatar({
  pct,
  size = 96,
  inner,
  color = "var(--cc-ink)",
  dashed = false,
  ringColor = "var(--cc-orange)",
}: {
  pct: number;
  size?: number;
  inner: ReactNode;
  color?: string;
  dashed?: boolean;
  ringColor?: string;
}) {
  const insetPx = Math.max(3, Math.round(size * 0.042));
  const borderPx = Math.max(2, Math.round(size * 0.031));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${ringColor} 0 ${pct}%, var(--cc-line) ${pct}% 100%)` }}
      />
      <div
        className="grid place-items-center rounded-full"
        style={{
          position: "absolute",
          inset: insetPx,
          background: "var(--cc-card2)",
          border: dashed
            ? `${borderPx}px dashed var(--cc-line)`
            : `${borderPx}px solid var(--cc-bg)`,
          color,
          fontWeight: 800,
          fontSize: Math.round(size * 0.26),
          boxSizing: "border-box",
        }}
      >
        {inner}
      </div>
    </div>
  );
}

/* ── one Circle as a board-16 tile ────────────────────────────────────────── */

function CircleTile({ c }: { c: CircleListRow }) {
  const left = timeLeft(c.expires_at);
  const closed = left === null;
  const pct = closed ? 0 : clockPct(c.expires_at);
  const initial = (c.ticker ?? c.topic).slice(0, 1).toUpperCase();
  return (
    <Link href={`/circles/${c.slug}`} className="block text-center">
      <ConicAvatar
        pct={pct}
        inner={initial}
        color={closed ? "var(--cc-dim)" : "var(--cc-ink)"}
        ringColor={closed ? "var(--cc-dim)" : "var(--cc-orange)"}
      />
      <div
        className="mt-[7px] truncate text-[11px] font-bold"
        style={{ color: closed ? "var(--cc-soft)" : "var(--cc-ink)" }}
      >
        {c.title}
      </div>
      <div className="mt-0.5 truncate text-[9px]" style={{ color: "var(--cc-soft)" }}>
        {c.topic} ·{" "}
        {closed ? (
          <span className="font-[family-name:var(--font-plex-mono)]" style={{ color: "var(--cc-dim)" }}>
            ended
          </span>
        ) : (
          <span className="font-[family-name:var(--font-plex-mono)]" style={{ color: "var(--cc-orange-ink)" }}>
            {left}
          </span>
        )}{" "}
        · {c.members.toLocaleString()}
      </div>
    </Link>
  );
}

/** The dashed green-ring "Start yours" tile — the openCircle affordance. */
function StartTile({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block text-center">
      <ConicAvatar
        pct={100}
        ringColor="var(--cc-up)"
        dashed
        color="var(--cc-soft)"
        inner="+"
      />
      <div className="mt-[7px] text-[11px] font-bold" style={{ color: "var(--cc-soft)" }}>
        Start yours
      </div>
      <div className="mt-0.5 text-[9px]" style={{ color: "var(--cc-dim)" }}>
        30 days on the clock
      </div>
    </button>
  );
}

/* ── local cc helpers ──────────────────────────────────────────────────────── */

/** Mono section label with an optional right-aligned text action. */
function SectionHead({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string | null;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Kicker tone="soft">{children}</Kicker>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="cc-mono text-[11px]"
          style={{ color: "var(--cc-orange-ink)" }}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** cc-native empty note (no v1 sand/gold tokens). */
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

/** Text action button in the orange voice. */
function TextAction({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
      style={{ color: "var(--cc-orange-ink)" }}
    >
      {children}
    </button>
  );
}

/* ── skeleton ──────────────────────────────────────────────────────────────── */

function Skeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "" : "mx-auto max-w-2xl px-4 pb-16 pt-4"} aria-busy="true">
      <div className="flex items-center justify-between">
        {!embedded && <span className="block h-9 w-28 rounded" style={{ background: "var(--cc-card2)" }} />}
        <span className="ml-auto block h-7 w-28 rounded-full" style={{ background: "var(--cc-card2)" }} />
      </div>
      <span className="mt-4 block h-4 w-72 rounded" style={{ background: "var(--cc-card2)" }} />
      <div className="mt-8 grid grid-cols-3 gap-x-2 gap-y-[18px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="text-center">
            <span className="mx-auto block h-24 w-24 rounded-full" style={{ background: "var(--cc-card2)" }} />
            <span className="mx-auto mt-2 block h-3 w-16 rounded" style={{ background: "var(--cc-card2)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── the opener (cc token fields) ──────────────────────────────────────────── */

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

  const label =
    "font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.14em]";
  const field =
    "w-full bg-transparent pb-2 text-[15px] focus:outline-none";
  const fieldStyle: CSSProperties = {
    color: "var(--cc-ink)",
    borderBottom: "1px solid var(--cc-line)",
  };

  return (
    <Card className="space-y-6 p-5">
      <div>
        <label htmlFor="circle-title" className={label} style={{ color: "var(--cc-soft)" }}>
          What is it about
        </label>
        <input
          id="circle-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nvidia earnings"
          className={`mt-2 ${field}`}
          style={fieldStyle}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="min-w-[9rem] flex-1">
          <label htmlFor="circle-topic" className={label} style={{ color: "var(--cc-soft)" }}>
            Topic
          </label>
          <input
            id="circle-topic"
            value={topic}
            maxLength={24}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Semis"
            className={`mt-2 ${field}`}
            style={fieldStyle}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <label htmlFor="circle-ticker" className={label} style={{ color: "var(--cc-soft)" }}>
            Ticker (optional)
          </label>
          <input
            id="circle-ticker"
            value={ticker}
            maxLength={11}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="NVDA"
            className={`mt-2 font-[family-name:var(--font-plex-mono)] ${field}`}
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="circle-premise" className={label} style={{ color: "var(--cc-soft)" }}>
          The premise
        </label>
        <textarea
          id="circle-premise"
          value={premise}
          maxLength={280}
          rows={3}
          onChange={(e) => setPremise(e.target.value)}
          placeholder="One line the room exists to argue about."
          className={`mt-2 resize-none ${field}`}
          style={fieldStyle}
        />
        <p className="mt-2 text-[12px]" style={{ color: "var(--cc-soft)" }}>
          {premise.trim().length}/280 · the clock starts at {CIRCLE_DAYS} days and cannot be
          extended.
        </p>
      </div>

      {error && (
        <p className="text-[13px] leading-snug" style={{ color: "var(--cc-ink)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || busy}
        className="cc-halo inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold disabled:opacity-45"
        style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
      >
        {busy ? "Opening…" : "Open the Circle"}
      </button>
    </Card>
  );
}

/* ── surface ─────────────────────────────────────────────────────────────── */

export default function CirclesSurfaceV2({
  embedded = false,
}: {
  /** Rendered as the CIRCLES tab under ClubModeShellV2 — the shell already draws
      the "club" wordmark, the FEED · CIRCLES tab row and the page container, so
      embedded drops this surface's own masthead/sub-tabs/outer padding. */
  embedded?: boolean;
} = {}) {
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

  if (loading) return <Skeleton embedded={embedded} />;

  const now = new Date();
  const open = rows.filter((r) => timeLeft(r.expires_at, now) !== null);
  const closed = rows.filter((r) => timeLeft(r.expires_at, now) === null);

  return (
    <div className={embedded ? "" : "mx-auto max-w-2xl px-4 pb-16 pt-4"}>
      {/* ── HEADER ─────────────────────────────────────────────────────────
          Standalone (/circles): board 16 "club" wordmark + start pill + the
          presentational FEED / CIRCLES / LIVE sub-tab labels.
          Embedded (CIRCLES tab of ClubModeShellV2): the shell already draws the
          "club" wordmark and the real FEED · CIRCLES tab row, so here we show
          only the start pill and the intro line. */}
      <header>
        {embedded ? (
          !isKid && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setComposing((v) => !v)}
                className="shrink-0 rounded-[18px] px-3.5 py-[7px] text-[11px] font-bold"
                style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
              >
                {composing ? "× Close" : "+ Start a Circle"}
              </button>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <ScriptTitle>club</ScriptTitle>
              {!isKid && (
                <button
                  type="button"
                  onClick={() => setComposing((v) => !v)}
                  className="shrink-0 rounded-[18px] px-3.5 py-[7px] text-[11px] font-bold"
                  style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
                >
                  {composing ? "× Close" : "+ Start a Circle"}
                </button>
              )}
            </div>

            {/* FEED / CIRCLES(active) / LIVE — this surface IS Circles; FEED and
                LIVE are presentational labels (no route invented behind them). */}
            <div className="mt-3.5 flex items-center gap-4">
              <span className="text-[12px] font-semibold tracking-[0.04em]" style={{ color: "var(--cc-soft)" }}>
                FEED
              </span>
              <span
                className="rounded-2xl px-3.5 py-[5px] text-[11px] font-extrabold tracking-[0.06em]"
                style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
              >
                CIRCLES
              </span>
              <span className="text-[12px] font-semibold tracking-[0.04em]" style={{ color: "var(--cc-soft)" }}>
                LIVE
              </span>
            </div>
          </>
        )}

        <p className={`${embedded ? "mt-2" : "mt-3"} max-w-[52ch] text-[11px] leading-relaxed`} style={{ color: "var(--cc-soft)" }}>
          Breakout rooms around one event or one thesis. Every Circle runs a
          30-day clock — when it ends the room closes and the thread stands as
          the record.
        </p>
      </header>

      {failed ? (
        <div className="mt-10">
          <EmptyNote
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
        <div className="mt-10">
          <EmptyNote
            title="Circles aren't switched on yet"
            body="The room layer hasn't been provisioned on this deployment. As soon as it is, every Circle opened will show up here."
          />
        </div>
      ) : (
        <>
          {/* ── OPEN — the conic-ring tile grid ───────────────────────────── */}
          {composing && !isKid && (
            <div className="mt-8">
              <OpenForm
                onOpened={(slug) => {
                  setComposing(false);
                  router.push(`/circles/${slug}`);
                }}
              />
            </div>
          )}

          {open.length === 0 ? (
            <div className="mt-8">
              <EmptyNote
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
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-3 gap-x-2 gap-y-[18px]">
              {open.map((c) => (
                <CircleTile key={c.id} c={c} />
              ))}
              {!isKid && <StartTile onClick={() => setComposing(true)} />}
            </div>
          )}

          {/* ── CLOSED — dimmed tiles, thread stands as the record ────────── */}
          {closed.length > 0 && (
            <section className="mt-12 space-y-5">
              <SectionHead>Clock ran out</SectionHead>
              <div className="grid grid-cols-3 gap-x-2 gap-y-[18px]">
                {closed.map((c) => (
                  <CircleTile key={c.id} c={c} />
                ))}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                A closed Circle keeps its thread. Nobody is scored on it — the record is the
                point.
              </p>
            </section>
          )}

          {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
          <section className="mt-12 space-y-4">
            <SectionHead>How a Circle works</SectionHead>
            <p className="max-w-xl text-[14px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              One event or one thesis per room, {CIRCLE_DAYS} days on the clock, no extensions.
              Join to post; leave whenever. Your stance inside a Circle belongs to that room&apos;s
              premise — it doesn&apos;t move your standing position on the ticker.
              {isKid
                ? " Circles are a grown-up room: you can read every one of them, but posting stays in your Family Circle."
                : ""}
            </p>
            {/* The canonical community disclaimer, byte-identical. */}
            <p className="max-w-xl text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
              {COMMUNITY_DISCLAIMER}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
