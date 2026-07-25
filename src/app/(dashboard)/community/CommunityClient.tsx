"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  AtSign, Send, Trophy, Heart, MessageCircle, Sparkles,
  ArrowRight, Paperclip, X, Film, Loader2, Link2,
  Award, Eye, CheckCircle2, Target, Calendar, Pin,
  Tag, TrendingUp, TrendingDown, Minus, MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import {
  getClubTier,
  getFamilyTierMap,
  type FamilyTier,
} from "@/lib/tier";
import { fetchXpForUsers } from "@/lib/belts";
import { evaluateBadges } from "@/lib/badges";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import {
  activityLine, isWatchlistShare, timeAgo, parseTickerTags, POSITION_META,
  type WatchlistSharePayload, type PostPosition,
  type FeedPost, type FeedAuthor, type PostComment, type ActivityPayload,
  type AnchorPayload, type Role,
} from "@/lib/feed";
import { MentionProvider, RichBody, extractHandles, type MentionMap } from "@/lib/mentions";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import AgeBadge from "@/components/community/AgeBadge";
import ClubChatDrawer from "@/components/community/ClubChatDrawer";
import AnnouncementCard from "@/components/community/AnnouncementCard";
import CompanyLogo from "@/components/fic/CompanyLogo";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  award: Award, eye: Eye, check: CheckCircle2, target: Target,
  calendar: Calendar, trophy: Trophy, sparkles: Sparkles, heart: Heart,
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
  username: string | null;
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
  "author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";
const COMMENT_AUTHOR_SEL =
  "author:profiles!post_comments_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";

function normAuthor(a: FeedAuthor | FeedAuthor[] | null): FeedAuthor | null {
  return Array.isArray(a) ? a[0] ?? null : a;
}

export default function CommunityClient({
  initialData = null,
}: {
  initialData?: CommunityFeedSeed | null;
}) {
  const supabase = createClient();
  // Server-first: when the feed is seeded, the states below start populated so
  // the feed paints on first paint; the initial client load is skipped (polling
  // + badge eval still run). A null seed falls back to the original full load.
  const seeded = initialData != null;
  // Posts present at first paint (server-seeded) render at their target state
  // with NO entrance animation (initial={false}), so the LCP text isn't held at
  // opacity:0 until hydration finishes. Posts that arrive later (polling /
  // optimistic new post) aren't in this set and keep the fade-in entrance.
  const seededPostIds = useRef<Set<string>>(
    new Set((initialData?.posts ?? []).map((p) => p.id))
  );

  const [me, setMe] = useState<Me | null>(initialData?.me ?? null);
  const [myTier, setMyTier] = useState<FamilyTier>(initialData?.myTier ?? "fic");
  // myTier defaults to 'fic' before the fetch lands, so a FREE viewer would
  // briefly see the member composer before the read-only join band settles.
  // Gate the composer slot on this flag — render NEITHER the composer nor the
  // upsell until the real tier is known, so free users never see the flash.
  const [tierResolved, setTierResolved] = useState(seeded);
  const [posts, setPosts] = useState<FeedPost[]>(initialData?.posts ?? []);
  const [loading, setLoading] = useState(!seeded);

  // Likes + comments state
  const [likeCount, setLikeCount] = useState<Record<string, number>>(
    initialData?.likeCount ?? {}
  );
  const [likedByMe, setLikedByMe] = useState<Set<string>>(
    () => new Set(initialData?.likedByMe ?? [])
  );
  const [commentCount, setCommentCount] = useState<Record<string, number>>(
    initialData?.commentCount ?? {}
  );
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});

  // @mention → username map (batched; resolves @handles in bodies to profile links)
  const [mentions, setMentions] = useState<MentionMap>(initialData?.mentions ?? {});
  const mentionsRef = useRef(mentions);
  mentionsRef.current = mentions;
  const resolveMentions = useCallback(
    async (bodies: Array<string | null | undefined>) => {
      const handles = extractHandles(bodies).filter((h) => !(h in mentionsRef.current));
      if (!handles.length) return;
      const { data } = await supabase.rpc("public_profile_mentions", { p_handles: handles });
      if (!data) return;
      setMentions((prev) => {
        const next = { ...prev };
        for (const r of data as { handle: string; username: string }[]) {
          if (r.handle && r.username && !(r.handle in next)) next[r.handle] = r.username;
        }
        return next;
      });
    },
    [supabase]
  );

  // Tier map for author badges (batched)
  const [tiers, setTiers] = useState<Record<string, FamilyTier>>(initialData?.tiers ?? {});
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

  // Batched belt XP for author belt rings (one RPC per batch, never N+1)
  const [beltXp, setBeltXp] = useState<Record<string, number>>(initialData?.beltXp ?? {});
  const beltXpRef = useRef(beltXp);
  beltXpRef.current = beltXp;
  const loadXp = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const missing = ids.filter((id): id is string => !!id && !(id in beltXpRef.current));
      if (!missing.length) return;
      const fetched = await fetchXpForUsers(supabase, missing);
      setBeltXp((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = fetched[id] ?? 0;
        return next;
      });
    },
    [supabase]
  );
  const xpOf = useCallback(
    (userId: string | null | undefined): number => (userId && beltXp[userId]) || 0,
    [beltXp]
  );

  // Composer
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  // Deep-link prefill: the challenge thank-you "commitment step" sends members
  // here with ?compose=<intro template>. Seed the composer once, when the member
  // composer is actually rendered (not for read-only free viewers), then focus +
  // scroll it into view and strip the param so a refresh doesn't re-seed.
  const composeSeeded = useRef(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // R5 composer additions: ticker tags + optional bull/neutral/bear stance.
  const [tickerDraft, setTickerDraft] = useState("");
  const [tickerTags, setTickerTags] = useState<string[]>([]);
  const [position, setPosition] = useState<PostPosition | null>(null);
  const [showTagger, setShowTagger] = useState(false);
  function commitTicker(raw: string) {
    const parsed = parseTickerTags(raw + " " + tickerTags.join(" "));
    setTickerTags(parsed);
    setTickerDraft("");
  }
  function removeTicker(t: string) {
    setTickerTags((prev) => prev.filter((x) => x !== t));
  }

  // R5 feed tabs
  const [tab, setTab] = useState<"foryou" | "following" | "research" | "discussions">("foryou");

  // Mobile Live Rooms drawer

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
    const people = roster
      .filter((p) => p.id !== me?.id)
      .filter((p) => p.stripped.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q))
      .slice(0, 6);
    // Admins only: @everyone broadcasts to all members (migration 091). Inert
    // text for everyone else, so it is offered only to admins.
    if (me?.role === "admin" && "everyone".startsWith(q)) {
      return [
        { id: "__everyone__", name: "Everyone", stripped: "everyone", avatar_url: null },
        ...people,
      ];
    }
    return people;
  }, [mention, roster, me?.id, me?.role]);
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
          `id, author_id, family_id, kind, body, title, link, audience, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, ticker_tags, position, created_at, ${AUTHOR_SEL}`
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
      loadXp([me?.id, ...norm.map((p) => p.author?.id)]);
      resolveMentions(norm.map((p) => p.body));

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
    [supabase, loadTiers, resolveMentions]
  );

  // Initial load
  useEffect(() => {
    let mounted = true;
    // Server-first: the feed + profile + tier are already seeded. Skip the whole
    // client load (no duplicate fetch, no skeleton flash); just run the
    // post-paint badge evaluation that the original load did.
    if (seeded) {
      if (initialData?.me?.id) evaluateBadges(supabase, initialData.me.id);
      return () => {
        mounted = false;
      };
    }
    (async () => {
      // getSession() is a local read (no network); RLS still guards every query.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid: string | null = session?.user?.id ?? null;

      // Fire the three independent reads together: the feed (the actual
      // content), the viewer's profile, and the community stat counts. The feed
      // no longer waits behind the profile + tier lookups.
      const profileP = (async () => {
        if (!uid) return null;
        const { data } = await supabase
          .from("profiles")
          .select("display_name, role, age_group, family_id, avatar_url, username")
          .eq("id", uid)
          .single();
        return data;
      })();

      const feedP = loadFeed(uid);

      const profile = await profileP;
      if (profile && uid && mounted) {
        setMe({
          id: uid,
          display_name: profile.display_name || "You",
          role: (profile.role as Role) || "parent",
          age_group: profile.age_group,
          family_id: profile.family_id ?? null,
          avatar_url: profile.avatar_url ?? null,
          username: profile.username ?? null,
        });
        // Tier badge + badge evaluation are non-critical chrome — resolve them
        // after paint so they never hold up the feed.
        getClubTier(supabase, profile.family_id)
          .then((t) => {
            if (mounted) setMyTier(t);
          })
          .finally(() => {
            if (mounted) setTierResolved(true);
          });
        evaluateBadges(supabase, uid);
      } else if (mounted) {
        // No signed-in profile (shouldn't happen behind the guard) — resolve so
        // the composer slot isn't stuck blank forever.
        setTierResolved(true);
      }

      await feedP;
      if (mounted) {
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
      .insert({
        author_id: me.id, family_id: me.family_id, kind: "post", body,
        ticker_tags: tickerTags,
        position: tickerTags.length ? position : null,
        ...(attachmentFields || {}),
      })
      .select(`id, author_id, family_id, kind, body, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, ticker_tags, position, created_at`)
      .single();

    if (!error && data) {
      const newPost: FeedPost = {
        ...(data as unknown as FeedPost),
        author: {
          id: me.id, display_name: me.display_name, role: me.role,
          age_group: me.age_group, family_id: me.family_id, avatar_url: me.avatar_url,
          username: me.username,
        },
      };
      setPosts((prev) => [newPost, ...prev]);
      resolveMentions([body]);
      setText("");
      setTickerTags([]);
      setTickerDraft("");
      setPosition(null);
      setShowTagger(false);
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
      loadXp(norm.map((c) => c.author?.id));
      resolveMentions(norm.map((c) => c.body));
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
        username: me.username,
      },
    };
    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), comment] }));
    setCommentCount((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    resolveMentions([body]);
    return true;
  }

  const tierOf = (a: FeedAuthor | null): FamilyTier => (a?.family_id && tiers[a.family_id]) || "fic";

  // FREE-tier families can VIEW the feed + rooms but can't post, like, or
  // comment. Every write affordance is swapped for a tasteful "Join FIC" nudge.
  const readOnly = myTier === "free";

  // ?compose= deep-link → seed the composer once (member composer only).
  useEffect(() => {
    if (composeSeeded.current || !tierResolved || readOnly) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seed = params.get("compose");
    if (!seed) return;
    composeSeeded.current = true;
    setText(seed);
    // Strip the param so a refresh / back doesn't re-seed over their edits.
    params.delete("compose");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
    // Focus + reveal the composer and drop the caret at the end.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
      el.setSelectionRange(seed.length, seed.length);
    });
  }, [tierResolved, readOnly]);

  const anchor = posts.find((p) => p.kind === "anchor");
  // Latest announcement pins above the feed for 7 days; older ones flow in-feed.
  const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
  const pinnedAnnouncement = posts.find(
    (p) => p.kind === "announcement" && Date.now() - new Date(p.created_at).getTime() < SEVEN_DAYS
  );
  const feedList = posts.filter(
    (p) => p.kind !== "anchor" && p.id !== pinnedAnnouncement?.id
  );

  // ── R5 tabs ──────────────────────────────────────────────────────────────
  // Following = authors whose posts the viewer has liked ("members whose picks
  // they liked"). Derived honestly from the like state already in memory.
  const followedAuthorIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of posts) {
      if (likedByMe.has(p.id) && p.author?.id && p.author.id !== me?.id) {
        s.add(p.author.id);
      }
    }
    return s;
  }, [posts, likedByMe, me?.id]);

  const hasTicker = (p: FeedPost) => (p.ticker_tags?.length ?? 0) > 0;

  const displayList = useMemo(() => {
    switch (tab) {
      case "following":
        return feedList.filter((p) => p.author?.id && followedAuthorIds.has(p.author.id));
      case "research":
        // Typed contributions stream: posts that tag a ticker or share a pick.
        return feedList.filter((p) => hasTicker(p) || isWatchlistShare(p.activity_payload));
      case "discussions":
        return feedList.filter(hasTicker);
      default:
        return feedList;
    }
  }, [tab, feedList, followedAuthorIds]);

  // Discussions view groups the ticker-tagged posts into per-ticker threads.
  const discussionThreads = useMemo(() => {
    if (tab !== "discussions") return [];
    const byTicker = new Map<string, FeedPost[]>();
    for (const p of displayList) {
      for (const t of p.ticker_tags ?? []) {
        const arr = byTicker.get(t) ?? [];
        arr.push(p);
        byTicker.set(t, arr);
      }
    }
    return Array.from(byTicker.entries())
      .map(([ticker, list]) => ({ ticker, list }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [tab, displayList]);

  const TABS = [
    { key: "foryou", label: "For You" },
    { key: "following", label: "Following" },
    { key: "research", label: "Research" },
    { key: "discussions", label: "Discussions" },
  ] as const;

  const EMPTY_COPY: Record<typeof tab, { title: string; body: string }> = {
    foryou: {
      title: "The club is just getting started",
      body: "Share a win, ask a question, or post your family's pick. Every badge, mission, and watchlist add shows up here too.",
    },
    following: {
      title: "You're not following anyone yet",
      body: "Like a member's post and their updates gather here — a quieter feed of the people whose picks you trust.",
    },
    research: {
      title: "No research shared yet",
      body: "Tag a ticker on your next post to add it here — the club's running stream of ideas, notes, and theses.",
    },
    discussions: {
      title: "No ticker discussions yet",
      body: "Tag a ticker like $NVDA on a post to start a thread. Every tagged post joins that ticker's conversation.",
    },
  };

  return (
    <MentionProvider map={mentions}>
    <div className="max-w-2xl mx-auto">
      <div className="space-y-4">
        {/* Main feed — full width now that Club Chat lives in a drawer */}
        <div className="min-w-0 space-y-4">
          {/* VIP Room entry — gated: only renders for Challenge VIP members. */}
          <VipRoomBanner />

          {/* Pinned This Week — one-line strip into the academy This Week tab */}
          {anchor && <ThisWeekStrip post={anchor} />}

          {/* Pinned latest announcement (first 7 days) */}
          {pinnedAnnouncement && <AnnouncementCard post={pinnedAnnouncement} pinned />}

          {/* Composer — or a read-only upsell for free members. Render NEITHER
              until the tier is known, so a free viewer never flashes the member
              composer while getFamilyTier is still in flight. A quiet skeleton
              holds the slot's height to avoid a layout jump. */}
          {!tierResolved ? (
            <div className="paper-card p-4">
              <div className="flex gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-sand/60 shrink-0" />
                <div className="flex-1 h-[76px] rounded-lg bg-sand/40" />
              </div>
            </div>
          ) : readOnly ? (
            <FreeComposerUpsell />
          ) : (
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

                {/* R5 ticker tagger + positioning */}
                {showTagger && (
                  <div className="mt-2 rounded-lg border border-sand bg-paper p-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tickerTags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 bg-chip-amber text-gold-800 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded">
                          ${t}
                          <button type="button" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`} className="hover:text-gold-900">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {tickerTags.length < 4 && (
                        <input
                          value={tickerDraft}
                          onChange={(e) => setTickerDraft(e.target.value.replace(/[^A-Za-z ,]/g, ""))}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " " || e.key === ",") && tickerDraft.trim()) {
                              e.preventDefault();
                              commitTicker(tickerDraft);
                            }
                          }}
                          onBlur={() => tickerDraft.trim() && commitTicker(tickerDraft)}
                          placeholder={tickerTags.length ? "add another…" : "Tag a ticker — e.g. NVDA"}
                          className="flex-1 min-w-[120px] bg-transparent text-xs text-ink placeholder:text-soft font-mono uppercase focus:outline-none"
                        />
                      )}
                    </div>
                    {tickerTags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-sand">
                        <span className="text-[10px] text-soft font-display uppercase tracking-wider mr-0.5">Leaning</span>
                        {(["bull", "neutral", "bear"] as PostPosition[]).map((p) => {
                          const meta = POSITION_META[p];
                          const Icon = p === "bull" ? TrendingUp : p === "bear" ? TrendingDown : Minus;
                          const active = position === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPosition(active ? null : p)}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${active ? meta.chip + " ring-1 ring-current" : "bg-sand/60 text-soft hover:text-ink"}`}
                            >
                              <Icon className="w-3 h-3" />{meta.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input ref={fileRef} type="file" accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach a photo or video" title="Attach a photo or video" className="flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-gold-700 hover:border-gold-300 disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
                    <button type="button" onClick={insertLink} disabled={posting} aria-label="Add a link" title="Add a link" className="flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-gold-700 hover:border-gold-300 disabled:opacity-40"><Link2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setShowTagger((v) => !v)} disabled={posting} aria-label="Tag a ticker" title="Tag a ticker" className={`flex items-center justify-center w-8 h-8 rounded-lg border disabled:opacity-40 ${showTagger || tickerTags.length ? "border-gold-300 text-gold-700 bg-chip-amber/40" : "border-sand text-soft hover:text-gold-700 hover:border-gold-300"}`}><Tag className="w-4 h-4" /></button>
                  </div>
                  <button onClick={submitPost} disabled={(!text.trim() && !attachment) || posting || !me} className="cta-button flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send className="w-3.5 h-3.5" />{uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* R5 feed tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-display font-semibold transition-colors ${tab === t.key ? "bg-gold-500 text-white" : "text-soft hover:text-ink hover:bg-sand/60"}`}
              >
                {t.label}
              </button>
            ))}
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
          ) : displayList.length === 0 ? (
            <div className="paper-card p-10 text-center">
              {tab === "discussions" ? <MessageSquare className="w-7 h-7 text-gold-500 mx-auto mb-3" /> : <Sparkles className="w-7 h-7 text-gold-500 mx-auto mb-3" />}
              <p className="font-display text-base font-semibold text-ink mb-1">{EMPTY_COPY[tab].title}</p>
              <p className="text-sm text-soft font-body max-w-sm mx-auto">{EMPTY_COPY[tab].body}</p>
            </div>
          ) : tab === "discussions" ? (
            <div className="space-y-4">
              {discussionThreads.map(({ ticker, list }) => (
                <div key={ticker} className="paper-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Link href={`/research/${encodeURIComponent(ticker)}`} className="inline-flex items-center gap-1.5 font-mono font-bold text-ink hover:text-gold-700">
                      <span className="text-gold-600">$</span>{ticker}
                    </Link>
                    <span className="text-[11px] text-soft font-body">{list.length} {list.length === 1 ? "post" : "posts"}</span>
                    <Link href={`/research/${encodeURIComponent(ticker)}`} className="ml-auto text-xs font-semibold text-gold-700 hover:text-gold-600 inline-flex items-center gap-1">Research <ArrowRight className="w-3.5 h-3.5" /></Link>
                  </div>
                  <div className="space-y-3">
                    {list.slice(0, 4).map((p) => (
                      <DiscussionRow key={p.id} post={p} tier={tierOf(p.author)} xpOf={xpOf} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {displayList.map((p, i) => (
                <m.div key={p.id} initial={seededPostIds.current.has(p.id) ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
                  {p.kind === "announcement" ? (
                    <AnnouncementCard post={p} />
                  ) : p.kind === "activity" ? (
                    <ActivityCard
                      post={p} me={me} readOnly={readOnly}
                      likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                      commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                      comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf} xpOf={xpOf}
                    />
                  ) : (
                    <PostCard
                      post={p} me={me} tier={tierOf(p.author)} readOnly={readOnly}
                      likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                      commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                      comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf} xpOf={xpOf}
                    />
                  )}
                </m.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Club Chat — always one tap away via the shared drawer */}
      <ClubChatDrawer key={myTier} me={me} tier={myTier} />
    </div>
    </MentionProvider>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PostBody({ body }: { body: string }) {
  if (!body) return null;
  return (
    <p className="text-sm text-midnight-200 font-body leading-relaxed mt-2 whitespace-pre-wrap break-words">
      <RichBody body={body} />
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
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setLightbox(false)} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out">
            <button type="button" onClick={() => setLightbox(false)} aria-label="Close image" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name || "Shared image"} className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          </m.div>
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
  readOnly?: boolean;
  likeCount: number;
  liked: boolean;
  onLike: () => void;
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
  comments?: PostComment[];
  onAddComment: (postId: string, body: string) => Promise<boolean>;
  tierOf: (a: FeedAuthor | null) => FamilyTier;
  xpOf?: (userId: string | null | undefined) => number;
}

function LikeCommentBar({ liked, likeCount, onLike, commentCount, onToggleComments, readOnly }: {
  liked: boolean; likeCount: number; onLike: () => void; commentCount: number; onToggleComments: () => void; readOnly?: boolean;
}) {
  // Free members: counts stay visible (they can read the conversation) but the
  // like affordance is inert. The comment button still opens the thread to read.
  return (
    <div className="flex items-center gap-4 mt-3">
      <button
        onClick={readOnly ? undefined : onLike}
        disabled={readOnly}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${readOnly ? "text-soft cursor-default" : liked ? "text-red-500" : "text-soft hover:text-red-500"}`}
      >
        <Heart className={`w-4 h-4 ${liked && !readOnly ? "fill-red-500" : ""}`} />
        {likeCount > 0 ? likeCount : "Like"}
      </button>
      <button onClick={onToggleComments} className="flex items-center gap-1.5 text-xs font-medium text-soft hover:text-gold-700 transition-colors">
        <MessageCircle className="w-4 h-4" />
        {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "Comment"}
      </button>
    </div>
  );
}

// Read-only community composer for free members — a warm "Join FIC to post" card.
function FreeComposerUpsell() {
  return (
    <div className="paper-card p-5 flex items-center gap-4 ring-1 ring-gold-300">
      <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
        <Sparkles className="w-6 h-6 text-gold-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-ink">You&apos;re viewing the club as a free member</p>
        <p className="text-sm text-soft">Join FIC to post, like, and comment with the community.</p>
      </div>
      <a
        href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a"
        className="cta-button inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs shrink-0"
      >
        Join FIC <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

// R5 — ticker-tag chips + optional positioning stance beneath a post body.
function TickerRow({ tags, position }: { tags?: string[] | null; position?: PostPosition | null }) {
  if (!tags?.length) return null;
  const pmeta = position ? POSITION_META[position] : null;
  const PIcon = position === "bull" ? TrendingUp : position === "bear" ? TrendingDown : Minus;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {tags.map((t) => (
        <Link key={t} href={`/research/${encodeURIComponent(t)}`} className="inline-flex items-center bg-chip-amber text-gold-800 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded hover:bg-gold-400/30">
          ${t}
        </Link>
      ))}
      {pmeta && (
        <span className={`inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${pmeta.chip}`}>
          <PIcon className="w-3 h-3" />{pmeta.label}
        </span>
      )}
    </div>
  );
}

// R5 — compact post row inside a Discussions ticker thread.
function DiscussionRow({ post, tier, xpOf }: { post: FeedPost; tier: FamilyTier; xpOf?: (id: string | null | undefined) => number }) {
  const pmeta = post.position ? POSITION_META[post.position] : null;
  return (
    <div className="flex items-start gap-2.5">
      <ProfileLink username={post.author?.username} variant="avatar">
        <Avatar name={post.author?.display_name} avatarUrl={post.author?.avatar_url} role={post.author?.role} tier={tier} xp={xpOf?.(post.author?.id)} size="sm" />
      </ProfileLink>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ProfileLink username={post.author?.username} className="font-display text-xs font-semibold text-ink">{post.author?.display_name || "Member"}</ProfileLink>
          {pmeta && <span className={`inline-flex items-center gap-0.5 text-[10px] font-display font-bold uppercase tracking-wider px-1 py-0.5 rounded ${pmeta.chip}`}><span className={`w-1.5 h-1.5 rounded-full ${pmeta.dot}`} />{pmeta.label}</span>}
          <span className="text-[10px] text-soft">{timeAgo(post.created_at)}</span>
        </div>
        {post.body && <p className="text-xs text-midnight-200 mt-0.5 line-clamp-3 whitespace-pre-wrap break-words"><RichBody body={post.body} /></p>}
      </div>
    </div>
  );
}

function PostCard(props: EngagementProps & { tier: FamilyTier }) {
  const { post, tier } = props;
  const role = post.author?.role || "parent";
  return (
    <div className="paper-card p-4">
      <div className="flex items-start gap-3">
        <ProfileLink username={post.author?.username} variant="avatar">
          <Avatar name={post.author?.display_name} avatarUrl={post.author?.avatar_url} role={role} tier={tier} xp={props.xpOf?.(post.author?.id)} size="lg" />
        </ProfileLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ProfileLink username={post.author?.username} className="font-display text-sm font-semibold text-ink">
              {post.author?.display_name || "Member"}
            </ProfileLink>
            <AgeBadge role={post.author?.role} ageGroup={post.author?.age_group} />
            <TierBadge tier={tier} size="xs" />
            <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_CHIP[role] || "bg-sand text-soft"}`}>{role}</span>
            <span className="text-[11px] text-soft font-body">{timeAgo(post.created_at)}</span>
          </div>
          <PostBody body={post.body} />
          <TickerRow tags={post.ticker_tags} position={post.position} />
          {isWatchlistShare(post.activity_payload) && (
            <WatchlistShareCard payload={post.activity_payload} />
          )}
          <PostAttachment url={post.attachment_url} type={post.attachment_type} name={post.attachment_meta?.name} />
          <LikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} readOnly={props.readOnly} />
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
            <ProfileLink username={post.author?.username} className="font-display font-semibold text-ink">
              {line.subject}
            </ProfileLink>
            {payload.actor_age_group || payload.actor_role ? (
              <> <AgeBadge role={payload.actor_role} ageGroup={payload.actor_age_group} className="align-middle" /></>
            ) : null}{" "}
            {line.verb}{" "}
            {payload.type === "ticker_like_milestone" && payload.ticker ? (
              <Link href={`/research/${encodeURIComponent(payload.ticker)}`} className="font-semibold text-gold-700 hover:text-gold-800">
                {line.target}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{line.target}</span>
            )}
            {payload.family_name ? <span className="text-soft"> · {payload.family_name}</span> : null}
          </p>
          <span className="text-[11px] text-soft font-body">{timeAgo(post.created_at)}</span>
          <LikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} readOnly={props.readOnly} />
        </div>
      </div>
      {props.commentsOpen && <CommentThread {...props} />}
    </div>
  );
}

const SHARE_STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  watch: { label: "Watching", chip: "bg-chip-sky text-sky-800" },
  study: { label: "Studying", chip: "bg-chip-amber text-gold-800" },
  favorite: { label: "Family favorite", chip: "bg-chip-green text-green-700" },
  avoid: { label: "Decided to avoid", chip: "bg-sand text-red-700" },
};

function WatchlistShareCard({ payload }: { payload: WatchlistSharePayload }) {
  const [quote, setQuote] = useState<{ price: number; changePct: number } | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/market/quote?symbol=${encodeURIComponent(payload.ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted) return;
        const q = data?.quote;
        if (q && typeof q.price === "number") {
          setQuote({ price: q.price, changePct: Number(q.changePercent) || 0 });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [payload.ticker]);

  const status = SHARE_STATUS_CHIP[payload.status] || SHARE_STATUS_CHIP.watch;
  const thesis = payload.why_we_picked || payload.bull_case;
  return (
    <Link
      href={`/research/${encodeURIComponent(payload.ticker)}`}
      className="mt-2 block rounded-xl border border-sand bg-paper p-3 hover:border-gold-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={payload.ticker} name={payload.company_name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-bold text-ink truncate">{payload.company_name}</span>
            <span className="text-[11px] font-mono text-soft">{payload.ticker}</span>
            <span className={`text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${status.chip}`}>{status.label}</span>
          </div>
          {quote && (
            <p className="text-xs font-body mt-0.5">
              <span className="font-semibold text-ink">${quote.price.toFixed(2)}</span>{" "}
              <span className={quote.changePct >= 0 ? "text-green-700" : "text-red-700"}>
                {quote.changePct >= 0 ? "+" : ""}
                {quote.changePct.toFixed(2)}% today
              </span>{" "}
              <span className="text-soft">· delayed</span>
            </p>
          )}
        </div>
      </div>
      {thesis && (
        <p className="mt-2 text-xs text-soft font-body italic line-clamp-2">&ldquo;{thesis}&rdquo;</p>
      )}
      {payload.champion_name && (
        <p className="mt-1 text-[11px] text-soft font-body">Championed by {payload.champion_name}</p>
      )}
    </Link>
  );
}

function CommentThread(props: EngagementProps) {
  const { post, me, comments, onAddComment, readOnly, xpOf } = props;
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
            <ProfileLink username={c.author?.username} variant="avatar">
              <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} xp={xpOf?.(c.author?.id)} size="sm" />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ProfileLink username={c.author?.username} className="font-display text-xs font-semibold text-ink">
                  {c.author?.display_name || "Member"}
                </ProfileLink>
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="text-[10px] text-soft">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-xs text-midnight-200 whitespace-pre-wrap break-words mt-0.5"><RichBody body={c.body} /></p>
            </div>
          </div>
        ))
      )}
      {me && readOnly && (
        <p className="text-xs text-soft">
          <a href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a" className="text-gold-700 font-semibold">Join FIC</a>{" "}
          to join the conversation.
        </p>
      )}
      {me && !readOnly && (
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

/**
 * One-line pinned "This Week" strip (was the full AnchorCard). The academy This
 * Week detail lives on the Home tab — this just points there so the feed stays
 * the star of /community.
 */
function ThisWeekStrip({ post }: { post: FeedPost }) {
  const a = post.activity_payload as AnchorPayload;
  return (
    <Link
      href="/dashboard?tab=this-week"
      className="paper-card bg-chip-amber/30 border-gold-300 px-4 py-3 flex items-center gap-3 hover:border-gold-400 transition-colors group"
    >
      <span className="w-7 h-7 rounded-lg bg-gold-500/20 text-gold-700 flex items-center justify-center shrink-0">
        <Pin className="w-3.5 h-3.5" />
      </span>
      <p className="text-sm text-ink min-w-0 truncate">
        <span className="font-display font-bold text-gold-700">This Week:</span>{" "}
        <span className="font-semibold">{a.class_title || "This week in the club"}</span>
      </p>
      <span className="ml-auto shrink-0 text-xs font-semibold text-gold-700 inline-flex items-center gap-1 group-hover:text-gold-600">
        Open <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

// ── VIP Room banner (Lane C9) ────────────────────────────────────────────────
// Self-contained, gated entry point into the private VIP room. Fetches VIP
// status once; renders nothing for non-VIP members (visible only to tier=vip).
function VipRoomBanner() {
  const [vip, setVip] = useState(false);
  useEffect(() => {
    let on = true;
    fetch("/api/challenge/vip-room")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (on && d?.vip) setVip(true);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  if (!vip) return null;
  return (
    <Link
      href="/vip-room"
      className="paper-card ring-1 ring-gold-300 p-4 flex items-center gap-3 hover:ring-gold-400 transition-colors"
    >
      <span className="w-10 h-10 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
        <Sparkles className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-ink text-[15px] leading-snug">
          Your VIP Room
        </span>
        <span className="block text-xs text-soft">
          A private space for VIP members — open through the challenge.
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-gold-600 shrink-0" />
    </Link>
  );
}
