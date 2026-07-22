"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  Newspaper,
  ExternalLink,
  Sparkles,
  Send,
  Tag,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuote, formatPrice, formatChangePct, changeTone, type MarketQuote } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import PickVideo from "@/components/picks/PickVideo";
import UpsellCard from "@/components/dashboard/UpsellCard";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import { timeAgo } from "@/lib/feed";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import {
  normArticleLinks,
  normPickAuthor,
  statusMeta,
  sincePickPercent,
  formatSincePct,
  formatPickedDate,
  toParagraphs,
  PICKS_DISCLAIMER,
  PICKS_EDUCATION_LINE,
  type Pick,
  type PickComment,
} from "@/lib/picks";

const COMMENT_SELECT =
  "id, pick_id, user_id, body, created_at, author:profiles!pick_comments_user_id_fkey(id, display_name, role, age_group, avatar_url)";

interface Me {
  id: string;
  display_name: string | null;
  role: string | null;
  age_group: string | null;
  avatar_url: string | null;
  family_id: string | null;
}

export default function PickDetailPage() {
  const params = useParams<{ id: string }>();
  const pickId = params.id;
  const supabase = createClient();

  const [me, setMe] = useState<Me | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [locked, setLocked] = useState(false);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<PickComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [commentErr, setCommentErr] = useState<string | null>(null);
  const likeBusy = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, role, age_group, avatar_url, family_id")
        .eq("id", user.id)
        .single();
      if (prof) {
        setMe(prof as Me);
        getFamilyTier(supabase, (prof as Me).family_id).then(setTier);
      }
    }

    // Server-enforced read: pick_detail (migration 087) strips the guidance
    // fields (thesis/video/articles) for a locked pick BEFORE they leave the
    // database — a free viewer never receives a non-free pick's thesis_long.
    const { data: rows } = await supabase.rpc("pick_detail", { p_id: pickId });
    const data = Array.isArray(rows) ? rows[0] : rows;

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const row: Pick = {
      ...(data as Pick),
      article_links: normArticleLinks((data as { article_links: unknown }).article_links),
      tags: (data as { tags: string[] | null }).tags ?? [],
    };
    setPick(row);
    setLocked(!!(data as { locked?: boolean }).locked);
    setLoading(false);

    fetchQuote(row.ticker).then((q) => q && setQuote(q));

    const [{ data: likes }, { data: cmts }] = await Promise.all([
      supabase.from("pick_likes").select("user_id").eq("pick_id", pickId),
      supabase
        .from("pick_comments")
        .select(COMMENT_SELECT)
        .eq("pick_id", pickId)
        .order("created_at", { ascending: true }),
    ]);
    setLikeCount((likes ?? []).length);
    if (user) setLiked((likes ?? []).some((l) => l.user_id === user.id));
    setComments(
      (cmts ?? []).map((c) => ({
        ...(c as unknown as PickComment),
        author: normPickAuthor((c as { author: unknown }).author as never),
      }))
    );
  }, [supabase, pickId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLike() {
    if (!me || likeBusy.current) return;
    likeBusy.current = true;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      const { error } = await supabase
        .from("pick_likes")
        .insert({ pick_id: pickId, user_id: me.id });
      if (error) {
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
      }
    } else {
      await supabase.from("pick_likes").delete().eq("pick_id", pickId).eq("user_id", me.id);
    }
    likeBusy.current = false;
  }

  async function submitComment() {
    const body = draft.trim();
    if (!body || sending || !me) return;
    const clean = checkClean(body);
    if (!clean.ok) {
      setCommentErr(PROFANITY_MESSAGE);
      return;
    }
    setSending(true);
    setCommentErr(null);
    const { data, error } = await supabase
      .from("pick_comments")
      .insert({ pick_id: pickId, user_id: me.id, body })
      .select(COMMENT_SELECT)
      .single();
    if (!error && data) {
      setComments((prev) => [
        ...prev,
        {
          ...(data as unknown as PickComment),
          author: normPickAuthor((data as { author: unknown }).author as never),
        },
      ]);
      setDraft("");
    } else {
      setCommentErr("Could not post your comment. Please try again.");
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-soft">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-gold-500" />
        Loading pick…
      </div>
    );
  }

  if (notFound || !pick) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Pick not found</h1>
        <p className="mt-2 text-sm text-soft">
          This pick may have been removed or isn&apos;t published.
        </p>
        <Link
          href="/picks"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team Picks
        </Link>
      </div>
    );
  }

  const meta = statusMeta(pick.status);
  const tone = changeTone(quote?.changePercent);
  const toneCls =
    tone === "up" ? "text-green-600" : tone === "down" ? "text-red-600" : "text-soft";
  const since = sincePickPercent(quote?.price, pick.picked_price);
  const sinceTone = changeTone(since);
  const sinceCls =
    sinceTone === "up"
      ? "bg-green-500/10 text-green-700"
      : sinceTone === "down"
        ? "bg-red-500/10 text-red-700"
        : "bg-paper text-soft";
  const paragraphs = toParagraphs(pick.thesis_long);
  // Free members read the free pick in full, but liking/commenting is member-only.
  const readOnly = tier === "free";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      {/* Back */}
      <Link
        href="/picks"
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Team Picks
      </Link>

      {/* Hero */}
      <div className="mt-4 rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <CompanyLogo symbol={pick.ticker} name={pick.company_name} size={56} />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-ink">{pick.company_name}</h1>
              <p className="font-mono text-sm text-soft">{pick.ticker}</p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-display font-bold uppercase tracking-wider ${meta.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>

        {/* Live price */}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {quote?.price != null ? (
            <>
              <span className="font-display text-3xl font-bold tabular-nums text-ink">
                {formatPrice(quote.price)}
              </span>
              {quote.changePercent != null && (
                <span className={`text-base font-semibold tabular-nums ${toneCls}`}>
                  {formatChangePct(quote.changePercent)} today
                </span>
              )}
              {since != null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${sinceCls}`}
                >
                  {formatSincePct(since)} since pick
                </span>
              )}
              <span className="text-[11px] text-soft">delayed ~15 min</span>
            </>
          ) : (
            <span className="text-sm text-soft">Live price loading…</span>
          )}
        </div>

        {/* Picked meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-soft">
          <span>Picked {formatPickedDate(pick.picked_at)}</span>
          {pick.picked_price != null && (
            <span>at {formatPrice(pick.picked_price)}</span>
          )}
        </div>

        {/* Tags */}
        {pick.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pick.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] text-soft ring-1 ring-sand"
              >
                <Tag className="h-2.5 w-2.5" /> {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Headline */}
      {pick.headline && (
        <h2 className="mt-6 font-display text-xl font-bold leading-snug text-ink">
          {pick.headline}
        </h2>
      )}

      {/* Education framing line */}
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-300/40 bg-chip-amber/40 px-3.5 py-2.5 font-body text-[13px] leading-snug text-midnight-100">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
        {PICKS_EDUCATION_LINE}
      </p>

      {/* LOCKED — free viewer on a non-free pick. The guidance never arrived
          from the server (pick_detail withheld it); we render a faded teaser
          block behind the upsell so the value is visible but not the content. */}
      {locked && (
        <section className="mt-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-soft">
            Why we study this company
          </h3>
          <div className="relative mt-3 overflow-hidden rounded-xl">
            <div aria-hidden className="select-none space-y-2.5 blur-[6px] opacity-50">
              <div className="h-4 w-11/12 rounded bg-sand" />
              <div className="h-4 w-full rounded bg-sand" />
              <div className="h-4 w-10/12 rounded bg-sand" />
              <div className="h-4 w-9/12 rounded bg-sand" />
              <div className="h-4 w-full rounded bg-sand" />
              <div className="h-4 w-8/12 rounded bg-sand" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-paper" />
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-midnight-900 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-gold-600 ring-1 ring-sand">
              <Lock className="h-2.5 w-2.5" /> FIC members
            </span>
          </div>
          <div className="mt-4">
            <UpsellCard context="pick" variant="band" />
          </div>
        </section>
      )}

      {/* Video */}
      {!locked && pick.video_kind && pick.video_path && (
        <div className="mt-5">
          <PickVideo pick={pick} />
        </div>
      )}

      {/* Thesis */}
      {!locked && (pick.thesis_short || paragraphs.length > 0) && (
        <section className="mt-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-soft">
            Why we study this company
          </h3>
          {pick.thesis_short && (
            <p className="mt-2 font-body text-base font-medium leading-relaxed text-ink">
              {pick.thesis_short}
            </p>
          )}
          {paragraphs.map((p, i) => (
            <p key={i} className="mt-3 font-body text-[15px] leading-relaxed text-midnight-100">
              {p}
            </p>
          ))}
        </section>
      )}

      {/* Closed note */}
      {!locked && pick.status === "closed" && pick.closed_note && (
        <div className="mt-5 rounded-xl border border-sand bg-paper/60 p-4">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-soft">
            How this pick wrapped up
          </p>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-midnight-100">
            {pick.closed_note}
          </p>
        </div>
      )}

      {/* Article links */}
      {!locked && pick.article_links.length > 0 && (
        <section className="mt-6">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wider text-soft">
            <Newspaper className="h-4 w-4" /> Read more
          </h3>
          <ul className="mt-2 space-y-2">
            {pick.article_links.map((a, i) => (
              <li key={i}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-sand bg-midnight-900 px-3.5 py-2.5 text-sm text-ink shadow-soft transition-colors hover:border-gold-300"
                >
                  <ExternalLink className="h-4 w-4 shrink-0 text-gold-600" />
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Engagement — hidden entirely on a locked pick (nothing to engage with). */}
      {!locked && (
      <section className="mt-8 border-t border-sand pt-5">
        <div className="flex items-center gap-4">
          <button
            onClick={readOnly ? undefined : toggleLike}
            disabled={!me || readOnly}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              liked
                ? "bg-red-500/10 text-red-600"
                : "bg-paper text-soft ring-1 ring-sand hover:text-ink"
            } disabled:opacity-50 disabled:cursor-default`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm text-soft">
            <MessageCircle className="h-4 w-4" />
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </span>
        </div>

        {/* Free members read the discussion but join FIC to take part. */}
        {readOnly && (
          <div className="mt-4">
            <UpsellCard context="pick-engage" variant="band" />
          </div>
        )}

        {/* Composer — members only. */}
        {me && !readOnly && (
          <div className="mt-4 flex items-start gap-2.5">
            <Avatar
              name={me.display_name}
              avatarUrl={me.avatar_url}
              role={me.role}
              size="sm"
            />
            <div className="flex-1">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (commentErr) setCommentErr(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                  }}
                  rows={2}
                  placeholder="Share what you noticed about this company…"
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-sand bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
                />
                <button
                  onClick={submitComment}
                  disabled={sending || !draft.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-white transition-opacity disabled:opacity-40"
                  aria-label="Post comment"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              {commentErr && <p className="mt-1.5 text-xs text-red-600">{commentErr}</p>}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mt-5 space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-soft">
              No comments yet — be the first to share what you learned.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-sm font-semibold text-ink">
                      {c.author?.display_name || "Member"}
                    </span>
                    <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                    <span className="text-[11px] text-soft">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words font-body text-sm text-midnight-100">
                    {c.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      )}

      {/* Disclaimer */}
      <footer className="mt-12 border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">{PICKS_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
