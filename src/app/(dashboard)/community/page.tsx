"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  TrendingUp,
  Trophy,
  Pin,
  MessageCircle,
  Users,
  Home,
  ChevronDown,
  Sparkles,
  Hand,
  ArrowRight,
  Paperclip,
  X,
  Film,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { getFamilyTierMap, type FamilyTier } from "@/lib/tier";
import TierBadge, { tierRingClass } from "@/components/TierBadge";

// The single global community room (seeded in migration 016)
const COMMUNITY_ROOM_ID = "c0000000-0000-4000-a000-000000000001";

type Category = "win" | "question" | "announcement" | "discussion";
type FilterType = "all" | Category;
type Role = "parent" | "child" | "coach" | "admin";

interface Author {
  display_name: string | null;
  role: Role | null;
  age_group: string | null;
  family_id: string | null;
}

interface AttachmentMeta {
  width?: number;
  height?: number;
  size?: number;
  name?: string;
}

interface Message {
  id: string;
  content: string;
  category: Category;
  created_at: string;
  user_id: string;
  author: Author | null;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
  attachment_meta: AttachmentMeta | null;
}

// ── Media attachment rules (bucket allows the same list server-side) ──

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB (project upload cap)

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

interface PendingAttachment {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
  width?: number;
  height?: number;
}

interface CurrentUser {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
  family_id: string | null;
}

// ── Style maps (warm-paper light theme) ──

const ROLE_CHIP: Record<string, string> = {
  coach: "bg-chip-amber text-gold-800",
  admin: "bg-chip-amber text-gold-800",
  parent: "bg-chip-sky text-sky-800",
  child: "bg-chip-green text-green-700",
};

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; chip: string; icon: React.ElementType }
> = {
  announcement: { label: "Announcement", chip: "bg-chip-amber text-gold-800", icon: Pin },
  win: { label: "Win", chip: "bg-chip-green text-green-700", icon: Trophy },
  question: { label: "Question", chip: "bg-chip-sky text-sky-800", icon: MessageCircle },
  discussion: { label: "Discussion", chip: "bg-sand text-soft", icon: TrendingUp },
};

const POSTABLE: Category[] = ["discussion", "win", "question"];

function initialsOf(name?: string | null) {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function Avatar({
  name,
  role,
  tier,
  size = "md",
}: {
  name?: string | null;
  role?: string | null;
  tier?: FamilyTier;
  size?: "sm" | "md";
}) {
  const sizes = { sm: "w-8 h-8 text-[11px]", md: "w-10 h-10 text-xs" };
  const bg =
    role === "coach" || role === "admin"
      ? "bg-chip-amber text-gold-800"
      : role === "child"
        ? "bg-chip-green text-green-700"
        : role === "parent"
          ? "bg-chip-sky text-sky-800"
          : "bg-sand text-soft";
  // Premium presence: FTA members get the gold avatar ring.
  return (
    <div
      className={`${sizes[size]} ${bg} ${tierRingClass(tier)} rounded-full flex items-center justify-center font-display font-bold shrink-0`}
    >
      {initialsOf(name)}
    </div>
  );
}

function MessageAttachment({ msg }: { msg: Message }) {
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!msg.attachment_url) return null;

  if (msg.attachment_type === "video") {
    return (
      <video
        src={msg.attachment_url}
        controls
        preload="metadata"
        playsInline
        className="mt-2 max-h-[360px] w-auto max-w-full rounded-xl border border-sand bg-night-950"
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="mt-2 block cursor-zoom-in"
        aria-label="Open image full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={msg.attachment_url}
          alt={msg.attachment_meta?.name || "Shared image"}
          loading="lazy"
          className="max-h-[360px] w-auto max-w-full rounded-xl border border-sand"
        />
      </button>
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close image"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.attachment_url}
              alt={msg.attachment_meta?.name || "Shared image"}
              className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageCard({ msg, tier }: { msg: Message; tier: FamilyTier }) {
  const cat = CATEGORY_CONFIG[msg.category] || CATEGORY_CONFIG.discussion;
  const role = msg.author?.role || "parent";
  return (
    <div className="paper-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={msg.author?.display_name} role={role} tier={tier} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-ink">
              {msg.author?.display_name || "Member"}
            </span>
            <TierBadge tier={tier} size="xs" />
            <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_CHIP[role] || "bg-sand text-soft"}`}>
              {role}
            </span>
            <span className="text-[11px] text-soft font-body">{timeAgo(msg.created_at)}</span>
            <span className={`text-[11px] font-display font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${cat.chip}`}>
              <cat.icon className="w-2.5 h-2.5" />
              {cat.label}
            </span>
          </div>
          {msg.content ? (
            <p className="text-sm text-midnight-200 font-body leading-relaxed mt-2 whitespace-pre-wrap break-words">
              {msg.content}
            </p>
          ) : null}
          <MessageAttachment msg={msg} />
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const supabase = createClient();

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [newPostText, setNewPostText] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("discussion");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState({ families: 0, members: 0, posts: 0 });
  const [showWelcome, setShowWelcome] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Membership tier per family (family_tiers view) — fetched in ONE batched
  // query for the whole feed, never per message.
  const [tiers, setTiers] = useState<Record<string, FamilyTier>>({});
  // Ref mirror so realtime callbacks don't close over stale tier state.
  const tiersRef = useRef(tiers);
  tiersRef.current = tiers;

  const authorCache = useRef<Record<string, Author>>({});

  /** Merge tiers for any families we haven't resolved yet (single query). */
  const loadTiers = useCallback(
    async (familyIds: Array<string | null | undefined>) => {
      const missing = familyIds.filter(
        (id): id is string => !!id && !(id in tiersRef.current)
      );
      if (missing.length === 0) return;
      const fetched = await getFamilyTierMap(supabase, missing);
      setTiers((prev) => ({ ...prev, ...fetched }));
    },
    [supabase]
  );

  const getAuthor = useCallback(
    async (userId: string): Promise<Author> => {
      if (authorCache.current[userId]) return authorCache.current[userId];
      const { data } = await supabase
        .from("profiles")
        .select("display_name, role, age_group, family_id")
        .eq("id", userId)
        .single();
      const author: Author = {
        display_name: data?.display_name ?? "Member",
        role: (data?.role as Role) ?? "parent",
        age_group: data?.age_group ?? null,
        family_id: data?.family_id ?? null,
      };
      authorCache.current[userId] = author;
      await loadTiers([author.family_id]);
      return author;
    },
    [supabase, loadTiers]
  );

  /** Tier for a message author — kids inherit their family's tier. */
  const tierOf = (author: Author | null): FamilyTier =>
    (author?.family_id && tiers[author.family_id]) || "fic";

  // Initial load: user, messages, stats
  useEffect(() => {
    let mounted = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, role, age_group, family_id")
          .eq("id", user.id)
          .single();
        if (profile) {
          const cu: CurrentUser = {
            id: user.id,
            display_name: profile.display_name || "You",
            role: (profile.role as Role) || "parent",
            age_group: profile.age_group,
            family_id: profile.family_id ?? null,
          };
          authorCache.current[user.id] = {
            display_name: cu.display_name,
            role: cu.role,
            age_group: cu.age_group,
            family_id: cu.family_id,
          };
          if (mounted) setMe(cu);

          // First-post welcome: show when this family has no posts yet.
          if (profile.family_id) {
            const { data: fam } = await supabase
              .from("profiles")
              .select("id")
              .eq("family_id", profile.family_id);
            const ids = (fam || []).map((m) => m.id);
            if (ids.length) {
              const { count } = await supabase
                .from("chat_messages")
                .select("id", { count: "exact", head: true })
                .in("user_id", ids);
              if (mounted && (count || 0) === 0) setShowWelcome(true);
            }
          }
        }
      }

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select(
          "id, content, category, created_at, user_id, attachment_url, attachment_type, attachment_meta, author:profiles!chat_messages_user_id_fkey(display_name, role, age_group, family_id)"
        )
        .eq("room_id", COMMUNITY_ROOM_ID)
        .order("created_at", { ascending: false })
        .limit(100);

      if (mounted && msgs) {
        const normalized: Message[] = msgs.map((m) => {
          const raw = m as unknown as {
            id: string;
            content: string | null;
            category: Category | null;
            created_at: string;
            user_id: string;
            attachment_url: string | null;
            attachment_type: "image" | "video" | null;
            attachment_meta: AttachmentMeta | null;
            author: Author | Author[] | null;
          };
          const author = Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author;
          return {
            id: raw.id,
            content: raw.content || "",
            category: raw.category || "discussion",
            created_at: raw.created_at,
            user_id: raw.user_id,
            author,
            attachment_url: raw.attachment_url ?? null,
            attachment_type: raw.attachment_type ?? null,
            attachment_meta: raw.attachment_meta ?? null,
          };
        });
        setMessages(normalized);
        // One batched tier lookup for every family in the feed (+ mine).
        await loadTiers([
          user ? authorCache.current[user.id]?.family_id : null,
          ...normalized.map((m) => m.author?.family_id),
        ]);
      }

      // Real sidebar stats
      const [{ count: families }, { count: members }, { count: posts }] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", COMMUNITY_ROOM_ID),
      ]);
      if (mounted) {
        setStats({ families: families || 0, members: members || 0, posts: posts || 0 });
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: stream new messages live
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      // Authenticate the realtime socket so RLS lets this user receive INSERTs.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try { await supabase.realtime.setAuth(token); } catch { /* noop */ }
      }
      if (cancelled) return;
      channel = supabase
      .channel("community-room")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${COMMUNITY_ROOM_ID}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            content: string | null;
            category: Category | null;
            created_at: string;
            user_id: string;
            attachment_url: string | null;
            attachment_type: "image" | "video" | null;
            attachment_meta: AttachmentMeta | null;
          };
          const author = await getAuthor(row.user_id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              {
                id: row.id,
                content: row.content || "",
                category: row.category || "discussion",
                created_at: row.created_at,
                user_id: row.user_id,
                author,
                attachment_url: row.attachment_url ?? null,
                attachment_type: row.attachment_type ?? null,
                attachment_meta: row.attachment_meta ?? null,
              },
              ...prev,
            ];
          });
          setStats((s) => ({ ...s, posts: s.posts + 1 }));
        }
      )
      .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileSelect(file: File | null) {
    if (!file) return;
    setAttachError(null);

    const isImage = IMAGE_MIMES.includes(file.type);
    const isVideo = VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) {
      setAttachError(
        "That file type isn't supported. Try a photo (JPG, PNG, WebP, GIF) or video (MP4, MOV, WebM)."
      );
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setAttachError("That photo is too big — images can be up to 10 MB.");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setAttachError("That video is too big — videos can be up to 50 MB. Try trimming it down.");
      return;
    }

    // Replace any existing pending attachment
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const kind: "image" | "video" = isImage ? "image" : "video";
    const pending: PendingAttachment = { file, kind, previewUrl };
    setAttachment(pending);

    // Best-effort dimensions for attachment_meta
    if (isImage) {
      const probe = new window.Image();
      probe.onload = () => {
        setAttachment((cur) =>
          cur && cur.previewUrl === previewUrl
            ? { ...cur, width: probe.naturalWidth, height: probe.naturalHeight }
            : cur
        );
      };
      probe.src = previewUrl;
    } else {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        setAttachment((cur) =>
          cur && cur.previewUrl === previewUrl
            ? { ...cur, width: probe.videoWidth, height: probe.videoHeight }
            : cur
        );
      };
      probe.src = previewUrl;
    }
  }

  function removeAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setAttachError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost() {
    const text = newPostText.trim();
    if ((!text && !attachment) || !me || posting) return;
    setPosting(true);
    setAttachError(null);

    // Upload the attachment first (path = {uid}/{uuid}.{ext} per storage RLS)
    let attachmentFields: {
      attachment_url: string;
      attachment_type: "image" | "video";
      attachment_meta: AttachmentMeta;
    } | null = null;

    if (attachment) {
      setUploading(true);
      const ext = EXT_BY_MIME[attachment.file.type] || "bin";
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, attachment.file, {
          contentType: attachment.file.type,
          cacheControl: "3600",
        });
      setUploading(false);
      if (upErr) {
        setAttachError("Upload didn't go through. Check your connection and try again.");
        setPosting(false);
        return;
      }
      const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path);
      attachmentFields = {
        attachment_url: pub.publicUrl,
        attachment_type: attachment.kind,
        attachment_meta: {
          size: attachment.file.size,
          name: attachment.file.name,
          ...(attachment.width ? { width: attachment.width } : {}),
          ...(attachment.height ? { height: attachment.height } : {}),
        },
      };
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: COMMUNITY_ROOM_ID,
        user_id: me.id,
        content: text,
        category: newCategory,
        ...(attachmentFields || {}),
      })
      .select("id, content, category, created_at, user_id, attachment_url, attachment_type, attachment_meta")
      .single();

    if (!error && data) {
      // Optimistic local add (deduped against realtime echo)
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [
          {
            id: data.id,
            content: data.content || "",
            category: (data.category as Category) || "discussion",
            created_at: data.created_at,
            user_id: data.user_id,
            author: {
              display_name: me.display_name,
              role: me.role,
              age_group: me.age_group,
              family_id: me.family_id,
            },
            attachment_url: data.attachment_url ?? null,
            attachment_type: (data.attachment_type as "image" | "video" | null) ?? null,
            attachment_meta: (data.attachment_meta as AttachmentMeta | null) ?? null,
          },
          ...prev,
        ];
      });
      setStats((s) => ({ ...s, posts: s.posts + 1 }));
      setNewPostText("");
      removeAttachment();
      setShowWelcome(false);

      // +5 XP per post, capped at the first few posts per day.
      const todayPosts = await countXpToday(supabase, me.id, "community");
      if (todayPosts < 3) {
        await awardXp(supabase, me.id, "community", XP.COMMUNITY, data.id);
      }
    } else if (error) {
      setAttachError("Your post didn't go through. Please try again.");
    }
    setPosting(false);
  }

  function prefillWelcome() {
    setNewCategory("discussion");
    setNewPostText(
      "Hi everyone! We just joined FTA. Here are the 5 companies our family picked: "
    );
    setShowWelcome(false);
    document
      .querySelector<HTMLTextAreaElement>("textarea")
      ?.focus();
  }

  const filtered = filter === "all" ? messages : messages.filter((m) => m.category === filter);

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "announcement", label: "Announcements" },
    { id: "win", label: "Wins" },
    { id: "question", label: "Questions" },
    { id: "discussion", label: "Discussion" },
  ];

  const catConf = CATEGORY_CONFIG[newCategory];

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Community</h1>
        <p className="text-soft text-sm mt-1 font-body">Learn out loud, grow together</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* First-post welcome */}
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="paper-card p-5 bg-chip-amber/40 border-gold-300"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center shrink-0">
                    <Hand className="w-5 h-5 text-gold-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-ink">
                      New here? Say hello
                    </h3>
                    <p className="text-sm text-soft mt-0.5">
                      Introduce your family and post the 5 companies you picked.
                      It is the best way to meet everyone.
                    </p>
                    <button
                      onClick={prefillWelcome}
                      className="cta-button inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs mt-3"
                    >
                      Start my hello post
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compose */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="paper-card p-4">
            <div className="flex gap-3">
              <Avatar
                name={me?.display_name}
                role={me?.role}
                tier={(me?.family_id && tiers[me.family_id]) || "fic"}
              />
              <div className="flex-1 min-w-0">
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder={
                    me?.role === "child"
                      ? "Share what you learned today..."
                      : "Share a win, ask a question, or start a discussion..."
                  }
                  rows={3}
                  className="w-full bg-paper border border-sand rounded-lg p-3 text-sm text-ink placeholder:text-soft font-body resize-none focus:outline-none focus:border-gold-400"
                />
                {/* Attachment preview chip */}
                <AnimatePresence>
                  {attachment && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-2 inline-flex items-center gap-2.5 bg-paper border border-sand rounded-xl p-2 pr-3 max-w-full"
                    >
                      {attachment.kind === "image" ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={attachment.previewUrl}
                          alt="Attachment preview"
                          className="w-12 h-12 rounded-lg object-cover border border-sand shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-night-950 flex items-center justify-center shrink-0">
                          <Film className="w-5 h-5 text-night-50" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-display font-semibold text-ink truncate max-w-[180px]">
                          {attachment.file.name}
                        </p>
                        <p className="text-[11px] text-soft font-body">
                          {uploading
                            ? "Uploading..."
                            : `${attachment.kind === "image" ? "Photo" : "Video"} · ${(attachment.file.size / (1024 * 1024)).toFixed(1)} MB`}
                        </p>
                      </div>
                      {uploading ? (
                        <Loader2 className="w-4 h-4 text-gold-600 animate-spin shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={removeAttachment}
                          aria-label="Remove attachment"
                          className="w-6 h-6 rounded-full bg-sand hover:bg-midnight-700 flex items-center justify-center text-midnight-300 hover:text-ink transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attachment validation / upload errors */}
                {attachError && (
                  <p className="mt-2 text-xs text-red-600 font-body">{attachError}</p>
                )}

                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")}
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={posting}
                      aria-label="Attach a photo or video"
                      title="Attach a photo or video"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-gold-700 hover:border-gold-300 transition-colors disabled:opacity-40"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowCatPicker((v) => !v)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold ${catConf.chip}`}
                    >
                      <catConf.icon className="w-3 h-3" />
                      {catConf.label}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {showCatPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full left-0 mt-1 bg-white border border-sand rounded-lg overflow-hidden z-10 shadow-lg"
                        >
                          {POSTABLE.map((cat) => {
                            const c = CATEGORY_CONFIG[cat];
                            return (
                              <button
                                key={cat}
                                onClick={() => {
                                  setNewCategory(cat);
                                  setShowCatPicker(false);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-body text-midnight-200 hover:bg-paper transition-colors"
                              >
                                <c.icon className="w-3 h-3" />
                                {c.label}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={(!newPostText.trim() && !attachment) || posting || !me}
                    className="cta-button flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {uploading ? "Uploading..." : posting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-body whitespace-nowrap transition-colors border ${
                  filter === f.id
                    ? "bg-chip-amber text-gold-800 border-gold-300"
                    : "text-soft border-sand hover:border-gold-300 hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Messages */}
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
          ) : filtered.length === 0 ? (
            <div className="paper-card p-10 text-center">
              <Sparkles className="w-7 h-7 text-gold-500 mx-auto mb-3" />
              <p className="font-display text-base font-semibold text-ink mb-1">
                {messages.length === 0 ? "Be the first to post" : "Nothing here yet"}
              </p>
              <p className="text-sm text-soft font-body max-w-sm mx-auto">
                {messages.length === 0
                  ? "Share a win, ask a question, or say hi to the FTA community."
                  : "No posts in this category yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                >
                  <MessageCard msg={msg} tier={tierOf(msg.author)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="lg:w-[280px] shrink-0 space-y-4"
        >
          <div className="paper-card p-4">
            <h3 className="font-display text-xs font-semibold text-soft uppercase tracking-wider mb-3">
              Community
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Home} value={stats.families} label="Families" />
              <Stat icon={Users} value={stats.members} label="Members" />
              <Stat icon={MessageCircle} value={stats.posts} label="Posts" />
            </div>
          </div>

          <Link
            href="/leaderboard"
            className="paper-card p-4 flex items-center gap-3 group hover:border-gold-300 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-chip-amber text-gold-800 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-semibold text-ink">
                Family XP leaderboard
              </p>
              <p className="text-[11px] text-soft">See how your family ranks</p>
            </div>
            <ArrowRight className="w-4 h-4 text-midnight-600 group-hover:text-gold-700" />
          </Link>

          <div className="paper-card p-4">
            <h3 className="font-display text-xs font-semibold text-soft uppercase tracking-wider mb-3">
              House rules
            </h3>
            <ul className="space-y-2 text-sm text-midnight-200 font-body">
              <li className="flex gap-2"><span className="text-gold-600">•</span> No dumb questions — we all started somewhere.</li>
              <li className="flex gap-2"><span className="text-gold-600">•</span> Celebrate each other&apos;s wins.</li>
              <li className="flex gap-2"><span className="text-gold-600">•</span> Keep it kind — kids are here too.</li>
            </ul>
          </div>
        </motion.aside>
      </div>
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
