"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AtSign, Send, Trophy, Heart, MessageCircle, Users, Home, Sparkles,
  ArrowRight, Paperclip, X, Film, Loader2, Link2, Radio,
  Award, Eye, CheckCircle2, Target, Calendar, Pin, BookOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { getFamilyTier, getFamilyTierMap, type FamilyTier } from "@/lib/tier";
import { evaluateBadges } from "@/lib/badges";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import {
  activityLine, linkify, timeAgo,
  type FeedPost, type FeedAuthor, type PostComment, type ActivityPayload,
  type AnchorPayload, type Role,
} from "@/lib/feed";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import LiveRooms from "@/components/community/LiveRooms";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  award: Award, eye: Eye, check: CheckCircle2, target: Target,
  calendar: Calendar, trophy: Trophy, sparkles: Sparkles,
};

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

interface Me {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
}
interface PendingAttachment {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
  width?: number;
  height?: number;
}

// PostgREST embeds
const AUTHOR_SEL =
  "author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url)";
const COMMENT_AUTHOR_SEL =
  "author:profiles!post_comments_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url)";

function normAuthor(a: FeedAuthor | FeedAuthor[] | null): FeedAuthor | null {
  return Array.isArray(a) ? a[0] ?? null : a;
}

export default function CommunityPage() {
  const supabase = createClient();

  const [me, setMe] = useState<Me | null>(null);
  const [myTier, setMyTier] = useState<FamilyTier>("fic");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ families: 0, members: 0, posts: 0 });

  // Likes + comments state
  const [likeCount, setLikeCount] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [commentCount, setCommentCount] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});

  // Tier map for author badges (batched)
  const [tiers, setTiers] = useState<Record<string, FamilyTier>>({});
  const tiersRef = useRef(tiers);
  tiersRef.current = tiers;
  const loadTiers = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const missing = ids.filter((id): id is string => !!id && !(id in tiersRef.current));
      if (!missing.length) return;
      const fetched = await getFamilyTierMap(supabase, missing);
      setTiers((prev) => ({ ...prev, ...fetched }));
    },
    [supabase]
  );

  // Composer
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mobile Live Rooms drawer
  const [liveOpen, setLiveOpen] = useState(false);

  // ── @mention autocomplete ──
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [roster, setRoster] = useState<{ id: string; name: string; stripped: string; avatar_url: string | null }[]>([]);
  const rosterLoaded = useRef(false);
  const loadRoster = useCallback(async () => {
    if (rosterLoaded.current) return;
    rosterLoaded.current = true;
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").limit(300);
    setRoster(
      (data ?? [])
        .filter((p) => p.display_name)
        .map((p) => ({
          id: p.id as string,
          name: p.display_name as string,
          stripped: (p.display_name as string).replace(/\s+/g, ""),
          avatar_url: (p.avatar_url as string) ?? null,
        }))
        .filter((p) => p.stripped.length > 0)
    );
  }, [supabase]);
  const mentionCandidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return roster
      .filter((p) => p.id !== me?.id)
      .filter((p) => p.stripped.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mention, roster, me?.id]);
  function detectMention(value: string, caret: number) {
    const m = value.slice(0, caret).match(/(^|\s)@([A-Za-z0-9_.'-]*)$/);
    if (m) {
      loadRoster();
      setMention({ start: caret - m[2].length - 1, end: caret, query: m[2] });
      setMentionIdx(0);
    } else setMention(null);
  }
  function insertMention(c: { stripped: string }) {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.end);
    const inserted = `@${c.stripped} `;
    setText(before + inserted + after);
    setMention(null);
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(caret, caret);
    });
  }

  // ── Load feed (posts + likes + comment counts) ──
  const loadFeed = useCallback(
    async (uid: string | null) => {
      const { data } = await supabase
        .from("feed_posts")
        .select(
          `id, author_id, family_id, kind, body, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, created_at, ${AUTHOR_SEL}`
        )
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);

      const norm: FeedPost[] = (data ?? []).map((r) => {
        const raw = r as unknown as FeedPost & { author: FeedAuthor | FeedAuthor[] | null };
        return { ...raw, author: normAuthor(raw.author) };
      });
      setPosts(norm);
      await loadTiers(norm.map((p) => p.author?.family_id));

      const ids = norm.map((p) => p.id);
      if (ids.length) {
        const [{ data: likes }, { data: comments }] = await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
          supabase.from("post_comments").select("post_id").in("post_id", ids),
        ]);
        const lc: Record<string, number> = {};
        const mine = new Set<string>();
        for (const l of likes ?? []) {
          lc[l.post_id as string] = (lc[l.post_id as string] || 0) + 1;
          if (uid && l.user_id === uid) mine.add(l.post_id as string);
        }
        const cc: Record<string, number> = {};
        for (const c of comments ?? []) cc[c.post_id as string] = (cc[c.post_id as string] || 0) + 1;
        setLikeCount(lc);
        setLikedByMe(mine);
        setCommentCount(cc);
      } else {
        setLikeCount({});
        setLikedByMe(new Set());
        setCommentCount({});
      }
    },
    [supabase, loadTiers]
  );

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let uid: string | null = null;
      if (user) {
        uid = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, role, age_group, family_id, avatar_url")
          .eq("id", user.id)
          .single();
        if (profile && mounted) {
          setMe({
            id: user.id,
            display_name: profile.display_name || "You",
            role: (profile.role as Role) || "parent",
            age_group: profile.age_group,
            family_id: profile.family_id ?? null,
            avatar_url: profile.avatar_url ?? null,
          });
          const tier = await getFamilyTier(supabase, profile.family_id);
          if (mounted) setMyTier(tier);
          evaluateBadges(supabase, user.id);
        }
      }
      await loadFeed(uid);
      const [{ count: families }, { count: members }, { count: postCount }] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("feed_posts").select("id", { count: "exact", head: true }).eq("kind", "post"),
      ]);
      if (mounted) {
        setStats({ families: families || 0, members: members || 0, posts: postCount || 0 });
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light polling (P1: fetch-on-load + poll instead of realtime on feed_posts).
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") loadFeed(me?.id ?? null);
    }, 30000);
    return () => clearInterval(iv);
  }, [loadFeed, me?.id]);

  // ── Attachments ──
  function handleFile(file: File | null) {
    if (!file) return;
    setComposerError(null);
    const isImage = IMAGE_MIMES.includes(file.type);
    const isVideo = VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) return setComposerError("Try a photo (JPG, PNG, WebP, GIF) or video (MP4, MOV, WebM).");
    if (isImage && file.size > MAX_IMAGE_BYTES) return setComposerError("That photo is too big — images can be up to 10 MB.");
    if (isVideo && file.size > MAX_VIDEO_BYTES) return setComposerError("That video is too big — videos can be up to 50 MB.");
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setAttachment({ file, kind: isImage ? "image" : "video", previewUrl });
  }
  function clearAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
  }
  function insertLink() {
    const el = taRef.current;
    const caret = el?.selectionStart ?? text.length;
    const next = text.slice(0, caret) + "https://" + text.slice(caret);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = caret + 8;
      el?.setSelectionRange(pos, pos);
    });
  }

  // ── Create post ──
  async function submitPost() {
    const body = text.trim();
    if ((!body && !attachment) || !me || posting) return;
    const clean = checkClean(body);
    if (!clean.ok) return setComposerError(PROFANITY_MESSAGE);
    setPosting(true);
    setComposerError(null);

    let attachmentFields: {
      attachment_url: string; attachment_type: "image" | "video"; attachment_meta: Record<string, unknown>;
    } | null = null;
    if (attachment) {
      setUploading(true);
      const ext = EXT_BY_MIME[attachment.file.type] || "bin";
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, attachment.file, { contentType: attachment.file.type, cacheControl: "3600" });
      setUploading(false);
      if (upErr) {
        setPosting(false);
        return setComposerError("Upload didn't go through. Check your connection and try again.");
      }
      const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path);
      attachmentFields = {
        attachment_url: pub.publicUrl,
        attachment_type: attachment.kind,
        attachment_meta: { size: attachment.file.size, name: attachment.file.name },
      };
    }

    const { data, error } = await supabase
      .from("feed_posts")
      .insert({ author_id: me.id, family_id: me.family_id, kind: "post", body, ...(attachmentFields || {}) })
      .select(`id, author_id, family_id, kind, body, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, created_at`)
      .single();

    if (!error && data) {
      const newPost: FeedPost = {
        ...(data as unknown as FeedPost),
        author: {
          id: me.id, display_name: me.display_name, role: me.role,
          age_group: me.age_group, family_id: me.family_id, avatar_url: me.avatar_url,
        },
      };
      setPosts((prev) => [newPost, ...prev]);
      setStats((s) => ({ ...s, posts: s.posts + 1 }));
      setText("");
      clearAttachment();
      const todayPosts = await countXpToday(supabase, me.id, "community");
      if (todayPosts < 3) await awardXp(supabase, me.id, "community", XP.COMMUNITY, data.id);
    } else {
      setComposerError("Your post didn't go through. Please try again.");
    }
    setPosting(false);
  }

  // ── Likes ──
  async function toggleLike(postId: string) {
    if (!me) return;
    const liked = likedByMe.has(postId);
    // optimistic
    setLikedByMe((prev) => {
      const n = new Set(prev);
      if (liked) n.delete(postId); else n.add(postId);
      return n;
    });
    setLikeCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + (liked ? -1 : 1)) }));
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: me.id });
      if (error) {
        // revert on failure (e.g., unique race)
        setLikedByMe((prev) => { const n = new Set(prev); n.delete(postId); return n; });
        setLikeCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }));
      }
    }
  }

  // ── Comments ──
  async function toggleComments(postId: string) {
    const willOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: willOpen }));
    if (willOpen && !commentsByPost[postId]) {
      const { data } = await supabase
        .from("post_comments")
        .select(`id, post_id, author_id, body, created_at, ${COMMENT_AUTHOR_SEL}`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      const norm: PostComment[] = (data ?? []).map((r) => {
        const raw = r as unknown as PostComment & { author: FeedAuthor | FeedAuthor[] | null };
        return { ...raw, author: normAuthor(raw.author) };
      });
      setCommentsByPost((prev) => ({ ...prev, [postId]: norm }));
    }
  }
  async function addComment(postId: string, body: string): Promise<boolean> {
    if (!me) return false;
    const clean = checkClean(body);
    if (!clean.ok) return false;
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, author_id: me.id, body })
      .select(`id, post_id, author_id, body, created_at`)
      .single();
    if (error || !data) return false;
    const comment: PostComment = {
      ...(data as unknown as PostComment),
      author: {
        id: me.id, display_name: me.display_name, role: me.role,
        age_group: me.age_group, family_id: me.family_id, avatar_url: me.avatar_url,
      },
    };
    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), comment] }));
    setCommentCount((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    return true;
  }

  const tierOf = (a: FeedAuthor | null): FamilyTier => (a?.family_id && tiers[a.family_id]) || "fic";

  const anchor = posts.find((p) => p.kind === "anchor");
  const feedList = posts.filter((p) => p.kind !== "anchor");

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mb-5">
        <h1 className="font-display text-2xl font-bold text-ink">Community</h1>
        <p className="text-soft text-sm mt-1 font-body">The club town square — learn out loud, grow together.</p>
      </motion.div>

      {/* Mobile Live Rooms toggle */}
      <button
        onClick={() => setLiveOpen(true)}
        className="lg:hidden mb-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gold-300 bg-chip-amber/50 text-gold-800 font-display text-sm font-semibold"
      >
        <Radio className="w-4 h-4" /> Open Live Rooms
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Pinned This Week anchor */}
          {anchor && <AnchorCard post={anchor} onReply={() => toggleComments(anchor.id)} />}

          {/* Composer */}
          <div className="paper-card p-4">
            <div className="flex gap-3">
              <Avatar name={me?.display_name} avatarUrl={me?.avatar_url} role={me?.role} tier={(me?.family_id && tiers[me.family_id]) || myTier} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <textarea
                    ref={taRef}
                    value={text}
                    onChange={(e) => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
                    onKeyDown={(e) => {
                      if (mention && mentionCandidates.length) {
                        if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionCandidates.length); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); }
                        else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionIdx]); }
                        else if (e.key === "Escape") setMention(null);
                      }
                    }}
                    onBlur={() => setTimeout(() => setMention(null), 150)}
                    placeholder={me?.role === "child" ? "Share what your family learned today…" : "Share a win, ask a question, or post your family's pick…"}
                    rows={3}
                    className="w-full bg-paper border border-sand rounded-lg p-3 text-sm text-ink placeholder:text-soft font-body resize-none focus:outline-none focus:border-gold-400"
                  />
                  {mention && mentionCandidates.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-midnight-900 border border-sand rounded-lg shadow-lg overflow-hidden z-20">
                      <p className="flex items-center gap-1 px-3 pt-2 pb-1 text-[10px] font-display font-semibold uppercase tracking-wider text-soft">
                        <AtSign className="w-3 h-3" /> Mention someone
                      </p>
                      {mentionCandidates.map((c, i) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); insertMention(c); }}
                          onMouseEnter={() => setMentionIdx(i)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 text-left ${i === mentionIdx ? "bg-paper" : "bg-midnight-900"}`}
                        >
                          <Avatar name={c.name} avatarUrl={c.avatar_url} size="xs" />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-ink truncate">{c.name}</span>
                            <span className="block text-[10px] text-soft truncate">@{c.stripped}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {attachment && (
                  <div className="mt-2 inline-flex items-center gap-2.5 bg-paper border border-sand rounded-xl p-2 pr-3 max-w-full">
                    {attachment.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.previewUrl} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-sand shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-night-950 flex items-center justify-center shrink-0"><Film className="w-5 h-5 text-night-50" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-display font-semibold text-ink truncate max-w-[180px]">{attachment.file.name}</p>
                      <p className="text-[11px] text-soft">{uploading ? "Uploading…" : `${attachment.kind === "image" ? "Photo" : "Video"} · ${(attachment.file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
                    </div>
                    {uploading ? <Loader2 className="w-4 h-4 text-gold-600 animate-spin shrink-0" /> : (
                      <button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="w-6 h-6 rounded-full bg-sand flex items-center justify-center text-midnight-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                )}
                {composerError && <p className="mt-2 text-xs text-red-600 font-body">{composerError}</p>}

                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input ref={fileRef} type="file" accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach a photo or video" title="Attach a photo or video" className="flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-gold-700 hover:border-gold-300 disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
                    <button type="button" onClick={insertLink} disabled={posting} aria-label="Add a link" title="Add a link" className="flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-gold-700 hover:border-gold-300 disabled:opacity-40"><Link2 className="w-4 h-4" /></button>
                  </div>
                  <button onClick={submitPost} disabled={(!text.trim() && !attachment) || posting || !me} className="cta-button flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send className="w-3.5 h-3.5" />{uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="paper-card p-4 animate-pulse">
                  <div className="h-4 w-40 bg-sand/70 rounded mb-3" />
                  <div className="h-3 w-full bg-sand/50 rounded mb-1.5" />
                  <div className="h-3 w-2/3 bg-sand/50 rounded" />
                </div>
              ))}
            </div>
          ) : feedList.length === 0 ? (
            <div className="paper-card p-10 text-center">
              <Sparkles className="w-7 h-7 text-gold-500 mx-auto mb-3" />
              <p className="font-display text-base font-semibold text-ink mb-1">The club is just getting started</p>
              <p className="text-sm text-soft font-body max-w-sm mx-auto">Share a win, ask a question, or post your family&apos;s pick. Every badge, mission, and watchlist add shows up here too.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedList.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
                  {p.kind === "activity" ? (
                    <ActivityCard
                      post={p} me={me}
                      likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                      commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                      comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf}
                    />
                  ) : (
                    <PostCard
                      post={p} me={me} tier={tierOf(p.author)}
                      likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                      commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                      comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="hidden lg:block lg:w-[320px] shrink-0 space-y-4">
          <LiveRooms me={me} tier={myTier} />
          {anchor && <ThisWeekSnapshot post={anchor} />}
          <Link href="/leaderboard" className="paper-card p-4 flex items-center gap-3 group hover:border-gold-300 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-chip-amber text-gold-800 flex items-center justify-center shrink-0"><Trophy className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-semibold text-ink">Family XP leaderboard</p>
              <p className="text-[11px] text-soft">Scored by average XP — every family competes fairly</p>
            </div>
            <ArrowRight className="w-4 h-4 text-midnight-600 group-hover:text-gold-700" />
          </Link>
          <div className="paper-card p-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Home} value={stats.families} label="Families" />
              <Stat icon={Users} value={stats.members} label="Members" />
              <Stat icon={MessageCircle} value={stats.posts} label="Posts" />
            </div>
          </div>
          <HouseRules />
        </aside>
      </div>

      {/* Mobile Live Rooms drawer */}
      <AnimatePresence>
        {liveOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 lg:hidden flex items-end" onClick={() => setLiveOpen(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.2 }} className="w-full max-h-[85vh] bg-paper rounded-t-2xl p-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="font-display text-sm font-bold text-ink">Live Rooms</span>
                <button onClick={() => setLiveOpen(false)} aria-label="Close"><X className="w-5 h-5 text-soft" /></button>
              </div>
              <LiveRooms me={me} tier={myTier} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PostBody({ body }: { body: string }) {
  if (!body) return null;
  return (
    <p className="text-sm text-midnight-200 font-body leading-relaxed mt-2 whitespace-pre-wrap break-words">
      {linkify(body).map((seg, i) =>
        seg.href ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="text-gold-700 underline break-all">{seg.text}</a>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

function PostAttachment({ url, type, name }: { url: string | null; type: "image" | "video" | null; name?: string }) {
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  if (!url) return null;
  if (type === "video") {
    return <video src={url} controls preload="metadata" playsInline className="mt-2 max-h-[360px] w-auto max-w-full rounded-xl border border-sand bg-night-950" />;
  }
  return (
    <>
      <button type="button" onClick={() => setLightbox(true)} className="mt-2 block cursor-zoom-in" aria-label="Open image full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name || "Shared image"} loading="lazy" className="max-h-[360px] w-auto max-w-full rounded-xl border border-sand" />
      </button>
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setLightbox(false)} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out">
            <button type="button" onClick={() => setLightbox(false)} aria-label="Close image" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name || "Shared image"} className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const ROLE_CHIP: Record<string, string> = {
  coach: "bg-chip-amber text-gold-800",
  admin: "bg-chip-amber text-gold-800",
  parent: "bg-chip-sky text-sky-800",
  child: "bg-chip-green text-green-700",
};

interface EngagementProps {
  post: FeedPost;
  me: Me | null;
  likeCount: number;
  liked: boolean;
  onLike: () => void;
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
  comments?: PostComment[];
  onAddComment: (postId: string, body: string) => Promise<boolean>;
  tierOf: (a: FeedAuthor | null) => FamilyTier;
}

function LikeCommentBar({ liked, likeCount, onLike, commentCount, onToggleComments }: {
  liked: boolean; likeCount: number; onLike: () => void; commentCount: number; onToggleComments: () => void;
}) {
  return (
    <div className="flex items-center gap-4 mt-3">
      <button onClick={onLike} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${liked ? "text-red-500" : "text-soft hover:text-red-500"}`}>
        <Heart className={`w-4 h-4 ${liked ? "fill-red-500" : ""}`} />
        {likeCount > 0 ? likeCount : "Like"}
      </button>
      <button onClick={onToggleComments} className="flex items-center gap-1.5 text-xs font-medium text-soft hover:text-gold-700 transition-colors">
        <MessageCircle className="w-4 h-4" />
        {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "Comment"}
      </button>
    </div>
  );
}

function PostCard(props: EngagementProps & { tier: FamilyTier }) {
  const { post, tier } = props;
  const role = post.author?.role || "parent";
  return (
    <div className="paper-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={post.author?.display_name} avatarUrl={post.author?.avatar_url} role={role} tier={tier} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-ink">{post.author?.display_name || "Member"}</span>
            <AgeBadge role={post.author?.role} ageGroup={post.author?.age_group} />
            <TierBadge tier={tier} size="xs" />
            <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_CHIP[role] || "bg-sand text-soft"}`}>{role}</span>
            <span className="text-[11px] text-soft font-body">{timeAgo(post.created_at)}</span>
          </div>
          <PostBody body={post.body} />
          <PostAttachment url={post.attachment_url} type={post.attachment_type} name={post.attachment_meta?.name} />
          <LikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} />
        </div>
      </div>
      {props.commentsOpen && <CommentThread {...props} />}
    </div>
  );
}

function ActivityCard(props: EngagementProps) {
  const { post } = props;
  const payload = post.activity_payload as ActivityPayload;
  const line = activityLine(payload);
  const Icon = ACTIVITY_ICONS[line.iconKey] || Sparkles;
  return (
    <div className="paper-card p-4 border-l-2 border-l-gold-300">
      <div className="flex items-start gap-3">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${line.accent}`}><Icon className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-midnight-200 font-body leading-relaxed">
            <span className="font-display font-semibold text-ink">{line.subject}</span>
            {payload.actor_age_group || payload.actor_role ? (
              <> <AgeBadge role={payload.actor_role} ageGroup={payload.actor_age_group} className="align-middle" /></>
            ) : null}{" "}
            {line.verb} <span className="font-semibold text-ink">{line.target}</span>
            {payload.family_name ? <span className="text-soft"> · {payload.family_name}</span> : null}
          </p>
          <span className="text-[11px] text-soft font-body">{timeAgo(post.created_at)}</span>
          <LikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} />
        </div>
      </div>
      {props.commentsOpen && <CommentThread {...props} />}
    </div>
  );
}

function CommentThread(props: EngagementProps) {
  const { post, me, comments, onAddComment } = props;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const body = draft.trim();
    if (!body || sending || !me) return;
    setSending(true);
    setErr(null);
    const ok = await onAddComment(post.id, body);
    if (ok) setDraft("");
    else setErr(PROFANITY_MESSAGE);
    setSending(false);
  }

  return (
    <div className="mt-3 pt-3 border-t border-sand space-y-3">
      {comments === undefined ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 text-gold-500 animate-spin" /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-soft">No comments yet — be the first to reply.</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-display text-xs font-semibold text-ink">{c.author?.display_name || "Member"}</span>
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="text-[10px] text-soft">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-xs text-midnight-200 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
            </div>
          </div>
        ))
      )}
      {me && (
        <div>
          {err && <p className="text-[11px] text-red-600 mb-1">{err}</p>}
          <div className="flex items-end gap-2">
            <Avatar name={me.display_name} avatarUrl={me.avatar_url} role={me.role} size="sm" />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Write a reply…"
              className="flex-1 resize-none bg-paper border border-sand rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 max-h-24"
            />
            <button onClick={submit} disabled={!draft.trim() || sending} aria-label="Reply" className="cta-button w-8 h-8 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnchorCard({ post, onReply }: { post: FeedPost; onReply: () => void }) {
  const a = post.activity_payload as AnchorPayload;
  return (
    <div className="paper-card p-5 bg-chip-amber/30 border-gold-300">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg bg-gold-500/20 text-gold-700 flex items-center justify-center"><Pin className="w-4 h-4" /></span>
        <div>
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-gold-700">This Week in the Club</p>
          <h3 className="font-display text-base font-bold text-ink leading-tight">{a.class_title || "This week"}</h3>
        </div>
      </div>
      {a.company_name && (
        <div className="flex items-center gap-2 text-sm text-midnight-200 mb-2">
          <BookOpen className="w-4 h-4 text-gold-600" />
          <span>Company of the Week: <span className="font-semibold text-ink">{a.company_name}</span>{a.company_ticker ? ` (${a.company_ticker})` : ""}</span>
        </div>
      )}
      {a.discussion_question && (
        <div className="rounded-lg bg-midnight-900/70 border border-gold-200 p-3 mb-2">
          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-soft mb-1">Family discussion</p>
          <p className="text-sm text-ink font-body">{a.discussion_question}</p>
        </div>
      )}
      {a.family_assignment && (
        <div className="rounded-lg bg-midnight-900/70 border border-gold-200 p-3 mb-3">
          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-soft mb-1">Your family&apos;s job</p>
          <p className="text-sm text-ink font-body">{a.family_assignment}</p>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onReply} className="cta-button inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs">
          <MessageCircle className="w-3.5 h-3.5" /> Post your family&apos;s pick
        </button>
        <Link href="/dashboard?tab=this-week" className="text-xs font-semibold text-gold-700 hover:text-gold-600 inline-flex items-center gap-1">
          Open This Week <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ThisWeekSnapshot({ post }: { post: FeedPost }) {
  const a = post.activity_payload as AnchorPayload;
  return (
    <div className="paper-card p-4">
      <h3 className="font-display text-xs font-semibold text-soft uppercase tracking-wider mb-2">This Week snapshot</h3>
      <p className="font-display text-sm font-bold text-ink">{a.class_title}</p>
      {a.company_name && <p className="text-xs text-soft mt-0.5">Company: {a.company_name}{a.company_ticker ? ` (${a.company_ticker})` : ""}</p>}
      {a.kid_challenge && (
        <div className="mt-2 rounded-lg bg-paper border border-sand p-2.5">
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-gold-700 mb-0.5">Kid challenge</p>
          <p className="text-xs text-midnight-200">{a.kid_challenge}</p>
        </div>
      )}
    </div>
  );
}

function HouseRules() {
  return (
    <div className="paper-card p-4">
      <h3 className="font-display text-xs font-semibold text-soft uppercase tracking-wider mb-3">House rules</h3>
      <ul className="space-y-2 text-sm text-midnight-200 font-body">
        <li className="flex gap-2"><span className="text-gold-600">•</span> We&apos;re here to learn — no dumb questions, we all started somewhere.</li>
        <li className="flex gap-2"><span className="text-gold-600">•</span> Be kind and celebrate each other — kids are in the club too.</li>
        <li className="flex gap-2"><span className="text-gold-600">•</span> Education only — no financial advice, hot tips, or &quot;buy this now.&quot;</li>
        <li className="flex gap-2"><span className="text-gold-600">•</span> Practice money only. We never pressure anyone to trade for real.</li>
      </ul>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-gold-700">
        <Icon className="w-3.5 h-3.5" />
        <p className="font-display text-lg font-bold text-ink">{value}</p>
      </div>
      <p className="text-[11px] text-soft font-body mt-0.5">{label}</p>
    </div>
  );
}
