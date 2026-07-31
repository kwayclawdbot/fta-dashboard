"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// The LazyMotion barrel, not framer-motion directly (cbd20ad): `m` keeps the
// heavy feature set in the one lazily-loaded chunk the root MotionProvider owns.
import { AnimatePresence, m } from "@/lib/motion";
import {
  ArrowRight,
  AtSign,
  ChevronDown,
  Film,
  Hand,
  Hash,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Paperclip,
  Pin,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { evaluateBadges } from "@/lib/badges";
import { MentionProvider, RichBody } from "@/lib/mentions";
import {
  useChatRoom,
  type ChatAuthor,
  type ChatCategory,
  type ChatMe,
  type ChatMsg,
} from "@/lib/useChatRoom";
import {
  CHAT_IMAGE_MIMES,
  CHAT_VIDEO_MIMES,
  CHAT_MAX_IMAGE_BYTES,
  CHAT_MAX_VIDEO_BYTES,
} from "@/lib/useChatRoom";
import { PROFANITY_MESSAGE } from "@/lib/profanity";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import TierBadge from "@/components/TierBadge";
import { FIC_ROOM_ID, FREE_LOUNGE_ROOM_ID, lockedRoomsFor, openRoomsFor } from "./rooms";

/**
 * COMMUNITY — the chat area, restored.
 *
 * This is the surface that lived at /community until 64de416 ("Clubhouse P1:
 * feed-first community") replaced it with a social feed, and that the Club
 * boards (4918d0b) then buried under Feed / Discussions / Changed My Mind. It is
 * restored from `64de416^` (the file as 1abc3e4 left it): a room rail, a compose
 * card that says what KIND of thing you are posting, a category filter row, and
 * the room itself as dated message cards — real people, in a room, in order.
 *
 * WHAT IS VERBATIM: the layout, the copy, the category system (Announcement /
 * Win / Question / Discussion), the filter row, the first-post welcome card, the
 * sidebar (room counts, leaderboard link, house rules), the composer's @mention
 * autocomplete and its attachment rules, and the message card down to its chips.
 *
 * FOUR DEPARTURES, each forced by the shell this now renders inside:
 *
 *  • `.paper-card` -> `.club-b-card` (x8). The class was DELETED from globals.css
 *    once its last call site went; the note left in its place names club-b-card
 *    as the replacement. Same precedent as the /courses restore (d0cf623).
 *  • the ROOM LIST is today's, not the restored file's. The original hard-coded
 *    two rooms (FIC Club, FTA Traders) because that is all there were. Since
 *    then FTA Traders moved to its own page (62704be), the Free Lounge shipped
 *    for free-tier members (5dd79c6), and three topic rooms opened (190). Rooms
 *    now come from rooms.ts via openRoomsFor()/lockedRoomsFor(), so the rail
 *    shows exactly the rooms a member may open at their tier — which is STRICTER
 *    than the restored file, whose hard-coded rail would have handed a free
 *    member the members-only room.
 *  • the DATA LAYER is `useChatRoom`, not the restored file's inlined copy of it.
 *    That hook IS this page's engine, extracted out of it by 4424c7a and
 *    maintained since: same channel name, same query, same XP cap, plus the belt
 *    rings, @mention linking and profanity check the surface has today. Bringing
 *    back the 1abc3e4 inline engine would have forked the chat into two
 *    implementations and silently dropped all three.
 *  • the inverted MIDNIGHT ramp. The redesign flipped midnight-* in place
 *    (midnight-950 is now #FBF7EF), so body copy moves midnight-200 -> ink and
 *    the attachment remove-button moves off midnight-700/300 onto sand/soft. The
 *    night-* tokens are NOT touched: they are the constant true-dark ramp and
 *    are still correct behind the video placeholder.
 *
 * GATING IS TODAY'S. Kids keep the composer: `kid_feed_readonly()` gates
 * feed_posts, never chat_messages — a minor's chat writes are gated by their
 * parent's guardrails (family_writes_allowed / family_chat_scope_ok, both
 * RESTRICTIVE on INSERT), which is the same posture as the Lounge this replaces.
 * Room access stays app-layer per the 016/018/019 scars: the SELECT policy is a
 * flat room-id comparison, so which rooms this rail opens IS the gate.
 */

type FilterType = "all" | ChatCategory;
type Role = "parent" | "child" | "coach" | "admin";

const ROLE_CHIP: Record<string, string> = {
  coach: "bg-chip-amber text-gold-800",
  admin: "bg-chip-amber text-gold-800",
  parent: "bg-chip-sky text-sky-800",
  child: "bg-chip-green text-green-700",
};

const CATEGORY_CONFIG: Record<
  ChatCategory,
  { label: string; chip: string; icon: React.ElementType }
> = {
  announcement: { label: "Announcement", chip: "bg-chip-amber text-gold-800", icon: Pin },
  win: { label: "Win", chip: "bg-chip-green text-green-700", icon: Trophy },
  question: { label: "Question", chip: "bg-chip-sky text-sky-800", icon: MessageCircle },
  discussion: { label: "Discussion", chip: "bg-sand text-soft", icon: TrendingUp },
};

/** What a member may file a post as. "Announcement" is not self-service. */
const POSTABLE: ChatCategory[] = ["discussion", "win", "question"];

const EXT_OK = [...CHAT_IMAGE_MIMES, ...CHAT_VIDEO_MIMES].join(",");

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── the message ──────────────────────────────────────────────────────────── */

function MessageAttachment({ msg }: { msg: ChatMsg }) {
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
          alt="Shared image"
          loading="lazy"
          className="max-h-[360px] w-auto max-w-full rounded-xl border border-sand"
        />
      </button>
      <AnimatePresence>
        {lightbox && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close image"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.attachment_url}
              alt="Shared image"
              className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageCard({ msg, tier, xp }: { msg: ChatMsg; tier: FamilyTier; xp: number }) {
  const cat = CATEGORY_CONFIG[msg.category] || CATEGORY_CONFIG.discussion;
  const role = msg.author?.role || "parent";
  const username = msg.author?.username ?? null;
  return (
    <div className="club-b-card p-4">
      <div className="flex items-start gap-3">
        <ProfileLink username={username} variant="avatar">
          <Avatar
            name={msg.author?.display_name}
            avatarUrl={msg.author?.avatar_url}
            role={role}
            tier={tier}
            xp={xp}
            size="lg"
          />
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProfileLink username={username}>
              <span className="font-display text-sm font-semibold text-ink">
                {msg.author?.display_name || "Member"}
              </span>
            </ProfileLink>
            <TierBadge tier={tier} size="xs" />
            <span
              className={`rounded px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${
                ROLE_CHIP[role] || "bg-sand text-soft"
              }`}
            >
              {role}
            </span>
            <span className="font-body text-[11px] text-soft">{timeAgo(msg.created_at)}</span>
            <span
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-display text-[11px] font-semibold ${cat.chip}`}
            >
              <cat.icon className="h-2.5 w-2.5" />
              {cat.label}
            </span>
          </div>
          {msg.content ? (
            <RichBody
              body={msg.content}
              className="mt-2 whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-ink"
            />
          ) : null}
          <MessageAttachment msg={msg} />
        </div>
      </div>
    </div>
  );
}

/* ── the board ────────────────────────────────────────────────────────────── */

interface PendingAttachment {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
}

export default function CommunityChat() {
  const supabase = createClient();

  const [me, setMe] = useState<ChatMe | null>(null);
  const [myTier, setMyTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string>(FIC_ROOM_ID);
  const [filter, setFilter] = useState<FilterType>("all");
  const [newPostText, setNewPostText] = useState("");
  const [newCategory, setNewCategory] = useState<ChatCategory>("discussion");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [stats, setStats] = useState({ families: 0, members: 0 });
  const [showWelcome, setShowWelcome] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rooms = useMemo(() => openRoomsFor(myTier), [myTier]);
  const locked = useMemo(() => lockedRoomsFor(myTier), [myTier]);
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0] ?? null;
  const roomId = activeRoom?.id ?? "";

  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } = useChatRoom(
    roomId,
    me
  );

  // ── @mention autocomplete ─────────────────────────────────────────────
  // Insert format MUST match the notification trigger rule (migration 028):
  // "@" + display name with all spaces stripped (e.g. "Kway Jr" → "@KwayJr"),
  // matched case-insensitively in Postgres to fan out mention notifications.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(
    null
  );
  const [mentionIdx, setMentionIdx] = useState(0);
  const [roster, setRoster] = useState<
    { id: string; name: string; stripped: string; avatar_url: string | null }[]
  >([]);
  const rosterLoaded = useRef(false);

  // Initial load: current user, tier (→ rooms), sidebar counts, welcome.
  useEffect(() => {
    let mounted = true;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, role, age_group, family_id, avatar_url, username")
          .eq("id", user.id)
          .single();
        if (profile && mounted) {
          setMe({
            id: user.id,
            display_name: profile.display_name || "You",
            role: (profile.role as Role) || "parent",
            age_group: profile.age_group ?? null,
            family_id: profile.family_id ?? null,
            avatar_url: profile.avatar_url ?? null,
            username: profile.username ?? null,
          });
        }

        // Family tier decides which rooms are available. Free members open on
        // the Free Lounge — the members-only rail is not theirs to stand in.
        const tier = await getFamilyTier(supabase, profile?.family_id ?? null);
        if (mounted) {
          setMyTier(tier);
          setTierResolved(true);
          if (tier === "free") setActiveRoomId(FREE_LOUNGE_ROOM_ID);
        }

        // Data-driven professional-title badges — cheap + idempotent.
        evaluateBadges(supabase, user.id);

        // First-post welcome: show when this family has said nothing yet.
        if (profile?.family_id) {
          const { data: fam } = await supabase
            .from("profiles")
            .select("id")
            .eq("family_id", profile.family_id);
          const ids = (fam || []).map((f) => f.id);
          if (ids.length) {
            const { count } = await supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .in("user_id", ids);
            if (mounted && (count || 0) === 0) setShowWelcome(true);
          }
        }
      } else if (mounted) {
        setTierResolved(true);
      }

      // Real sidebar stats (families/members are global).
      const [{ count: families }, { count: members }] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      if (mounted) setStats({ families: families || 0, members: members || 0 });
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileSelect(file: File | null) {
    if (!file) return;
    setAttachError(null);

    const isImage = CHAT_IMAGE_MIMES.includes(file.type);
    const isVideo = CHAT_VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) {
      setAttachError(
        "That file type isn't supported. Try a photo (JPG, PNG, WebP, GIF) or video (MP4, MOV, WebM)."
      );
      return;
    }
    if (isImage && file.size > CHAT_MAX_IMAGE_BYTES) {
      setAttachError("That photo is too big — images can be up to 10 MB.");
      return;
    }
    if (isVideo && file.size > CHAT_MAX_VIDEO_BYTES) {
      setAttachError("That video is too big — videos can be up to 50 MB. Try trimming it down.");
      return;
    }

    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({
      file,
      kind: isImage ? "image" : "video",
      previewUrl: URL.createObjectURL(file),
    });
  }

  function removeAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setAttachError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Lazy-load the member roster the first time "@" is typed (profiles are
  // readable by all authenticated members per migration 016).
  const loadRoster = useCallback(async () => {
    if (rosterLoaded.current) return;
    rosterLoaded.current = true;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .limit(300);
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
      .filter(
        (p) => p.stripped.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q)
      )
      .slice(0, 6);
  }, [mention, roster, me?.id]);

  function detectMention(value: string, caret: number) {
    // Token chars mirror the trigger's parser: letters, digits, _ . ' -
    const found = value.slice(0, caret).match(/(^|\s)@([A-Za-z0-9_.'-]*)$/);
    if (found) {
      loadRoster();
      setMention({ start: caret - found[2].length - 1, end: caret, query: found[2] });
      setMentionIdx(0);
    } else {
      setMention(null);
    }
  }

  function insertMention(candidate: { stripped: string }) {
    if (!mention) return;
    const before = newPostText.slice(0, mention.start);
    const after = newPostText.slice(mention.end);
    const inserted = `@${candidate.stripped} `;
    setNewPostText(before + inserted + after);
    setMention(null);
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || mentionCandidates.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIdx((i) => (i + 1) % mentionCandidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(mentionCandidates[mentionIdx]);
    } else if (e.key === "Escape") {
      setMention(null);
    }
  }

  async function handlePost() {
    const text = newPostText.trim();
    if ((!text && !attachment) || !me || posting) return;
    setAttachError(null);
    const res = await send(text, attachment?.file ?? null, newCategory);
    if (res.ok) {
      setNewPostText("");
      removeAttachment();
      setShowWelcome(false);
    } else if (res.error === "profanity") {
      setAttachError(PROFANITY_MESSAGE);
    } else if (res.error === "upload") {
      setAttachError("Upload didn't go through. Check your connection and try again.");
    } else if (res.error === "send") {
      setAttachError("Your post didn't go through. Please try again.");
    }
  }

  function prefillWelcome() {
    setNewCategory("discussion");
    setNewPostText(
      "Hi everyone! We just joined the club. Here are the companies our family picked: "
    );
    setShowWelcome(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
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
  const myTierForAvatar: FamilyTier =
    (me?.family_id && tierOf({ family_id: me.family_id } as ChatAuthor)) || myTier;

  return (
    <MentionProvider map={mentions}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink">Community</h1>
          <p className="mt-1 font-body text-sm text-soft">Learn out loud, grow together</p>
        </div>

        {/* Room rail — the rooms this member may open, then the ones they cannot.
            LOADING IS NOT EMPTY: the rail waits for the tier so a free member is
            never shown the members-only rail for a frame. */}
        {tierResolved && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {rooms.map((r) => {
              const active = r.id === roomId;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoomId(r.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 transition-colors ${
                    active
                      ? "border-gold-300 bg-chip-amber text-gold-800"
                      : "border-sand bg-card text-soft hover:border-gold-300 hover:text-ink"
                  }`}
                >
                  <Hash className={`h-3.5 w-3.5 ${active ? "text-gold-700" : "text-soft"}`} />
                  <span className="font-display text-sm font-semibold">{r.name}</span>
                </button>
              );
            })}
            {locked.map((r) => (
              <Link
                key={r.id}
                href="/upgrade"
                className="flex items-center gap-2 rounded-lg border border-sand bg-card px-3.5 py-2 text-soft transition-colors hover:border-gold-300 hover:text-ink"
                title={`${r.name} is for members`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="font-display text-sm font-semibold">{r.name}</span>
                <TierBadge tier="fic" size="xs" />
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── the room ─────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-4">
            <AnimatePresence>
              {showWelcome && (
                <m.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="club-b-card border-gold-300 bg-chip-amber/40 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/20">
                      <Hand className="h-5 w-5 text-gold-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-bold text-ink">New here? Say hello</h3>
                      <p className="mt-0.5 text-sm text-soft">
                        Introduce your family and post the companies you picked. It is the best
                        way to meet everyone.
                      </p>
                      <button
                        onClick={prefillWelcome}
                        className="cta-button mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
                      >
                        Start my hello post
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {/* Compose */}
            <div className="club-b-card p-4">
              <div className="flex gap-3">
                <Avatar
                  name={me?.display_name}
                  avatarUrl={me?.avatar_url}
                  role={me?.role}
                  tier={myTierForAvatar}
                  xp={xpOf(me?.id)}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={newPostText}
                      onChange={(e) => {
                        setNewPostText(e.target.value);
                        detectMention(
                          e.target.value,
                          e.target.selectionStart ?? e.target.value.length
                        );
                      }}
                      onKeyDown={handleComposerKeyDown}
                      onBlur={() => setTimeout(() => setMention(null), 150)}
                      placeholder={
                        me?.role === "child"
                          ? "Share what you learned today..."
                          : `Post to ${activeRoom?.name ?? "the room"} — share a win, ask a question, start a discussion...`
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-sand bg-paper p-3 font-body text-sm text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
                    />
                    {mention && mentionCandidates.length > 0 && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-sand bg-card shadow-lg">
                        <p className="flex items-center gap-1 px-3 pb-1 pt-2 font-display text-[10px] font-semibold uppercase tracking-wider text-soft">
                          <AtSign className="h-3 w-3" />
                          Mention someone
                        </p>
                        {mentionCandidates.map((c, i) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertMention(c);
                            }}
                            onMouseEnter={() => setMentionIdx(i)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                              i === mentionIdx ? "bg-paper" : "bg-card"
                            }`}
                          >
                            <Avatar name={c.name} avatarUrl={c.avatar_url} size="xs" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-ink">
                                {c.name}
                              </span>
                              <span className="block truncate text-[10px] text-soft">
                                @{c.stripped}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {attachment && (
                      <m.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-2 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-sand bg-paper p-2 pr-3"
                      >
                        {attachment.kind === "image" ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={attachment.previewUrl}
                            alt="Attachment preview"
                            className="h-12 w-12 shrink-0 rounded-lg border border-sand object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-night-950">
                            <Film className="h-5 w-5 text-night-50" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate font-display text-xs font-semibold text-ink">
                            {attachment.file.name}
                          </p>
                          <p className="font-body text-[11px] text-soft">
                            {uploading
                              ? "Uploading..."
                              : `${attachment.kind === "image" ? "Photo" : "Video"} · ${(
                                  attachment.file.size /
                                  (1024 * 1024)
                                ).toFixed(1)} MB`}
                          </p>
                        </div>
                        {uploading ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold-600" />
                        ) : (
                          <button
                            type="button"
                            onClick={removeAttachment}
                            aria-label="Remove attachment"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand text-soft transition-colors hover:text-ink"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </m.div>
                    )}
                  </AnimatePresence>

                  {attachError && (
                    <p className="mt-2 font-body text-xs text-red-600">{attachError}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="relative flex items-center gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={EXT_OK}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={posting}
                        aria-label="Attach a photo or video"
                        title="Attach a photo or video"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-sand text-soft transition-colors hover:border-gold-300 hover:text-gold-700 disabled:opacity-40"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowCatPicker((v) => !v)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-display text-[11px] font-semibold ${catConf.chip}`}
                      >
                        <catConf.icon className="h-3 w-3" />
                        {catConf.label}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <AnimatePresence>
                        {showCatPicker && (
                          <m.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-sand bg-card shadow-lg"
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
                                  className="flex w-full items-center gap-2 px-3 py-2 font-body text-xs text-ink transition-colors hover:bg-paper"
                                >
                                  <c.icon className="h-3 w-3" />
                                  {c.label}
                                </button>
                              );
                            })}
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      onClick={handlePost}
                      disabled={(!newPostText.trim() && !attachment) || posting || !me}
                      className="cta-button flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {uploading ? "Uploading..." : posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`whitespace-nowrap rounded-lg border px-3 py-1.5 font-body text-xs transition-colors ${
                    filter === f.id
                      ? "border-gold-300 bg-chip-amber text-gold-800"
                      : "border-sand text-soft hover:border-gold-300 hover:text-ink"
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
                  <div key={i} className="club-b-card animate-pulse p-4">
                    <div className="mb-3 h-4 w-40 rounded bg-sand/70" />
                    <div className="mb-1.5 h-3 w-full rounded bg-sand/50" />
                    <div className="h-3 w-2/3 rounded bg-sand/50" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="club-b-card p-10 text-center">
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-gold-500" />
                <p className="mb-1 font-display text-base font-semibold text-ink">
                  {messages.length === 0 ? "Be the first to post" : "Nothing here yet"}
                </p>
                <p className="mx-auto max-w-sm font-body text-sm text-soft">
                  {messages.length === 0
                    ? `Share a win, ask a question, or say hi in ${activeRoom?.name ?? "the room"}.`
                    : "No posts in this category yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((msg) => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    tier={tierOf(msg.author)}
                    xp={xpOf(msg.user_id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── sidebar ──────────────────────────────────────────────────── */}
          <aside className="shrink-0 space-y-4 lg:w-[280px]">
            <div className="club-b-card p-4">
              <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-soft">
                {activeRoom?.name ?? "The room"}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat icon={Home} value={stats.families} label="Families" />
                <Stat icon={Users} value={stats.members} label="Members" />
                <Stat icon={MessageCircle} value={messages.length} label="Posts" />
              </div>
            </div>

            <Link
              href="/leaderboard"
              className="club-b-card group flex items-center gap-3 p-4 transition-colors hover:border-gold-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chip-amber text-gold-800">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-ink">Family XP leaderboard</p>
                <p className="text-[11px] text-soft">See how your family ranks</p>
              </div>
              <ArrowRight className="h-4 w-4 text-soft group-hover:text-gold-700" />
            </Link>

            <div className="club-b-card p-4">
              <h3 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-soft">
                House rules
              </h3>
              <ul className="space-y-2 font-body text-sm text-ink">
                <li className="flex gap-2">
                  <span className="text-gold-600">•</span> No dumb questions — we all started
                  somewhere.
                </li>
                <li className="flex gap-2">
                  <span className="text-gold-600">•</span> Celebrate each other&apos;s wins.
                </li>
                <li className="flex gap-2">
                  <span className="text-gold-600">•</span> Keep it kind — kids are here too.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </MentionProvider>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-gold-700">
        <Icon className="h-3.5 w-3.5" />
        <p className="font-display text-lg font-bold text-ink">{value}</p>
      </div>
      <p className="mt-0.5 font-body text-[11px] text-soft">{label}</p>
    </div>
  );
}
