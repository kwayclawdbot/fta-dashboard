"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// The single global community room (seeded in migration 016)
const COMMUNITY_ROOM_ID = "c0000000-0000-4000-a000-000000000001";

type Category = "win" | "question" | "announcement" | "discussion";
type FilterType = "all" | Category;
type Role = "parent" | "child" | "coach" | "admin";

interface Author {
  display_name: string | null;
  role: Role | null;
  age_group: string | null;
}

interface Message {
  id: string;
  content: string;
  category: Category;
  created_at: string;
  user_id: string;
  author: Author | null;
}

interface CurrentUser {
  id: string;
  display_name: string;
  role: Role;
  age_group: string | null;
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

function Avatar({ name, role, size = "md" }: { name?: string | null; role?: string | null; size?: "sm" | "md" }) {
  const sizes = { sm: "w-8 h-8 text-[11px]", md: "w-10 h-10 text-xs" };
  const bg =
    role === "coach" || role === "admin"
      ? "bg-chip-amber text-gold-800"
      : role === "child"
        ? "bg-chip-green text-green-700"
        : role === "parent"
          ? "bg-chip-sky text-sky-800"
          : "bg-sand text-soft";
  return (
    <div className={`${sizes[size]} ${bg} rounded-full flex items-center justify-center font-display font-bold shrink-0`}>
      {initialsOf(name)}
    </div>
  );
}

function MessageCard({ msg }: { msg: Message }) {
  const cat = CATEGORY_CONFIG[msg.category] || CATEGORY_CONFIG.discussion;
  const role = msg.author?.role || "parent";
  return (
    <div className="paper-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={msg.author?.display_name} role={role} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-ink">
              {msg.author?.display_name || "Member"}
            </span>
            <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_CHIP[role] || "bg-sand text-soft"}`}>
              {role}
            </span>
            <span className="text-[11px] text-soft font-body">{timeAgo(msg.created_at)}</span>
            <span className={`text-[11px] font-display font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${cat.chip}`}>
              <cat.icon className="w-2.5 h-2.5" />
              {cat.label}
            </span>
          </div>
          <p className="text-sm text-midnight-200 font-body leading-relaxed mt-2 whitespace-pre-wrap break-words">
            {msg.content}
          </p>
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

  const authorCache = useRef<Record<string, Author>>({});

  const getAuthor = useCallback(
    async (userId: string): Promise<Author> => {
      if (authorCache.current[userId]) return authorCache.current[userId];
      const { data } = await supabase
        .from("profiles")
        .select("display_name, role, age_group")
        .eq("id", userId)
        .single();
      const author: Author = {
        display_name: data?.display_name ?? "Member",
        role: (data?.role as Role) ?? "parent",
        age_group: data?.age_group ?? null,
      };
      authorCache.current[userId] = author;
      return author;
    },
    [supabase]
  );

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
          .select("display_name, role, age_group")
          .eq("id", user.id)
          .single();
        if (profile) {
          const cu: CurrentUser = {
            id: user.id,
            display_name: profile.display_name || "You",
            role: (profile.role as Role) || "parent",
            age_group: profile.age_group,
          };
          authorCache.current[user.id] = {
            display_name: cu.display_name,
            role: cu.role,
            age_group: cu.age_group,
          };
          if (mounted) setMe(cu);
        }
      }

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select(
          "id, content, category, created_at, user_id, author:profiles!chat_messages_user_id_fkey(display_name, role, age_group)"
        )
        .eq("room_id", COMMUNITY_ROOM_ID)
        .order("created_at", { ascending: false })
        .limit(100);

      if (mounted && msgs) {
        const normalized: Message[] = msgs.map((m) => {
          const raw = m as unknown as {
            id: string;
            content: string;
            category: Category | null;
            created_at: string;
            user_id: string;
            author: Author | Author[] | null;
          };
          const author = Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author;
          return {
            id: raw.id,
            content: raw.content,
            category: raw.category || "discussion",
            created_at: raw.created_at,
            user_id: raw.user_id,
            author,
          };
        });
        setMessages(normalized);
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
    const channel = supabase
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
            content: string;
            category: Category | null;
            created_at: string;
            user_id: string;
          };
          const author = await getAuthor(row.user_id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              {
                id: row.id,
                content: row.content,
                category: row.category || "discussion",
                created_at: row.created_at,
                user_id: row.user_id,
                author,
              },
              ...prev,
            ];
          });
          setStats((s) => ({ ...s, posts: s.posts + 1 }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePost() {
    const text = newPostText.trim();
    if (!text || !me || posting) return;
    setPosting(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: COMMUNITY_ROOM_ID,
        user_id: me.id,
        content: text,
        category: newCategory,
      })
      .select("id, content, category, created_at, user_id")
      .single();

    if (!error && data) {
      // Optimistic local add (deduped against realtime echo)
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [
          {
            id: data.id,
            content: data.content,
            category: (data.category as Category) || "discussion",
            created_at: data.created_at,
            user_id: data.user_id,
            author: {
              display_name: me.display_name,
              role: me.role,
              age_group: me.age_group,
            },
          },
          ...prev,
        ];
      });
      setStats((s) => ({ ...s, posts: s.posts + 1 }));
      setNewPostText("");
    }
    setPosting(false);
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
          {/* Compose */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="paper-card p-4">
            <div className="flex gap-3">
              <Avatar name={me?.display_name} role={me?.role} />
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
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="relative">
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
                    disabled={!newPostText.trim() || posting || !me}
                    className="cta-button flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {posting ? "Posting..." : "Post"}
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
                  <MessageCard msg={msg} />
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
