"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import Link from "next/link";
import { AtSign, Hash, Lock, Paperclip, Radio, Send, X, Film, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierMap, type FamilyTier } from "@/lib/tier";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { checkClean, PROFANITY_MESSAGE } from "@/lib/profanity";
import { timeAgo, type Role } from "@/lib/feed";
import { MentionProvider, RichBody, extractHandles, type MentionMap } from "@/lib/mentions";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import TierBadge from "@/components/TierBadge";
import AgeBadge from "@/components/community/AgeBadge";

/**
 * Club Chat — the ALWAYS-ON realtime chat, now presented as a collapsible drawer
 * (ClubChatDrawer) shared across /community and /chart. This REUSES the existing
 * chat_messages realtime plumbing untouched (migrations 016/018/019/027):
 * `community-room-${roomId}` channel, postgres_changes INSERTs, the simple
 * realtime-safe SELECT policy. FIC Club is always available; FTA Traders too for
 * FTA-tier families. Nothing about the chat data model changed.
 */

const FIC_ROOM_ID = "c0000000-0000-4000-a000-000000000001";
const FTA_ROOM_ID = "c0000000-0000-4000-a000-000000000002";
const FREE_LOUNGE_ROOM_ID = "c0000000-0000-4000-a000-000000000003";

interface Room {
  id: string;
  name: string;
}
const FIC_ROOM: Room = { id: FIC_ROOM_ID, name: "FIC Club" };
const FTA_ROOM: Room = { id: FTA_ROOM_ID, name: "FTA Traders" };
const FREE_LOUNGE: Room = { id: FREE_LOUNGE_ROOM_ID, name: "Free Lounge" };

/**
 * Rooms a tier may OPEN + post in (app-layer gating, per migrations 016/033/086).
 * Single source of truth for the room list — a later lane moves FTA Traders to a
 * dedicated FTA chat page, which is a one-line removal here (drop FTA_ROOM from
 * the `fta` array).
 */
function openRoomsFor(tier: FamilyTier): Room[] {
  if (tier === "free") return [FREE_LOUNGE];
  if (tier === "fta") return [FIC_ROOM, FTA_ROOM, FREE_LOUNGE];
  return [FIC_ROOM, FREE_LOUNGE]; // fic — members also see the Free Lounge to welcome newcomers
}
/** Rooms shown but locked for this tier (a tasteful upsell chip). */
function lockedRoomsFor(tier: FamilyTier): Room[] {
  return tier === "free" ? [FIC_ROOM] : [];
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

interface Author {
  display_name: string | null;
  role: Role | null;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
  username: string | null;
}
interface Msg {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: Author | null;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
}
export interface Me {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
  username?: string | null;
}
export type LiveRoomsMe = Me;
interface PendingAttachment {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
}

export default function LiveRooms({ me, tier }: { me: Me | null; tier: FamilyTier }) {
  const supabase = createClient();
  const rooms = useMemo(() => openRoomsFor(tier), [tier]);
  const lockedRooms = useMemo(() => lockedRoomsFor(tier), [tier]);
  const [activeRoomId, setActiveRoomId] = useState(
    tier === "free" ? FREE_LOUNGE_ROOM_ID : FIC_ROOM_ID
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tiers, setTiers] = useState<Record<string, FamilyTier>>({});
  const tiersRef = useRef(tiers);
  tiersRef.current = tiers;
  const authorCache = useRef<Record<string, Author>>({});

  // @mention → username map (batched), so @handles in messages link to profiles.
  const [mentions, setMentions] = useState<MentionMap>({});
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

  const loadTiers = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const missing = ids.filter((id): id is string => !!id && !(id in tiersRef.current));
      if (!missing.length) return;
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
        .select("display_name, role, age_group, family_id, avatar_url, username")
        .eq("id", userId)
        .single();
      const a: Author = {
        display_name: data?.display_name ?? "Member",
        role: (data?.role as Role) ?? "parent",
        age_group: data?.age_group ?? null,
        family_id: data?.family_id ?? null,
        avatar_url: data?.avatar_url ?? null,
        username: data?.username ?? null,
      };
      authorCache.current[userId] = a;
      await loadTiers([a.family_id]);
      return a;
    },
    [supabase, loadTiers]
  );

  // ── @mention autocomplete (same stripped-name rule as migration 028) ──
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
      .slice(0, 5);
    // Admins only: @everyone pings every member in the room (migration 091).
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

  // Load messages when the room changes.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setMessages([]);
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select(
          "id, content, created_at, user_id, attachment_url, attachment_type, author:profiles!chat_messages_user_id_fkey(display_name, role, age_group, family_id, avatar_url, username)"
        )
        .eq("room_id", activeRoomId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!mounted) return;
      const norm: Msg[] = (data ?? []).map((m) => {
        const raw = m as unknown as Msg & { author: Author | Author[] | null };
        const author = Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author;
        return {
          id: raw.id,
          content: raw.content || "",
          created_at: raw.created_at,
          user_id: raw.user_id,
          author,
          attachment_url: raw.attachment_url ?? null,
          attachment_type: raw.attachment_type ?? null,
        };
      });
      setMessages(norm);
      await loadTiers([me?.family_id, ...norm.map((m) => m.author?.family_id)]);
      resolveMentions(norm.map((m) => m.content));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, me?.id]);

  // Realtime INSERT stream for the active room (reused verbatim).
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try { await supabase.realtime.setAuth(token); } catch { /* noop */ }
      }
      if (cancelled) return;
      channel = supabase
        .channel(`community-room-${activeRoomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${activeRoomId}` },
          async (payload) => {
            const row = payload.new as {
              id: string; content: string | null; created_at: string; user_id: string;
              attachment_url: string | null; attachment_type: "image" | "video" | null;
            };
            const author = await getAuthor(row.user_id);
            resolveMentions([row.content]);
            setMessages((prev) =>
              prev.some((m) => m.id === row.id)
                ? prev
                : [
                    {
                      id: row.id, content: row.content || "", created_at: row.created_at,
                      user_id: row.user_id, author,
                      attachment_url: row.attachment_url ?? null, attachment_type: row.attachment_type ?? null,
                    },
                    ...prev,
                  ]
            );
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const isImage = IMAGE_MIMES.includes(file.type);
    const isVideo = VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) return setError("Try a photo or video (JPG, PNG, MP4, MOV…).");
    if (isImage && file.size > MAX_IMAGE_BYTES) return setError("Photos can be up to 10 MB.");
    if (isVideo && file.size > MAX_VIDEO_BYTES) return setError("Videos can be up to 50 MB.");
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({ file, kind: isImage ? "image" : "video", previewUrl: URL.createObjectURL(file) });
  }
  function clearAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    const body = text.trim();
    if ((!body && !attachment) || !me || posting) return;
    const clean = checkClean(body);
    if (!clean.ok) return setError(PROFANITY_MESSAGE);
    setPosting(true);
    setError(null);

    let attachmentFields: { attachment_url: string; attachment_type: "image" | "video"; attachment_meta: Record<string, unknown> } | null = null;
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
        return setError("Upload didn't go through. Try again.");
      }
      const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path);
      attachmentFields = {
        attachment_url: pub.publicUrl,
        attachment_type: attachment.kind,
        attachment_meta: { size: attachment.file.size, name: attachment.file.name },
      };
    }

    const { data, error: insErr } = await supabase
      .from("chat_messages")
      .insert({ room_id: activeRoomId, user_id: me.id, content: body, category: "discussion", ...(attachmentFields || {}) })
      .select("id, content, created_at, user_id, attachment_url, attachment_type")
      .single();

    if (!insErr && data) {
      setMessages((prev) =>
        prev.some((m) => m.id === data.id)
          ? prev
          : [
              {
                id: data.id, content: data.content || "", created_at: data.created_at, user_id: data.user_id,
                author: { display_name: me.display_name, role: me.role, age_group: me.age_group, family_id: me.family_id, avatar_url: me.avatar_url, username: me.username ?? null },
                attachment_url: data.attachment_url ?? null, attachment_type: (data.attachment_type as "image" | "video" | null) ?? null,
              },
              ...prev,
            ]
      );
      setText("");
      clearAttachment();
      const todayPosts = await countXpToday(supabase, me.id, "community");
      if (todayPosts < 3) await awardXp(supabase, me.id, "community", XP.COMMUNITY, data.id);
    } else {
      setError("Message didn't send. Try again.");
    }
    setPosting(false);
  }

  const tierOf = (a: Author | null): FamilyTier => (a?.family_id && tiers[a.family_id]) || "fic";

  return (
    <MentionProvider map={mentions}>
    <div className="paper-card overflow-hidden flex flex-col max-h-[560px]">
      {/* Header + room tabs */}
      <div className="px-4 py-3 border-b border-sand">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500/60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <h3 className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-gold-600" /> Club Chat
          </h3>
        </div>
        <p className="text-[11px] text-soft mt-0.5">
          {tier === "free"
            ? "Say hi in the Free Lounge — the whole club can see it."
            : "Always-on chat — hop in during class or anytime."}
        </p>
        {rooms.length + lockedRooms.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {rooms.map((r) => {
              const active = r.id === activeRoomId;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoomId(r.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-display font-semibold border transition-colors ${
                    active ? "bg-chip-amber border-gold-300 text-gold-800" : "bg-white border-sand text-soft hover:text-ink"
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {r.name}
                  {r.id === FTA_ROOM_ID && <TierBadge tier="fta" size="xs" />}
                </button>
              );
            })}
            {lockedRooms.map((r) => (
              <Link
                key={r.id}
                href="/upgrade"
                title="Members chat — join FIC"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-display font-semibold border border-sand bg-paper text-soft/80 hover:text-gold-700 hover:border-gold-300 transition-colors"
              >
                <Lock className="w-3 h-3" />
                {r.name}
              </Link>
            ))}
          </div>
        )}
        {tier === "free" && (
          <p className="text-[11px] text-soft/80 mt-1.5">
            <Lock className="inline w-3 h-3 -mt-0.5 mr-0.5" />
            FIC Club is the members&apos; room —{" "}
            <Link href="/upgrade" className="text-gold-700 font-semibold">
              join FIC
            </Link>{" "}
            to chat there.
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[180px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-soft py-8">No messages yet — say hi 👋</p>
        ) : (
          [...messages].reverse().map((m) => (
            <div key={m.id} className="flex items-start gap-2">
              <ProfileLink username={m.author?.username} variant="avatar">
                <Avatar name={m.author?.display_name} avatarUrl={m.author?.avatar_url} role={m.author?.role} tier={tierOf(m.author)} size="sm" />
              </ProfileLink>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ProfileLink username={m.author?.username} className="font-display text-xs font-semibold text-ink">
                    {m.author?.display_name || "Member"}
                  </ProfileLink>
                  <AgeBadge role={m.author?.role} ageGroup={m.author?.age_group} />
                  {tierOf(m.author) === "free" && <TierBadge tier="free" size="xs" />}
                  <span className="text-[10px] text-soft">{timeAgo(m.created_at)}</span>
                </div>
                {m.content && <p className="text-xs text-midnight-200 whitespace-pre-wrap break-words mt-0.5"><RichBody body={m.content} /></p>}
                {m.attachment_url && m.attachment_type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.attachment_url} alt="shared" loading="lazy" className="mt-1 max-h-40 w-auto rounded-lg border border-sand" />
                )}
                {m.attachment_url && m.attachment_type === "video" && (
                  <video src={m.attachment_url} controls playsInline className="mt-1 max-h-40 w-auto rounded-lg border border-sand bg-night-950" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-sand p-2.5">
        {error && <p className="text-[11px] text-red-600 mb-1.5">{error}</p>}
        {attachment && (
          <div className="mb-1.5 inline-flex items-center gap-2 bg-paper border border-sand rounded-lg p-1.5 pr-2">
            {attachment.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.previewUrl} alt="preview" className="w-8 h-8 rounded object-cover" />
            ) : (
              <div className="w-8 h-8 rounded bg-night-950 flex items-center justify-center"><Film className="w-4 h-4 text-night-50" /></div>
            )}
            <span className="text-[11px] text-soft max-w-[120px] truncate">{uploading ? "Uploading…" : attachment.file.name}</span>
            <button onClick={clearAttachment} aria-label="Remove"><X className="w-3.5 h-3.5 text-soft" /></button>
          </div>
        )}
        <div className="relative flex items-end gap-1.5">
          <input ref={fileRef} type="file" accept={[...IMAGE_MIMES, ...VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach" className="w-8 h-8 shrink-0 rounded-lg border border-sand text-soft hover:text-gold-700 flex items-center justify-center disabled:opacity-40">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (mention && mentionCandidates.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionCandidates.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionIdx]); return; }
                if (e.key === "Escape") { setMention(null); return; }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            rows={1}
            placeholder={me?.role === "child" ? "Say something…" : "Message the room…"}
            className="flex-1 resize-none bg-paper border border-sand rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 max-h-24"
          />
          <button onClick={send} disabled={(!text.trim() && !attachment) || posting || !me} aria-label="Send" className="cta-button w-8 h-8 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-40">
            <Send className="w-3.5 h-3.5" />
          </button>
          {mention && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-9 mb-1 w-56 bg-white border border-sand rounded-lg shadow-lg overflow-hidden z-20">
              <p className="flex items-center gap-1 px-2.5 pt-1.5 pb-1 text-[10px] font-display font-semibold uppercase tracking-wider text-soft">
                <AtSign className="w-3 h-3" /> Mention
              </p>
              {mentionCandidates.map((c, i) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(c); }}
                  onMouseEnter={() => setMentionIdx(i)}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left ${i === mentionIdx ? "bg-paper" : "bg-white"}`}
                >
                  <Avatar name={c.name} avatarUrl={c.avatar_url} size="xs" />
                  <span className="text-xs text-ink truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </MentionProvider>
  );
}
