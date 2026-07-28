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
import { BoardSection } from "@/components/clubhome/board";
import {
  FunnelPage,
  TopBar,
  Mast,
  Card,
  CardMark,
  WarmCard,
  Pill,
  IconLine,
  Action,
  Terms,
  Spinner,
} from "@/components/free-class/ui";

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
 *
 * DRAWN AS: board 01's card language, with the board's section marks carrying
 * the hierarchy instead of a stack of ringed panels. Every neutral object is a
 * white hairline card; the referral loop and the VIP ticket are the two
 * brand-tinted cards, and the VIP badge hangs off the card's top edge exactly
 * as the pricing board's "BEST VALUE" tab does. Nothing here is green, amber or
 * sky: success, timing and scarcity are not price, so the only chromatic thing
 * on the page is the accent. Every commercial string — the VIP price, the
 * monthly price, the terms — is the one that shipped, character for character.
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

  /* The three beats of the run-up. `tone` is the PILL's weight, not a
     semantic colour: the kickoff is the loud one, so it takes the accent
     fill; the rest are hairlines. */
  const timeline: {
    when: string;
    title: string;
    body: string;
    tone: "quiet" | "accent" | "solid";
  }[] = [
    {
      when: "Today",
      title: "Your Club is open — explore now",
      body: "Full access is already live: the tools, Kai, the community, live classes. Look around, no waiting.",
      tone: "accent",
    },
    {
      when: "August",
      title: "Weekly warm-up guides",
      body: "We'll send short, friendly guides each week so you walk into Day 1 already comfortable.",
      tone: "quiet",
    },
    {
      when: "Sept 1",
      title: "The challenge begins — live",
      body: "Five live sessions, one each morning at 9:30 AM ET. We do it together in the room — and if you can't make it live, the replay's waiting in the Club.",
      tone: "solid",
    },
  ];

  return (
    <FunnelPage>
      <TopBar />
      <div className="mx-auto w-full max-w-lg px-5 py-8 sm:py-12">
        {/* Celebration */}
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex justify-center">
            <CardMark icon={PartyPopper} size={56} round />
          </div>
          <Mast
            eyebrow={
              <>
                <Sparkles className="h-3 w-3" /> You&apos;re in the challenge
              </>
            }
            title={
              <>
                You&apos;re in{firstName ? `, ${firstName}` : ""} — the Club is yours
                starting now.
              </>
            }
            lede={
              <>
                Free, no card, and your account is already open. The challenge kicks
                off <span className="font-semibold text-ink">Sept 1</span> — but you
                don&apos;t have to wait to start looking around.
              </>
            }
          />
        </m.div>

        {/* Family Mode — kids-subaccount setup prompt (Lane C9). Shown only when
            step-1 said kids are learning too; solo ("Just me") sees nothing. */}
        {hasKids && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mt-7"
          >
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <CardMark icon={Baby} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                    Family Mode is on
                  </p>
                  <h2 className="mt-1 font-display text-[1.0625rem] font-extrabold leading-snug tracking-[-0.015em] text-ink">
                    Set up a login for each kid
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-soft">
                    You told us the kids are learning too — so your account is in
                    Family Mode. Give each child their own safe, kid-friendly login
                    and you can all do the challenge together.
                  </p>
                  <div className="mt-4 sm:max-w-[16rem]">
                    <Action href="/family" external size="md">
                      <Baby className="h-4 w-4" /> Set up my kids{" "}
                      <ArrowRight className="h-4 w-4" />
                    </Action>
                  </div>
                </div>
              </div>
            </Card>
          </m.div>
        )}

        {/* What happens next */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-8"
        >
          <BoardSection id="challenge-next" label="What happens" mark="next">
            <Card className="mt-3 space-y-4 p-5">
              {timeline.map((t) => (
                <div key={t.when} className="flex gap-3">
                  <div className="flex shrink-0 flex-col items-center">
                    <Pill tone={t.tone} className="min-w-[68px] justify-center">
                      {t.when}
                    </Pill>
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-[15px] font-bold leading-snug text-ink">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-soft">
                      {t.body}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          </BoardSection>
        </m.div>

        {/* Referral share loop */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-7"
        >
          <WarmCard>
            <div className="px-6 py-6">
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <CardMark icon={Users} size={48} round />
                </div>
                <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
                  Challenges are better with friends
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-soft">
                  Bring someone along — send your link and do the five days together.
                  When they join, it&apos;s credited to you.
                </p>
              </div>

              {/* Link + copy */}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="club-b-card min-w-0 flex-1 px-4 py-3">
                  <p className="truncate font-mono text-[13px] text-ink" title={link}>
                    {link || "Preparing your link…"}
                  </p>
                </div>
                <div className="shrink-0 sm:w-auto">
                  <Action onClick={copyLink} disabled={!link} size="md" full={false} className="w-full sm:w-auto">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy link
                      </>
                    )}
                  </Action>
                </div>
              </div>

              {/* Share buttons */}
              {targets && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {canNativeShare && (
                    <button
                      onClick={nativeShare}
                      className="f0-press f0-focus inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 font-display text-[13px] font-bold text-[color:var(--accent-on)] transition-opacity hover:opacity-90"
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                  )}
                  <ShareLink href={targets.whatsapp} label="WhatsApp">
                    <MessageCircle className="h-4 w-4" />
                  </ShareLink>
                  <ShareLink href={targets.x} label="X">
                    <XGlyph />
                  </ShareLink>
                  <ShareLink href={targets.facebook} label="Facebook">
                    <FacebookGlyph />
                  </ShareLink>
                  <ShareLink href={targets.mailto} label="Email">
                    <Mail className="h-4 w-4" />
                  </ShareLink>
                  <ShareLink href={targets.sms} label="Text">
                    <MessageCircle className="h-4 w-4" />
                  </ShareLink>
                </div>
              )}
            </div>
          </WarmCard>
        </m.div>

        {/* Commitment step — post your intro in the community NOW (the third
            activation leg, alongside referral + calendar). Research-backed: a
            public micro-commitment on day zero lifts follow-through. */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-6"
        >
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <CardMark icon={PenLine} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Take 60 seconds now
                </p>
                <h2 className="mt-1 font-display text-[1.0625rem] font-extrabold leading-snug tracking-[-0.015em] text-ink">
                  Post your intro in the community
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-soft">
                  Introduce yourself — solo, with a partner, a friend, or the whole
                  family, whoever you&apos;re doing this with — and name one money
                  habit you want to build by Day 5. No experience needed; we learn
                  together. People who say hi on day one are far more likely to
                  finish.
                </p>
                <div className="mt-4 sm:max-w-[16rem]">
                  <Action href={INTRO_HREF} external size="md">
                    <PenLine className="h-4 w-4" /> Write my intro{" "}
                    <ArrowRight className="h-4 w-4" />
                  </Action>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-soft">
                  We&apos;ll open the composer with a friendly starter — just fill
                  in the blanks and post.
                </p>
              </div>
            </div>
          </Card>
        </m.div>

        {/* Calendar add */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-6"
        >
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <CardMark icon={CalendarDays} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Don&apos;t miss a session
                </p>
                <h2 className="mt-1 font-display text-[1.0625rem] font-extrabold leading-snug tracking-[-0.015em] text-ink">
                  Add the live sessions to your calendar
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-soft">
                  Five live sessions, Sept 1&ndash;5 at 9:30 AM ET each morning —
                  one reminder for every day we meet in the room.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Action tone="quiet" size="sm" full={false} onClick={() => downloadChallengeIcs(true)}>
                    <CalendarPlus className="h-3.5 w-3.5" /> Add all 5 sessions
                  </Action>
                  <Action tone="quiet" size="sm" full={false} onClick={() => downloadChallengeIcs(false)}>
                    <CalendarPlus className="h-3.5 w-3.5" /> Just Day 1
                  </Action>
                </div>
              </div>
            </div>
          </Card>
        </m.div>

        {/* VIP ticket (Lane C9) — non-blocking, below calendar + referral. If
            they already bought VIP, this is a confirmation; otherwise a single,
            honest upsell that never implies the free challenge is incomplete.
            The brand-tinted card is reserved for the two states that are an
            OFFER or a confirmed purchase; the quiet, non-intent upsell sits on
            a neutral card so the page has one loud object, not three. */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-6"
        >
          {isVip ? (
            <WarmCard
              badge={
                <>
                  <Ticket className="h-3 w-3" /> You&apos;re VIP
                </>
              }
            >
              <div className="px-6 pb-6 pt-5">
                <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
                  Your textbook is on the way
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-soft">
                  Your printed textbook is being prepared and will ship to the
                  address you entered — we&apos;ll email tracking when it&apos;s on
                  the way. Your first month of Club is already included, your private
                  VIP room is open, and replays of every live session land there
                  after each evening.
                </p>
                <div className="mt-4">
                  <Action href="/vip-room" external size="md">
                    <Lock className="h-4 w-4" /> Enter your VIP room{" "}
                    <ArrowRight className="h-4 w-4" />
                  </Action>
                </div>
                <div className="mt-3">
                  <Terms icon={ShieldCheck} align="left">
                    First month included in your $197 · $99/mo after · we&apos;ll
                    remind you 3 days before · cancel in one click.
                  </Terms>
                </div>
              </div>
            </WarmCard>
          ) : vipIntent ? (
            <WarmCard
              badge={
                <>
                  <Ticket className="h-3 w-3" /> Optional · VIP ticket
                </>
              }
            >
              <div className="px-6 pb-6 pt-5">
                <VipOffer
                  vipLoading={vipLoading}
                  vipMsg={vipMsg}
                  vipEnabled={vipEnabled}
                  onCheckout={startVipCheckout}
                />
              </div>
            </WarmCard>
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-2 text-accent">
                <Ticket className="h-5 w-5" />
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em]">
                  Optional · VIP ticket
                </p>
              </div>
              <div className="mt-1">
                <VipOffer
                  vipLoading={vipLoading}
                  vipMsg={vipMsg}
                  vipEnabled={vipEnabled}
                  onCheckout={startVipCheckout}
                />
              </div>
            </Card>
          )}
        </m.div>

        {/* Immediate-activation CTAs */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <Card className="p-6 text-center">
            <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
              Start now — you already have full access
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-soft">
              The best way to be ready for Day 1 is to poke around today. Pick one:
            </p>
            <div className="mt-5">
              <Action onClick={onExplore}>
                <Compass className="h-4 w-4" /> Step inside the Club{" "}
                <ArrowRight className="h-4 w-4" />
              </Action>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          </Card>
        </m.div>

        <div className="mx-auto mt-8 max-w-sm">
          <Terms icon={ShieldCheck}>
            Education only — nothing here is financial advice. Practice money
            always.
          </Terms>
        </div>
      </div>
    </FunnelPage>
  );
}

// ── VIP offer body ───────────────────────────────────────────────────────────
// One body, two hosts (the brand-tinted card when the visitor arrived on the VIP
// CTA, the neutral card otherwise) so the commercial copy exists exactly once.
function VipOffer({
  vipLoading,
  vipMsg,
  vipEnabled,
  onCheckout,
}: {
  vipLoading: boolean;
  vipMsg: string | null;
  vipEnabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div>
      <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
        Want the textbook version?
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-soft">
        Your free challenge is complete on its own — nothing is held back.
        The VIP ticket just adds a few extras for people who like them:
      </p>
      <div className="mt-4 space-y-2.5">
        <IconLine icon={BookOpen}>
          A printed textbook mailed to you
        </IconLine>
        <IconLine icon={Sparkles}>
          Your first month of Club included
        </IconLine>
        <IconLine icon={Lock}>
          A private VIP room during the challenge
        </IconLine>
        <IconLine icon={PlayCircle}>
          Replays of every live session
        </IconLine>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-soft">
        The <span className="font-semibold text-ink">$197</span> is just the
        textbook&apos;s normal price — the Club month, VIP room, and replays
        come on top.
      </p>
      <div className="mt-5">
        <Action onClick={onCheckout} disabled={vipLoading}>
          {vipLoading ? (
            <Spinner />
          ) : (
            <>
              <Ticket className="h-4 w-4" /> Get the VIP ticket — $197{" "}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Action>
      </div>
      {vipMsg && (
        <p className="mt-3 text-center text-[14px] text-soft">{vipMsg}</p>
      )}
      {!vipEnabled && !vipMsg && (
        <p className="mt-3 text-center text-[12px] text-soft">
          VIP tickets open soon — grab your free spot now and you&apos;ll
          be first to know.
        </p>
      )}
      <div className="mt-3">
        <Terms icon={ShieldCheck} align="left">
          $197 today · includes your first month of Club · $99/mo after —
          we&apos;ll remind you 3 days before, cancel in one click. Education,
          not financial advice.
        </Terms>
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
      className="f0-press f0-focus club-b-card inline-flex items-center justify-center gap-2 px-4 py-2.5 font-display text-[13.5px] font-bold text-ink transition-colors hover:text-accent"
    >
      <Icon className="h-4 w-4 text-accent" />
      {children}
    </a>
  );
}

// ── Share button ─────────────────────────────────────────────────────────────
// Uniform hairline card chips. The old set painted each network in its own
// brand colour, which put green, sky and amber on a surface where green is the
// PRICE colour by law. The glyph carries the identity; the chip stays neutral.
function ShareLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="f0-press f0-focus inline-flex items-center gap-2 rounded-full border border-sand bg-card px-4 py-2.5 font-display text-[13px] font-bold text-ink transition-colors hover:border-[color:var(--accent-solid)]"
    >
      {children}
      {label}
    </a>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
