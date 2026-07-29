"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Image as ImageIcon, Lightbulb, MessageCircle, ThumbsUp } from "lucide-react";

import { beltForXp } from "@/lib/belts";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import { timeAgo, type FeedPost } from "@/lib/feed";
import { createClient } from "@/lib/supabase/client";
import { REASON_BY_KEY, STANCE_META, type ChangedMindEntry } from "@/lib/social/stance";

function initials(name: string | null | undefined) {
  const value = (name || "Member").trim();
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function postTicker(post: FeedPost) {
  return post.ticker_tags?.[0]?.toUpperCase() ?? null;
}

function AvatarMark({ post }: { post: FeedPost }) {
  const name = post.author?.display_name || "Member";
  if (post.author?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.author.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3A3240] text-[11px] font-bold text-[#F4F0EC]">
      {initials(name)}
    </span>
  );
}

function ClubPostCard({
  post,
  initialData,
  likes,
  liked,
  readOnly,
  onLike,
}: {
  post: FeedPost;
  initialData: CommunityFeedSeed | null;
  likes: number;
  liked: boolean;
  readOnly: boolean;
  onLike: () => void;
}) {
  const author = post.author?.display_name || "Member";
  const ticker = postTicker(post);
  const xp = post.author?.id ? initialData?.beltXp[post.author.id] ?? 0 : 0;
  const rank = beltForXp(xp);
  return (
    <article className="cc-app-card px-[13px] py-3">
      <div className="flex items-center gap-[9px]">
        <AvatarMark post={post} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[12.5px] font-bold text-[#F4F0EC]">{author}</span>
            <span
              className="shrink-0 rounded-[4px] px-[5px] py-px text-[9px] font-bold"
              style={{ background: rank.belt.hex, color: rank.belt.onHex }}
            >
              {rank.belt.name} Belt
            </span>
          </div>
          {ticker && (
            <Link href={`/research/${encodeURIComponent(ticker)}`} className="cc-app-signal mt-0.5 block text-[9.5px] text-[#FF9A4D]">
              ${ticker}
            </Link>
          )}
        </div>
        <span className="shrink-0 text-[9.5px] text-[#6E6774]">{timeAgo(post.created_at)} ···</span>
      </div>

      <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-[#E8E2E4]">{post.body}</p>

      {post.attachment_url && post.attachment_type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.attachment_url} alt={post.attachment_meta?.name || "Shared chart"} className="mt-2.5 max-h-52 w-full rounded-[11px] border border-[#2A2530] object-cover" />
      )}

      <div className="mt-2.5 flex items-center gap-4 text-[10.5px] text-[#8F8894]">
        <button
          type="button"
          onClick={onLike}
          disabled={readOnly}
          className={`inline-flex items-center gap-1.5 ${liked ? "text-[#FF9A4D]" : "hover:text-[#F4F0EC]"}`}
          aria-pressed={liked}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          {likes}
        </button>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" />
          {initialData?.commentCount[post.id] ?? 0}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          {post.ticker_tags?.length ?? 0}
        </span>
        <span className="ml-auto text-[#6E6774]">🔖</span>
      </div>
    </article>
  );
}

export default function StandaloneClubFeed({ initialData }: { initialData: CommunityFeedSeed | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [posts] = useState<FeedPost[]>(initialData?.posts ?? []);
  const [likes, setLikes] = useState<Record<string, number>>(initialData?.likeCount ?? {});
  const [liked, setLiked] = useState<Set<string>>(() => new Set(initialData?.likedByMe ?? []));
  const [latestFlip, setLatestFlip] = useState<ChangedMindEntry | null>(null);
  const [kaiBrief, setKaiBrief] = useState<{ ticker?: string; text: string } | null>(null);
  const me = initialData?.me ?? null;
  const readOnly = initialData?.myTier === "free" || !me;

  const feed = useMemo(
    () => posts.filter((post) => post.kind === "post").slice(0, 8),
    [posts]
  );

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_changed_minds", { p_limit: 1 }).then(({ data }) => {
      if (!active) return;
      setLatestFlip((data as { items?: ChangedMindEntry[] } | null)?.items?.[0] ?? null);
    });
    void fetch("/api/club/brief", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active) return;
        setKaiBrief(payload?.items?.[0] ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [supabase]);

  async function toggleLike(postId: string) {
    if (!me || readOnly) return;
    const wasLiked = liked.has(postId);
    setLiked((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setLikes((current) => ({
      ...current,
      [postId]: Math.max(0, (current[postId] ?? 0) + (wasLiked ? -1 : 1)),
    }));

    const result = wasLiked
      ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id)
      : await supabase.from("post_likes").insert({ post_id: postId, user_id: me.id });

    if (result.error) {
      setLiked((current) => {
        const next = new Set(current);
        if (wasLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setLikes((current) => ({
        ...current,
        [postId]: Math.max(0, (current[postId] ?? 0) + (wasLiked ? 1 : -1)),
      }));
    }
  }

  return (
    <div className="space-y-[10px]">
      <Link
        href={readOnly ? "/upgrade" : "/community/compose"}
        className="cc-app-card flex items-center gap-[11px] px-[13px] py-[11px]"
      >
        {me?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3A3240] text-[11px] font-bold text-[#F4F0EC]">
            {initials(me?.display_name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-[#C8C2CE]">
            {readOnly ? "Join the Club to share your take" : "What’s your take?"}
          </span>
          <span className="mt-0.5 block text-[10px] text-[#6E6774]">Share an opinion, chart, or question</span>
        </span>
        <span className="flex items-center gap-1.5 text-[#6E6774]" aria-hidden>
          <BarChart3 className="h-3.5 w-3.5" />
          <ImageIcon className="h-3.5 w-3.5" />
        </span>
      </Link>

      {feed.length === 0 && !latestFlip && !kaiBrief ? (
        <div className="cc-app-card px-[13px] py-8 text-center">
          <p className="text-[13px] font-semibold text-[#F4F0EC]">The feed is ready for its first take.</p>
          <p className="mt-1 text-[10.5px] text-[#8F8894]">Posts from the Club will appear here as members publish them.</p>
        </div>
      ) : (
        <>
          {feed.slice(0, 1).map((post) => (
            <ClubPostCard key={post.id} post={post} initialData={initialData} likes={likes[post.id] ?? 0} liked={liked.has(post.id)} readOnly={readOnly} onLike={() => toggleLike(post.id)} />
          ))}

          {latestFlip && (
            <Link href="/community/changed-my-mind" className="cc-app-card block px-[13px] py-3">
              <p className="cc-app-signal text-[8.5px] font-semibold uppercase tracking-[.14em] text-[#FF4D6D]">Changed my mind</p>
              <div className="mt-2 flex items-center gap-[9px]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3A3240] text-[11px] font-bold text-[#F4F0EC]">{initials(latestFlip.display_name)}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#F4F0EC]">{latestFlip.display_name || "Member"}</span>
                <span className="cc-app-signal text-[10.5px] text-[#FF9A4D]">${latestFlip.ticker.toUpperCase()}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-bold">
                <span className="text-[#FF4D6D]">{latestFlip.from_stance ? STANCE_META[latestFlip.from_stance].label : "—"}</span>
                <span className="text-[#8F8894]">→</span>
                <span className="text-[#C8C2CE]">{STANCE_META[latestFlip.to_stance].label}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[#B8B2BC]">
                {latestFlip.note || (latestFlip.reason ? REASON_BY_KEY[latestFlip.reason]?.label : "Position updated.")}
              </p>
              <p className="mt-2 text-[10.5px] text-[#8F8894]">🔥 {latestFlip.respect_count}</p>
            </Link>
          )}

          {feed.slice(1, 2).map((post) => (
            <ClubPostCard key={post.id} post={post} initialData={initialData} likes={likes[post.id] ?? 0} liked={liked.has(post.id)} readOnly={readOnly} onLike={() => toggleLike(post.id)} />
          ))}

          {kaiBrief && (
            <Link href={kaiBrief.ticker ? `/research/${encodeURIComponent(kaiBrief.ticker)}` : "/kai"} className="cc-app-card flex items-center gap-2.5 px-[13px] py-[11px]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#1E3050] bg-[#0E1B2E] text-[14px]">🐋</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold text-[#5BC4F0]">Kai Insight</span>
                <span className="mt-0.5 block truncate text-[10.5px] text-[#8F8894]">{kaiBrief.text}</span>
              </span>
              <span className="cc-app-signal text-[10px] text-[#FF9A4D]">{kaiBrief.ticker ? `$${kaiBrief.ticker} ›` : "Open ›"}</span>
            </Link>
          )}

          {feed.slice(2).map((post) => (
            <ClubPostCard key={post.id} post={post} initialData={initialData} likes={likes[post.id] ?? 0} liked={liked.has(post.id)} readOnly={readOnly} onLike={() => toggleLike(post.id)} />
          ))}
        </>
      )}
    </div>
  );
}
