"use client";

import { useEffect, useRef, useState } from "react";
import {
  Lock,
  Ticket,
  BookOpen,
  Sparkles,
  Loader2,
  Send,
  ShieldCheck,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import { DisplayHead, SectionRule } from "@/components/f0/parts";

/**
 * VIP Room (Lane C9) — a private, gated space for Challenge VIP ticket holders,
 * live through the challenge window (prep from purchase → Sept 6).
 *
 * VIP members see the private room (intro + feed + composer). Non-VIP members
 * (including anyone who followed a vip_upsell email link) see the VIP offer
 * instead, so this doubles as the in-app VIP upsell surface. All data flows
 * through the gated /api/challenge/vip-room routes.
 *
 * REBUILD NOTE (canvas): the gate (`vip`), the checkout call, the `vipEnabled`
 * and `windowOpen` flags and every word of the offer copy — the $197 price, the
 * four perks, the renewal terms — are preserved exactly. Only the surface
 * changed: the ringed card became a dark offer field over a hairline perk
 * ledger, and the post feed became a ruled ledger.
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-600" />
      </div>
    );
  }

  // ── Non-VIP: the upsell / offer surface ──────────────────────────────────
  if (!vip) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 pb-16">
        {/* The one dark object on this surface — the ticket itself. */}
        <div className="f0-hero-field f0-grain px-6 py-9 sm:px-8">
          <p className="text-eyebrow font-display font-bold uppercase text-volt-300">
            VIP ticket · optional
          </p>
          <h1 className="mt-3 font-display text-display-2 font-extrabold">
            The VIP Room is for VIP members
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-white/70">
            Your free challenge is complete on its own — this is an optional extra.
            The VIP ticket adds a printed textbook, your first month of Club, this
            private room, and replays of every live session. The $197 is just the
            textbook&apos;s normal price — the rest comes on top.
          </p>
        </div>

        <section className="mt-8">
          <SectionRule>What the ticket adds</SectionRule>
          <div className="f0-ledger mt-1">
            <Perk icon={BookOpen}>A printed textbook mailed to you</Perk>
            <Perk icon={Sparkles}>Your first month of Club included</Perk>
            <Perk icon={Lock}>This private VIP room during the challenge</Perk>
            <Perk icon={PlayCircle}>Replays of every live session</Perk>
          </div>
        </section>

        <button
          onClick={startVipCheckout}
          disabled={checkoutLoading}
          className="cta-button mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] disabled:opacity-60"
        >
          {checkoutLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Ticket className="h-4 w-4" /> Get the VIP ticket — $197{" "}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        {checkoutMsg && <p className="mt-3 text-sm text-soft">{checkoutMsg}</p>}
        {!vipEnabled && !checkoutMsg && (
          <p className="mt-3 text-[12px] text-soft">VIP tickets open soon.</p>
        )}
        <p className="mt-4 flex max-w-[60ch] items-start gap-1.5 text-[12px] leading-relaxed text-soft">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            $197 today · includes your first month of Club · $99/mo after — we&apos;ll
            remind you 3 days before, cancel in one click. Education, not financial advice.
          </span>
        </p>
      </div>
    );
  }

  // ── VIP: the private room ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-16">
      <DisplayHead
        eyebrow="VIP Room · private"
        title="Welcome to the VIP room"
        lede={
          "A quieter space, just for VIP members, to ask questions and share what you're working on through the challenge. Your session replays land here after each live session — yours to rewatch anytime." +
          (windowOpen
            ? " It's open now through the end of the challenge."
            : " The challenge window has closed — thanks for being here.")
        }
        aside={<Lock className="h-5 w-5 text-gold-600" />}
      />

      {/* Composer */}
      <div className="mt-8">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Share a win, ask a question, or introduce yourself to the room…"
          className="w-full resize-none rounded-xl border border-sand bg-card px-4 py-3 text-[15px] text-ink transition-colors placeholder:text-soft focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-400/20"
        />
        {/* COLOUR LAW: red belongs to price, so a form error signals in the
            action ramp + weight rather than turning red. */}
        {error && (
          <p className="mt-2 text-sm font-semibold text-gold-700">{error}</p>
        )}
        <div className="mt-2 flex justify-end">
          <button
            onClick={submit}
            disabled={posting || !draft.trim()}
            className="cta-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Post to VIP room
          </button>
        </div>
      </div>

      {/* Feed */}
      <section className="mt-9">
        <SectionRule>The room</SectionRule>
        {posts.length === 0 ? (
          <p className="py-8 text-sm text-soft">
            Be the first to say hi in the VIP room.
          </p>
        ) : (
          <div className="f0-ledger mt-1">
            {posts.map((p) => (
              <div key={p.id} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-display text-sm font-extrabold text-ink">
                    {p.author?.display_name || "VIP member"}
                  </span>
                  <span className="font-mono text-[11px] text-soft">
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 max-w-[64ch] whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="f0-rule-top mt-10 flex items-center gap-1.5 pt-5 text-xs text-soft">
        <ShieldCheck className="h-3.5 w-3.5" />
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
    <div className="f0-ledger-row">
      <Icon className="h-4 w-4 shrink-0 text-gold-700" />
      <span className="text-[15px] leading-snug text-ink">{children}</span>
    </div>
  );
}
