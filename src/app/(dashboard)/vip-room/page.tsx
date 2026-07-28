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
import { BoardSection } from "@/components/clubhome/board";
import { DisplayHead } from "@/components/f0/parts";

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
 * CANVAS v2 (board rebuild): the offer was a dark ticket field over a hairline
 * perk ledger. It is now the reference board's PRICING CARD — the one warm
 * tinted object on the screen (`.club-b-warm`), carrying the stub line, the
 * price in the display register, the feature list, and a full-width solid orange
 * button, exactly as board 11 draws a commercial card. The room itself is the
 * board's white card language: a `.club-b-card` composer over `.club-b-card`
 * posts under a `BoardSection` mark. No hairline ledgers, no dark island — this
 * is a paper surface, and the board reserves the dark field for live moments.
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
     the skeleton is deliberately neutral to both — it commits to nothing. It is
     shaped like the card the surface becomes, not like either outcome. */
  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 pb-16" aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-sand/60" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-sand/60" />
        <div className="club-b-card mt-9 space-y-3 px-5 py-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-3.5 w-full animate-pulse rounded-full bg-sand/50"
            />
          ))}
        </div>
        <span className="sr-only">Loading the VIP room</span>
      </div>
    );
  }

  // ── Non-VIP: the upsell / offer surface ──────────────────────────────────
  if (!vip) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 pb-16">
        <DisplayHead
          eyebrow="VIP ticket · optional"
          title="The VIP Room is for VIP members"
          lede={
            <>
              Your free challenge is complete on its own — this is an optional extra.
              The VIP ticket adds a printed textbook, your first month of Club, this
              private room, and replays of every live session. The $197 is just the
              textbook&apos;s normal price — the rest comes on top.
            </>
          }
        />

        {/* THE PRICING CARD — the one warm object on this surface. */}
        <section className="club-b-warm f0-grain mt-8 px-5 py-6 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
              Admit one · challenge window
            </span>
            <span className="font-display text-[34px] font-extrabold leading-none tabular-nums text-ink">
              $197
            </span>
          </div>

          <div className="mt-5 border-t border-sand/70 pt-5">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              What the ticket <span className="text-accent">adds</span>
            </p>
            <ul className="mt-3 space-y-2.5">
              <Perk icon={BookOpen}>A printed textbook mailed to you</Perk>
              <Perk icon={Sparkles}>Your first month of Club included</Perk>
              <Perk icon={Lock}>This private VIP room during the challenge</Perk>
              <Perk icon={PlayCircle}>Replays of every live session</Perk>
            </ul>
          </div>

          <button
            onClick={startVipCheckout}
            disabled={checkoutLoading}
            className="f0-focus f0-press mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-display text-[14.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)] disabled:opacity-60"
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
        </section>

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
      {/* Hand-composed rather than `DisplayHead`, and only for this reason:
          DisplayHead's `mark` is appended AFTER the title, and this heading's
          marked word sits mid-sentence ("Welcome to the VIP room"). Same
          eyebrow / display-1 / lede registers, same classes — the shared
          masthead is used verbatim on the offer branch above. */}
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
        <Lock className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
      </header>

      {/* Composer */}
      <div className="mt-9">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Share a win, ask a question, or introduce yourself to the room…"
          className="club-b-card f0-focus w-full resize-none px-4 py-3 text-[15px] text-ink transition-colors placeholder:text-soft focus:outline-none"
        />
        {/* COLOUR LAW: red belongs to price, so a form error signals in the
            action ramp + weight rather than turning red. */}
        {error && (
          <p className="mt-2 text-sm font-semibold text-accent">{error}</p>
        )}
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={submit}
            disabled={posting || !draft.trim()}
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)] disabled:opacity-50"
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

      <div className="mt-10">
        <BoardSection id="vip-room-feed" label="The" mark="room">
          {posts.length === 0 ? (
            /* FOUNDING STATE (§0.5) — on day one the room genuinely is empty.
               That is the truth and it is an invitation, not an error. */
            <div className="club-b-card mt-3 px-4 py-4">
              <p className="font-display text-[16px] font-extrabold uppercase leading-[1.15] text-ink">
                Nobody has posted yet
              </p>
              <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
                Be the first to say hi in the VIP room. It is a small room by
                design — the first message sets the tone for everyone who follows.
              </p>
            </div>
          ) : (
            <div className="f0-stagger mt-3 flex flex-col gap-[7px]">
              {posts.map((p, i) => (
                <article
                  key={p.id}
                  className="club-b-card px-4 py-3.5"
                  style={{ ["--i" as string]: Math.min(i, 12) }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="font-display text-[14px] font-extrabold text-ink">
                      {p.author?.display_name || "VIP member"}
                    </span>
                    <span className="font-mono text-[10.5px] text-soft">
                      {new Date(p.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[64ch] whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                    {p.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </BoardSection>
      </div>

      <p className="mt-10 flex items-center gap-1.5 border-t border-sand pt-5 text-xs text-soft">
        <ShieldCheck className="h-3.5 w-3.5" />
        Education only — nothing here is financial advice.
      </p>
    </div>
  );
}

/** One line of the pricing card's feature list. */
function Perk({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-[2px] h-4 w-4 shrink-0 text-accent" />
      <span className="text-[13.5px] leading-snug text-ink">{children}</span>
    </li>
  );
}
