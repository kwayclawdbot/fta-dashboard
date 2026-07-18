"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Send,
  TrendingUp,
  Trophy,
  Pin,
  MoreHorizontal,
  Image as ImageIcon,
  Smile,
  Flame,
  ThumbsUp,
  Bookmark,
  Users,
  Crown,
  Star,
  ChevronDown,
} from "lucide-react";

// ── Types ──

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface Comment {
  id: string;
  author: string;
  avatar: string;
  role: "parent" | "child" | "coach" | "admin";
  text: string;
  time: string;
  likes: number;
}

interface Post {
  id: string;
  author: string;
  avatar: string;
  role: "parent" | "child" | "coach" | "admin";
  badge?: string;
  time: string;
  content: string;
  image?: string;
  category: "discussion" | "win" | "question" | "announcement";
  pinned?: boolean;
  reactions: Reaction[];
  comments: Comment[];
  bookmarked: boolean;
}

interface Member {
  name: string;
  avatar: string;
  role: "parent" | "child" | "coach" | "admin";
  streak?: number;
  online: boolean;
}

// ── Mock Data ──

const MOCK_MEMBERS: Member[] = [
  { name: "Coach Marcus", avatar: "CM", role: "coach", online: true },
  { name: "Kway", avatar: "KC", role: "parent", streak: 12, online: true },
  { name: "Kway Jr", avatar: "KJ", role: "child", streak: 8, online: true },
  { name: "Sarah T.", avatar: "ST", role: "parent", streak: 5, online: false },
  { name: "Mike D.", avatar: "MD", role: "parent", streak: 3, online: false },
  { name: "Ava D.", avatar: "AD", role: "child", online: false },
];

const MOCK_POSTS: Post[] = [
  {
    id: "p0",
    author: "Coach Marcus",
    avatar: "CM",
    role: "coach",
    badge: "Head Coach",
    time: "2h ago",
    content: "Welcome to the Family Trading Academy community! This is your space to share wins, ask questions, and learn together as a family. Remember: there are no dumb questions here. Every pro trader was once a beginner. Let's build generational wealth together!",
    category: "announcement",
    pinned: true,
    reactions: [
      { emoji: "🔥", count: 14, reacted: true },
      { emoji: "💪", count: 9, reacted: false },
      { emoji: "❤️", count: 7, reacted: false },
    ],
    comments: [],
    bookmarked: false,
  },
  {
    id: "p1",
    author: "Kway",
    avatar: "KC",
    role: "parent",
    badge: "12-day streak",
    time: "45m ago",
    content: "Just finished the Candlestick Patterns module with my son. He spotted a hammer pattern on AAPL before I did! Proud dad moment. This is exactly why we started this journey together.",
    category: "win",
    reactions: [
      { emoji: "🔥", count: 8, reacted: false },
      { emoji: "💪", count: 12, reacted: true },
      { emoji: "🎉", count: 5, reacted: false },
    ],
    comments: [
      { id: "c1", author: "Coach Marcus", avatar: "CM", role: "coach", text: "This is what it's all about! Kids have incredible pattern recognition. Keep it up!", time: "30m ago", likes: 3 },
      { id: "c2", author: "Sarah T.", avatar: "ST", role: "parent", text: "Love this! My daughter is starting the same module this week.", time: "20m ago", likes: 1 },
    ],
    bookmarked: true,
  },
  {
    id: "p2",
    author: "Kway Jr",
    avatar: "KJ",
    role: "child",
    badge: "Rising Trader",
    time: "1h ago",
    content: "Can someone explain why a stock can go down even when the company has good earnings? I saw NFLX drop after beating estimates and I'm confused.",
    category: "question",
    reactions: [
      { emoji: "🤔", count: 6, reacted: false },
      { emoji: "👍", count: 3, reacted: false },
    ],
    comments: [
      { id: "c3", author: "Coach Marcus", avatar: "CM", role: "coach", text: "Great question! This is called \"sell the news.\" Sometimes the market has already priced in good earnings expectations. When results come out, even if they're good, traders take profits. It's all about expectations vs reality.", time: "50m ago", likes: 7 },
      { id: "c4", author: "Kway", avatar: "KC", role: "parent", text: "We should add this to our family trading journal!", time: "45m ago", likes: 2 },
    ],
    bookmarked: false,
  },
  {
    id: "p3",
    author: "Sarah T.",
    avatar: "ST",
    role: "parent",
    time: "3h ago",
    content: "Week 2 update: my family just finished the \"How Markets Work\" lesson together. We turned it into a game — each of us picked a stock to track for a month with fake $1000. Kids are SO competitive about it and I love it.",
    category: "win",
    reactions: [
      { emoji: "❤️", count: 11, reacted: false },
      { emoji: "🎉", count: 6, reacted: false },
      { emoji: "💰", count: 4, reacted: false },
    ],
    comments: [
      { id: "c5", author: "Mike D.", avatar: "MD", role: "parent", text: "Paper trading competition is genius. Stealing this idea!", time: "2h ago", likes: 3 },
    ],
    bookmarked: false,
  },
  {
    id: "p4",
    author: "Mike D.",
    avatar: "MD",
    role: "parent",
    time: "5h ago",
    content: "Quick tip that helped my family: we set a fixed 30-minute \"market school\" time every evening after dinner. Consistency beats intensity. 3 weeks in and it's become our favorite family activity.",
    category: "discussion",
    reactions: [
      { emoji: "💡", count: 15, reacted: false },
      { emoji: "🔥", count: 8, reacted: false },
    ],
    comments: [],
    bookmarked: false,
  },
];

// ── Helpers ──

const ROLE_COLORS: Record<string, string> = {
  coach: "text-gold-400 bg-gold-400/10",
  admin: "text-gold-400 bg-gold-400/10",
  parent: "text-blue-400 bg-blue-400/10",
  child: "text-green-400 bg-green-400/10",
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  announcement: { label: "Announcement", color: "text-gold-400 bg-gold-400/10", icon: Pin },
  win: { label: "Win", color: "text-green-400 bg-green-400/10", icon: Trophy },
  question: { label: "Question", color: "text-blue-400 bg-blue-400/10", icon: MessageCircle },
  discussion: { label: "Discussion", color: "text-midnight-300 bg-midnight-700/50", icon: TrendingUp },
};

type FilterType = "all" | "announcement" | "win" | "question" | "discussion";

// ── Components ──

function AvatarCircle({ initials, role, size = "md" }: { initials: string; role: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7 text-[11px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" };
  const bg = role === "coach" || role === "admin"
    ? "bg-gold-400/20 text-gold-400 ring-1 ring-gold-400/30"
    : role === "child"
      ? "bg-green-400/15 text-green-400"
      : "bg-midnight-700 text-midnight-300";

  return (
    <div className={`${sizes[size]} ${bg} rounded-full flex items-center justify-center font-display font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function PostCard({ post, onReact }: { post: Post; onReact: (postId: string, emoji: string) => void }) {
  const [showComments, setShowComments] = useState(post.comments.length <= 2);
  const [commentText, setCommentText] = useState("");
  const cat = CATEGORY_CONFIG[post.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border bg-midnight-900/40 p-4 ${post.pinned ? "border-gold-400/30" : "border-midnight-800/60"}`}
    >
      {/* Pinned indicator */}
      {post.pinned && (
        <div className="flex items-center gap-1.5 text-[11px] text-gold-400 font-display font-semibold uppercase tracking-wider mb-3">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <AvatarCircle initials={post.avatar} role={post.role} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-semibold text-midnight-100">{post.author}</span>
            <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_COLORS[post.role]}`}>
              {post.role}
            </span>
            {post.badge && (
              <span className="text-[11px] text-midnight-500 font-body flex items-center gap-1">
                <Star className="w-2.5 h-2.5 text-gold-400" />
                {post.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-midnight-500 font-body">{post.time}</span>
            <span className={`text-[11px] font-display font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${cat.color}`}>
              <cat.icon className="w-2.5 h-2.5" />
              {cat.label}
            </span>
          </div>
        </div>
        <button className="p-1 rounded text-midnight-600 hover:text-midnight-400 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <p className="text-sm text-midnight-200 font-body leading-relaxed mb-3 whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Reactions */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {post.reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => onReact(post.id, r.emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-body transition-colors ${
              r.reacted
                ? "bg-gold-400/10 border border-gold-400/30 text-gold-400"
                : "bg-midnight-800/60 border border-midnight-700/40 text-midnight-400 hover:border-midnight-600"
            }`}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        ))}
        <button className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-midnight-800/40 border border-midnight-700/30 text-midnight-500 hover:text-midnight-400 hover:border-midnight-600 transition-colors">
          <Smile className="w-3 h-3" />
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 pt-2 border-t border-midnight-800/50">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors font-body"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {post.comments.length > 0 ? `${post.comments.length} comments` : "Comment"}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors font-body">
          <Bookmark className={`w-3.5 h-3.5 ${post.bookmarked ? "fill-gold-400 text-gold-400" : ""}`} />
          Save
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && post.comments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-midnight-800/50 space-y-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <AvatarCircle initials={comment.avatar} role={comment.role} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-display font-semibold text-midnight-200">{comment.author}</span>
                      <span className={`text-[11px] font-display font-bold uppercase tracking-wider px-1 py-0.5 rounded ${ROLE_COLORS[comment.role]}`}>
                        {comment.role}
                      </span>
                      <span className="text-[11px] text-midnight-600 font-body">{comment.time}</span>
                    </div>
                    <p className="text-xs text-midnight-300 font-body leading-relaxed mt-0.5">{comment.text}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button className="text-[11px] text-midnight-500 hover:text-midnight-300 font-body flex items-center gap-1 transition-colors">
                        <ThumbsUp className="w-2.5 h-2.5" />
                        {comment.likes}
                      </button>
                      <button className="text-[11px] text-midnight-500 hover:text-midnight-300 font-body transition-colors">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment input */}
      {showComments && (
        <div className="mt-3 flex items-center gap-2">
          <AvatarCircle initials="KC" role="parent" size="sm" />
          <div className="flex-1 flex items-center gap-2 bg-midnight-800/50 border border-midnight-700/50 rounded-lg px-3 py-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-transparent text-xs text-midnight-200 placeholder:text-midnight-600 font-body focus:outline-none"
            />
            <button className="text-midnight-500 hover:text-gold-400 transition-colors">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ──

export default function CommunityPage() {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [filter, setFilter] = useState<FilterType>("all");
  const [newPostText, setNewPostText] = useState("");
  const [newPostCategory, setNewPostCategory] = useState<"discussion" | "win" | "question">("discussion");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  function handleReact(postId: string, emoji: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          reactions: p.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
              : r
          ),
        };
      })
    );
  }

  function handlePost() {
    if (!newPostText.trim()) return;
    const newPost: Post = {
      id: `p${Date.now()}`,
      author: "Kway",
      avatar: "KC",
      role: "parent",
      time: "Just now",
      content: newPostText,
      category: newPostCategory,
      reactions: [
        { emoji: "🔥", count: 0, reacted: false },
        { emoji: "👍", count: 0, reacted: false },
      ],
      comments: [],
      bookmarked: false,
    };
    setPosts((prev) => [prev[0], newPost, ...prev.slice(1)]);
    setNewPostText("");
  }

  const filteredPosts = filter === "all" ? posts : posts.filter((p) => p.category === filter || p.pinned);

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "announcement", label: "Announcements" },
    { id: "win", label: "Wins" },
    { id: "question", label: "Questions" },
    { id: "discussion", label: "Discussion" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mb-6">
        <h2 className="font-display text-2xl font-bold text-midnight-100">Community</h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">Learn together, grow together</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Compose box */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4"
          >
            <div className="flex gap-3">
              <AvatarCircle initials="KC" role="parent" />
              <div className="flex-1">
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="Share a win, ask a question, or start a discussion..."
                  rows={3}
                  className="w-full bg-midnight-800/50 border border-midnight-700/50 rounded-lg p-3 text-sm text-midnight-200 placeholder:text-midnight-600 font-body resize-none focus:outline-none focus:border-gold-400/40"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded text-midnight-500 hover:text-midnight-300 transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded text-midnight-500 hover:text-midnight-300 transition-colors">
                      <Smile className="w-4 h-4" />
                    </button>
                    {/* Category picker */}
                    <div className="relative">
                      <button
                        onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-display font-semibold transition-colors ${CATEGORY_CONFIG[newPostCategory].color}`}
                      >
                        {(() => { const Icon = CATEGORY_CONFIG[newPostCategory].icon; return <Icon className="w-3 h-3" />; })()}
                        {CATEGORY_CONFIG[newPostCategory].label}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <AnimatePresence>
                        {showCategoryPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute top-full left-0 mt-1 bg-midnight-900 border border-midnight-700 rounded-lg overflow-hidden z-10 shadow-lg"
                          >
                            {(["discussion", "win", "question"] as const).map((cat) => (
                              <button
                                key={cat}
                                onClick={() => { setNewPostCategory(cat); setShowCategoryPicker(false); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-body text-midnight-300 hover:bg-midnight-800 transition-colors"
                              >
                                {(() => { const Icon = CATEGORY_CONFIG[cat].icon; return <Icon className="w-3 h-3" />; })()}
                                {CATEGORY_CONFIG[cat].label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={!newPostText.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gold-400 text-midnight-950 text-xs font-display font-semibold hover:bg-gold-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post
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
                className={`px-3 py-1.5 rounded-lg text-xs font-body whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? "bg-gold-400/10 text-gold-400 border border-gold-400/30"
                    : "text-midnight-400 border border-midnight-800/50 hover:border-midnight-600 hover:text-midnight-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Posts */}
          <div className="space-y-4">
            {filteredPosts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.03 }}
              >
                <PostCard post={post} onReact={handleReact} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="lg:w-[280px] shrink-0 space-y-4"
        >
          {/* Community stats */}
          <div className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4">
            <h3 className="font-display text-xs font-semibold text-midnight-300 uppercase tracking-wider mb-3">Community</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-display text-lg font-bold text-midnight-100">47</p>
                <p className="text-[11px] text-midnight-500 font-body">Families</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-midnight-100">128</p>
                <p className="text-[11px] text-midnight-500 font-body">Members</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-gold-400">23</p>
                <p className="text-[11px] text-midnight-500 font-body">Online now</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-green-400">312</p>
                <p className="text-[11px] text-midnight-500 font-body">Posts this week</p>
              </div>
            </div>
          </div>

          {/* Streak leaderboard */}
          <div className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4">
            <h3 className="font-display text-xs font-semibold text-midnight-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Streak Leaders
            </h3>
            <div className="space-y-2.5">
              {MOCK_MEMBERS.filter((m) => m.streak).sort((a, b) => (b.streak || 0) - (a.streak || 0)).map((member, i) => (
                <div key={member.name} className="flex items-center gap-2.5">
                  <span className="text-[11px] font-display font-bold text-midnight-500 w-4 text-right">
                    {i === 0 ? <Crown className="w-3.5 h-3.5 text-gold-400 inline" /> : `#${i + 1}`}
                  </span>
                  <AvatarCircle initials={member.avatar} role={member.role} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body text-midnight-200 truncate">{member.name}</p>
                  </div>
                  <span className="text-xs font-display font-bold text-orange-400 flex items-center gap-0.5">
                    <Flame className="w-3 h-3" />
                    {member.streak}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active members */}
          <div className="rounded-lg border border-midnight-800/60 bg-midnight-900/40 p-4">
            <h3 className="font-display text-xs font-semibold text-midnight-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Members Online
            </h3>
            <div className="space-y-2.5">
              {MOCK_MEMBERS.filter((m) => m.online).map((member) => (
                <div key={member.name} className="flex items-center gap-2.5">
                  <div className="relative">
                    <AvatarCircle initials={member.avatar} role={member.role} size="sm" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-midnight-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body text-midnight-200 truncate">{member.name}</p>
                    <p className={`text-[11px] font-body ${ROLE_COLORS[member.role].split(" ")[0]}`}>{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
