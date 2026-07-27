"use client";

/**
 * TickerThread — the canonical per-ticker discussion thread (community_ticker_
 * comments) rendered as a self-contained, lazy-loaded block. It is the SAME data
 * the research page shows under #research-notes; this component lets any other
 * surface (watchlist board cards) expand the thread INLINE without navigating.
 *
 * Typed contributions (Note · Thesis · Risk · News · Chart note · Question),
 * belt rings on every author avatar (batched — one RPC), profile links, age
 * badges, own/admin delete, profanity-checked composer. Members post; free tier
 * and signed-out read only. No XP is awarded here (contributions ride the feed's
 * community-XP path elsewhere; inline notes are lightweight).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2, StickyNote, Lightbulb, TriangleAlert, Newspaper, LineChart, HelpCircle, Send } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { checkClean } from "@/lib/profanity";
import { fetchXpForUsers } from "@/lib/belts";
import {
  CONTRIBUTION_TYPES,
  contributionMeta,
  type ContributionType,
} from "@/lib/research/social";

const ICON: Record<string, React.ElementType> = {
  StickyNote, Lightbulb, TriangleAlert, Newspaper, LineChart, HelpCircle,
};

interface Author {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  age_group: string | null;
}
interface Comment {
  id: string;
  user_id: string;
  body: string;
  contribution_type: string;
  created_at: string;
  author: Author | null;
}

const AUTHOR_SEL =
  "author:profiles!community_ticker_comments_user_id_fkey(id, display_name, username, avatar_url, role, age_group)";

function normAuthor(a: Author | Author[] | null): Author | null {
  return Array.isArray(a) ? a[0] ?? null : a;
}

export default function TickerThread({
  supabase,
  ticker,
  userId,
  role,
  canPost,
  onCountChange,
}: {
  supabase: SupabaseClient;
  ticker: string;
  userId?: string | null;
  role?: string | null;
  canPost?: boolean;
  /** Fired whenever the comment count changes, so a card badge can stay in sync. */
  onCountChange?: (n: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ContributionType>("note");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_ticker_comments")
      .select(`id, user_id, body, contribution_type, created_at, ${AUTHOR_SEL}`)
      .eq("ticker", ticker)
      .order("created_at", { ascending: true });
    const norm: Comment[] = (data ?? []).map((r) => {
      const raw = r as unknown as Comment & { author: Author | Author[] | null };
      return { ...raw, author: normAuthor(raw.author) };
    });
    setComments(norm);
    setLoading(false);
    countRef.current?.(norm.length);
    fetchXpForUsers(supabase, norm.map((c) => c.author?.id)).then(setXpMap);
  }, [supabase, ticker]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending || !userId) return;
    const clean = checkClean(body);
    if (!clean.ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setSending(true);
    setErr(null);
    const { data, error } = await supabase
      .from("community_ticker_comments")
      .insert({ ticker, user_id: userId, body, contribution_type: draftType })
      .select(`id, user_id, body, contribution_type, created_at, ${AUTHOR_SEL}`)
      .single();
    setSending(false);
    if (error || !data) {
      setErr("Couldn't post that — try again.");
      return;
    }
    const raw = data as unknown as Comment & { author: Author | Author[] | null };
    const c: Comment = { ...raw, author: normAuthor(raw.author) };
    setDraft("");
    setDraftType("note");
    setComments((prev) => {
      const next = [...prev, c];
      countRef.current?.(next.length);
      return next;
    });
    if (c.author?.id) fetchXpForUsers(supabase, [c.author.id]).then((m) => setXpMap((p) => ({ ...p, ...m })));
  }

  async function remove(id: string) {
    await supabase.from("community_ticker_comments").delete().eq("id", id);
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      countRef.current?.(next.length);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
        </div>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sand px-3 py-4 text-center text-xs text-soft">
          No notes yet — be the first to share what you found.
        </p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => {
            const meta = contributionMeta(c.contribution_type);
            const Icon = ICON[meta.icon] ?? StickyNote;
            const canDelete = c.user_id === userId || role === "admin";
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Link href={c.author?.username ? `/u/${c.author.username}` : "#"} className="shrink-0">
                  <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} xp={c.author?.id ? xpMap[c.author.id] : undefined} size="xs" />
                </Link>
                <div className="min-w-0 flex-1 rounded-lg border border-sand bg-paper px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.author?.username ? (
                      <Link href={`/u/${c.author.username}`} className="text-[12px] font-semibold text-ink hover:text-gold-700">
                        {c.author?.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="text-[12px] font-semibold text-ink">{c.author?.display_name || "Member"}</span>
                    )}
                    <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                    {c.contribution_type !== "note" && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.chip}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    )}
                    <span className="text-[10px] text-soft">· {timeAgo(c.created_at)}</span>
                    {canDelete && (
                      <button onClick={() => remove(c.id)} className="ml-auto text-soft hover:text-red-600" aria-label="Delete note">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-snug text-midnight-200">{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canPost ? (
        userId ? (
          <p className="rounded-lg border border-dashed border-sand px-3 py-2.5 text-center text-xs text-soft">
            Join the club to add your own research notes.
          </p>
        ) : null
      ) : (
        <div className="rounded-lg border border-sand bg-paper p-2.5">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {CONTRIBUTION_TYPES.map((t) => {
              const Icon = ICON[t.icon] ?? StickyNote;
              return (
                <button
                  key={t.key}
                  onClick={() => setDraftType(t.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    draftType === t.key ? t.chip : "border border-sand text-soft hover:bg-sand/40"
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          {err && <p className="mb-1 text-[11px] text-red-600">{err}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Share a note about this company…"
              className="max-h-28 flex-1 resize-none rounded-lg border border-sand bg-card px-2.5 py-1.5 text-[12px] text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
            />
            <button
              onClick={submit}
              disabled={sending || !draft.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-night-950 transition-colors hover:bg-gold-600 disabled:opacity-50"
              aria-label="Post note"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
