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

/**
 * VIP Room (Lane C9) — a private, gated space for Challenge VIP ticket holders,
 * live through the challenge window (prep from purchase → Sept 6).
 *
 * VIP members see the private room (intro + feed + composer). Non-VIP members
 * (including anyone who followed a vip_upsell email link) see the VIP offer
 * instead, so this doubles as the in-app VIP upsell surface. All data flows
 * through the gated /api/challenge/vip-room routes.
 *
 * THE GATE IS UNCHANGED. `vip` still comes from the server route and still
 * decides which of the two surfaces renders; the checkout call, the `vipEnabled`
 * and `windowOpen` flags are untouched. Nothing here reveals room content to a
 * non-VIP viewer — the posts are not even fetched into this branch.
 *
 * EVERY COMMERCIAL STRING IS BYTE-IDENTICAL to the version before this rebuild:
 * the $197 price, the four perks, the "$197 today · includes your first month of
 * Club · $99/mo after…" terms line, the "VIP tickets open soon." line and the
 * fallback checkout message. They were diffed word for word. Only the surface
 * changed.
 *
 * CANVAS v2: the offer is now a TICKET — a dark field with a torn hairline foot
 * and a mono stub, over a hairline perk ledger — rather than a ringed card. The
 * room itself is a display masthead over a ruled post ledger. No boxes.
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

  /* LOADING ≠ EMPTY (§0.4). A gated surface must not flash either branch, so
     the skeleton is deliberately neutral to both — it commits to nothing. */
  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 pb-16" aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-sand/60" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-sand/60" />
        <div className="f0-ledger mt-10 border-t border-sand/70">
          {[0, 1, 2].map((i) => (
            <div key={i} className="f0-ledger-row">
              <div className="h-4 w-full animate-pulse rounded bg-sand/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Non-VIP: the upsell / offer surface ──────────────────────────────────
  if (!vip) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 pb-16">
        {/* THE TICKET — the one dark object on this surface. */}
        <section className="f0-hero-field f0-grain px-6 py-9 sm:px-8">
          <div className="flex items-center gap-3">
            <Ticket className="h-4 w-4 opacity-70" aria-hidden />
            <p className="font-mono text-eyebrow font-semibold uppercase tracking-[0.18em] text-volt-300">
              VIP ticket · optional
            </p>
          </div>
          <h1 className="mt-3.5 font-display text-display-2 font-extrabold uppercase leading-[1.05]">
            The VIP Room is for VIP members
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed opacity-75">
            Your free challenge is complete on its own — this is an optional extra.
            The VIP ticket adds a printed textbook, your first month of Club, this
            private room, and replays of every live session. The $197 is just the
            textbook&apos;s normal price — the rest comes on top.
          </p>

          {/* The stub. A perforation rule + the price in the mono register —
              the ticket says its own price before the button does. */}
          <div className="mt-7 flex items-baseline justify-between gap-4 border-t border-dashed border-white/20 pt-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-55">
              Admit one · challenge window
            </span>
            <span className="font-display text-[26px] font-extrabold tabular-nums">$197</span>
          </div>
        </section>

        <section className="mt-9">
          <h2 className="f0-section-rule mb-1">
            <span className="text-eyebrow font-display font-bold uppercase text-soft">
              What the ticket adds
            </span>
          </h2>
          <div className="f0-ledger">
            <Perk icon={BookOpen}>A printed textbook mailed to you</Perk>
            <Perk icon={Sparkles}>Your first month of Club included</Perk>
            <Perk icon={Lock}>This private VIP room during the challenge</Perk>
            <Perk icon={PlayCircle}>Replays of every live session</Perk>
          </div>
        </section>

        <button
          onClick={startVipCheckout}
          disabled={checkoutLoading}
          className="f0-focus f0-press mt-9 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-night-950 disabled:opacity-60"
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
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            VIP Room · private
          </p>
          <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
            Welcome to the <span className="f0-underline-mark">VIP</span> room
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
            {"A quieter space, just for VIP members, to ask questions and share what you're working on through the challenge. Your session replays land here after each live session — yours to rewatch anytime." +
              (windowOpen
                ? " It's open now through the end of the challenge."
                : " The challenge window has closed — thanks for being here.")}
          </p>
        </div>
        <Lock className="mt-1 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
      </header>

      {/* Composer */}
      <div className="mt-9">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Share a win, ask a question, or introduce yourself to the room…"
          className="f0-focus f0-frame w-full resize-none rounded-xl bg-transparent px-4 py-3 text-[15px] text-ink transition-colors placeholder:text-soft focus:outline-none"
        />
        {/* COLOUR LAW: red belongs to price, so a form error signals in the
            action ramp + weight rather than turning red. */}
        {error && (
          <p className="mt-2 text-sm font-semibold text-gold-700">{error}</p>
        )}
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={submit}
            disabled={posting || !draft.trim()}
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-night-950 disabled:opacity-50"
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
      <section className="mt-10">
        <h2 className="f0-section-rule mb-1">
          <span className="text-eyebrow font-display font-bold uppercase text-soft">
            The room
          </span>
        </h2>
        {posts.length === 0 ? (
          /* FOUNDING STATE (§0.5) — on day one the room genuinely is empty.
             That is the truth and it is an invitation, not an error. */
          <div className="mt-4 border-l-2 border-sand py-1 pl-4">
            <p className="font-display text-display-3 font-extrabold text-ink">
              Nobody has posted yet
            </p>
            <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">
              Be the first to say hi in the VIP room. It is a small room by
              design — the first message sets the tone for everyone who follows.
            </p>
          </div>
        ) : (
          <div className="f0-ledger f0-stagger">
            {posts.map((p, i) => (
              <div key={p.id} className="py-5" style={{ ["--i" as string]: Math.min(i, 12) }}>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">
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
      <Icon className="h-4 w-4 shrink-0 self-center text-gold-700" />
      <span className="text-[15px] leading-snug text-ink">{children}</span>
    </div>
  );
}
