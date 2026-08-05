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
/**
 * The chat_messages.category column has existed since migration 016 and is what
 * the original Community board filtered on (All / Wins / Questions / Discussion).
 * The drawer and the FTA channel never surfaced it and wrote a constant
 * "discussion"; the restored Community board does surface it, so the engine now
 * CARRIES the column instead of hard-coding it. Callers that pass nothing still
 * write "discussion" — byte-identical behaviour to before.
 */
export type ChatCategory = "win" | "question" | "announcement" | "discussion";

export interface ChatMsg {
  id: string;
  content: string;
  category: ChatCategory;
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

/* ── WHY A POST DID NOT LAND ──────────────────────────────────────────────────
   `send` used to collapse EVERY insert failure into `{ok:false, error:"send"}`,
   and the composer rendered one sentence for it: "Your post didn't go through.
   Please try again." That sentence is a lie in the two cases that matter most.

   A family's guardrails (the parent-set chat wall / downtime window) refuse the
   insert at the DATABASE, as an RLS denial — Postgres 42501. A profanity trigger
   refuses it by RAISING, which arrives as a Postgres exception carrying the
   message the trigger chose. Both were shown to the member as a network hiccup,
   so a kid whose parent had closed chat for the evening was told to retry, and
   retried, and retried.

   The insert's real error is therefore CARRIED OUT of the hook and classified
   here — once — so the composer maps a KIND to a sentence instead of guessing:

     · "blocked"  — a policy/guardrail denial (42501, or an explicit
                    permission/guardrail message). Not retryable; say why.
     · "rejected" — a trigger REJECTED the content. `message` carries the
                    trigger's own words when they are safe to show a member.
     · "send"     — everything else, including genuine network failure. The
                    retry copy is correct here and ONLY here.

   The DB-side profanity trigger is landing in another agent's lane, so the
   classifier is written against the SHAPE of a raised exception (any code in the
   P0001 / plpgsql-raise family, or a message that names the rejection) rather
   than against a specific string, and it never shows a member a message that
   reads like internals. */
export type SendErrorKind = "profanity" | "upload" | "blocked" | "rejected" | "send";

export interface SendResult {
  ok: boolean;
  error?: SendErrorKind;
  /** A member-safe sentence from the database, when there is one. */
  message?: string;
}

/** Postgres codes that mean "a policy said no", not "the network dropped". */
const RLS_DENIED_CODES = new Set(["42501"]);
/** Postgres codes a `RAISE EXCEPTION` in a trigger arrives as. */
const RAISED_EXCEPTION_CODES = new Set(["P0001", "P0000", "23514"]);

/**
 * A raised-exception message is written by us, for a member — but it can still
 * arrive wrapped in plpgsql context, or be a bare internals string. Show it only
 * when it reads like a sentence a person wrote: reasonably short, no SQL, no
 * schema names, no stack context.
 */
function memberSafeMessage(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const msg = raw.split("\n")[0].trim();
  if (!msg || msg.length > 160) return undefined;
  if (/[_"]|\b(?:select|insert|update|relation|column|constraint|function|pg_)\b/i.test(msg))
    return undefined;
  return msg;
}

/** Classify an insert failure into one of the kinds above. */
export function classifySendError(err: {
  code?: string | null;
  message?: string | null;
} | null): { error: SendErrorKind; message?: string } {
  if (!err) return { error: "send" };
  const code = err.code ?? "";
  const message = err.message ?? "";

  if (RLS_DENIED_CODES.has(code) || /row-level security|permission denied/i.test(message)) {
    return { error: "blocked" };
  }
  if (RAISED_EXCEPTION_CODES.has(code)) {
    // A guardrail that raises rather than relying on RLS still means "closed",
    // not "rejected content" — honour the word the trigger used.
    if (/guardrail|chat is (?:closed|off)|quiet hours|downtime/i.test(message)) {
      return { error: "blocked", message: memberSafeMessage(message) };
    }
    return { error: "rejected", message: memberSafeMessage(message) };
  }
  return { error: "send" };
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
          "id, content, category, created_at, user_id, attachment_url, attachment_type, author:profiles!chat_messages_user_id_fkey(display_name, role, age_group, family_id, avatar_url, username)"
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
          category: raw.category || "discussion",
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
              id: string; content: string | null; category: ChatCategory | null;
              created_at: string; user_id: string;
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
                      id: row.id, content: row.content || "", category: row.category || "discussion",
                      created_at: row.created_at,
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
    async (
      body: string,
      file: File | null,
      category: ChatCategory = "discussion"
    ): Promise<SendResult> => {
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
        .insert({ room_id: roomId, user_id: me.id, content: trimmed, category, ...(attachmentFields || {}) })
        .select("id, content, category, created_at, user_id, attachment_url, attachment_type")
        .single();

      if (!insErr && data) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.id)
            ? prev
            : [
                {
                  id: data.id, content: data.content || "",
                  category: (data.category as ChatCategory) || "discussion",
                  created_at: data.created_at, user_id: data.user_id,
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
      // The insert's OWN error, classified — never a flat "send" for everything.
      return { ok: false, ...classifySendError(insErr) };
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
