"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Trash2, Loader2, Film, ImageIcon, RefreshCw, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Community rooms (migration 033: room 1 = "FIC Club", room 2 = "FTA Traders").
const FIC_ROOM_ID = "c0000000-0000-4000-a000-000000000001";
const FTA_ROOM_ID = "c0000000-0000-4000-a000-000000000002";
const ROOM_IDS = [FIC_ROOM_ID, FTA_ROOM_ID];
const ROOM_NAMES: Record<string, string> = {
  [FIC_ROOM_ID]: "FIC Club",
  [FTA_ROOM_ID]: "FTA Traders",
};
const MEDIA_BUCKET = "community-media";

type RoomFilter = "all" | typeof FIC_ROOM_ID | typeof FTA_ROOM_ID;

interface AdminMessage {
  id: string;
  content: string | null;
  category: string | null;
  created_at: string;
  user_id: string;
  room_id: string;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
  author: { display_name: string | null; role: string | null } | null;
}

/** Extract the object path inside community-media from a Supabase public URL. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const raw = url.slice(i + marker.length).split("?")[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function AdminCommunityPage() {
  const supabase = createClient();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("chat_messages")
      .select(
        "id, content, category, created_at, user_id, room_id, attachment_url, attachment_type, author:profiles!chat_messages_user_id_fkey(display_name, role)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    query = roomFilter === "all" ? query.in("room_id", ROOM_IDS) : query.eq("room_id", roomFilter);
    const { data } = await query;
    const normalized: AdminMessage[] = (data || []).map((m) => {
      const raw = m as unknown as AdminMessage & {
        author: AdminMessage["author"] | NonNullable<AdminMessage["author"]>[];
      };
      return {
        ...raw,
        author: Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author,
      };
    });
    setMessages(normalized);
    setLoading(false);
  }, [supabase, roomFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(msg: AdminMessage) {
    if (deletingId) return;
    if (!window.confirm("Delete this post for everyone? This cannot be undone.")) return;
    setDeletingId(msg.id);
    setError(null);

    // Best-effort: remove the storage object first so media does not orphan.
    if (msg.attachment_url) {
      const path = storagePathFromUrl(msg.attachment_url);
      if (path) {
        const { error: rmErr } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
        if (rmErr) {
          // Non-fatal: still delete the message; log for follow-up.
          console.warn("community-media cleanup failed:", rmErr.message);
        }
      }
    }

    const { error: delErr } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", msg.id);

    if (delErr) {
      setError(`Delete failed: ${delErr.message}`);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }
    setDeletingId(null);
  }

  const roomTabs: { id: RoomFilter; label: string }[] = [
    { id: "all", label: "All rooms" },
    { id: FIC_ROOM_ID, label: "FIC Club" },
    { id: FTA_ROOM_ID, label: "FTA Traders" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Community</h1>
          <p className="text-soft text-sm mt-1">
            Moderate both rooms — deleting a post also removes its photo or video.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand text-ink text-xs hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Room filter */}
      <div className="flex items-center gap-1.5 mb-6">
        {roomTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setRoomFilter(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              roomFilter === t.id
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-sand text-soft hover:border-accent/50"
            }`}
          >
            <Hash className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-accent/40 bg-accent/10 text-accent text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-soft">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          Loading messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-20 club-b-card">
          <MessageCircle className="w-12 h-12 text-soft/70 mx-auto mb-4" />
          <h3 className="font-display text-[17px] font-extrabold text-ink mb-2">No posts yet</h3>
          <p className="text-sm text-soft max-w-md mx-auto">
            Community messages will appear here for moderation.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-3 px-4 py-3 club-b-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-ink">
                    {msg.author?.display_name || "Member"}
                  </span>
                  <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                    {msg.author?.role || "member"}
                  </span>
                  <span className="flex items-center gap-1 text-soft border border-sand rounded px-1.5 py-0.5 text-[10px]">
                    <Hash className="w-2.5 h-2.5" />
                    {ROOM_NAMES[msg.room_id] || "room"}
                  </span>
                  <span className="text-soft/70">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                  {msg.category && (
                    <span className="text-soft border border-sand rounded px-1.5 py-0.5 text-[10px]">
                      {msg.category}
                    </span>
                  )}
                  {msg.attachment_type === "image" && (
                    <span className="flex items-center gap-1 text-accent/80 text-[10px]">
                      <ImageIcon className="w-3 h-3" /> photo
                    </span>
                  )}
                  {msg.attachment_type === "video" && (
                    <span className="flex items-center gap-1 text-accent/80 text-[10px]">
                      <Film className="w-3 h-3" /> video
                    </span>
                  )}
                </div>
                {msg.content ? (
                  <p className="text-sm text-ink mt-1 whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                ) : null}
                {msg.attachment_url && msg.attachment_type === "image" && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={msg.attachment_url}
                    alt="Attachment"
                    loading="lazy"
                    className="mt-2 max-h-32 rounded-lg border border-sand"
                  />
                )}
                {msg.attachment_url && msg.attachment_type === "video" && (
                  <video
                    src={msg.attachment_url}
                    controls
                    preload="metadata"
                    className="mt-2 max-h-32 rounded-lg border border-sand"
                  />
                )}
              </div>
              <button
                onClick={() => handleDelete(msg)}
                disabled={deletingId === msg.id}
                title="Delete post"
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-sand text-soft hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-40"
              >
                {deletingId === msg.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
