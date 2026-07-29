"use client";

/**
 * THE CLUB · FEED — v2 canvas (DESIGN-UX-SPEC + board 04 "Club · Feed").
 *
 * Rendered ONLY behind designV2Enabled() (ClubModeShellV2 mounts it). This is a
 * STANDALONE re-skin of ./CommunityClient — it duplicates that file's state,
 * handlers and effects verbatim (they are logic, not chrome) and rebuilds the
 * presentation on the cc canvas. The v1 CommunityClient is left untouched so its
 * other render path stays byte-identical when the flag is off.
 *
 * SAME DATA READS. Nothing new is fetched except the HAPPENING NOW rail, which
 * reads the SAME real circles source /circles uses (listCircles). No number is
 * invented; below a floor the surface renders founding copy, never a faked crowd.
 *
 * COLOUR LAW (DESIGN-UX-SPEC §1-3, outranks the mockup literals):
 *   · orange = brand/live + the ONE primary CTA (the composer's Post button).
 *   · a member's STANCE is an OPINION, never green/pink — rendered as a neutral
 *     mono label (bull/neutral/bear carried by the WORD + ▲—▼, not by hue).
 *   · a LIKE is community sentiment — kept non-red (a soft/ink toggle, never a
 *     red heart, never the price ramp).
 *   · belt colour rings the author's avatar from REAL data (beltForXp(xpOf(id))),
 *     white belt at 0 xp (the honest default the ladder returns).
 *
 * HONEST-DATA DECISIONS:
 *   · The board's "Kai Insight" feed-injection card is OMITTED — there is no
 *     backend for it, and a fabricated whale-flow card would be invented data.
 *   · Reactions are like-count + comment-count only (the two real toggles); the
 *     board's 💡 / 🔖 are dropped (no backend).
 *   · HAPPENING NOW renders real open circles or is omitted entirely.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  AtSign, Send, Paperclip, X, Film, Loader2, Link2,
  Award, Eye, CheckCircle2, Target, Calendar, Trophy, Heart, Sparkles,
  Tag, ChevronDown, MoreHorizontal, Pencil, Trash2, ArrowRight,
  ThumbsUp, MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, countXpToday, getUserXp } from "@/lib/xp";
import { useXpAward } from "@/components/canvas2";
import { getClubTier, getFamilyTierMap, type FamilyTier } from "@/lib/tier";
import { fetchXpForUsers, beltForXp, type BeltKey } from "@/lib/belts";
import { evaluateBadges } from "@/lib/badges";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import {
  activityLine, isWatchlistShare, timeAgo, parseTickerTags, parseCashtags,
  TIME_HORIZON_META, CONTENT_TYPE_META,
  type WatchlistSharePayload, type PostPosition, type TimeHorizon, type ContentType,
  type FeedPost, type FeedAuthor, type PostComment, type ActivityPayload,
  type Role,
} from "@/lib/feed";
import { MentionProvider, RichBody, extractHandles, type MentionMap } from "@/lib/mentions";
import { deriveRegister } from "@/lib/register";
import { isSharedFeedReadOnly, KID_FEED_READONLY_NOTE } from "@/lib/social/kid-posting";
import { REASON_BY_KEY, type ChangedMindEntry } from "@/lib/social/stance";
import { listCircles, isOpen, CIRCLE_DAYS, type CircleListRow } from "@/lib/circles";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import ProfileLink from "@/components/ProfileLink";
import AgeBadge from "@/components/community/AgeBadge";
import AnnouncementCard from "@/components/community/AnnouncementCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Kicker, TickerBadge, BeltAvatar } from "@/components/cc/ui";
import { CountdownChip } from "@/components/cc/interactive";

const JOIN_CLUB_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";

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

const AUTHOR_SEL =
  "author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";
const COMMENT_AUTHOR_SEL =
  "author:profiles!post_comments_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url, username)";

function normAuthor(a: FeedAuthor | FeedAuthor[] | null): FeedAuthor | null {
  return Array.isArray(a) ? a[0] ?? null : a;
}

/* ── cc identity helpers ─────────────────────────────────────────────────── */

/** Two-letter avatar initials from a display name. */
function initialsOf(name?: string | null): string {
  const n = (name || "Member").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

/** cc BeltAvatar belt key from a lifetime-XP total (0 → white, honest default). */
function beltKeyOf(xp: number): BeltKey {
  return beltForXp(xp || 0).belt.key;
}

export default function CommunityClientV2({
  initialData = null,
  embedded = false,
  onOpenDiscussions,
  onOpenLounge,
}: {
  initialData?: CommunityFeedSeed | null;
  embedded?: boolean;
  onOpenDiscussions?: () => void;
  onOpenLounge?: () => void;
}) {
  const supabase = createClient();
  const xpAward = useXpAward();
  const seeded = initialData != null;
  const seededPostIds = useRef<Set<string>>(
    new Set((initialData?.posts ?? []).map((p) => p.id))
  );

  const [me, setMe] = useState<Me | null>(initialData?.me ?? null);
  const [myTier, setMyTier] = useState<FamilyTier>(initialData?.myTier ?? "fic");
  const [tierResolved, setTierResolved] = useState(seeded);
  const [posts, setPosts] = useState<FeedPost[]>(initialData?.posts ?? []);
  const [loading, setLoading] = useState(!seeded);

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

  // Composer state
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const composeSeeded = useRef(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tickerDraft, setTickerDraft] = useState("");
  const [tickerTags, setTickerTags] = useState<string[]>([]);
  const [position, setPosition] = useState<PostPosition | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon | null>(null);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [showTagger, setShowTagger] = useState(false);
  function commitTicker(raw: string) {
    const parsed = parseTickerTags(raw + " " + tickerTags.join(" "));
    setTickerTags(parsed);
    setTickerDraft("");
  }
  function removeTicker(t: string) {
    setTickerTags((prev) => prev.filter((x) => x !== t));
  }

  // @mention autocomplete
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
    if (me?.role === "admin" && "everyone".startsWith(q)) {
      return [
        { id: "__everyone__", name: "Everyone", stripped: "everyone", avatar_url: null },
        ...people,
      ];
    }
    return people;
  }, [mention, roster, me?.id, me?.role]);
  function detectMention(value: string, caret: number) {
    const mm = value.slice(0, caret).match(/(^|\s)@([A-Za-z0-9_.'-]*)$/);
    if (mm) {
      loadRoster();
      setMention({ start: caret - mm[2].length - 1, end: caret, query: mm[2] });
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

  const hydrateEdited = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const { data, error } = await supabase
        .from("feed_posts")
        .select("id, edited_at")
        .in("id", ids)
        .not("edited_at", "is", null);
      if (error || !data?.length) return;
      const marks = new Map(
        (data as { id: string; edited_at: string | null }[]).map((r) => [r.id, r.edited_at])
      );
      setPosts((prev) =>
        prev.map((p) => (marks.has(p.id) ? { ...p, edited_at: marks.get(p.id) ?? null } : p))
      );
    },
    [supabase]
  );

  const loadFeed = useCallback(
    async (uid: string | null) => {
      const { data } = await supabase
        .from("feed_posts")
        .select(
          `id, author_id, family_id, kind, body, title, link, audience, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, ticker_tags, position, time_horizon, content_type, created_at, ${AUTHOR_SEL}`
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
      hydrateEdited(norm.map((p) => p.id));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, loadTiers, resolveMentions, hydrateEdited]
  );

  // Initial load
  useEffect(() => {
    let mounted = true;
    if (seeded) {
      if (initialData?.me?.id) evaluateBadges(supabase, initialData.me.id);
      hydrateEdited((initialData?.posts ?? []).map((p) => p.id));
      return () => {
        mounted = false;
      };
    }
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid: string | null = session?.user?.id ?? null;

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
        getClubTier(supabase, profile.family_id)
          .then((t) => {
            if (mounted) setMyTier(t);
          })
          .finally(() => {
            if (mounted) setTierResolved(true);
          });
        evaluateBadges(supabase, uid);
      } else if (mounted) {
        setTierResolved(true);
      }

      await feedP;
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light polling
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") loadFeed(me?.id ?? null);
    }, 30000);
    return () => clearInterval(iv);
  }, [loadFeed, me?.id]);

  // Attachments
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

  const focusComposer = useCallback(() => {
    setComposerOpen(true);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    });
  }, []);

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

    const mergedTags = [...tickerTags];
    for (const t of parseCashtags(body)) if (!mergedTags.includes(t)) mergedTags.push(t);
    let finalTags = mergedTags.slice(0, 4);
    if (mergedTags.length) {
      const { data: valid } = await supabase
        .from("screener_metrics")
        .select("ticker")
        .in("ticker", mergedTags);
      if (valid) {
        const ok = new Set((valid as { ticker: string }[]).map((r) => r.ticker));
        finalTags = mergedTags.filter((t) => ok.has(t)).slice(0, 4);
      }
    }

    const { data, error } = await supabase
      .from("feed_posts")
      .insert({
        author_id: me.id, family_id: me.family_id, kind: "post", body,
        ticker_tags: finalTags,
        position: finalTags.length ? position : null,
        time_horizon: finalTags.length ? timeHorizon : null,
        content_type: contentType,
        ...(attachmentFields || {}),
      })
      .select(`id, author_id, family_id, kind, body, attachment_url, attachment_type, attachment_meta, activity_payload, anchor_week_id, pinned, ticker_tags, position, time_horizon, content_type, created_at`)
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
      setTimeHorizon(null);
      setContentType(null);
      setShowTagger(false);
      clearAttachment();
      const todayPosts = await countXpToday(supabase, me.id, "community");
      if (todayPosts < 3) {
        const xpBefore = await getUserXp(supabase, me.id);
        await awardXp(supabase, me.id, "community", XP.COMMUNITY, data.id);
        const xpAfter = await getUserXp(supabase, me.id);
        if (xpAfter > xpBefore) {
          xpAward.fire({
            amount: xpAfter - xpBefore,
            xpBefore,
            xpAfter,
            reason: "Post published",
          });
        }
      }
    } else {
      setComposerError("Your post didn't go through. Please try again.");
    }
    setPosting(false);
  }

  const savePostEdit = useCallback(
    async (postId: string, nextBody: string): Promise<{ ok: boolean; error?: string }> => {
      const body = nextBody.trim();
      if (!body) return { ok: false, error: "An entry still needs something in it." };
      if (!checkClean(body).ok) return { ok: false, error: PROFANITY_MESSAGE };

      const stamp = new Date().toISOString();
      let { data, error } = await supabase
        .from("feed_posts")
        .update({ body, edited_at: stamp })
        .eq("id", postId)
        .select("id");

      let marked = true;
      if (error && error.code === "42703") {
        marked = false;
        ({ data, error } = await supabase
          .from("feed_posts")
          .update({ body })
          .eq("id", postId)
          .select("id"));
      }
      if (error || !data?.length) {
        return { ok: false, error: "That edit wasn't allowed — you can only change your own entry." };
      }

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, body, edited_at: marked ? stamp : p.edited_at ?? null } : p))
      );
      resolveMentions([body]);
      return { ok: true };
    },
    [supabase, resolveMentions]
  );

  const deletePost = useCallback(
    async (postId: string): Promise<{ ok: boolean; error?: string }> => {
      const { data, error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", postId)
        .select("id");
      if (error || !data?.length) {
        return { ok: false, error: "That entry couldn't be deleted — you can only delete your own." };
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      return { ok: true };
    },
    [supabase]
  );

  async function toggleLike(postId: string) {
    if (!me) return;
    const liked = likedByMe.has(postId);
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
        setLikedByMe((prev) => { const n = new Set(prev); n.delete(postId); return n; });
        setLikeCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }));
      }
    }
  }

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
  const readOnly = myTier === "free";
  const feedReadOnlyKid = isSharedFeedReadOnly(me ? deriveRegister(me) : "adult");

  // ?compose= deep-link seed
  useEffect(() => {
    if (composeSeeded.current || !tierResolved || readOnly) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seed = params.get("compose");
    if (!seed) return;
    composeSeeded.current = true;
    setComposerOpen(true);
    setText(seed);
    params.delete("compose");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
      el.setSelectionRange(seed.length, seed.length);
    });
  }, [tierResolved, readOnly]);

  const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
  const pinnedAnnouncement = posts.find(
    (p) => p.kind === "announcement" && Date.now() - new Date(p.created_at).getTime() < SEVEN_DAYS
  );
  const feedList = posts.filter(
    (p) => p.kind !== "anchor" && p.id !== pinnedAnnouncement?.id
  );

  const threadPosts = useMemo(() => feedList.filter((p) => p.kind === "post"), [feedList]);
  const feedAnnouncements = useMemo(() => feedList.filter((p) => p.kind === "announcement"), [feedList]);
  const activityItems = useMemo(() => feedList.filter((p) => p.kind === "activity"), [feedList]);

  const EMPTY_COPY = {
    eyebrow: "The floor is open",
    title: "Nothing on the floor yet.",
    body: "The first entry sets the tone for every member who walks in after it. Share a read, ask the thing you're stuck on, or post your family's pick.",
  };

  const voices = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedAuthor[] = [];
    for (const p of threadPosts) {
      const a = p.author;
      if (!a?.id || seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
      if (out.length >= 6) break;
    }
    return out;
  }, [threadPosts]);

  const topTickers = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of threadPosts) {
      for (const t of p.ticker_tags ?? []) {
        const k = t.toUpperCase();
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    return Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ticker]) => ticker);
  }, [threadPosts]);

  const hotThreads = useMemo(() => {
    const by = new Map<string, number>();
    for (const p of threadPosts) {
      for (const t of p.ticker_tags ?? []) {
        const k = t.toUpperCase();
        by.set(k, (by.get(k) ?? 0) + 1);
      }
    }
    return Array.from(by.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([ticker, entries]) => ({ ticker, entries }));
  }, [threadPosts]);

  const [quotes, setQuotes] = useState<Record<string, number | null>>({});
  const topKey = topTickers.join(",");
  useEffect(() => {
    const list = topKey ? topKey.split(",") : [];
    if (!list.length) return;
    let live = true;
    void Promise.all(
      list.map(async (t) => {
        try {
          const r = await fetch(`/api/market/quote?symbol=${encodeURIComponent(t)}`);
          if (!r.ok) return [t, null] as const;
          const j = await r.json();
          const pct = Number(j?.quote?.changePercent);
          return [t, Number.isFinite(pct) ? pct : null] as const;
        } catch {
          return [t, null] as const;
        }
      })
    ).then((rows) => {
      if (!live) return;
      setQuotes(Object.fromEntries(rows));
    });
    return () => {
      live = false;
    };
  }, [topKey]);

  const [latestFlip, setLatestFlip] = useState<ChangedMindEntry | null>(null);
  useEffect(() => {
    let live = true;
    void supabase.rpc("get_changed_minds", { p_limit: 1 }).then(({ data }) => {
      if (!live) return;
      const first = (data as { items?: ChangedMindEntry[] } | null)?.items?.[0] ?? null;
      setLatestFlip(first);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HAPPENING NOW — real open circles (the SAME source /circles reads). Omitted
  // entirely when there are none or the schema isn't present; never faked.
  const [circles, setCircles] = useState<CircleListRow[]>([]);
  useEffect(() => {
    let live = true;
    void listCircles(supabase)
      .then(({ rows, missingSchema }) => {
        if (!live || missingSchema) return;
        setCircles(rows.filter((c) => isOpen(c)));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceCount = new Set(threadPosts.map((p) => p.author?.id).filter(Boolean)).size;
  const foundingLedger = [
    threadPosts.length > 0
      ? `${threadPosts.length} ${threadPosts.length === 1 ? "entry" : "entries"}`
      : null,
    voiceCount > 0 ? `${voiceCount} ${voiceCount === 1 ? "voice" : "voices"}` : null,
    activityItems.length > 0 ? `${activityItems.length} moves today` : null,
  ].filter((x): x is string => x !== null);

  return (
    <MentionProvider map={mentions}>
      <div className="relative mx-auto max-w-2xl">
        {xpAward.overlay}
        <div className="space-y-7">
          {/* VIP room entry — gated; renders nothing for non-VIP members. */}
          <CcVipRoomBanner />

          {/* CIRCLES RAIL — real open circles at the top of the feed (board 04
              anatomy). Never hidden: it always draws the rail, and when no Circle
              is open it shows a single quiet "start" ring. */}
          <HappeningNow circles={circles} canCreate={!readOnly && !feedReadOnlyKid} />

          {/* Pinned announcement (reuses AnnouncementCard — carries v1 chrome;
              a full cc re-skin of the announcement card is a visual follow-up). */}
          {pinnedAnnouncement && <AnnouncementCard post={pinnedAnnouncement} pinned />}

          {/* Composer — board 04 draws it CLOSED (a pill). Opens in-place with the
              full composer (this is an existing feature and stays reachable; the
              masthead pencil ADDITIONALLY routes to the structured composer). */}
          {!tierResolved ? (
            <div
              className="flex animate-pulse items-center gap-3 rounded-[14px] border p-3"
              style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
            >
              <div className="h-8 w-8 shrink-0 rounded-full" style={{ background: "var(--cc-card2)" }} />
              <div className="h-4 flex-1 rounded" style={{ background: "var(--cc-card2)" }} />
            </div>
          ) : readOnly ? (
            <FreeComposerUpsell />
          ) : feedReadOnlyKid ? (
            <KidFeedReadOnlyNote />
          ) : !composerOpen ? (
            <button
              type="button"
              onClick={() => {
                setComposerOpen(true);
                requestAnimationFrame(() => taRef.current?.focus());
              }}
              className="flex w-full items-center gap-2.5 rounded-[14px] border px-3.5 py-3 text-left transition-colors hover:border-[var(--cc-orange)]"
              style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
            >
              <BeltAvatar initials={initialsOf(me?.display_name)} belt={beltKeyOf(xpOf(me?.id))} size={32} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold" style={{ color: "var(--cc-soft)" }}>
                  What&apos;s your take?
                </span>
                <span className="block text-[10px]" style={{ color: "var(--cc-dim)" }}>
                  Share an opinion, chart, or question
                </span>
              </span>
              <span className="ml-auto flex items-center gap-1.5" style={{ color: "var(--cc-dim)" }}>
                <Paperclip className="h-4 w-4" aria-hidden />
                <Tag className="h-4 w-4" aria-hidden />
              </span>
            </button>
          ) : (
            /* The full composer, inline (refs are assigned via ref={}, never
               passed as props — keeps the react-hooks/refs contract clean, as
               the v1 composer does). All features preserved: mention autocomplete,
               attachment preview + clear, ticker tagger, content-type, neutral
               stance picker, time horizon, and the ONE orange primary CTA. */
            <div className="rounded-2xl border p-3.5" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
              <div className="flex gap-3">
                <BeltAvatar initials={initialsOf(me?.display_name)} belt={beltKeyOf(xpOf(me?.id))} size={38} />
                <div className="min-w-0 flex-1">
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
                      placeholder={me?.role === "child" ? "Share what your family learned today…" : "Write an entry — a read, a question, or your family's pick…"}
                      rows={2}
                      className="w-full resize-none bg-transparent p-0 text-[15px] leading-relaxed focus:outline-none"
                      style={{ color: "var(--cc-ink)" }}
                    />
                    {mention && mentionCandidates.length > 0 && (
                      <div
                        className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border shadow-lg"
                        style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
                      >
                        <p className="flex items-center gap-1 px-3 pb-1 pt-2 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
                          <AtSign className="h-3 w-3" /> Mention someone
                        </p>
                        {mentionCandidates.map((c, i) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(c); }}
                            onMouseEnter={() => setMentionIdx(i)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                            style={{ background: i === mentionIdx ? "var(--cc-card2)" : "transparent" }}
                          >
                            <BeltAvatar initials={initialsOf(c.name)} belt="white" size={26} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium" style={{ color: "var(--cc-ink)" }}>{c.name}</span>
                              <span className="block truncate text-[10px]" style={{ color: "var(--cc-soft)" }}>@{c.stripped}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {attachment && (
                    <div className="mt-2 inline-flex max-w-full items-center gap-2.5 rounded-xl border p-2 pr-3" style={{ background: "var(--cc-card2)", borderColor: "var(--cc-line)" }}>
                      {attachment.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.previewUrl} alt="preview" className="h-12 w-12 shrink-0 rounded-lg border object-cover" style={{ borderColor: "var(--cc-line)" }} />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--cc-bg)" }}>
                          <Film className="h-5 w-5" style={{ color: "var(--cc-soft)" }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[180px] truncate text-xs font-semibold" style={{ color: "var(--cc-ink)" }}>{attachment.file.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--cc-soft)" }}>{uploading ? "Uploading…" : `${attachment.kind === "image" ? "Photo" : "Video"} · ${(attachment.file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
                      </div>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--cc-orange-ink)" }} />
                      ) : (
                        <button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--cc-line)", color: "var(--cc-soft)" }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {composerError && <p className="mt-2 text-xs font-semibold" style={{ color: "var(--cc-ink)" }}>{composerError}</p>}

                  {showTagger && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--cc-line)" }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {tickerTags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[11px] font-bold" style={{ background: "var(--cc-card2)", color: "var(--cc-orange-ink)" }}>
                            ${t}
                            <button type="button" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`} style={{ color: "var(--cc-soft)" }}>
                              <X className="h-2.5 w-2.5" />
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
                            className="min-w-[120px] flex-1 bg-transparent font-[family-name:var(--font-plex-mono)] text-xs uppercase focus:outline-none"
                            style={{ color: "var(--cc-ink)" }}
                          />
                        )}
                      </div>
                      {/* content type */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: "var(--cc-line)" }}>
                        <span className="mr-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>Type</span>
                        {(["thesis", "question", "news_reaction"] as ContentType[]).map((c) => {
                          const active = contentType === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setContentType(active ? null : c)}
                              className="rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors"
                              style={active
                                ? { background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-orange)" }
                                : { background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}
                            >
                              {CONTENT_TYPE_META[c].label}
                            </button>
                          );
                        })}
                      </div>
                      {/* stance — neutral (opinion, not price) */}
                      {tickerTags.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--cc-line)" }}>
                          <span className="mr-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>Leaning</span>
                          {(["bull", "neutral", "bear"] as PostPosition[]).map((pos) => {
                            const active = position === pos;
                            return (
                              <button key={pos} type="button" aria-pressed={active} onClick={() => setPosition(active ? null : pos)}>
                                <CcStanceLabel position={pos} active={active} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* time horizon */}
                      {tickerTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="mr-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>Horizon</span>
                          {(["near", "1yr", "3-5yr"] as TimeHorizon[]).map((h) => {
                            const active = timeHorizon === h;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => setTimeHorizon(active ? null : h)}
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors"
                                style={active
                                  ? { background: "var(--cc-card2)", color: "var(--cc-ink)", border: "1px solid var(--cc-orange)" }
                                  : { background: "var(--cc-card2)", color: "var(--cc-soft)", border: "1px solid var(--cc-line)" }}
                              >
                                {TIME_HORIZON_META[h].label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <input ref={fileRef} type="file" accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach a photo or video" title="Attach a photo or video" className="transition-colors disabled:opacity-40" style={{ color: "var(--cc-soft)" }}><Paperclip className="h-4 w-4" /></button>
                      <button type="button" onClick={insertLink} disabled={posting} aria-label="Add a link" title="Add a link" className="transition-colors disabled:opacity-40" style={{ color: "var(--cc-soft)" }}><Link2 className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setShowTagger((v) => !v)} disabled={posting} aria-label="Tag a ticker" title="Tag a ticker" className="transition-colors disabled:opacity-40" style={{ color: showTagger || tickerTags.length ? "var(--cc-orange-ink)" : "var(--cc-soft)" }}><Tag className="h-4 w-4" /></button>
                    </div>
                    {/* The ONE primary CTA on this screen — the orange Post button. */}
                    <button
                      onClick={submitPost}
                      disabled={(!text.trim() && !attachment) || posting || !me}
                      className="cc-halo inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:hover:translate-y-0"
                      style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
                    >
                      <Send className="h-3.5 w-3.5" />{uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WHO'S AROUND — real distinct voices, belt-ringed. */}
          {voices.length > 0 && (
            <WhosAround voices={voices} xpOf={xpOf} />
          )}

          {/* TOP IN THE CLUB — most-tagged names + live deltas. */}
          {topTickers.length > 0 && (
            <TopInClub tickers={topTickers} quotes={quotes} />
          )}

          {/* CHANGED MY MIND preview (real latest flip). */}
          {latestFlip && <CmmPreview flip={latestFlip} xpOf={xpOf} />}

          {/* HOT DISCUSSIONS — busiest ticker threads. */}
          {hotThreads.length > 0 && (
            <HotDiscussions threads={hotThreads} onOpenDiscussions={onOpenDiscussions} />
          )}

          {/* The feed itself. */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border p-3.5"
                  style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
                >
                  <div className="flex gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: "var(--cc-card2)" }} />
                    <div className="flex-1">
                      <div className="mb-3 h-3.5 w-32 rounded" style={{ background: "var(--cc-card2)" }} />
                      <div className="mb-1.5 h-3 w-full rounded" style={{ background: "var(--cc-card2)" }} />
                      <div className="h-3 w-2/3 rounded" style={{ background: "var(--cc-card2)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {feedAnnouncements.map((p) => (
                <AnnouncementCard key={p.id} post={p} />
              ))}

              {activityItems.length > 0 && <CcAmbientActivityStrip items={activityItems} />}

              {threadPosts.length === 0 ? (
                <CcEmptyRoom
                  copy={EMPTY_COPY}
                  ledger={foundingLedger}
                  onStart={!readOnly && !feedReadOnlyKid ? focusComposer : undefined}
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {threadPosts.map((p, i) => (
                      <m.div
                        key={p.id}
                        initial={seededPostIds.current.has(p.id) ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.2) }}
                      >
                        <CcPostEntry
                          post={p} me={me} readOnly={readOnly}
                          likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                          commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                          comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf} xpOf={xpOf}
                          canManage={!!me && !!p.author_id && p.author_id === me.id && !feedReadOnlyKid}
                          onEditPost={savePostEdit} onDeletePost={deletePost}
                        />
                      </m.div>
                    ))}
                  </div>

                  {threadPosts.length < 6 && (
                    <CcFoundingTail
                      count={threadPosts.length}
                      ledger={foundingLedger}
                      readOnly={readOnly}
                      feedReadOnlyKid={feedReadOnlyKid}
                      onStart={focusComposer}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Feed foot — ONE quiet row that keeps Discussions + the Lounge
              reachable now that neither is a tab (owner directive). Ghost, small;
              routes/components are untouched. */}
          {(onOpenDiscussions || onOpenLounge) && (
            <FeedFootRooms onOpenDiscussions={onOpenDiscussions} onOpenLounge={onOpenLounge} />
          )}
        </div>
      </div>
    </MentionProvider>
  );
  // NOTE: embedded is honoured implicitly — the shell (ClubModeShellV2) owns the
  // Lounge chat, so this feed never mounts a duplicate chat drawer.
  void embedded;
}

/**
 * FEED FOOT — quiet ghost row folding the (now tab-less) Discussions and Lounge
 * entry points into one line so no function is orphaned. Full consolidation
 * (merge discussions into the feed? retire the lounge?) is an owner decision.
 */
function FeedFootRooms({
  onOpenDiscussions,
  onOpenLounge,
}: {
  onOpenDiscussions?: () => void;
  onOpenLounge?: () => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-3 border-t pt-5" style={{ borderColor: "var(--cc-line)" }}>
      <button
        type="button"
        onClick={onOpenDiscussions ?? onOpenLounge}
        className="text-[12px] font-semibold transition-colors"
        style={{ color: "var(--cc-soft)" }}
      >
        Rooms &amp; discussions ›
      </button>
      {onOpenDiscussions && onOpenLounge && (
        <>
          <span aria-hidden style={{ color: "var(--cc-line)" }}>·</span>
          <button
            type="button"
            onClick={onOpenLounge}
            className="text-[12px] font-semibold transition-colors"
            style={{ color: "var(--cc-soft)" }}
          >
            Lounge
          </button>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   cc sub-components
   ══════════════════════════════════════════════════════════════════════════ */

/** $CASHTAG — orange, hot-linked to the research page (DESIGN-UX-SPEC §4). */
function CcCashtag({ ticker, size = "md" }: { ticker: string; size?: "sm" | "md" }) {
  return (
    <Link
      href={`/research/${encodeURIComponent(ticker)}`}
      className="font-[family-name:var(--font-plex-mono)] font-semibold"
      style={{
        color: "var(--cc-orange-ink)",
        fontSize: size === "sm" ? 11 : 12.5,
      }}
    >
      ${ticker.toUpperCase()}
    </Link>
  );
}

/**
 * STANCE — an OPINION, not a quote, so NEVER green/pink (DESIGN-UX-SPEC §3).
 * bull/neutral/bear are carried by the WORD + the ▲—▼ mark, all in neutral ink.
 */
const STANCE_MARK: Record<PostPosition, { glyph: string; label: string }> = {
  bull: { glyph: "▲", label: "Bull" },
  neutral: { glyph: "—", label: "Neutral" },
  bear: { glyph: "▼", label: "Bear" },
};
function CcStanceLabel({ position, active = false }: { position: PostPosition; active?: boolean }) {
  const s = STANCE_MARK[position];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        color: active ? "var(--cc-ink)" : "var(--cc-soft)",
        background: active ? "var(--cc-card2)" : "transparent",
        border: active ? "1px solid var(--cc-line)" : "1px solid transparent",
      }}
    >
      <span aria-hidden>{s.glyph}</span>
      {s.label}
    </span>
  );
}

/**
 * Author marks beside the name: coach/admin AUTHORITY (orange), else a BELT chip
 * coloured from real data (belt.hex/onHex are contrast-safe in both themes).
 * White belt at 0 xp — the honest default the ladder returns.
 */
function AuthorMarks({ role, xp }: { role?: string | null; xp?: number }) {
  const authority = role === "coach" || role === "admin" ? role.toUpperCase() : null;
  if (authority) {
    return (
      <span
        className="font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--cc-orange-ink)" }}
      >
        {authority}
      </span>
    );
  }
  const rank = beltForXp(xp || 0);
  return (
    <span
      className="rounded-[4px] px-[5px] py-[1px] text-[10px] font-bold"
      style={{ background: rank.belt.hex, color: rank.belt.onHex }}
    >
      {rank.short} Belt
    </span>
  );
}

/**
 * The reaction rail — like + comment only (the two real toggles). A like is
 * community sentiment, kept NON-RED (a soft→ink toggle, never a red heart).
 * Free members keep the counts (they can read the room) but the like is inert.
 */
function CcLikeCommentBar({
  liked, likeCount, onLike, commentCount, onToggleComments, readOnly,
}: {
  liked: boolean; likeCount: number; onLike: () => void; commentCount: number; onToggleComments: () => void; readOnly?: boolean;
}) {
  return (
    <div className="mt-2.5 flex items-center gap-4 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold">
      <button
        onClick={readOnly ? undefined : onLike}
        disabled={readOnly}
        className="inline-flex items-center gap-1.5 transition-colors"
        style={{ color: liked && !readOnly ? "var(--cc-ink)" : "var(--cc-soft)", cursor: readOnly ? "default" : "pointer" }}
        aria-pressed={liked}
      >
        <ThumbsUp className="h-3.5 w-3.5" fill={liked && !readOnly ? "currentColor" : "none"} />
        {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
        <span>{liked && !readOnly ? "Liked" : "Like"}</span>
      </button>
      <button
        onClick={onToggleComments}
        className="inline-flex items-center gap-1.5 transition-colors"
        style={{ color: "var(--cc-soft)" }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>Reply</span>
        {commentCount > 0 && <span className="tabular-nums" style={{ color: "var(--cc-ink)" }}>{commentCount}</span>}
      </button>
    </div>
  );
}

/** Read-only composer slot for free members. */
function FreeComposerUpsell() {
  return (
    <div className="rounded-2xl border p-3.5" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <Kicker>Reading as a free member</Kicker>
      <p className="mt-2 max-w-[38ch] cc-display text-[22px]" style={{ color: "var(--cc-ink)" }}>
        You can read the floor. Members write it.
      </p>
      <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        Join the Club to file entries, back the ones you agree with, and reply in the threads.
      </p>
      <a
        href={JOIN_CLUB_URL}
        className="cc-halo mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-bold"
        style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}
      >
        Join the Club <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/** Kid feed read-only note (no upsell shown to a child). */
function KidFeedReadOnlyNote() {
  return (
    <div className="rounded-2xl border p-3.5" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <Kicker tone="soft">Your space is coming</Kicker>
      <p className="mt-2 max-w-[38ch] cc-display text-[22px]" style={{ color: "var(--cc-ink)" }}>
        Read everything. Back what you like.
      </p>
      <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
        {KID_FEED_READONLY_NOTE}
      </p>
    </div>
  );
}

/* Fraction of the 30-day clock STILL LEFT — real, from expires_at (board 16 /
   04 ring logic). Orange sweeps the remaining time; the track is cc-line. */
function circleClockPct(expiresAt: string, now = Date.now()): number {
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return 0;
  const total = CIRCLE_DAYS * 86_400_000;
  return Math.max(0, Math.min(100, (ms / total) * 100));
}

/** One 60px conic-progress ring in the rail — a real open Circle. */
function CircleRing({ c }: { c: CircleListRow }) {
  const pct = circleClockPct(c.expires_at);
  const label = c.ticker ? c.ticker.toUpperCase() : (c.title || "?").slice(0, 1).toUpperCase();
  return (
    <Link
      href={`/circles/${encodeURIComponent(c.slug)}`}
      className="w-[92px] shrink-0 text-center"
      title={c.title}
    >
      {/* Conic ring — orange fills the fraction of the clock left; achromatic
          center object (ticker badge or topic initial) carries the identity,
          per the colour law (one accent, objects-with-identity). */}
      <span className="relative mx-auto block h-[60px] w-[60px]">
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(var(--cc-orange) 0 ${pct}%, var(--cc-line) ${pct}% 100%)` }}
        />
        <span
          className="absolute grid place-items-center rounded-full"
          style={{ inset: 3, background: "var(--cc-card)", border: "2px solid var(--cc-bg)" }}
        >
          {c.ticker ? (
            <TickerBadge symbol={c.ticker} size={34} />
          ) : (
            <span className="cc-display text-[16px]" style={{ color: "var(--cc-soft)" }}>
              {label}
            </span>
          )}
        </span>
      </span>
      <span className="mt-2 block truncate text-[11px] font-semibold" style={{ color: "var(--cc-ink)" }}>
        {c.title}
      </span>
      {/* One mono meta line — ⏳ live countdown · N joined (board 04). */}
      <span className="mt-1 flex items-center justify-center gap-1 font-[family-name:var(--font-plex-mono)] text-[9px] tabular-nums" style={{ color: "var(--cc-dim)" }}>
        <CountdownChip target={c.expires_at} bare />
        {c.members > 0 && <span>· {c.members.toLocaleString()} joined</span>}
      </span>
    </Link>
  );
}

/** The rail's dashed "+ Start" ring — routes to /circles where the opener lives. */
function StartRing({ label, sub }: { label: string; sub: string }) {
  return (
    <Link href="/circles" className="w-[92px] shrink-0 text-center" aria-label="Start a Circle">
      <span className="relative mx-auto block h-[60px] w-[60px]">
        <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(var(--cc-up) 0 100%, var(--cc-up) 0 100%)` }} />
        <span
          className="absolute grid place-items-center rounded-full"
          style={{ inset: 3, background: "var(--cc-card)", border: "2px dashed var(--cc-line)", color: "var(--cc-soft)" }}
        >
          <span className="text-[20px] leading-none" style={{ color: "var(--cc-soft)" }}>+</span>
        </span>
      </span>
      <span className="mt-2 block truncate text-[11px] font-semibold" style={{ color: "var(--cc-soft)" }}>
        {label}
      </span>
      <span className="mt-1 block font-[family-name:var(--font-plex-mono)] text-[9px]" style={{ color: "var(--cc-dim)" }}>
        {sub}
      </span>
    </Link>
  );
}

/**
 * CIRCLES RAIL (board 04 "Happening now") — real open circles as conic-progress
 * rings at the TOP of the feed. Never hidden: when no Circle is open it draws a
 * single quiet start/read ring. Tapping a ring → /circles/[slug]; the trailing
 * ring → /circles (the opener). All counts + clocks are real.
 */
function HappeningNow({ circles, canCreate }: { circles: CircleListRow[]; canCreate: boolean }) {
  const shown = circles.slice(0, 8);
  const empty = shown.length === 0;
  return (
    <section aria-label="Circles">
      <div className="flex items-baseline justify-between gap-3">
        <Kicker tone="soft">Happening now</Kicker>
        <Link href="/circles" className="text-[11px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
          See all
        </Link>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-4 overflow-x-auto px-1">
        {shown.map((c) => (
          <CircleRing key={c.id} c={c} />
        ))}
        {/* Never hide the rail: a trailing start ring when creation is allowed;
            a quiet zero-state ring otherwise. */}
        {empty ? (
          canCreate ? (
            <StartRing label="Start the first" sub="30 days on the clock" />
          ) : (
            <StartRing label="No circles yet" sub="Check back soon" />
          )
        ) : (
          canCreate && <StartRing label="Start" sub="30-day clock" />
        )}
      </div>
    </section>
  );
}

/** WHO'S AROUND — real distinct voices, avatars belt-ringed. */
function WhosAround({
  voices,
  xpOf,
}: {
  voices: FeedAuthor[];
  xpOf: (id: string | null | undefined) => number;
}) {
  return (
    <section aria-label="Who's around">
      <Kicker tone="soft">Who&apos;s around</Kicker>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-3.5 overflow-x-auto px-1">
        {voices.map((a) => (
          <ProfileLink key={a.id} username={a.username} variant="avatar">
            <div className="w-[56px] shrink-0 text-center">
              <div className="flex justify-center">
                <BeltAvatar initials={initialsOf(a.display_name)} belt={beltKeyOf(xpOf(a.id))} size={46} />
              </div>
              <span className="mt-1.5 block truncate text-[9.5px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                {(a.display_name || "Member").split(" ")[0]}
              </span>
            </div>
          </ProfileLink>
        ))}
      </div>
    </section>
  );
}

/** TOP IN THE CLUB — most-tagged names with live price deltas (price ramp OK). */
function TopInClub({
  tickers,
  quotes,
}: {
  tickers: string[];
  quotes: Record<string, number | null>;
}) {
  return (
    <section aria-label="Top in the Club">
      <Kicker tone="soft">Top in the club</Kicker>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2.5 overflow-x-auto px-1">
        {tickers.map((t) => {
          const pct = quotes[t];
          const tone = pct == null ? "soft" : pct >= 0 ? "up" : "down";
          return (
            <Link
              key={t}
              href={`/research/${encodeURIComponent(t)}`}
              className="w-[92px] shrink-0 rounded-2xl border px-2.5 py-2.5 text-center transition-colors hover:border-[var(--cc-orange)]"
              style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
            >
              <div className="flex justify-center">
                <TickerBadge symbol={t} size={30} />
              </div>
              <span className="mt-1.5 block font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold" style={{ color: "var(--cc-ink)" }}>
                {t}
              </span>
              <span
                className="mt-0.5 block font-[family-name:var(--font-plex-mono)] text-[10.5px] tabular-nums"
                style={{
                  color: tone === "up" ? "var(--cc-up)" : tone === "down" ? "var(--cc-down)" : "var(--cc-dim)",
                }}
              >
                {pct == null ? "—" : `${pct >= 0 ? "▲" : "▼"}${Math.abs(pct).toFixed(1)}%`}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** CHANGED MY MIND preview — the latest real flip. Stance = neutral (opinion). */
function CmmPreview({
  flip,
  xpOf,
}: {
  flip: ChangedMindEntry;
  xpOf: (id: string | null | undefined) => number;
}) {
  return (
    <section aria-label="Changed my mind">
      <div className="flex items-baseline justify-between gap-3">
        <Kicker tone="soft">Changed my mind</Kicker>
        <Link href="/community/changed-my-mind" className="text-[11px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
          See all
        </Link>
      </div>
      <div className="mt-3 rounded-[14px] border p-[13px]" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
        {/* Board-04 CMM card kicker — the section's pink identity mark. */}
        <span className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-down)" }}>
          Changed my mind
        </span>
        <div className="mt-2 flex items-center gap-2.5">
          <BeltAvatar initials={initialsOf(flip.display_name)} belt={beltKeyOf(xpOf((flip as { user_id?: string }).user_id))} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
              {flip.display_name || "Member"}
            </p>
          </div>
          <CcCashtag ticker={flip.ticker} size="sm" />
        </div>
        {/* Transition row — stance stays NEUTRAL (a stance is an opinion, never a
            market colour per §3); the arrow carries the brand mark. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {flip.from_stance && <CcStanceLabel position={flip.from_stance as PostPosition} />}
          <span aria-hidden style={{ color: "var(--cc-dim)" }}>→</span>
          <CcStanceLabel position={flip.to_stance as PostPosition} active />
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.5]" style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, var(--cc-soft))" }}>
          {flip.note || (flip.reason ? REASON_BY_KEY[flip.reason].label : "Position updated.")}
        </p>
        {flip.respect_count > 0 && (
          <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
            {flip.respect_count} respect
          </p>
        )}
      </div>
    </section>
  );
}

/** HOT DISCUSSIONS — busiest ticker threads by real entry count. */
function HotDiscussions({
  threads,
  onOpenDiscussions,
}: {
  threads: { ticker: string; entries: number }[];
  onOpenDiscussions?: () => void;
}) {
  return (
    <section aria-label="Hot discussions">
      <div className="flex items-baseline justify-between gap-3">
        <Kicker tone="soft">Hot discussions</Kicker>
        {onOpenDiscussions ? (
          <button type="button" onClick={onOpenDiscussions} className="text-[11px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            See all
          </button>
        ) : (
          <Link href="/community?mode=discussions" className="text-[11px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
            See all
          </Link>
        )}
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {threads.map((t) => (
          <Link
            key={t.ticker}
            href={`/research/${encodeURIComponent(t.ticker)}`}
            className="flex items-center gap-2.5 rounded-2xl border p-3.5 transition-colors hover:border-[var(--cc-orange)]"
            style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
          >
            <TickerBadge symbol={t.ticker} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
                ${t.ticker} thread
              </span>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--cc-soft)" }}>
                {t.entries} {t.entries === 1 ? "entry" : "entries"}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── one entry ───────────────────────────────────────────────────────────── */

function splitEntry(raw: string | null | undefined): { headline: string | null; rest: string } {
  const body = (raw ?? "").trim();
  if (!body) return { headline: null, rest: "" };
  const nl = body.indexOf("\n");
  if (nl > 0 && nl <= 140) {
    return { headline: body.slice(0, nl).trim(), rest: body.slice(nl).trim() };
  }
  const sentence = body.slice(0, 140).match(/^[\s\S]*?[.!?…](\s|$)/);
  if (sentence && sentence[0].trim().length >= 12) {
    return { headline: sentence[0].trim(), rest: body.slice(sentence[0].length).trim() };
  }
  if (body.length <= 140) return { headline: body, rest: "" };
  return { headline: null, rest: body };
}

function CcPostAttachment({ url, type, name }: { url: string | null; type: "image" | "video" | null; name?: string }) {
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  if (!url) return null;
  if (type === "video") {
    return <video src={url} controls preload="metadata" playsInline className="mt-2 max-h-[360px] w-auto max-w-full rounded-xl border" style={{ borderColor: "var(--cc-line)", background: "var(--cc-bg)" }} />;
  }
  return (
    <>
      <button type="button" onClick={() => setLightbox(true)} className="mt-2 block cursor-zoom-in" aria-label="Open image full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name || "Shared image"} loading="lazy" className="max-h-[360px] w-auto max-w-full rounded-xl border" style={{ borderColor: "var(--cc-line)" }} />
      </button>
      {/* Theme-invariant lightbox scrim — a full-screen viewer neutralises the UI. */}
      <AnimatePresence>
        {lightbox && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setLightbox(false)} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4">
            <button type="button" onClick={() => setLightbox(false)} aria-label="Close image" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name || "Shared image"} className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CcTickerRow({
  tags, position, timeHorizon, contentType,
}: {
  tags?: string[] | null;
  position?: PostPosition | null;
  timeHorizon?: TimeHorizon | null;
  contentType?: ContentType | null;
}) {
  const hasMeta = !!tags?.length || !!contentType || !!timeHorizon || !!position;
  if (!hasMeta) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {(tags ?? []).map((t) => (
        <CcCashtag key={t} ticker={t} />
      ))}
      {position && <CcStanceLabel position={position} active />}
      {(contentType || timeHorizon) && (
        <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
          {contentType ? CONTENT_TYPE_META[contentType].label : null}
          {contentType && timeHorizon ? " · " : null}
          {timeHorizon ? TIME_HORIZON_META[timeHorizon].label : null}
        </span>
      )}
    </div>
  );
}

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
  canManage?: boolean;
  onEditPost?: (postId: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeletePost?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
}

function CcPostEntry(props: EngagementProps) {
  const { post } = props;
  const role = post.author?.role || "parent";
  const xp = props.xpOf?.(post.author?.id) ?? 0;
  const { headline, rest } = splitEntry(post.body);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function closeMenu() {
    setMenuOpen(false);
    setConfirmingDelete(false);
  }
  async function commitEdit() {
    if (!props.onEditPost || busy) return;
    setBusy(true);
    setErr(null);
    const res = await props.onEditPost(post.id, draft);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "That edit didn't go through."); return; }
    setEditing(false);
  }
  async function commitDelete() {
    if (!props.onDeletePost || busy) return;
    setBusy(true);
    setErr(null);
    const res = await props.onDeletePost(post.id);
    if (!res.ok) {
      setBusy(false);
      setErr(res.error ?? "That entry couldn't be deleted.");
      closeMenu();
    }
  }

  return (
    <div className="rounded-[14px] border p-[13px]" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <div className="flex items-start gap-2.5">
        <ProfileLink username={post.author?.username} variant="avatar">
          <BeltAvatar initials={initialsOf(post.author?.display_name)} belt={beltKeyOf(xp)} size={32} />
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                <ProfileLink username={post.author?.username} className="text-[12.5px] font-bold text-[var(--cc-ink)]">
                  {post.author?.display_name || "Member"}
                </ProfileLink>
                <AuthorMarks role={role} xp={xp} />
                <AgeBadge role={post.author?.role} ageGroup={post.author?.age_group} />
              </div>
              {(post.ticker_tags?.length ?? 0) > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {(post.ticker_tags ?? []).map((t) => (
                    <CcCashtag key={t} ticker={t} size="sm" />
                  ))}
                </div>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-dim)" }}>
              {timeAgo(post.created_at)}
              {post.edited_at && (
                <>
                  <span aria-hidden>·</span>
                  <span title="The author edited this entry">edited</span>
                </>
              )}
            </span>
            {props.canManage && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
                  aria-label="Entry options"
                  aria-expanded={menuOpen}
                  className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                  style={{ color: "var(--cc-soft)" }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <>
                    <button type="button" aria-hidden tabIndex={-1} onClick={closeMenu} className="fixed inset-0 z-30 cursor-default" />
                    <div
                      role="menu"
                      onKeyDown={(e) => e.key === "Escape" && closeMenu()}
                      className="absolute right-0 top-7 z-40 min-w-[11.5rem] overflow-hidden rounded-xl border py-1 shadow-lg"
                      style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
                    >
                      {confirmingDelete ? (
                        <div className="px-3 py-2">
                          <p className="text-[12.5px] leading-snug" style={{ color: "var(--cc-ink)" }}>
                            Delete this entry? Replies go with it.
                          </p>
                          <div className="mt-2 flex items-center gap-4">
                            {/* Deliberately NOT red — red is price under the colour law. */}
                            <button type="button" onClick={commitDelete} disabled={busy} className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] underline underline-offset-4 disabled:opacity-50" style={{ color: "var(--cc-ink)", textDecorationColor: "var(--cc-line)" }}>
                              {busy ? "Deleting…" : "Delete"}
                            </button>
                            <button type="button" onClick={closeMenu} className="text-[11.5px] font-semibold" style={{ color: "var(--cc-soft)" }}>
                              Keep it
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button type="button" role="menuitem" onClick={() => { setDraft(post.body); setErr(null); setEditing(true); closeMenu(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]" style={{ color: "var(--cc-ink)" }}>
                            <Pencil className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} /> Edit entry
                          </button>
                          <button type="button" role="menuitem" onClick={() => setConfirmingDelete(true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]" style={{ color: "var(--cc-ink)" }}>
                            <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--cc-soft)" }} /> Delete entry
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-2.5">
              <label htmlFor={`edit-${post.id}`} className="sr-only">Edit your entry</label>
              <textarea
                id={`edit-${post.id}`}
                value={draft}
                autoFocus
                onChange={(e) => { setDraft(e.target.value); setErr(null); }}
                rows={Math.min(14, Math.max(4, draft.split("\n").length + 1))}
                className="w-full resize-none rounded-[10px] border p-3 text-[14px] leading-[1.55] focus:outline-none"
                style={{ background: "var(--cc-card2)", borderColor: "var(--cc-line)", color: "var(--cc-ink)" }}
              />
              <div className="mt-2 flex items-center gap-4">
                <button type="button" onClick={commitEdit} disabled={busy || !draft.trim() || draft === post.body} className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-40" style={{ color: "var(--cc-orange-ink)" }}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setDraft(post.body); setErr(null); }} className="text-[11.5px] font-semibold" style={{ color: "var(--cc-soft)" }}>
                  Cancel
                </button>
                <span className="ml-auto font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }}>
                  Saves marked edited
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Board 04 post body — 13px/1.5 in a softened ink, no oversized
                  heading. The opening line keeps emphasis by WEIGHT only (never a
                  jumbo heading, never cc-display — that voice is for the app's own
                  section headers, not a member's sentence). */}
              {headline && (
                <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-semibold leading-[1.5]" style={{ color: "var(--cc-ink)" }}>
                  <RichBody body={headline} />
                </p>
              )}
              {rest && (
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-[1.5]" style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, var(--cc-soft))" }}>
                  <RichBody body={rest} />
                </p>
              )}
            </>
          )}

          {err && (
            <p role="alert" className="mt-2 text-[12.5px] font-semibold leading-snug" style={{ color: "var(--cc-ink)" }}>
              {err}
            </p>
          )}

          {/* Cashtags render under the author name (board 04); this row carries
              the remaining stance / horizon / type metadata only. */}
          <CcTickerRow position={post.position} timeHorizon={post.time_horizon} contentType={post.content_type} />
          {isWatchlistShare(post.activity_payload) && <CcWatchlistShareCard payload={post.activity_payload} />}
          <CcPostAttachment url={post.attachment_url} type={post.attachment_type} name={post.attachment_meta?.name} />
          <CcLikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} readOnly={props.readOnly} />
          {props.commentsOpen && <CcCommentThread {...props} />}
        </div>
      </div>
    </div>
  );
}

/* ── ambient activity strip ──────────────────────────────────────────────── */
function CcAmbientActivityStrip({ items }: { items: FeedPost[] }) {
  const [open, setOpen] = useState(false);
  const tickers: string[] = [];
  for (const p of items) {
    const pay = p.activity_payload as ActivityPayload | null;
    const t = pay?.ticker || pay?.company_name;
    if (t && !tickers.includes(t)) tickers.push(t);
    if (tickers.length >= 3) break;
  }
  const summary =
    tickers.length > 0
      ? `researching ${tickers.join(", ")}${tickers.length >= 3 ? "…" : ""}`
      : "badges, missions, and picks moving through the club";

  return (
    <div className="border-t pt-1" style={{ borderColor: "var(--cc-line)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2.5 py-2.5 text-left">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: "var(--cc-up)" }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--cc-up)" }} />
        </span>
        <span className="min-w-0 truncate font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
          <span className="font-bold tabular-nums" style={{ color: "var(--cc-ink)" }}>{items.length}</span>{" "}
          {items.length === 1 ? "move" : "moves"} · {summary}
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: "var(--cc-soft)" }} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="overflow-hidden">
            <ul className="max-h-72 space-y-2 overflow-y-auto pb-3 pt-0.5">
              {items.map((p) => {
                const pay = p.activity_payload as ActivityPayload;
                const line = activityLine(pay);
                const Icon = ACTIVITY_ICONS[line.iconKey] || Sparkles;
                return (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: "var(--cc-card2)", color: "var(--cc-soft)" }}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="min-w-0 truncate text-xs" style={{ color: "var(--cc-soft)" }}>
                      <ProfileLink username={p.author?.username} className="font-semibold text-[var(--cc-ink)]">
                        {line.subject}
                      </ProfileLink>{" "}
                      {line.verb}{" "}
                      {pay.type === "ticker_like_milestone" && pay.ticker ? (
                        <Link href={`/research/${encodeURIComponent(pay.ticker)}`} className="font-medium" style={{ color: "var(--cc-orange-ink)" }}>{line.target}</Link>
                      ) : (
                        <span className="font-medium" style={{ color: "var(--cc-ink)" }}>{line.target}</span>
                      )}
                    </p>
                    <span className="ml-auto shrink-0 text-[10px]" style={{ color: "var(--cc-soft)" }}>{timeAgo(p.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── founding states ─────────────────────────────────────────────────────── */
function FoundingNoteCc({
  eyebrow, headline, body, ledger, action,
}: {
  eyebrow: string;
  headline: string;
  body?: string;
  ledger?: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="py-7">
      <Kicker>{eyebrow}</Kicker>
      <h3 className="mt-2 max-w-[22ch] cc-display text-[24px] leading-[1.05]" style={{ color: "var(--cc-ink)" }}>
        {headline}
      </h3>
      {body && (
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {body}
        </p>
      )}
      {ledger && ledger.length > 0 && (
        <p className="mt-3 font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
          {ledger.join("  ·  ")}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function CcEmptyRoom({
  copy, ledger, onStart,
}: {
  copy: { eyebrow: string; title: string; body: string };
  ledger?: string[];
  onStart?: () => void;
}) {
  return (
    <div className="rounded-2xl border px-3.5" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <FoundingNoteCc
        eyebrow={copy.eyebrow}
        headline={copy.title}
        body={copy.body}
        ledger={ledger}
        action={
          onStart ? (
            <button type="button" onClick={onStart} className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--cc-orange-ink)" }}>
              Write the first entry <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

function CcFoundingTail({
  count, ledger, readOnly, feedReadOnlyKid, onStart,
}: {
  count: number;
  ledger: string[];
  readOnly: boolean;
  feedReadOnlyKid: boolean;
  onStart: () => void;
}) {
  return (
    <div className="rounded-2xl border px-3.5" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <FoundingNoteCc
        eyebrow="The floor is open"
        headline={count === 1 ? "One entry in. The next one is yours." : `${count} entries in. The next one is yours.`}
        body={
          readOnly
            ? "Members write the floor. Join the Club to file your own entry alongside them."
            : feedReadOnlyKid
              ? "Read everything here. Your own space to post is being built."
              : "Nobody is waiting for permission. File a read, a question, or the trade you're still arguing with yourself about."
        }
        ledger={ledger}
        action={
          readOnly ? (
            <a href={JOIN_CLUB_URL} className="cc-halo inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold" style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}>
              Join the Club
            </a>
          ) : feedReadOnlyKid ? undefined : (
            <button type="button" onClick={onStart} className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--cc-orange-ink)" }}>
              Write an entry
            </button>
          )
        }
      />
    </div>
  );
}

/* ── watchlist share card ────────────────────────────────────────────────── */
const SHARE_STATUS_LABEL: Record<string, string> = {
  watch: "Watching",
  study: "Studying",
  favorite: "Family favourite",
  avoid: "Decided to avoid",
};

function CcWatchlistShareCard({ payload }: { payload: WatchlistSharePayload }) {
  const [quote, setQuote] = useState<{ price: number; changePct: number } | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/market/quote?symbol=${encodeURIComponent(payload.ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted) return;
        const q = data?.quote;
        if (q && typeof q.price === "number") setQuote({ price: q.price, changePct: Number(q.changePercent) || 0 });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [payload.ticker]);

  const status = SHARE_STATUS_LABEL[payload.status] || SHARE_STATUS_LABEL.watch;
  const thesis = payload.why_we_picked || payload.bull_case;
  return (
    <Link href={`/research/${encodeURIComponent(payload.ticker)}`} className="mt-3 block py-1 pl-3.5 transition-colors" style={{ borderLeft: "2px solid var(--cc-line)" }}>
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={payload.ticker} name={payload.company_name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5">
            <span className="truncate text-[14px] font-bold" style={{ color: "var(--cc-ink)" }}>{payload.company_name}</span>
            <span className="font-[family-name:var(--font-plex-mono)] text-[11px] font-bold" style={{ color: "var(--cc-orange-ink)" }}>
              ${payload.ticker}
            </span>
            <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>{status}</span>
          </div>
          {/* PRICE — the one place green/pink is correct on this card. */}
          {quote && (
            <p className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[11.5px] tabular-nums">
              <span className="font-bold" style={{ color: "var(--cc-ink)" }}>${quote.price.toFixed(2)}</span>{" "}
              <span style={{ color: quote.changePct >= 0 ? "var(--cc-up)" : "var(--cc-down)" }}>
                {quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
              </span>{" "}
              <span style={{ color: "var(--cc-soft)" }}>delayed</span>
            </p>
          )}
        </div>
      </div>
      {thesis && (
        <p className="mt-2 line-clamp-2 text-[13.5px] italic leading-relaxed" style={{ color: "var(--cc-soft)" }}>&ldquo;{thesis}&rdquo;</p>
      )}
      {payload.champion_name && (
        <p className="mt-1 font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>Championed by {payload.champion_name}</p>
      )}
    </Link>
  );
}

/* ── comment thread ──────────────────────────────────────────────────────── */
function CcCommentThread(props: EngagementProps) {
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
    <div className="mt-4 space-y-3.5 border-l pl-4" style={{ borderColor: "var(--cc-line)" }}>
      {comments === undefined ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--cc-orange-ink)" }} /></div>
      ) : comments.length === 0 ? (
        <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>No replies yet</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <ProfileLink username={c.author?.username} variant="avatar">
              <BeltAvatar initials={initialsOf(c.author?.display_name)} belt={beltKeyOf(xpOf?.(c.author?.id) ?? 0)} size={28} />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <ProfileLink username={c.author?.username} className="text-[12.5px] font-bold text-[var(--cc-ink)]">
                  {c.author?.display_name || "Member"}
                </ProfileLink>
                <AuthorMarks role={c.author?.role} xp={xpOf?.(c.author?.id) ?? 0} />
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="font-[family-name:var(--font-plex-mono)] text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--cc-soft)" }}>{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed" style={{ color: "var(--cc-soft)" }}><RichBody body={c.body} /></p>
            </div>
          </div>
        ))
      )}
      {me && readOnly && (
        <p className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--cc-soft)" }}>
          <a href={JOIN_CLUB_URL} className="font-bold" style={{ color: "var(--cc-orange-ink)" }}>Join the Club</a>{" "}to reply
        </p>
      )}
      {me && !readOnly && (
        <div>
          {err && <p className="mb-1 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cc-ink)" }}>{err}</p>}
          <div className="flex items-end gap-2.5">
            <BeltAvatar initials={initialsOf(me.display_name)} belt={beltKeyOf(xpOf?.(me.id) ?? 0)} size={28} />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Reply…"
              className="max-h-24 flex-1 resize-none border-b bg-transparent pb-1.5 text-[14px] focus:outline-none"
              style={{ borderColor: "var(--cc-line)", color: "var(--cc-ink)" }}
            />
            <button onClick={submit} disabled={!draft.trim() || sending} aria-label="Reply" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40" style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}><Send className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── VIP room banner (gated) ─────────────────────────────────────────────── */
function CcVipRoomBanner() {
  const [vip, setVip] = useState(false);
  useEffect(() => {
    let on = true;
    fetch("/api/challenge/vip-room")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on && d?.vip) setVip(true); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  if (!vip) return null;
  return (
    <Link href="/vip-room" className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors hover:border-[var(--cc-orange)]" style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}>
      <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--cc-orange-ink)" }} aria-hidden />
      <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cc-orange-ink)" }}>
        VIP
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: "var(--cc-ink)" }}>
        Your private room is open
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--cc-orange-ink)" }} />
    </Link>
  );
}
