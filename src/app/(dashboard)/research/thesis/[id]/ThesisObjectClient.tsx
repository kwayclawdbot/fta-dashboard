"use client";

/**
 * ThesisObjectClient — the Research Object page body. Renders the structured
 * thesis (stance + hook + horizon + live move since publish), informational
 * reactions, the four body sections with section-anchored comments, and the
 * THESIS UPDATE lifecycle (author posts strengthened / weakened / changed
 * entries; each stamped with the price at update).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Send, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { checkClean } from "@/lib/profanity";
import { fetchQuote } from "@/lib/market/client";
import ReactionBar from "@/components/social/ReactionBar";
import { STANCE_META } from "@/lib/social/stance";
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

export default function ThesisObjectClient({
  object,
  initialUpdates,
  userId,
  isKid,
  isMember,
}: {
  object: ResearchObject;
  initialUpdates: ThesisUpdate[];
  userId: string | null;
  isKid: boolean;
  isMember: boolean;
}) {
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
  const moveTone = pct == null ? "text-soft" : pct >= 0 ? "text-green-600" : "text-red-600";

  const sectionBody: Record<ThesisSection, string> = {
    thesis: object.thesis,
    catalysts: object.catalysts,
    risks: object.risks,
    valuation: object.valuation,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <Link
        href={`/research/${object.ticker}`}
        className="inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> {object.ticker.toUpperCase()} research
      </Link>

      {/* header */}
      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-gold-600" />
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${stance.chip}`}>
            {stance.label}
          </span>
          <span className="font-mono text-sm font-bold text-ink">{object.ticker.toUpperCase()}</span>
          {object.company_name && <span className="text-sm text-soft">{object.company_name}</span>}
          {object.time_horizon && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-soft">
              · {TIME_HORIZON_META[object.time_horizon].label}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {object.headline}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-soft">
          <Avatar name={object.author?.display_name} avatarUrl={object.author?.avatar_url} role={object.author?.role} size="xs" />
          <span className="font-semibold text-ink">{object.author?.display_name || "Member"}</span>
          <AgeBadge role={object.author?.role} ageGroup={object.author?.age_group} />
          <span>· {timeAgo(object.created_at)}</span>
          {object.price_at_publish != null && (
            <span className="ml-1">
              published at ${object.price_at_publish.toFixed(2)}
            </span>
          )}
          {pct != null && (
            <span className={`inline-flex items-center gap-1 font-mono font-bold tabular-nums ${moveTone}`}>
              <TrendingUp className="h-3.5 w-3.5" /> {formatPctMove(pct)}
            </span>
          )}
        </div>
      </header>

      {/* informational reactions */}
      <div className="mt-4 border-y border-sand py-4">
        <ReactionBar supabase={supabase} targetType="research_object" targetId={object.id} userId={userId} canReact={!!userId} />
      </div>

      {/* THESIS UPDATE lifecycle */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-ink">Thesis updates</h2>
        {isAuthor && !isKid && (
          <UpdateComposer
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
          <p className="rounded-lg border border-dashed border-sand px-3 py-3 text-center text-xs text-soft">
            No updates yet{isAuthor ? " — post one as the thesis evolves." : "."}
          </p>
        ) : (
          <div className="space-y-2">
            {updates.map((u) => {
              const meta = UPDATE_META[u.kind];
              return (
                <div key={u.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                  <div className="min-w-0 flex-1 rounded-lg border border-sand bg-paper px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.chip}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-soft">· {timeAgo(u.created_at)}</span>
                      {u.price_at_update != null && (
                        <span className="text-[10px] text-soft">at ${u.price_at_update.toFixed(2)}</span>
                      )}
                    </div>
                    {u.body && <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-midnight-200">{u.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* body sections with section-anchored comments */}
      <div className="mt-6 space-y-6">
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
        />
      </div>
    </div>
  );
}

function UpdateComposer({ onPost }: { onPost: (kind: ThesisUpdateKind, body: string) => Promise<boolean> }) {
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
    <div className="mb-3 rounded-xl border border-sand bg-paper p-2.5">
      <div className="mb-1.5 inline-flex rounded-lg border border-sand p-0.5">
        {UPDATE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
              kind === k ? UPDATE_META[k].chip : "text-soft"
            }`}
          >
            {UPDATE_META[k].label}
          </button>
        ))}
      </div>
      {err && <p className="mb-1 text-[11px] text-red-600">{err}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="What changed?"
          className="max-h-24 flex-1 resize-none rounded-lg border border-sand bg-card px-2.5 py-1.5 text-[13px] text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-white transition-colors hover:bg-gold-600 disabled:opacity-50"
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

  return (
    <section id={`section-${section}`} className="scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">{label}</h2>
        {comments.length > 0 && <span className="text-[11px] text-soft">{comments.length} note{comments.length === 1 ? "" : "s"}</span>}
      </div>
      {body ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-midnight-200">{body}</p>
      ) : section !== "general" ? (
        <p className="mt-1.5 text-sm text-soft/80">The author didn&apos;t add this section.</p>
      ) : null}

      {comments.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-sand pl-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.author?.username ? (
                    <Link href={`/u/${c.author.username}`} className="text-[12px] font-semibold text-ink hover:text-gold-700">
                      {c.author?.display_name || "Member"}
                    </Link>
                  ) : (
                    <span className="text-[12px] font-semibold text-ink">{c.author?.display_name || "Member"}</span>
                  )}
                  <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                  <span className="text-[10px] text-soft">· {timeAgo(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-midnight-200">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canComment && (
        open ? (
          <div className="mt-2 rounded-lg border border-sand bg-paper p-2">
            {err && <p className="mb-1 text-[11px] text-red-600">{err}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder={`Respond to ${label.toLowerCase()}…`}
                className="max-h-24 flex-1 resize-none rounded-lg border border-sand bg-card px-2.5 py-1.5 text-[13px] text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
              />
              <button
                onClick={submit}
                disabled={sending || !draft.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-white transition-colors hover:bg-gold-600 disabled:opacity-50"
                aria-label="Post response"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-gold-700 hover:underline">
            + Respond to {label.toLowerCase()}
          </button>
        )
      )}
    </section>
  );
}
