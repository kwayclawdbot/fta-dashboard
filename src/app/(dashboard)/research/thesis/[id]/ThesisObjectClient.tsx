"use client";

/**
 * THESIS OBJECT — canvas rebuild (light-primary club system).
 *
 * A member's structured thesis, rendered as LONG-FORM: author identity leads,
 * the headline carries the display voice, and the body runs at a real reading
 * measure (~65ch) instead of full-bleed inside bordered boxes. The old surface
 * wrapped every update and every comment in its own rounded container, which
 * turned a piece of writing into a stack of widgets; sections and responses are
 * now separated by rules and attribution — the same vocabulary the Kai surface
 * and the ledgers use.
 *
 * COLOUR LAW: the only green/red on this page is the PRICE move since publish
 * (text-price-up / text-price-down). Stance and update kind used to render as
 * green/red chips — a second, competing green/red on a page that already shows
 * a price — so a reader could not tell "the author is bullish" from "the stock
 * is up". They now read as typographic labels in the accent register.
 *
 * COMPLIANCE: the disclaimer is COMMUNITY_DISCLAIMER, the approved club string,
 * rendered VERBATIM. Kid-walling on both composers, the profanity check, the
 * definer-RPC reads and the THESIS UPDATE lifecycle are untouched.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { checkClean } from "@/lib/profanity";
import { fetchQuote } from "@/lib/market/client";
import ReactionBar from "@/components/social/ReactionBar";
import { SectionRule } from "@/components/f0/parts";
import { STANCE_META } from "@/lib/social/stance";
import { COMMUNITY_DISCLAIMER } from "@/lib/community-watchlist";
import {
  SECTION_META,
  TIME_HORIZON_META,
  UPDATE_META,
  addThesisUpdate,
  pctSincePublish,
  formatPctMove,
  type ResearchObject,
  type ThesisUpdate,
  type ThesisUpdateKind,
  type ThesisSection,
  type ThesisCommentSection,
} from "@/lib/social/research-object";

interface CommentRow {
  id: string;
  section: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author: { display_name: string | null; username: string | null; avatar_url: string | null; role: string | null; age_group: string | null } | null;
}

const AUTHOR_SEL = "author:profiles!research_object_comments_author_id_fkey(display_name, username, avatar_url, role, age_group)";

const UPDATE_KINDS: ThesisUpdateKind[] = ["strengthened", "weakened", "changed"];

/** Split a body into real paragraphs — this is prose, not a form field. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function ThesisObjectClient({
  object,
  initialUpdates,
  userId,
  isKid,
}: {
  object: ResearchObject;
  initialUpdates: ThesisUpdate[];
  userId: string | null;
  isKid: boolean;
  isMember: boolean;
}) {
  // CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): in club
  // mode the section rules become WHITE BOLD CAPS labels — the law's thesis
  // object register. The price move keeps the price ramp (the only green/red
  // here), all reads/writes, kid walls, the verbatim disclaimer and the whole
  // family render are byte-identical.
  const isClub = useAppMode() === "club";
  const supabase = useMemo(() => createClient(), []);
  const [updates, setUpdates] = useState<ThesisUpdate[]>(initialUpdates);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [price, setPrice] = useState<number | null>(null);

  const isAuthor = userId != null && userId === object.author_id;
  const stance = STANCE_META[object.stance];

  useEffect(() => {
    let live = true;
    fetchQuote(object.ticker).then((q) => {
      if (live) setPrice(q?.price ?? null);
    });
    return () => {
      live = false;
    };
  }, [object.ticker]);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("research_object_comments")
      .select(`id, section, body, created_at, author_id, ${AUTHOR_SEL}`)
      .eq("object_id", object.id)
      .order("created_at", { ascending: true });
    const norm = (data ?? []).map((r) => {
      const raw = r as unknown as CommentRow & { author: CommentRow["author"] | CommentRow["author"][] };
      return { ...raw, author: Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author };
    });
    setComments(norm as CommentRow[]);
  }, [supabase, object.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const pct = pctSincePublish(object.price_at_publish, price);
  const moveTone =
    pct == null ? "text-soft" : pct >= 0 ? "text-price-up" : "text-price-down";

  const sectionBody: Record<ThesisSection, string> = {
    thesis: object.thesis,
    catalysts: object.catalysts,
    risks: object.risks,
    valuation: object.valuation,
  };

  return (
    <div className="mx-auto max-w-[72ch] px-4 pb-24 sm:px-6">
      <Link
        href={`/research/${object.ticker}`}
        className="inline-flex items-center gap-1.5 pt-5 font-mono text-eyebrow font-semibold uppercase text-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> ${object.ticker.toUpperCase()} research
      </Link>

      {/* ── Masthead: the argument's provenance, then its headline ────────── */}
      <header className="mt-5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-eyebrow font-semibold uppercase text-soft">
          <span className="text-ink">${object.ticker.toUpperCase()}</span>
          {object.company_name && (
            <span className="normal-case tracking-normal text-soft">
              {object.company_name}
            </span>
          )}
          <span aria-hidden className="text-soft/40">·</span>
          <span className="text-gold-700">{stance.label} case</span>
          {object.time_horizon && (
            <>
              <span aria-hidden className="text-soft/40">·</span>
              <span>{TIME_HORIZON_META[object.time_horizon].label}</span>
            </>
          )}
        </p>

        <h1 className="mt-3 max-w-[65ch] font-display text-display-2 font-extrabold leading-tight tracking-tight text-ink">
          {object.headline}
        </h1>

        {/* byline — a thesis belongs to whoever staked their name on it */}
        <div className="f0-rule-top mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
          <Avatar
            name={object.author?.display_name}
            avatarUrl={object.author?.avatar_url}
            role={object.author?.role}
            size="sm"
          />
          <span className="text-[13.5px] font-semibold text-ink">
            {object.author?.display_name || "Member"}
          </span>
          <AgeBadge role={object.author?.role} ageGroup={object.author?.age_group} />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-soft/75">
            {timeAgo(object.created_at)}
          </span>

          {object.price_at_publish != null && (
            <span className="ml-auto flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
                Published at
              </span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                {object.price_at_publish.toFixed(2)}
              </span>
              {pct != null && (
                <span className={`font-mono text-[13px] font-semibold tabular-nums ${moveTone}`}>
                  {formatPctMove(pct)}
                </span>
              )}
            </span>
          )}
        </div>
      </header>

      {/* informational reactions */}
      <div className="mt-4 border-y border-sand py-3.5">
        <ReactionBar
          supabase={supabase}
          targetType="research_object"
          targetId={object.id}
          userId={userId}
          canReact={!!userId}
        />
      </div>

      {/* ── THESIS UPDATE lifecycle ───────────────────────────────────────── */}
      <section className="mt-9">
        {isClub ? (
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            Thesis updates
          </h2>
        ) : (
          <SectionRule>Thesis updates</SectionRule>
        )}
        <p className="mb-3 mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-soft">
          A thesis is a living argument. Every update is stamped with the price
          at the moment it was written, so the record can&apos;t be tidied up
          after the fact.
        </p>

        {isAuthor && !isKid && (
          <UpdateComposer
            club={isClub}
            onPost={async (kind, body) => {
              const res = await addThesisUpdate(supabase, object.id, kind, body);
              if (res.ok) {
                setUpdates((prev) => [
                  {
                    id: crypto.randomUUID(),
                    object_id: object.id,
                    author_id: userId!,
                    kind,
                    body,
                    price_at_update: res.price_at_update ?? null,
                    created_at: new Date().toISOString(),
                  },
                  ...prev,
                ]);
                return true;
              }
              return false;
            }}
          />
        )}

        {updates.length === 0 ? (
          <p className="f0-rule-top pt-3 text-[13px] leading-relaxed text-soft">
            No updates yet
            {isAuthor
              ? " — post one when the argument strengthens, weakens or changes."
              : ". The author hasn't revisited this one publicly."}
          </p>
        ) : (
          <div className="f0-ledger f0-rule-top">
            {updates.map((u) => {
              const meta = UPDATE_META[u.kind];
              return (
                <article key={u.id} className="py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      aria-hidden
                      className="h-3 w-[3px] shrink-0 rounded-full bg-accent"
                    />
                    <span className="font-mono text-eyebrow font-semibold uppercase text-gold-700">
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft/70">
                      {timeAgo(u.created_at)}
                    </span>
                    {u.price_at_update != null && (
                      <span className="font-mono text-[11px] tabular-nums text-soft/80">
                        at {u.price_at_update.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {u.body && (
                    <p className="mt-1.5 max-w-[65ch] whitespace-pre-wrap text-[14px] leading-relaxed text-ink/85">
                      {u.body}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── The argument itself ───────────────────────────────────────────── */}
      <div className="mt-10 space-y-10">
        {SECTION_META.map((sec) => (
          <SectionBlock
            key={sec.key}
            section={sec.key}
            label={sec.label}
            body={sectionBody[sec.key]}
            comments={comments.filter((c) => c.section === sec.key)}
            userId={userId}
            canComment={!!userId && !isKid}
            supabase={supabase}
            objectId={object.id}
            onPosted={loadComments}
            club={isClub}
          />
        ))}

        {/* general discussion */}
        <SectionBlock
          section="general"
          label="Discussion"
          body=""
          comments={comments.filter((c) => c.section === "general")}
          userId={userId}
          canComment={!!userId && !isKid}
          supabase={supabase}
          objectId={object.id}
          onPosted={loadComments}
          club={isClub}
        />
      </div>

      <footer className="mt-12 border-t border-sand pt-5">
        <p className="max-w-[65ch] text-[11px] leading-relaxed text-soft">
          {COMMUNITY_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}

function UpdateComposer({
  onPost,
  club = false,
}: {
  onPost: (kind: ThesisUpdateKind, body: string) => Promise<boolean>;
  /** Club terminal skin: raised-well composer (no gold-hover underline). */
  club?: boolean;
}) {
  const [kind, setKind] = useState<ThesisUpdateKind>("strengthened");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (text && !checkClean(text).ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ok = await onPost(kind, text);
    setBusy(false);
    if (ok) setBody("");
    else setErr("Couldn't post that — try again.");
  }

  return (
    <div className="f0-rule-top mb-4 pt-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
          The thesis
        </span>
        {UPDATE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`font-mono text-[11px] uppercase tracking-[0.1em] transition ${
              kind === k ? "text-gold-700" : "text-soft/70 hover:text-ink"
            }`}
          >
            {UPDATE_META[k].label}
          </button>
        ))}
      </div>
      {err && <p className="mt-1.5 text-[11.5px] text-soft">{err}</p>}
      <div className="mt-1.5 flex items-end gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="What changed?"
          className={
            club
              ? "max-h-28 flex-1 resize-none rounded-[10px] border border-sand bg-card px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-soft/55 focus:border-accent focus:outline-none"
              : "max-h-28 flex-1 resize-none border-b border-sand bg-transparent px-1 py-2 text-[14px] leading-relaxed text-ink placeholder:text-soft/55 focus:border-gold-400 focus:outline-none"
          }
        />
        <button
          onClick={submit}
          disabled={busy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-volt-500 text-white transition hover:brightness-110 disabled:opacity-50"
          aria-label="Post update"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  label,
  body,
  comments,
  userId,
  canComment,
  supabase,
  objectId,
  onPosted,
  club = false,
}: {
  section: ThesisCommentSection;
  label: string;
  body: string;
  comments: CommentRow[];
  userId: string | null;
  canComment: boolean;
  supabase: ReturnType<typeof createClient>;
  objectId: string;
  onPosted: () => void;
  /** Club terminal skin: white bold caps section label. Family unchanged. */
  club?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    const text = draft.trim();
    if (!text || sending || !userId) return;
    if (!checkClean(text).ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setSending(true);
    setErr(null);
    const { error } = await supabase
      .from("research_object_comments")
      .insert({ object_id: objectId, author_id: userId, section, body: text });
    setSending(false);
    if (error) {
      setErr("Couldn't post that — try again.");
      return;
    }
    setDraft("");
    setOpen(false);
    onPosted();
  }

  const noteCount =
    comments.length > 0 ? (
      <span className="font-mono text-[11px] tabular-nums text-soft/70">
        {comments.length} note{comments.length === 1 ? "" : "s"}
      </span>
    ) : undefined;

  return (
    <section id={`section-${section}`} className="scroll-mt-20">
      {club ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            {label}
          </h2>
          {noteCount}
        </div>
      ) : (
        <SectionRule action={noteCount}>{label}</SectionRule>
      )}

      {body ? (
        <div className="mt-3 max-w-[65ch] space-y-3.5">
          {paragraphs(body).map((para, i) => (
            <p
              key={i}
              className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink/90"
            >
              {para}
            </p>
          ))}
        </div>
      ) : section !== "general" ? (
        <p className="mt-3 text-[13.5px] text-soft/80">
          The author didn&apos;t write this section.
        </p>
      ) : null}

      {/* Responses — attributed entries on hairlines, never chat bubbles. */}
      {comments.length > 0 && (
        <div className="f0-ledger mt-5 max-w-[65ch] border-l-2 border-sand pl-4">
          {comments.map((c) => (
            <article key={c.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="xs"
                />
                {c.author?.username ? (
                  <Link
                    href={`/u/${c.author.username}`}
                    className="text-[12.5px] font-semibold text-ink transition hover:text-gold-700"
                  >
                    {c.author?.display_name || "Member"}
                  </Link>
                ) : (
                  <span className="text-[12.5px] font-semibold text-ink">
                    {c.author?.display_name || "Member"}
                  </span>
                )}
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft/70">
                  {timeAgo(c.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">
                {c.body}
              </p>
            </article>
          ))}
        </div>
      )}

      {canComment &&
        (open ? (
          <div className="mt-4 max-w-[65ch]">
            {err && <p className="mb-1 text-[11.5px] text-soft">{err}</p>}
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder={`Respond to ${label.toLowerCase()}…`}
                className={
                  club
                    ? "max-h-28 flex-1 resize-none rounded-[10px] border border-sand bg-card px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-soft/55 focus:border-accent focus:outline-none"
                    : "max-h-28 flex-1 resize-none border-b border-sand bg-transparent px-1 py-2 text-[14px] leading-relaxed text-ink placeholder:text-soft/55 focus:border-gold-400 focus:outline-none"
                }
              />
              <button
                onClick={submit}
                disabled={sending || !draft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-volt-500 text-white transition hover:brightness-110 disabled:opacity-50"
                aria-label="Post response"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
          >
            + Respond to {label.toLowerCase()}
          </button>
        ))}
    </section>
  );
}
