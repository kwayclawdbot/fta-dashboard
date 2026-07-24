"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierMap, type FamilyTier } from "@/lib/tier";
import { XP, awardXp, countXpToday } from "@/lib/xp";
import { fetchXpForUsers } from "@/lib/belts";
import { extractHandles, type MentionMap } from "@/lib/mentions";
import { checkClean } from "@/lib/profanity";
import type { Role } from "@/lib/feed";

/**
 * useChatRoom — the shared realtime chat engine behind BOTH the Club Chat drawer
 * (LiveRooms) and the dedicated FTA Traders page (FtaChat). It owns the data
 * plumbing that was previously inlined in LiveRooms: load the last 60 messages,
 * subscribe to the `community-room-${roomId}` realtime INSERT stream, cache
 * authors, batch family-tier lookups for badges, resolve @mention handles, and
 * post a message (with optional image/video upload + capped community XP).
 *
 * The chat_messages schema + realtime policies (migrations 016/018/019/027) are
 * untouched — this is a pure refactor/extraction so the two surfaces never
 * duplicate the engine.
 */

export const CHAT_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const CHAT_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
export const CHAT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CHAT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

export interface ChatAuthor {
  display_name: string | null;
  role: Role | null;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
  username: string | null;
}
export interface ChatMsg {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: ChatAuthor | null;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
}
export interface ChatMe {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
  family_id: string | null;
  avatar_url: string | null;
  username?: string | null;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export function useChatRoom(roomId: string, me: ChatMe | null) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [tiers, setTiers] = useState<Record<string, FamilyTier>>({});
  const tiersRef = useRef(tiers);
  tiersRef.current = tiers;
  const authorCache = useRef<Record<string, ChatAuthor>>({});

  // Batched belt XP per author (one RPC per batch, never N+1) so every chat
  // avatar shows its earned belt ring.
  const [beltXp, setBeltXp] = useState<Record<string, number>>({});
  const beltXpRef = useRef(beltXp);
  beltXpRef.current = beltXp;
  const loadXp = useCallback(
    async (ids: Array<string | null | undefined>) => {
      const missing = ids.filter((id): id is string => !!id && !(id in beltXpRef.current));
      if (!missing.length) return;
      const fetched = await fetchXpForUsers(supabase, missing);
      // Mark every requested id as resolved (0 → White) so we never refetch.
      setBeltXp((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = fetched[id] ?? 0;
        return next;
      });
    },
    [supabase]
  );

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
    async (userId: string): Promise<ChatAuthor> => {
      if (authorCache.current[userId]) return authorCache.current[userId];
      const { data } = await supabase
        .from("profiles")
        .select("display_name, role, age_group, family_id, avatar_url, username")
        .eq("id", userId)
        .single();
      const a: ChatAuthor = {
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

  // Load the room history when the room (or viewer) changes.
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
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!mounted) return;
      const norm: ChatMsg[] = (data ?? []).map((m) => {
        const raw = m as unknown as ChatMsg & { author: ChatAuthor | ChatAuthor[] | null };
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
      loadXp(norm.map((m) => m.user_id));
      resolveMentions(norm.map((m) => m.content));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me?.id]);

  // Realtime INSERT stream for the active room (reused verbatim from LiveRooms).
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
        .channel(`community-room-${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
          async (payload) => {
            const row = payload.new as {
              id: string; content: string | null; created_at: string; user_id: string;
              attachment_url: string | null; attachment_type: "image" | "video" | null;
            };
            const author = await getAuthor(row.user_id);
            loadXp([row.user_id]);
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
  }, [roomId]);

  const send = useCallback(
    async (body: string, file: File | null): Promise<SendResult> => {
      const trimmed = body.trim();
      if ((!trimmed && !file) || !me || posting) return { ok: false };
      const clean = checkClean(trimmed);
      if (!clean.ok) return { ok: false, error: "profanity" };
      setPosting(true);

      let attachmentFields:
        | { attachment_url: string; attachment_type: "image" | "video"; attachment_meta: Record<string, unknown> }
        | null = null;
      if (file) {
        setUploading(true);
        const ext = EXT_BY_MIME[file.type] || "bin";
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const isImage = CHAT_IMAGE_MIMES.includes(file.type);
        const { error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, file, { contentType: file.type, cacheControl: "3600" });
        setUploading(false);
        if (upErr) {
          setPosting(false);
          return { ok: false, error: "upload" };
        }
        const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path);
        attachmentFields = {
          attachment_url: pub.publicUrl,
          attachment_type: isImage ? "image" : "video",
          attachment_meta: { size: file.size, name: file.name },
        };
      }

      const { data, error: insErr } = await supabase
        .from("chat_messages")
        .insert({ room_id: roomId, user_id: me.id, content: trimmed, category: "discussion", ...(attachmentFields || {}) })
        .select("id, content, created_at, user_id, attachment_url, attachment_type")
        .single();

      if (!insErr && data) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.id)
            ? prev
            : [
                {
                  id: data.id, content: data.content || "", created_at: data.created_at, user_id: data.user_id,
                  author: {
                    display_name: me.display_name, role: me.role, age_group: me.age_group,
                    family_id: me.family_id, avatar_url: me.avatar_url, username: me.username ?? null,
                  },
                  attachment_url: data.attachment_url ?? null,
                  attachment_type: (data.attachment_type as "image" | "video" | null) ?? null,
                },
                ...prev,
              ]
        );
        const todayPosts = await countXpToday(supabase, me.id, "community");
        if (todayPosts < 3) await awardXp(supabase, me.id, "community", XP.COMMUNITY, data.id);
        setPosting(false);
        return { ok: true };
      }
      setPosting(false);
      return { ok: false, error: "send" };
    },
    [supabase, me, posting, roomId]
  );

  const tierOf = useCallback(
    (a: ChatAuthor | null): FamilyTier => (a?.family_id && tiers[a.family_id]) || "fic",
    [tiers]
  );

  const xpOf = useCallback((userId: string | null | undefined): number => (userId && beltXp[userId]) || 0, [beltXp]);

  return { messages, loading, posting, uploading, mentions, tierOf, xpOf, send };
}
