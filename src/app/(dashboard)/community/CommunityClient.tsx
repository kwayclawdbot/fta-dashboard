"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  AtSign, Send, Trophy, Heart, Sparkles,
  ArrowRight, Paperclip, X, Film, Loader2, Link2,
  Award, Eye, CheckCircle2, Target, Calendar,
  Tag,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, countXpToday, getUserXp } from "@/lib/xp";
import { useXpAward } from "@/components/canvas2";
import {
  getClubTier,
  getFamilyTierMap,
  type FamilyTier,
} from "@/lib/tier";
import { fetchXpForUsers } from "@/lib/belts";
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
import {
  isSharedFeedReadOnly,
  KID_FEED_READONLY_NOTE,
} from "@/lib/social/kid-posting";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import AgeBadge from "@/components/community/AgeBadge";
import ClubChatDrawer from "@/components/community/ClubChatDrawer";
import AnnouncementCard from "@/components/community/AnnouncementCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { TextAction } from "@/components/f0/parts";
import { ScrollRow, TickerTile, TickerTileStrip } from "@/components/canvas2";
import {
  Cashtag,
  CredibilityTag,
  FoundingNote,
  StanceLabel,
  VoltAction,
} from "./parts";
import {
  BoardCard,
  SectionLabel,
  StanceChip,
  StoryRing,
  TickerMark,
} from "./board";
import { REASON_BY_KEY, type ChangedMindEntry } from "@/lib/social/stance";

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
  embedded = false,
  onOpenDiscussions,
}: {
  initialData?: CommunityFeedSeed | null;
  /** Rendered inside The Club's Feed mode — the mode shell owns the Lounge chat,
   *  so the always-on ClubChatDrawer is suppressed to avoid a duplicate chat. */
  embedded?: boolean;
  /** Board 01's HOT DISCUSSIONS block hands off to the Discussions screen. */
  onOpenDiscussions?: () => void;
}) {
  const supabase = createClient();
  // The XP award moment for publishing — see the fire() call in the composer.
  const xpAward = useXpAward();
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
  // Board 01 draws the composer CLOSED — a pill. It opens on the first touch and
  // stays open for the rest of the session.
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // R5 composer additions: ticker tags + optional bull/neutral/bear stance.
  const [tickerDraft, setTickerDraft] = useState("");
  const [tickerTags, setTickerTags] = useState<string[]>([]);
  const [position, setPosition] = useState<PostPosition | null>(null);
  // KAI §2b: optional structured capture (asked once, never inferred).
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

  // Board 01's Feed is ONE stream. The old four-way filter rail (All / Following
  // / Research / Tickers) is gone: the board draws no second control on this
  // screen, and per-ticker threading is the Discussions screen's whole subject.

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

  /* ── "edited" marks, asked for separately ───────────────────────────────
     feed_posts.edited_at arrives with migration 201. Folding it into the feed's
     main select would mean a database that has not run 201 yet answers the
     WHOLE query with 42703 and the club sees an empty room — a schema rollout
     is not allowed to take the feed down. So the mark is a second, tiny read
     (only rows that were actually edited), and an error simply means no marks.  */
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

  // ── Load feed (posts + likes + comment counts) ──
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
    [supabase, loadTiers, resolveMentions, hydrateEdited]
  );

  // Initial load
  useEffect(() => {
    let mounted = true;
    // Server-first: the feed + profile + tier are already seeded. Skip the whole
    // client load (no duplicate fetch, no skeleton flash); just run the
    // post-paint badge evaluation that the original load did.
    if (seeded) {
      if (initialData?.me?.id) evaluateBadges(supabase, initialData.me.id);
      // The seed's select cannot ask for edited_at (see hydrateEdited) — the
      // marks come in after paint, or not at all.
      hydrateEdited((initialData?.posts ?? []).map((p) => p.id));
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

  // Reveal + focus the composer — used by warm empty states to invite a post.
  const focusComposer = useCallback(() => {
    setComposerOpen(true);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    });
  }, []);

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

    // Fold any in-body $cashtags into the tag set, then validate the whole set
    // against the securities universe (screener_metrics) so only real symbols
    // are stored. Manual tags keep priority (listed first); cap at 4. If the
    // validation query fails, degrade to the raw merge so a post never silently
    // loses its tags.
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
        // KAI §2b structured capture — horizon only meaningful with a ticker.
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
      // Publishing used to bank XP in total silence — the number moved on a
      // screen the member had already scrolled past. The award is now spent:
      // read the lifetime total BEFORE the write, award, then fire the moment
      // with both figures so the belt beat only plays when a belt was really
      // crossed. `awardXp` swallows its own errors, so the celebration is
      // gated on the row we can actually see land, never on the call
      // returning.
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

  /* ── Your own entry: rewrite it, or withdraw it ──────────────────────────
     Both are REAL writes against feed_posts, authorized by the author's own
     policies (034, guarded by migration 201). Neither pretends: a refusal from
     the database is handed back as a sentence for the card to print, and the
     local state only moves after the write actually lands.

     The edit deliberately sends edited_at too. On a database with 201 the
     trigger overrides it anyway (the disclosure is the trigger's, never the
     client's); on one WITHOUT 201 the column does not exist, PostgREST answers
     42703, and we retry the body alone — the words are saved, the "edited" mark
     just isn't available yet. What we never do is claim an edit that failed. */
  const savePostEdit = useCallback(
    async (postId: string, nextBody: string): Promise<{ ok: boolean; error?: string }> => {
      const body = nextBody.trim();
      if (!body) return { ok: false, error: "An entry still needs something in it." };
      if (!checkClean(body).ok) return { ok: false, error: PROFANITY_MESSAGE };

      const stamp = new Date().toISOString();
      // .select() is the honesty check: a row refused by RLS comes back as an
      // EMPTY result with no error at all, so "no error" is not proof of a write.
      let { data, error } = await supabase
        .from("feed_posts")
        .update({ body, edited_at: stamp })
        .eq("id", postId)
        .select("id");

      let marked = true;
      // 42703 = column does not exist → migration 201 hasn't run here yet.
      if (error && error.code === "42703") {
        marked = false;
        ({ data, error } = await supabase
          .from("feed_posts")
          .update({ body })
          .eq("id", postId)
          .select("id"));
      }
      if (error || !data?.length) {
        return {
          ok: false,
          error: "That edit wasn't allowed — you can only change your own entry.",
        };
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
      // Same honesty check as the edit: a delete refused by RLS returns no
      // error and deletes nothing, so the returned rows are the proof.
      const { data, error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", postId)
        .select("id");
      if (error || !data?.length) {
        return {
          ok: false,
          error: "That entry couldn't be deleted — you can only delete your own.",
        };
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      return { ok: true };
    },
    [supabase]
  );

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

  // KID FEED READ-ONLY (SOCIAL-OBJECTS + FIC-LEARNING-WORLD P8): kids READ + REACT
  // in the shared adult feed but do not post top-level entries into it. Structured,
  // cohort-scoped kid social is coming. The composer slot shows a warm note instead;
  // migration 161 enforces the same server-side. Single flip in src/lib/social/
  // kid-posting.ts (KID_FEED_READONLY) + its SQL pair. Teens/adults unaffected.
  const feedReadOnlyKid = isSharedFeedReadOnly(me ? deriveRegister(me) : "adult");

  // ?compose= deep-link → seed the composer once (member composer only).
  useEffect(() => {
    if (composeSeeded.current || !tierResolved || readOnly) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seed = params.get("compose");
    if (!seed) return;
    composeSeeded.current = true;
    setComposerOpen(true);
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

  // Latest announcement pins above the feed for 7 days; older ones flow in-feed.
  const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
  const pinnedAnnouncement = posts.find(
    (p) => p.kind === "announcement" && Date.now() - new Date(p.created_at).getTime() < SEVEN_DAYS
  );
  const feedList = posts.filter(
    (p) => p.kind !== "anchor" && p.id !== pinnedAnnouncement?.id
  );

  // ── Two lanes ─────────────────────────────────────────────────────────────
  // The editorial lane = human posts (the dominant conversation). The ambient
  // lane = auto-generated activity ("is now researching / going to class"),
  // collapsed into one quiet strip instead of ~25 interchangeable cards.
  const threadPosts = useMemo(
    () => feedList.filter((p) => p.kind === "post"),
    [feedList]
  );
  const feedAnnouncements = useMemo(
    () => feedList.filter((p) => p.kind === "announcement"),
    [feedList]
  );
  const activityItems = useMemo(
    () => feedList.filter((p) => p.kind === "activity"),
    [feedList]
  );

  // FOUNDING STATE COPY. It takes a position instead of apologising for a small
  // room — the surface most exposed to emptiness earns the most deliberate
  // writing.
  const EMPTY_COPY = {
    eyebrow: "The floor is open",
    title: "Nothing on the floor yet.",
    body: "The first entry sets the tone for every member who walks in after it. Share a read, ask the thing you're stuck on, or post your family's pick.",
  };

  // ── Board 01 sections ─────────────────────────────────────────────────────
  // WHO'S AROUND — the real distinct voices in the seeded feed, newest first.
  // Never a manufactured crowd: these are members who actually posted.
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

  // TOP IN THE CLUB — the names the club is actually tagging, most-tagged first.
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

  // HOT DISCUSSIONS — the two busiest ticker threads, by real entry count.
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

  // Live deltas for the TOP IN THE CLUB strip. A tile with no quote renders the
  // honest dash rather than a fabricated 0.00% (TickerTile owns that contract).
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

  // The newest change of mind, for board 01's preview card. One row, one RPC —
  // the same aggregate the destination reads (get_changed_minds, migration 190).
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

  // Real ledger counts for the founding note — the club's actual numbers,
  // stated rather than hidden. Never inferred, never rounded up, and ZEROS ARE
  // DROPPED rather than printed: "3 entries · 2 voices" owns a small room,
  // "0 entries · 0 voices" is the exact failure this surface must never show.
  // With nothing to count the note falls back to type alone.
  const voiceCount = new Set(
    threadPosts.map((p) => p.author?.id).filter(Boolean)
  ).size;
  const foundingLedger = [
    threadPosts.length > 0
      ? `${threadPosts.length} ${threadPosts.length === 1 ? "entry" : "entries"}`
      : null,
    voiceCount > 0 ? `${voiceCount} ${voiceCount === 1 ? "voice" : "voices"}` : null,
    activityItems.length > 0 ? `${activityItems.length} moves today` : null,
  ].filter((x): x is string => x !== null);

  return (
    <MentionProvider map={mentions}>
    <div className="relative max-w-2xl mx-auto">
      {/* The award overlay anchors to the whole feed column, so the count-up
          and the belt beat land over the post that earned them rather than
          over one corner of the composer. It renders nothing until fired. */}
      {xpAward.overlay}
      <div className="space-y-6">
        {/* Main feed — full width now that Club Chat lives in a drawer */}
        <div className="min-w-0 space-y-6">
          {/* VIP Room entry — gated: only renders for Challenge VIP members. */}
          <VipRoomBanner />

          {/* Pinned latest announcement (first 7 days) */}
          {pinnedAnnouncement && <AnnouncementCard post={pinnedAnnouncement} pinned />}

          {/* Composer — board 01 draws it CLOSED: a white pill with the member's
              avatar and "What's on your mind?". It opens into the full composer
              on the first touch, so the screen leads with the room rather than
              with a form. Renders NEITHER pill nor upsell until the tier is
              known, so a free viewer never flashes the member composer while
              getFamilyTier is in flight. */}
          {!tierResolved ? (
            <div className="flex animate-pulse items-center gap-3 rounded-[14px] border border-sand bg-card p-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-sand/60" />
              <div className="h-4 flex-1 rounded bg-sand/40" />
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
              className="f0-focus flex w-full items-center gap-3 rounded-[14px] border border-sand bg-card px-3.5 py-3 text-left transition-colors hover:border-gold-300"
            >
              <Avatar
                name={me?.display_name}
                avatarUrl={me?.avatar_url}
                role={me?.role}
                tier={(me?.family_id && tiers[me.family_id]) || myTier}
                size="sm"
              />
              <span className="text-[13px] text-soft">What&apos;s on your mind?</span>
            </button>
          ) : (
          <div className="rounded-[14px] border border-sand bg-card p-3.5">
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
                    placeholder={me?.role === "child" ? "Share what your family learned today…" : "Write an entry — a read, a question, or your family's pick…"}
                    rows={2}
                    className="w-full resize-none bg-transparent p-0 font-body text-[15px] leading-relaxed text-ink placeholder:text-soft focus:outline-none"
                  />
                  {mention && mentionCandidates.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-sand rounded-lg shadow-lg overflow-hidden z-20">
                      <p className="flex items-center gap-1 px-3 pt-2 pb-1 text-[10px] font-display font-semibold uppercase tracking-wider text-soft">
                        <AtSign className="w-3 h-3" /> Mention someone
                      </p>
                      {mentionCandidates.map((c, i) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); insertMention(c); }}
                          onMouseEnter={() => setMentionIdx(i)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 text-left ${i === mentionIdx ? "bg-paper" : "bg-card"}`}
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
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gold-600 shrink-0" /> : (
                      <button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="w-6 h-6 rounded-full bg-sand flex items-center justify-center text-soft shrink-0"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                )}
                {composerError && <p className="mt-2 font-body text-xs font-semibold text-ink">{composerError}</p>}

                {/* R5 ticker tagger + positioning */}
                {showTagger && (
                  <div className="mt-3 f0-rule-top pt-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tickerTags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 bg-teal-400/15 text-teal-700 dark:text-teal-300 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded">
                          ${t}
                          <button type="button" onClick={() => removeTicker(t)} aria-label={`Remove ${t}`} className="hover:text-teal-800 dark:hover:text-teal-200">
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
                    {/* KAI §2b — optional "what kind of post" (any post) */}
                    <div className="flex items-center gap-1.5 mt-2 pt-2 f0-rule-top flex-wrap">
                      <span className="text-[10px] text-soft font-display uppercase tracking-wider mr-0.5">Type</span>
                      {(["thesis", "question", "news_reaction"] as ContentType[]).map((c) => {
                        const active = contentType === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setContentType(active ? null : c)}
                            className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${active ? "bg-chip-sky text-sky-800 ring-1 ring-current" : "bg-sand/60 text-soft hover:text-ink"}`}
                          >
                            {CONTENT_TYPE_META[c].label}
                          </button>
                        );
                      })}
                    </div>
                    {/* STANCE PICKER — must speak the same lime-keyed vocabulary
                        the published entry does. The old picker used POSITION_META's
                        green/red chips, which broke the colour law right at the
                        moment the member declares a stance (and taught them that
                        bull == green == price). Selected state is carried by the
                        StanceLabel mark itself plus a volt ring: the accent means
                        "this is your choice", the label means bull/bear. */}
                    {tickerTags.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 pt-2 f0-rule-top">
                        <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">Leaning</span>
                        {(["bull", "neutral", "bear"] as PostPosition[]).map((p) => {
                          const active = position === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setPosition(active ? null : p)}
                              className={`inline-flex items-center rounded-full px-2 py-1 transition-colors ${
                                active
                                  ? "bg-volt-500/12 ring-1 ring-volt-500/40"
                                  : "opacity-55 hover:opacity-100"
                              }`}
                            >
                              <StanceLabel position={p} size="sm" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* KAI §2b — optional time horizon (ticker-scoped) */}
                    {tickerTags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] text-soft font-display uppercase tracking-wider mr-0.5">Horizon</span>
                        {(["near", "1yr", "3-5yr"] as TimeHorizon[]).map((h) => {
                          const active = timeHorizon === h;
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setTimeHorizon(active ? null : h)}
                              className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${active ? "bg-teal-400/15 text-teal-700 dark:text-teal-300 ring-1 ring-current" : "bg-sand/60 text-soft hover:text-ink"}`}
                            >
                              {TIME_HORIZON_META[h].label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <input ref={fileRef} type="file" accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach a photo or video" title="Attach a photo or video" className="text-soft transition-colors hover:text-ink disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
                    <button type="button" onClick={insertLink} disabled={posting} aria-label="Add a link" title="Add a link" className="text-soft transition-colors hover:text-ink disabled:opacity-40"><Link2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setShowTagger((v) => !v)} disabled={posting} aria-label="Tag a ticker" title="Tag a ticker" className={`transition-colors disabled:opacity-40 ${showTagger || tickerTags.length ? "text-teal-600 dark:text-teal-300" : "text-soft hover:text-ink"}`}><Tag className="w-4 h-4" /></button>
                  </div>
                  <button onClick={submitPost} disabled={(!text.trim() && !attachment) || posting || !me} className="inline-flex items-center gap-1.5 rounded-full bg-volt-500 dark:bg-volt-600 px-4 py-2 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-transform hover:-translate-y-px hover:bg-volt-600 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:hover:translate-y-0">
                    <Send className="w-3.5 h-3.5" />{uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── WHO'S AROUND (board 01's story rail) ───────────────────────
              Real distinct voices from the feed, newest first. Never a
              manufactured crowd — these are members who actually posted. */}
          {voices.length > 0 && (
            <ScrollRow className="-mx-1 flex gap-2 px-1">
              {voices.map((a, i) => (
                <ProfileLink key={a.id} username={a.username} variant="avatar">
                  <StoryRing live={i === 0} label={(a.display_name || "Member").split(" ")[0]}>
                    <Avatar
                      name={a.display_name}
                      avatarUrl={a.avatar_url}
                      role={a.role}
                      tier={tierOf(a)}
                      xp={xpOf(a.id)}
                      size="lg"
                    />
                  </StoryRing>
                </ProfileLink>
              ))}
            </ScrollRow>
          )}

          {/* ── TOP IN THE CLUB (board 01) ────────────────────────────────
              The names the club is actually tagging, most-tagged first, with
              live deltas. A tile with no quote prints the honest dash. */}
          {topTickers.length > 0 && (
            <section>
              <SectionLabel glyph="🔥">Top in the Club</SectionLabel>
              <TickerTileStrip>
                {topTickers.map((t) => (
                  <TickerTile
                    key={t}
                    ticker={t}
                    changePct={quotes[t] ?? null}
                    href={`/research/${encodeURIComponent(t)}`}
                  />
                ))}
              </TickerTileStrip>
            </section>
          )}

          {/* ── CHANGED MY MIND (board 01's preview card) ─────────────────── */}
          {latestFlip && (
            <section>
              <SectionLabel action="See all" actionHref="/community/changed-my-mind">
                Changed my mind
              </SectionLabel>
              <BoardCard>
                <div className="flex items-start gap-2.5">
                  <Avatar
                    name={latestFlip.display_name}
                    avatarUrl={latestFlip.avatar_url}
                    role={latestFlip.role}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13px] font-bold text-ink">
                      {latestFlip.display_name || "Member"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-soft">
                      <span>Changed on ${latestFlip.ticker.toUpperCase()}</span>
                      {latestFlip.from_stance && (
                        <StanceChip stance={latestFlip.from_stance} muted size="sm" />
                      )}
                      <span aria-hidden className="font-bold text-gold-700">
                        →
                      </span>
                      <StanceChip stance={latestFlip.to_stance} size="sm" />
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 pl-[42px]">
                  <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-gold-700">
                    Changed my mind
                  </p>
                  <p className="mt-1.5 text-[13px] leading-[1.5] text-ink">
                    {latestFlip.note ||
                      (latestFlip.reason
                        ? REASON_BY_KEY[latestFlip.reason].label
                        : "Position updated.")}
                  </p>
                  {latestFlip.respect_count > 0 && (
                    <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-soft">
                      {latestFlip.respect_count} respect
                    </p>
                  )}
                </div>
              </BoardCard>
            </section>
          )}

          {/* ── HOT DISCUSSIONS (board 01) ────────────────────────────────── */}
          {hotThreads.length > 0 && (
            <section>
              <SectionLabel
                action="See all"
                onAction={onOpenDiscussions}
                actionHref={onOpenDiscussions ? undefined : "/community?mode=discussions"}
              >
                Hot discussions
              </SectionLabel>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {hotThreads.map((t) => (
                  <BoardCard key={t.ticker} href={`/research/${encodeURIComponent(t.ticker)}`}>
                    <div className="flex items-center gap-2.5">
                      <TickerMark ticker={t.ticker} size={30} tone="cream" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[12.5px] font-bold text-ink">
                          ${t.ticker} thread
                        </span>
                        <span className="mt-0.5 block text-[11px] text-soft">
                          {t.entries} {t.entries === 1 ? "entry" : "entries"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-soft" aria-hidden />
                    </div>
                  </BoardCard>
                ))}
              </div>
            </section>
          )}

          {/* ── The feed itself ──────────────────────────────────────────────
              Board 01 builds the whole screen out of cards, so an entry is a
              card: white ground, one sand hairline, 14px radius. Hierarchy
              inside the card is still type — byline, promoted opening line,
              prose, marks, reactions. */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-[14px] border border-sand bg-card p-3.5">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-sand/60" />
                    <div className="flex-1">
                      <div className="mb-3 h-3.5 w-32 rounded bg-sand/70" />
                      <div className="mb-1.5 h-3 w-full rounded bg-sand/50" />
                      <div className="h-3 w-2/3 rounded bg-sand/50" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* In-feed announcements (rare — pinned ones live above) */}
              {feedAnnouncements.map((p) => (
                <AnnouncementCard key={p.id} post={p} />
              ))}

              {/* Ambient activity — collapsed grouped strip */}
              {activityItems.length > 0 && <AmbientActivityStrip items={activityItems} />}

              {/* The conversation */}
              {threadPosts.length === 0 ? (
                <EmptyRoom
                  copy={EMPTY_COPY}
                  ledger={foundingLedger}
                  onStart={!readOnly && !feedReadOnlyKid ? focusComposer : undefined}
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {threadPosts.map((p, i) => (
                      <m.div key={p.id} initial={seededPostIds.current.has(p.id) ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }}>
                        <PostEntry
                          post={p} me={me} tier={tierOf(p.author)} readOnly={readOnly}
                          likeCount={likeCount[p.id] || 0} liked={likedByMe.has(p.id)} onLike={() => toggleLike(p.id)}
                          commentCount={commentCount[p.id] || 0} commentsOpen={!!openComments[p.id]} onToggleComments={() => toggleComments(p.id)}
                          comments={commentsByPost[p.id]} onAddComment={addComment} tierOf={tierOf} xpOf={xpOf}
                          canManage={!!me && !!p.author_id && p.author_id === me.id && !feedReadOnlyKid}
                          onEditPost={savePostEdit} onDeletePost={deletePost}
                        />
                      </m.div>
                    ))}
                  </div>

                  {/* FOUNDING TAIL — the club has ~3 entries. Rather than let the
                      ledger stop dead after the last one, the floor stays open as
                      the NEXT entry on the same hairline: same rhythm, real
                      counts, one action. A thin room reads as a room that
                      started, not one that failed. */}
                  {threadPosts.length < 6 && (
                    <BoardCard className="px-3.5">
                      <FoundingNote
                        eyebrow="The floor is open"
                        headline={
                          threadPosts.length === 1
                            ? "One entry in. The next one is yours."
                            : `${threadPosts.length} entries in. The next one is yours.`
                        }
                        body={
                          readOnly
                            ? "Members write the floor. Join the Club to file your own entry alongside them."
                            : feedReadOnlyKid
                              ? "Read everything here. Your own space to post is being built."
                              : "Nobody is waiting for permission. File a read, a question, or the trade you're still arguing with yourself about."
                        }
                        ledger={foundingLedger}
                        action={
                          readOnly ? (
                            <VoltAction href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a">
                              Join the Club
                            </VoltAction>
                          ) : feedReadOnlyKid ? undefined : (
                            <TextAction onClick={focusComposer}>
                              Write an entry
                            </TextAction>
                          )
                        }
                      />
                    </BoardCard>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Club Chat — always one tap away via the shared drawer. Suppressed when
          embedded in The Club shell, where the Lounge mode owns chat. */}
      {!embedded && <ClubChatDrawer key={myTier} me={me} tier={myTier} />}
    </div>
    </MentionProvider>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Split an entry into HEADLINE + prose.
 *
 * Members write posts, not articles — so the headline is not invented, it is
 * FOUND: the entry's own first line or first sentence, promoted typographically.
 * Nothing is ever truncated away; whatever isn't the headline renders below it
 * verbatim. When an entry has no natural break inside 140 chars it gets NO
 * headline and runs as prose — a fabricated headline would be worse than none.
 */
function splitEntry(raw: string | null | undefined): {
  headline: string | null;
  rest: string;
} {
  const body = (raw ?? "").trim();
  if (!body) return { headline: null, rest: "" };

  const nl = body.indexOf("\n");
  if (nl > 0 && nl <= 140) {
    return { headline: body.slice(0, nl).trim(), rest: body.slice(nl).trim() };
  }
  const sentence = body.slice(0, 140).match(/^[\s\S]*?[.!?…](\s|$)/);
  if (sentence && sentence[0].trim().length >= 12) {
    return {
      headline: sentence[0].trim(),
      rest: body.slice(sentence[0].length).trim(),
    };
  }
  if (body.length <= 140) return { headline: body, rest: "" };
  return { headline: null, rest: body };
}

/** The entry's promoted opening line — display-3 weight, the loudest type in the row. */
function EntryHeadline({ text }: { text: string }) {
  return (
    <h3 className="mt-1.5 font-display text-[20px] font-extrabold leading-[1.18] tracking-[-0.015em] text-ink">
      <RichBody body={text} />
    </h3>
  );
}

function PostBody({ body }: { body: string }) {
  if (!body) return null;
  // Prose under the headline: quieter, so the headline carries the row.
  return (
    <p className="mt-2 whitespace-pre-wrap break-words font-body text-[15px] leading-relaxed text-soft">
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
      {/* The lightbox scrim is theme-INVARIANT on purpose: a full-screen media
          viewer neutralises the surrounding UI in both themes, so black/85 and
          white chrome are correct here and must NOT follow the page tokens. */}
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
  /** Your own entry — the overflow menu is offered only when this is true. */
  canManage?: boolean;
  onEditPost?: (postId: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeletePost?: (postId: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * The reaction rail — a tight MONO ledger line, not a button bar.
 *
 * COLOUR: a like is COMMUNITY SENTIMENT, so an active like is LIME. The old red
 * heart is gone: red belongs to price under the colour law, and a red heart next
 * to a $CASHTAG entry reads as a down move for a beat before it reads as a like.
 * Free members keep the counts (they can read the room) but the like is inert.
 */
function LikeCommentBar({ liked, likeCount, onLike, commentCount, onToggleComments, readOnly }: {
  liked: boolean; likeCount: number; onLike: () => void; commentCount: number; onToggleComments: () => void; readOnly?: boolean;
}) {
  return (
    <div className="mt-3.5 flex items-center gap-5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">
      <button
        onClick={readOnly ? undefined : onLike}
        disabled={readOnly}
        className={`inline-flex items-center gap-1.5 transition-colors ${
          readOnly
            ? "cursor-default text-soft"
            : liked
              ? "text-lime-700 dark:text-lime-400"
              : "text-soft hover:text-ink"
        }`}
      >
        <Heart className={`h-3.5 w-3.5 ${liked && !readOnly ? "fill-lime-500 text-lime-600 dark:fill-lime-400 dark:text-lime-400" : ""}`} />
        {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
        <span>{liked && !readOnly ? "Liked" : "Like"}</span>
      </button>
      <button
        onClick={onToggleComments}
        className="inline-flex items-center gap-1.5 text-soft transition-colors hover:text-ink"
      >
        <span>Reply</span>
        {commentCount > 0 && <span className="tabular-nums text-ink">{commentCount}</span>}
      </button>
    </div>
  );
}

// Read-only composer slot for free members — the composer's card, saying what
// the card is for instead of pretending to be a form they can use.
function FreeComposerUpsell() {
  return (
    <div className="rounded-[14px] border border-sand bg-card p-3.5">
      <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
        Reading as a free member
      </p>
      <p className="mt-2 max-w-[38ch] font-display text-display-3 font-extrabold text-ink">
        You can read the floor. Members write it.
      </p>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-soft">
        Join the Club to file entries, back the ones you agree with, and reply in
        the threads.
      </p>
      <div className="mt-4">
        <VoltAction href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a">
          Join the Club <ArrowRight className="w-3.5 h-3.5" />
        </VoltAction>
      </div>
    </div>
  );
}

// KID FEED READ-ONLY — kids read + react in the shared feed but don't post into it
// (SOCIAL-OBJECTS + FIC-LEARNING-WORLD P8; enforced server-side by migration 161).
// A warm, non-punishing note in place of the composer — no upsell shown to a child.
function KidFeedReadOnlyNote() {
  return (
    <div className="rounded-[14px] border border-sand bg-card p-3.5">
      <p className="font-display text-eyebrow font-bold uppercase text-teal-700 dark:text-teal-300">
        Your space is coming
      </p>
      <p className="mt-2 max-w-[38ch] font-display text-display-3 font-extrabold text-ink">
        Read everything. Back what you like.
      </p>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-soft">
        {KID_FEED_READONLY_NOTE}
      </p>
    </div>
  );
}

// R5 — ticker-tag chips + optional positioning stance beneath a post body.
// KAI §2b — plus subtle structured metadata (content type + time horizon) when
// the author declared them at compose. Quiet, muted, never a loud chip wall.
function TickerRow({
  tags,
  position,
  timeHorizon,
  contentType,
}: {
  tags?: string[] | null;
  position?: PostPosition | null;
  timeHorizon?: TimeHorizon | null;
  contentType?: ContentType | null;
}) {
  const hasMeta = !!tags?.length || !!contentType || !!timeHorizon || !!position;
  if (!hasMeta) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {(tags ?? []).map((t) => (
        <Link key={t} href={`/research/${encodeURIComponent(t)}`} className="group/tag">
          <Cashtag ticker={t} />
        </Link>
      ))}
      {position && <StanceLabel position={position} />}
      {(contentType || timeHorizon) && (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
          {contentType ? CONTENT_TYPE_META[contentType].label : null}
          {contentType && timeHorizon ? " · " : null}
          {timeHorizon ? TIME_HORIZON_META[timeHorizon].label : null}
        </span>
      )}
    </div>
  );
}

/**
 * ONE ENTRY — a card, the unit board 01 is built from: white ground, one sand
 * hairline, 14px radius. Inside the card, hierarchy is still TYPE:
 *
 *   byline      avatar · name · CREDIBILITY (belt or authority) · age · time
 *   headline    the entry's own opening line, promoted to 20px Sora extrabold
 *   prose       the remainder, quiet
 *   marks       $CASHTAG (mono, teal-underlined) + BULL/BEAR stance (lime-keyed)
 *   reactions   a tight mono rail
 *
 * The credibility tag is EARNED standing (belt) or ROLE authority — the paid
 * tier badge stays out of the byline on purpose: a tier is a purchase, not
 * credibility, and it was the loudest thing in the row.
 */
function PostEntry(props: EngagementProps & { tier: FamilyTier }) {
  const { post, tier, canManage, onEditPost, onDeletePost } = props;
  const role = post.author?.role || "parent";
  const xp = props.xpOf?.(post.author?.id);
  const { headline, rest } = splitEntry(post.body);

  /* YOUR OWN ENTRY — the club could Like and Reply to a post and its author
     could do neither of the two things only they should be able to do. The menu
     is offered on own entries only; both actions are real writes and a refusal
     is printed on the card rather than swallowed. */
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
    if (!onEditPost || busy) return;
    setBusy(true);
    setErr(null);
    const res = await onEditPost(post.id, draft);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "That edit didn't go through.");
      return;
    }
    setEditing(false);
  }

  async function commitDelete() {
    if (!onDeletePost || busy) return;
    setBusy(true);
    setErr(null);
    const res = await onDeletePost(post.id);
    // On success this component unmounts with the row, so there is nothing to
    // reset — only a refusal needs to survive and be read.
    if (!res.ok) {
      setBusy(false);
      setErr(res.error ?? "That entry couldn't be deleted.");
      closeMenu();
    }
  }

  return (
    <div className="rounded-[14px] border border-sand bg-card p-3.5 transition-colors">
      <div className="flex items-start gap-3">
        <ProfileLink username={post.author?.username} variant="avatar">
          <Avatar name={post.author?.display_name} avatarUrl={post.author?.avatar_url} role={role} tier={tier} xp={xp} size="lg" />
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 leading-tight">
            <ProfileLink username={post.author?.username} className="font-display text-[14px] font-bold text-ink">
              {post.author?.display_name || "Member"}
            </ProfileLink>
            <CredibilityTag role={role} xp={xp} />
            <AgeBadge role={post.author?.role} ageGroup={post.author?.age_group} />
            <span className="ml-auto flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
              {timeAgo(post.created_at)}
              {/* An edit that isn't disclosed is a rewrite of the record. */}
              {post.edited_at && (
                <>
                  <span aria-hidden className="text-soft/60">·</span>
                  <span title="The author edited this entry">edited</span>
                </>
              )}
            </span>
            {canManage && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
                  aria-label="Entry options"
                  aria-expanded={menuOpen}
                  className="f0-focus -mr-1 flex h-6 w-6 items-center justify-center rounded-full text-soft transition-colors hover:text-ink"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <>
                    {/* Dismiss layer — a menu that only closes by re-tapping the
                        glyph is a menu members get stuck in. */}
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={closeMenu}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div
                      role="menu"
                      onKeyDown={(e) => e.key === "Escape" && closeMenu()}
                      className="absolute right-0 top-7 z-40 min-w-[11.5rem] overflow-hidden rounded-xl border border-sand bg-card py-1 shadow-[var(--shadow-lift)]"
                    >
                      {confirmingDelete ? (
                        <div className="px-3 py-2">
                          <p className="font-body text-[12.5px] leading-snug text-ink">
                            Delete this entry? Replies go with it.
                          </p>
                          <div className="mt-2 flex items-center gap-4">
                            <button
                              type="button"
                              onClick={commitDelete}
                              disabled={busy}
                              /* Deliberately NOT red: under the colour law red
                                 is price, and a red word beside a $CASHTAG
                                 entry reads as a down move first. The sentence
                                 above it carries the weight. */
                              className="f0-focus font-display text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-ink underline decoration-sand underline-offset-4 disabled:opacity-50"
                            >
                              {busy ? "Deleting…" : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={closeMenu}
                              className="f0-focus font-display text-[11.5px] font-semibold text-soft transition-colors hover:text-ink"
                            >
                              Keep it
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setDraft(post.body);
                              setErr(null);
                              setEditing(true);
                              closeMenu();
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-body text-[13px] text-ink transition-colors hover:bg-paper"
                          >
                            <Pencil className="h-3.5 w-3.5 text-soft" />
                            Edit entry
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setConfirmingDelete(true)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-body text-[13px] text-ink transition-colors hover:bg-paper"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-soft" />
                            Delete entry
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
              <label htmlFor={`edit-${post.id}`} className="sr-only">
                Edit your entry
              </label>
              <textarea
                id={`edit-${post.id}`}
                value={draft}
                autoFocus
                onChange={(e) => {
                  setDraft(e.target.value);
                  setErr(null);
                }}
                rows={Math.min(14, Math.max(4, draft.split("\n").length + 1))}
                className="f0-focus w-full resize-none rounded-[10px] border border-sand bg-paper p-3 font-body text-[14px] leading-[1.55] text-ink focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={commitEdit}
                  disabled={busy || !draft.trim() || draft === post.body}
                  className="f0-focus font-display text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-gold-700 transition-colors hover:text-gold-600 disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(post.body);
                    setErr(null);
                  }}
                  className="f0-focus font-display text-[11.5px] font-semibold text-soft transition-colors hover:text-ink"
                >
                  Cancel
                </button>
                <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">
                  Saves marked edited
                </span>
              </div>
            </div>
          ) : (
            <>
              {headline && <EntryHeadline text={headline} />}
              {rest && <PostBody body={rest} />}
            </>
          )}

          {/* The database's answer, printed. Never a silent no-op. */}
          {err && (
            <p role="alert" className="mt-2 font-body text-[12.5px] font-semibold leading-snug text-ink">
              {err}
            </p>
          )}

          <TickerRow tags={post.ticker_tags} position={post.position} timeHorizon={post.time_horizon} contentType={post.content_type} />
          {isWatchlistShare(post.activity_payload) && (
            <WatchlistShareCard payload={post.activity_payload} />
          )}
          <PostAttachment url={post.attachment_url} type={post.attachment_type} name={post.attachment_meta?.name} />
          <LikeCommentBar liked={props.liked} likeCount={props.likeCount} onLike={props.onLike} commentCount={props.commentCount} onToggleComments={props.onToggleComments} readOnly={props.readOnly} />
          {props.commentsOpen && <CommentThread {...props} />}
        </div>
      </div>
    </div>
  );
}

// ── Ambient activity strip (D1 collapse) ─────────────────────────────────────
// The auto-generated activity ("is now researching / going to class / earned a
// badge") used to render as ~25 identical cards that buried the ~3 real posts.
// Here it collapses into ONE quiet strip: a live pulse + a grouped summary line,
// expandable into a compact ledger. Visible pulse, zero noise — the real
// conversation below stays dominant.
function AmbientActivityStrip({ items }: { items: FeedPost[] }) {
  const [open, setOpen] = useState(false);

  // Grouped summary: how many updates + the standout tickers/companies moving
  // through the club right now.
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
    <div className="f0-rule-top">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 py-2.5 text-left"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
        </span>
        <span className="min-w-0 truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft">
          <span className="font-bold text-ink tabular-nums">{items.length}</span>{" "}
          {items.length === 1 ? "move" : "moves"} · {summary}
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <ul className="max-h-72 space-y-2 overflow-y-auto pb-3 pt-0.5">
              {items.map((p) => {
                const pay = p.activity_payload as ActivityPayload;
                const line = activityLine(pay);
                const Icon = ACTIVITY_ICONS[line.iconKey] || Sparkles;
                return (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${line.accent}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-xs text-soft min-w-0 truncate">
                      <ProfileLink username={p.author?.username} className="font-semibold text-ink">
                        {line.subject}
                      </ProfileLink>{" "}
                      {line.verb}{" "}
                      {pay.type === "ticker_like_milestone" && pay.ticker ? (
                        <Link href={`/research/${encodeURIComponent(pay.ticker)}`} className="font-medium text-gold-700 hover:text-gold-600">{line.target}</Link>
                      ) : (
                        <span className="font-medium text-ink">{line.target}</span>
                      )}
                    </p>
                    <span className="text-[10px] text-soft ml-auto shrink-0">{timeAgo(p.created_at)}</span>
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

/**
 * The FOUNDING STATE for a filter with nothing in it.
 *
 * Not a centred card with a grey icon. It is a left-aligned editorial note on
 * the same measure and rhythm as an entry — eyebrow rule, a display-3 line that
 * takes a position, the real ledger counts when we have them, one action. A
 * member reading this should feel early, not stranded.
 */
function EmptyRoom({
  copy,
  ledger,
  onStart,
}: {
  copy: { eyebrow: string; title: string; body: string };
  ledger?: string[];
  onStart?: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-sand bg-card px-3.5">
      <FoundingNote
        eyebrow={copy.eyebrow}
        headline={copy.title}
        body={copy.body}
        ledger={ledger}
        action={
          onStart ? (
            <TextAction onClick={onStart}>
              Write the first entry <ArrowRight className="w-3.5 h-3.5" />
            </TextAction>
          ) : undefined
        }
      />
    </div>
  );
}

// Status is a member's DECLARED relationship to a name — community sentiment,
// not price and not an action. It renders as a mono caps label, so it never
// competes with the green/red price mark two lines below it.
const SHARE_STATUS_LABEL: Record<string, string> = {
  watch: "Watching",
  study: "Studying",
  favorite: "Family favourite",
  avoid: "Decided to avoid",
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

  const status = SHARE_STATUS_LABEL[payload.status] || SHARE_STATUS_LABEL.watch;
  const thesis = payload.why_we_picked || payload.bull_case;
  return (
    <Link
      href={`/research/${encodeURIComponent(payload.ticker)}`}
      className="mt-3 block border-l-2 border-teal-500/45 py-1 pl-3.5 transition-colors hover:border-teal-500"
    >
      <div className="flex items-center gap-3">
        <CompanyLogo symbol={payload.ticker} name={payload.company_name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5">
            <span className="truncate font-display text-[14px] font-bold text-ink">{payload.company_name}</span>
            <span className="font-mono text-[11px] font-bold text-ink">
              <span className="text-teal-600 dark:text-teal-300">$</span>
              {payload.ticker}
            </span>
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-soft">{status}</span>
          </div>
          {/* PRICE — the one place green/red is correct on this surface. */}
          {quote && (
            <p className="mt-0.5 font-mono text-[11.5px] tabular-nums">
              <span className="font-bold text-ink">${quote.price.toFixed(2)}</span>{" "}
              <span className={quote.changePct >= 0 ? "text-price-up" : "text-price-down"}>
                {quote.changePct >= 0 ? "+" : ""}
                {quote.changePct.toFixed(2)}%
              </span>{" "}
              <span className="text-soft">delayed</span>
            </p>
          )}
        </div>
      </div>
      {thesis && (
        <p className="mt-2 line-clamp-2 font-body text-[13.5px] italic leading-relaxed text-soft">&ldquo;{thesis}&rdquo;</p>
      )}
      {payload.champion_name && (
        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">Championed by {payload.champion_name}</p>
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

  // Replies are INDENTED LEDGER ROWS under the entry — a marginal rule and a
  // byline, never chat bubbles. The reply is a continuation of the record.
  return (
    <div className="mt-4 space-y-3.5 border-l border-sand pl-4">
      {comments === undefined ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gold-600" /></div>
      ) : comments.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">No replies yet</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <ProfileLink username={c.author?.username} variant="avatar">
              <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} xp={xpOf?.(c.author?.id)} size="sm" />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <ProfileLink username={c.author?.username} className="font-display text-[12.5px] font-bold text-ink">
                  {c.author?.display_name || "Member"}
                </ProfileLink>
                <CredibilityTag role={c.author?.role} xp={xpOf?.(c.author?.id)} />
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-soft">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-soft"><RichBody body={c.body} /></p>
            </div>
          </div>
        ))
      )}
      {me && readOnly && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          <a href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a" className="font-bold text-gold-700">Join the Club</a>{" "}
          to reply
        </p>
      )}
      {me && !readOnly && (
        <div>
          {err && <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">{err}</p>}
          <div className="flex items-end gap-2.5">
            <Avatar name={me.display_name} avatarUrl={me.avatar_url} role={me.role} size="sm" />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Reply…"
              className="max-h-24 flex-1 resize-none border-b border-sand bg-transparent pb-1.5 text-[14px] text-ink placeholder:text-soft focus:border-volt-500 focus:outline-none"
            />
            <button onClick={submit} disabled={!draft.trim() || sending} aria-label="Reply" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-volt-500 dark:bg-volt-600 text-white transition-colors hover:bg-volt-600 disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
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
      className="flex items-center gap-3 f0-rule-top py-3 transition-colors hover:bg-volt-500/[0.06]"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">
        VIP
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold text-ink">
        Your private room is open
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-gold-600" />
    </Link>
  );
}
