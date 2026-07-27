"use client";

import { useEffect, useMemo, useState } from "react";
import { m } from "@/lib/motion";
import {
  PartyPopper,
  CalendarPlus,
  CalendarDays,
  ShieldCheck,
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
  Users,
  Sparkles,
  Compass,
  Bot,
  LineChart,
  ArrowRight,
  PenLine,
  Ticket,
  BookOpen,
  Lock,
  Loader2,
  Baby,
  PlayCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadChallengeIcs } from "@/lib/free-class";
import {
  referralLink,
  shareTargets,
  CHALLENGE_SHARE_MESSAGE,
} from "@/lib/referral";
import { TopBar } from "@/components/free-class/ui";

/**
 * 5-Day Investing Challenge — post-registration thank-you (Lane C7).
 *
 * Reached right after a challenge signup (register route pushes here). The
 * account already has full Club access, so this page is a celebration +
 * activation surface, not a "see you Sept 1" holding page:
 *   1. Celebration — "You're in — the Club is yours starting now."
 *   2. What-happens-next timeline (today → August → Sept 1).
 *   3. Referral share loop (challenge-framed) — the highest-leverage viral step.
 *   4. Calendar add (.ics: Sept 1 kickoff + the 5 daily missions).
 *   5. Immediate-activation CTAs (explore / tour / add a stock / Ask Kai).
 *
 * Compliance floor: education-not-advice, capability language only, zero
 * income / return / performance promises anywhere.
 */

/**
 * Prefilled intro post the "commitment step" deep-links into. The community
 * composer reads `?compose=` and seeds the textarea with this. Copy flexes for
 * solo / couple / friends / family — nobody is assumed to be a parent.
 */
const INTRO_TEMPLATE =
  "Hi everyone — just joined the 5-Day Investing Challenge! 👋 A bit about me (or my family / crew): \n\nOne money habit I want to build by Day 5: ";
const INTRO_HREF = `/community?compose=${encodeURIComponent(INTRO_TEMPLATE)}`;
export default function ChallengeThankYou({
  firstName,
  ages = null,
  isVip = false,
  vipIntent = false,
  vipEnabled = false,
  onExplore,
}: {
  firstName: string;
  /** Step-1 "who's learning with you" answer — drives Family Mode surfacing. */
  ages?: string | null;
  /** Family already holds a paid VIP ticket → show confirmation, not upsell. */
  isVip?: boolean;
  /** Arrived via the VIP CTA (?vip=1) → lead with the VIP offer. */
  vipIntent?: boolean;
  /** Live VIP checkout path is open (app_settings gate). */
  vipEnabled?: boolean;
  onExplore: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [origin, setOrigin] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [vipLoading, setVipLoading] = useState(false);
  const [vipMsg, setVipMsg] = useState<string | null>(null);

  // Family Mode surfacing: kids in the step-1 answer → this is a family; show
  // the kids-subaccount setup prompt. 'adults' (Just me) → solo, no prompt.
  const hasKids = ages === "young" || ages === "teens" || ages === "mixed";

  async function startVipCheckout() {
    setVipMsg(null);
    setVipLoading(true);
    try {
      const res = await fetch("/api/challenge/vip-checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url as string;
        return;
      }
      setVipMsg(
        data?.message || "VIP tickets aren't open just yet — we'll email you the moment they are."
      );
    } catch {
      setVipMsg("Something went wrong opening checkout. Please try again in a moment.");
    } finally {
      setVipLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
    // Mint (or fetch) the permanent referral code — parent-gated, server-side.
    // Challenge registrants are always provisioned as parents, so this resolves.
    supabase
      .rpc("get_or_create_referral_code")
      .then(
        ({ data }) => setCode((data as string) ?? null),
        () => {}
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = useMemo(
    () => (code && origin ? referralLink(origin, code) : ""),
    [code, origin]
  );
  const targets = useMemo(
    () => (link ? shareTargets(link, CHALLENGE_SHARE_MESSAGE) : null),
    [link]
  );

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is still selectable */
    }
  }

  async function nativeShare() {
    if (!link || !targets) return;
    try {
      await navigator.share({
        title: "5-Day Investing Challenge",
        text: targets.message,
        url: link,
      });
    } catch {
      /* dismissed */
    }
  }

  const timeline = [
    {
      when: "Today",
      title: "Your Club is open — explore now",
      body: "Full access is already live: the tools, Kai, the community, live classes. Look around, no waiting.",
      tone: "bg-chip-green text-green-700",
    },
    {
      when: "August",
      title: "Weekly warm-up guides",
      body: "We'll send short, friendly guides each week so you walk into Day 1 already comfortable.",
      tone: "bg-chip-sky text-sky-800",
    },
    {
      when: "Sept 1",
      title: "The challenge begins — live",
      body: "Five live sessions, one each morning at 9:30 AM ET. We do it together in the room — and if you can't make it live, the replay's waiting in the Club.",
      tone: "bg-chip-amber text-gold-800",
    },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <TopBar />
      <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
        {/* Celebration */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-chip-green flex items-center justify-center mb-4">
            <PartyPopper className="w-7 h-7 text-green-600" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-3">
            <Sparkles className="w-3 h-3" /> You&apos;re in the challenge
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
            You&apos;re in{firstName ? `, ${firstName}` : ""} — the Club is yours
            starting now.
          </h1>
          <p className="text-soft text-sm mt-2.5 max-w-sm mx-auto leading-relaxed">
            Free, no card, and your account is already open. The challenge kicks
            off <span className="font-semibold text-ink">Sept 1</span> — but you
            don&apos;t have to wait to start looking around.
          </p>
        </m.div>

        {/* Family Mode — kids-subaccount setup prompt (Lane C9). Shown only when
            step-1 said kids are learning too; solo ("Just me") sees nothing. */}
        {hasKids && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="paper-card ring-1 ring-gold-300 p-6 mt-7"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
                <Baby className="w-6 h-6 text-gold-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                  Family Mode is on
                </p>
                <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                  Set up a login for each kid
                </h2>
                <p className="text-sm text-soft mt-1.5 leading-relaxed">
                  You told us the kids are learning too — so your account is in
                  Family Mode. Give each child their own safe, kid-friendly login
                  and you can all do the challenge together.
                </p>
                <a
                  href="/family"
                  className="cta-button mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm"
                >
                  <Baby className="w-4 h-4" /> Set up my kids{" "}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </m.div>
        )}

        {/* What happens next */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="paper-card p-5 mt-7"
        >
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700 mb-4">
            What happens next
          </p>
          <div className="space-y-4">
            {timeline.map((t) => (
              <div key={t.when} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className={`inline-flex items-center justify-center min-w-[64px] px-2 py-1 rounded-lg text-[11px] font-display font-bold ${t.tone}`}
                  >
                    {t.when}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink text-[15px] leading-snug">
                    {t.title}
                  </p>
                  <p className="text-sm text-soft leading-relaxed mt-0.5">
                    {t.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </m.div>

        {/* Referral share loop */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="paper-card ring-2 ring-gold-400 p-6 mt-6"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-ink">
              Challenges are better with friends
            </h3>
            <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              Bring someone along — send your link and do the five days together.
              When they join, it&apos;s credited to you.
            </p>
          </div>

          {/* Link + copy */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 min-w-0 rounded-xl border border-sand bg-card px-4 py-3">
              <p className="truncate font-mono text-sm text-ink" title={link}>
                {link || "Preparing your link…"}
              </p>
            </div>
            <button
              onClick={copyLink}
              disabled={!link}
              className="cta-button inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm shrink-0 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy link
                </>
              )}
            </button>
          </div>

          {/* Share buttons */}
          {targets && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {canNativeShare && (
                <button
                  onClick={nativeShare}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-night-950 text-sm font-semibold hover:bg-gold-600 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              )}
              <ShareLink href={targets.whatsapp} label="WhatsApp" tone="green">
                <MessageCircle className="w-4 h-4" />
              </ShareLink>
              <ShareLink href={targets.x} label="X" tone="ink">
                <XGlyph />
              </ShareLink>
              <ShareLink href={targets.facebook} label="Facebook" tone="sky">
                <FacebookGlyph />
              </ShareLink>
              <ShareLink href={targets.mailto} label="Email" tone="sand">
                <Mail className="w-4 h-4" />
              </ShareLink>
              <ShareLink href={targets.sms} label="Text" tone="sand">
                <MessageCircle className="w-4 h-4" />
              </ShareLink>
            </div>
          )}
        </m.div>

        {/* Commitment step — post your intro in the community NOW (the third
            activation leg, alongside referral + calendar). Research-backed: a
            public micro-commitment on day zero lifts follow-through. */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="paper-card ring-1 ring-gold-300 p-6 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <PenLine className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                Take 60 seconds now
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                Post your intro in the community
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed">
                Introduce yourself — solo, with a partner, a friend, or the whole
                family, whoever you&apos;re doing this with — and name one money
                habit you want to build by Day 5. No experience needed; we learn
                together. People who say hi on day one are far more likely to
                finish.
              </p>
              <a
                href={INTRO_HREF}
                className="cta-button mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm"
              >
                <PenLine className="w-4 h-4" /> Write my intro{" "}
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="text-[12px] text-soft mt-2.5 leading-relaxed">
                We&apos;ll open the composer with a friendly starter — just fill
                in the blanks and post.
              </p>
            </div>
          </div>
        </m.div>

        {/* Calendar add */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="paper-card p-5 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                Don&apos;t miss a session
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                Add the live sessions to your calendar
              </h2>
              <p className="text-sm text-soft mt-1 leading-relaxed">
                Five live sessions, Sept 1&ndash;5 at 9:30 AM ET each morning —
                one reminder for every day we meet in the room.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <button
                  onClick={() => downloadChallengeIcs(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-card transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Add all 5 sessions
                </button>
                <button
                  onClick={() => downloadChallengeIcs(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-card transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Just Day 1
                </button>
              </div>
            </div>
          </div>
        </m.div>

        {/* VIP ticket (Lane C9) — non-blocking, below calendar + referral. If
            they already bought VIP, this is a confirmation; otherwise a single,
            honest upsell that never implies the free challenge is incomplete. */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className={`paper-card p-6 mt-6 ${
            isVip ? "ring-2 ring-gold-400" : vipIntent ? "ring-2 ring-gold-400" : "ring-1 ring-sand"
          }`}
        >
          {isVip ? (
            <div>
              <div className="flex items-center gap-2 text-gold-700">
                <Ticket className="w-5 h-5" />
                <p className="text-[11px] font-display font-bold uppercase tracking-wider">
                  You&apos;re VIP
                </p>
              </div>
              <h3 className="font-display text-xl font-bold text-ink mt-1">
                Your textbook is on the way
              </h3>
              <p className="text-soft text-sm mt-2 leading-relaxed">
                Your printed textbook is being prepared and will ship to the
                address you entered — we&apos;ll email tracking when it&apos;s on
                the way. Your first month of Club is already included, your private
                VIP room is open, and replays of every live session land there
                after each evening.
              </p>
              <a
                href="/vip-room"
                className="cta-button mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm"
              >
                <Lock className="w-4 h-4" /> Enter your VIP room{" "}
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="mt-3 text-[12px] text-soft leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                First month included in your $197 · $99/mo after · we&apos;ll
                remind you 3 days before · cancel in one click.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-gold-700">
                <Ticket className="w-5 h-5" />
                <p className="text-[11px] font-display font-bold uppercase tracking-wider">
                  Optional · VIP ticket
                </p>
              </div>
              <h3 className="font-display text-xl font-bold text-ink mt-1">
                Want the textbook version?
              </h3>
              <p className="text-soft text-sm mt-2 leading-relaxed">
                Your free challenge is complete on its own — nothing is held back.
                The VIP ticket just adds a few extras for people who like them:
              </p>
              <div className="mt-4 space-y-2.5">
                <VipPerk icon={BookOpen}>
                  A printed textbook mailed to you
                </VipPerk>
                <VipPerk icon={Sparkles}>
                  Your first month of Club included
                </VipPerk>
                <VipPerk icon={Lock}>
                  A private VIP room during the challenge
                </VipPerk>
                <VipPerk icon={PlayCircle}>
                  Replays of every live session
                </VipPerk>
              </div>
              <p className="mt-3 text-[13px] text-soft leading-relaxed">
                The <span className="font-semibold text-ink">$197</span> is just the
                textbook&apos;s normal price — the Club month, VIP room, and replays
                come on top.
              </p>
              <button
                onClick={startVipCheckout}
                disabled={vipLoading}
                className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px] disabled:opacity-60"
              >
                {vipLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ticket className="w-4 h-4" /> Get the VIP ticket — $197{" "}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {vipMsg && (
                <p className="mt-3 text-sm text-soft text-center">{vipMsg}</p>
              )}
              {!vipEnabled && !vipMsg && (
                <p className="mt-3 text-[12px] text-soft text-center">
                  VIP tickets open soon — grab your free spot now and you&apos;ll
                  be first to know.
                </p>
              )}
              <p className="mt-3 text-[12px] text-soft leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                $197 today · includes your first month of Club · $99/mo after —
                we&apos;ll remind you 3 days before, cancel in one click. Education,
                not financial advice.
              </p>
            </div>
          )}
        </m.div>

        {/* Immediate-activation CTAs */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="paper-card p-6 mt-6 text-center"
        >
          <h3 className="font-display text-xl font-bold text-ink">
            Start now — you already have full access
          </h3>
          <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            The best way to be ready for Day 1 is to poke around today. Pick one:
          </p>
          <button
            onClick={onExplore}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
          >
            <Compass className="w-4 h-4" /> Step inside the Club{" "}
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ActivationLink href="/dashboard?tour=1" icon={Compass}>
              Take the 60-second tour
            </ActivationLink>
            <ActivationLink href="/watchlist" icon={LineChart}>
              Add your first stock
            </ActivationLink>
            <ActivationLink href="/kai" icon={Bot}>
              Ask Kai a question
            </ActivationLink>
            <ActivationLink href="/community" icon={Users}>
              Say hi to the community
            </ActivationLink>
          </div>
        </m.div>

        <p className="mt-8 text-center text-xs text-soft max-w-sm mx-auto leading-relaxed flex items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Education only — nothing here is financial advice. Practice money
          always.
        </p>
      </div>
    </div>
  );
}

// ── Activation link ──────────────────────────────────────────────────────────
function ActivationLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-card transition-colors"
    >
      <Icon className="w-4 h-4 text-gold-600" />
      {children}
    </a>
  );
}

// ── VIP perk row ─────────────────────────────────────────────────────────────
function VipPerk({
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

// ── Share button (mirrors the referrals page) ────────────────────────────────
const TONES: Record<string, string> = {
  green: "bg-chip-green text-green-700 hover:bg-green-100",
  sky: "bg-chip-sky text-sky-800 hover:bg-sky-100",
  amber: "bg-chip-amber text-gold-800 hover:bg-gold-100",
  ink: "bg-ink text-white hover:opacity-90",
  sand: "bg-sand text-ink hover:bg-[#E0D6BE]",
};

function ShareLink({
  href,
  label,
  tone,
  children,
}: {
  href: string;
  label: string;
  tone: keyof typeof TONES | string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${TONES[tone] || TONES.sand}`}
    >
      {children}
      {label}
    </a>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
