"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Bell, CheckCheck, CornerUpLeft, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerServiceWorker } from "@/lib/push";
import EnablePushButton from "./EnablePushButton";

interface NotificationItem {
  id: string;
  type: "reply" | "mention" | "announcement";
  body: string;
  read_at: string | null;
  created_at: string;
  actor: { display_name: string } | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function verbFor(type: NotificationItem["type"]): string {
  switch (type) {
    case "reply":
      return "replied to you";
    case "mention":
      return "mentioned you";
    case "announcement":
      return "posted an announcement";
  }
}

function IconFor({ type }: { type: NotificationItem["type"] }) {
  const cls = "w-3.5 h-3.5";
  if (type === "reply") return <CornerUpLeft className={cls} />;
  if (type === "mention") return <AtSign className={cls} />;
  return <Megaphone className={cls} />;
}

export default function NotificationsBell() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (uid: string) => {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id, type, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(display_name)"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .is("read_at", null),
      ]);
      setItems((data as unknown as NotificationItem[]) ?? []);
      setUnread(count ?? 0);
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    // Registering the SW never prompts — keeps push alive for users who
    // already granted permission.
    registerServiceWorker();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      setUserId(user.id);
      load(user.id);
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, load]);

  // Live unread count — Realtime INSERTs on my notifications (simple
  // user_id = auth.uid() SELECT policy, Realtime-safe per 019).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => load(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleItemClick(n: NotificationItem) {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i))
      );
      setUnread((c) => Math.max(0, c - 1));
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    }
    router.push("/community");
  }

  async function markAllRead() {
    if (!userId || unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
    setUnread(0);
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative text-midnight-400 hover:text-midnight-200 transition-colors p-1 -m-1"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-gold-500 text-white text-[10px] font-bold font-display flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-midnight-900 border border-midnight-700 shadow-lg shadow-ink/10 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-800">
              <p className="text-sm font-semibold font-display text-midnight-100">
                Notifications
              </p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-600 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 text-midnight-600 mx-auto mb-2" />
                  <p className="text-sm text-midnight-400">No notifications yet</p>
                  <p className="text-xs text-midnight-500 mt-1">
                    Replies and @mentions from the community show up here.
                  </p>
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 border-b border-midnight-800 last:border-b-0 transition-colors hover:bg-midnight-950 ${
                      !n.read_at ? "bg-gold-400/10" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        !n.read_at
                          ? "bg-gold-400/20 text-gold-700"
                          : "bg-midnight-800 text-midnight-500"
                      }`}
                    >
                      <IconFor type={n.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-midnight-200">
                        <span className="font-semibold text-midnight-100">
                          {n.actor?.display_name || "Someone"}
                        </span>{" "}
                        {verbFor(n.type)}
                      </span>
                      {n.body && (
                        <span className="block text-xs text-midnight-400 truncate mt-0.5">
                          {n.body}
                        </span>
                      )}
                      <span className="block text-[11px] text-midnight-500 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {!n.read_at && (
                      <span className="mt-2 w-2 h-2 rounded-full bg-gold-500 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-midnight-800 bg-midnight-950/60">
              <EnablePushButton compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
