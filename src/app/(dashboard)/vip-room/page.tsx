"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Ticket, BookOpen, Sparkles, Loader2, Send, ShieldCheck, ArrowRight, PlayCircle } from "lucide-react";

/**
 * VIP Room (Lane C9) — a private, gated space for Challenge VIP ticket holders,
 * live through the challenge window (prep from purchase → Sept 6).
 *
 * VIP members see the private room (intro + feed + composer). Non-VIP members
 * (including anyone who followed a vip_upsell email link) see the VIP offer
 * instead, so this doubles as the in-app VIP upsell surface. All data flows
 * through the gated /api/challenge/vip-room routes.
 */

interface VipPost {
  id: string;
  body: string;
  created_at: string;
  author?: { display_name?: string | null; avatar_url?: string | null } | null;
}

export default function VipRoomPage() {
  const [loading, setLoading] = useState(true);
  const [vip, setVip] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [vipEnabled, setVipEnabled] = useState(false);
  const [posts, setPosts] = useState<VipPost[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/challenge/vip-room");
      const data = await res.json();
      setVip(!!data.vip);
      setWindowOpen(data.windowOpen !== false);
      setVipEnabled(!!data.vipEnabled);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setPosting(true);
    try {
      const res = await fetch("/api/challenge/vip-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Could not post.");
      } else {
        setDraft("");
        setPosts((p) => [data.post as VipPost, ...p]);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function startVipCheckout() {
    setCheckoutMsg(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/challenge/vip-checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url as string;
        return;
      }
      setCheckoutMsg(
        data?.message || "VIP tickets aren't open just yet — we'll email you the moment they are."
      );
    } catch {
      setCheckoutMsg("Something went wrong opening checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  // ── Non-VIP: the upsell / offer surface ──────────────────────────────────
  if (!vip) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="paper-card ring-2 ring-gold-400 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
            <Ticket className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">The VIP Room is for VIP members</h1>
          <p className="text-soft text-sm mt-2 leading-relaxed max-w-sm mx-auto">
            Your free challenge is complete on its own — this is an optional extra.
            The VIP ticket adds a printed textbook, your first month of Club, this
            private room, and replays of every live session. The $197 is just the
            textbook&apos;s normal price — the rest comes on top.
          </p>
          <div className="mt-5 space-y-2.5 text-left max-w-xs mx-auto">
            <Perk icon={BookOpen}>A printed textbook mailed to you</Perk>
            <Perk icon={Sparkles}>Your first month of Club included</Perk>
            <Perk icon={Lock}>This private VIP room during the challenge</Perk>
            <Perk icon={PlayCircle}>Replays of every live session</Perk>
          </div>
          <button
            onClick={startVipCheckout}
            disabled={checkoutLoading}
            className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px] disabled:opacity-60"
          >
            {checkoutLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Ticket className="w-4 h-4" /> Get the VIP ticket — $197 <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          {checkoutMsg && <p className="mt-3 text-sm text-soft">{checkoutMsg}</p>}
          {!vipEnabled && !checkoutMsg && (
            <p className="mt-3 text-[12px] text-soft">VIP tickets open soon.</p>
          )}
          <p className="mt-4 text-[12px] text-soft leading-relaxed flex items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            $197 today · includes your first month of Club · $99/mo after — we&apos;ll
            remind you 3 days before, cancel in one click. Education, not financial advice.
          </p>
        </div>
      </div>
    );
  }

  // ── VIP: the private room ────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-gold-700">
        <Lock className="w-4 h-4" />
        <span className="text-[11px] font-display font-bold uppercase tracking-wider">
          VIP Room · private
        </span>
      </div>
      <h1 className="font-display text-2xl font-bold text-ink mt-1">Welcome to the VIP room</h1>
      <p className="text-soft text-sm mt-2 leading-relaxed">
        A quieter space, just for VIP members, to ask questions and share what
        you&apos;re working on through the challenge. Your session replays land
        here after each live session — yours to rewatch anytime.
        {windowOpen
          ? " It's open now through the end of the challenge."
          : " The challenge window has closed — thanks for being here."}
      </p>

      {/* Composer */}
      <div className="paper-card p-4 mt-5">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Share a win, ask a question, or introduce yourself to the room…"
          className="w-full rounded-xl border border-sand bg-white/50 px-4 py-3 text-[15px] text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/20 transition-colors resize-none"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end mt-2">
          <button
            onClick={submit}
            disabled={posting || !draft.trim()}
            className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm disabled:opacity-50"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post to VIP room
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="mt-6 space-y-3">
        {posts.length === 0 && (
          <p className="text-center text-sm text-soft py-8">
            Be the first to say hi in the VIP room.
          </p>
        )}
        {posts.map((p) => (
          <div key={p.id} className="paper-card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-display font-semibold text-ink text-sm">
                {p.author?.display_name || "VIP member"}
              </span>
              <span className="text-[11px] text-soft">
                {new Date(p.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-[15px] text-ink leading-relaxed whitespace-pre-wrap">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-soft flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Education only — nothing here is financial advice.
      </p>
    </div>
  );
}

function Perk({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-7 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gold-700" />
      </span>
      <span className="text-[15px] text-ink leading-snug">{children}</span>
    </div>
  );
}
