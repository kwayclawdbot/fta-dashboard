"use client";

import { useMemo, useState } from "react";
import { m } from "@/lib/motion";
import {
  PartyPopper,
  Ticket,
  BookOpen,
  Lock,
  ShieldCheck,
  CalendarPlus,
  CalendarDays,
  ArrowRight,
  LogIn,
  KeyRound,
  Users,
  Share2,
  MessageCircle,
  Mail,
  Sparkles,
} from "lucide-react";
import { TopBar } from "@/components/free-class/ui";
import {
  downloadChallengeIcs,
  CHALLENGE_SESSION_TIME_LABEL,
  CHALLENGE_DATES_LABEL,
} from "@/lib/free-class";
import { shareTargets, CHALLENGE_SHARE_MESSAGE } from "@/lib/referral";

/**
 * VIP thank-you — the post-checkout surface for a $197 VIP ticket.
 *
 * CANVAS v2: this was a stack of pre-canvas paper card boxes with gold-tinted icon tiles
 * and gradient `.cta-button`s, centred. It is now the reference board's card
 * language: ONE warm tinted object (`.club-b-warm` — the account step, the only
 * thing the buyer still has to DO), the rest as neutral white `.club-b-card`
 * rows, each led by a round orange `.club-b-orb` glyph and a tracked mono caps
 * eyebrow, with solid orange pill buttons for the primary actions and hairline
 * `.f0-chip` buttons for the secondary ones. Left-aligned, like the board.
 *
 * EVERY COMMERCIAL STRING IS BYTE-IDENTICAL to the version before this restyle:
 * the $197 confirmation line, the value-anchor paragraph and the "$197 today ·
 * includes your first month of Club · $99/mo after…" terms line. Only the
 * containers moved. The one deliberate copy change is the support address, which
 * is now `support@cheatcode.com` — the only support address in the product.
 *
 * COLOUR LAW: the WhatsApp share target no longer borrows WhatsApp green —
 * green/red belongs to price — so the share row is hairline chips plus the one
 * orange action.
 */

/** Generic (non-personalized) challenge link for the share loop — a guest buyer
 *  isn't authenticated here yet, so they get their personal referral link on the
 *  in-app thank-you once they're signed in. */
const CHALLENGE_PUBLIC_URL = "https://cheatcode-club.vercel.app/challenge/";

/** The board's primary action: a solid orange pill, full width on a card. */
const ctaClass =
  "f0-focus f0-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-display text-[14.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)]";

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export default function VipSuccess({
  state,
  accountState = "existing",
  setupUrl = null,
  firstName = "",
  shippingName = "",
  address,
}: {
  state: "ok" | "not_found";
  accountState?: "new" | "existing";
  setupUrl?: string | null;
  firstName?: string;
  shippingName?: string;
  address?: Address;
}) {
  const [canNativeShare] = useState(
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
  const targets = useMemo(
    () => shareTargets(CHALLENGE_PUBLIC_URL, CHALLENGE_SHARE_MESSAGE),
    []
  );

  if (state === "not_found") {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <TopBar />
        <div className="max-w-lg mx-auto px-5 py-16">
          <h1 className="font-display text-[26px] font-extrabold uppercase leading-[1.08] text-ink">
            We couldn&apos;t find that checkout
          </h1>
          <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
            This link looks incomplete or expired. If you just completed a VIP
            purchase, check your email for your receipt — or reach us at{" "}
            <a href="mailto:support@cheatcode.com" className="font-semibold text-accent">
              support@cheatcode.com
            </a>{" "}
            and we&apos;ll sort it out right away.
          </p>
          <a
            href="/free-class"
            className="f0-focus f0-press mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-display text-[13.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)]"
          >
            Go to the challenge <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  const hasAddress = !!(address && (address.line1 || address.city));

  async function nativeShare() {
    try {
      await navigator.share({
        title: "5-Day Investing Challenge",
        text: targets.message,
        url: CHALLENGE_PUBLIC_URL,
      });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <TopBar />
      <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
        {/* Celebration */}
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="club-b-orb mb-4 h-12 w-12">
            <PartyPopper className="h-6 w-6" aria-hidden />
          </span>
          <span className="f0-chip f0-chip-accent mb-3 flex w-fit items-center gap-1.5 px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Ticket className="h-3 w-3" aria-hidden /> You&apos;re VIP
          </span>
          <h1 className="font-display text-[28px] font-extrabold uppercase leading-[1.05] text-ink sm:text-[34px]">
            You&apos;re in{firstName ? `, ${firstName}` : ""} — welcome to VIP.
          </h1>
          <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
            Your $197 VIP ticket is confirmed. Your textbook is being prepared,
            your first month of Club is included, and your private VIP room is
            open. The live challenge runs {CHALLENGE_DATES_LABEL}.
          </p>
        </m.div>

        {/* Finish setup / log in */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="club-b-warm f0-grain mt-7 px-5 py-6 sm:px-6"
        >
          {accountState === "new" ? (
            <div>
              <div className="flex items-start gap-3.5">
                <span className="club-b-orb h-11 w-11 shrink-0">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[20px] font-extrabold uppercase leading-[1.1] text-ink">
                    One step to finish
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-soft">
                    We set up your account with the email you used at checkout. Set a
                    password and you&apos;ll drop straight into the Club — VIP room and
                    all.
                  </p>
                </div>
              </div>
              {setupUrl ? (
                <a
                  href={setupUrl}
                  className={ctaClass}
                >
                  <KeyRound className="w-4 h-4" /> Set my password &amp; enter{" "}
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <p className="mt-4 text-[13.5px] text-soft">
                  Check your email for a sign-in link to finish setting up your
                  account.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3.5">
                <span className="club-b-orb h-11 w-11 shrink-0">
                  <LogIn className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[20px] font-extrabold uppercase leading-[1.1] text-ink">
                    You&apos;re upgraded — log in
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-soft">
                    That email already has a Club account, so we added VIP right to it.
                    Log in and your VIP room is waiting.
                  </p>
                </div>
              </div>
              <a
                href="/login?next=/vip-room"
                className={ctaClass}
              >
                <LogIn className="w-4 h-4" /> Log in to your VIP room{" "}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </m.div>

        {/* Textbook shipping confirmation */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="club-b-card mt-6 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <span className="club-b-orb h-10 w-10 shrink-0">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                Your textbook
              </p>
              <h2 className="mt-1 font-display text-[16px] font-extrabold uppercase leading-[1.15] text-ink">
                On its way to you
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                Your printed copy of <em>The Investing Textbook</em> is being
                prepared and will ship
                {hasAddress ? " to:" : " to the address you entered at checkout."}
              </p>
              {hasAddress && (
                <div className="club-b-card mt-3 px-4 py-3 text-[13px] leading-relaxed text-ink">
                  {shippingName && <div className="font-semibold">{shippingName}</div>}
                  {address?.line1 && <div>{address.line1}</div>}
                  {address?.line2 && <div>{address.line2}</div>}
                  <div>
                    {[address?.city, address?.state, address?.postal_code]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {address?.country && <div>{address.country}</div>}
                </div>
              )}
              <p className="mt-2.5 text-[12px] text-soft">
                We&apos;ll email tracking as soon as it ships.
              </p>
            </div>
          </div>
        </m.div>

        {/* VIP room */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="club-b-card mt-6 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <span className="club-b-orb h-10 w-10 shrink-0">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                VIP room
              </p>
              <h2 className="mt-1 font-display text-[16px] font-extrabold uppercase leading-[1.15] text-ink">
                Your private space is open
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                A private room just for VIP members during the challenge. You&apos;ll
                find it in the Club as soon as you&apos;re signed in — and your{" "}
                <span className="font-semibold text-ink">session replays</span> will
                appear here after each live session, yours to rewatch anytime.
              </p>
            </div>
          </div>
        </m.div>

        {/* Calendar add — live sessions */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="club-b-card mt-6 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <span className="club-b-orb h-10 w-10 shrink-0">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                Don&apos;t miss a session
              </p>
              <h2 className="mt-1 font-display text-[16px] font-extrabold uppercase leading-[1.15] text-ink">
                Add the live sessions to your calendar
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                Five live sessions, {CHALLENGE_DATES_LABEL}, at{" "}
                {CHALLENGE_SESSION_TIME_LABEL} each morning — we do it together in
                the room.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadChallengeIcs(true)}
                  className="f0-chip f0-focus f0-press inline-flex items-center gap-1.5 px-3 py-2 font-display text-[12px] font-bold text-ink"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Add all 5 sessions
                </button>
                <button
                  onClick={() => downloadChallengeIcs(false)}
                  className="f0-chip f0-focus f0-press inline-flex items-center gap-1.5 px-3 py-2 font-display text-[12px] font-bold text-ink"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Just Day 1
                </button>
              </div>
            </div>
          </div>
        </m.div>

        {/* Share loop */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="club-b-card mt-6 px-4 py-5"
        >
          <div className="flex items-start gap-3">
            <span className="club-b-orb h-10 w-10 shrink-0">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[16px] font-extrabold uppercase leading-[1.15] text-ink">
                Bring someone with you
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                The room is more fun with people you know — invite a friend to the
                free challenge and go through the five days together.
              </p>
            </div>
          </div>
          {/* COLOUR LAW: green belongs to price, so the share targets are the
              board's hairline chips, not brand-coloured buttons. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 font-display text-[12.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)]"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            <a
              href={targets.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="f0-chip f0-focus f0-press inline-flex items-center gap-2 px-4 py-2.5 font-display text-[12.5px] font-bold text-ink"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a
              href={targets.mailto}
              className="f0-chip f0-focus f0-press inline-flex items-center gap-2 px-4 py-2.5 font-display text-[12.5px] font-bold text-ink"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          </div>
        </m.div>

        {/* Value anchor + billing disclosure */}
        <p className="mt-6 max-w-[52ch] text-[13px] leading-relaxed text-soft">
          Your <span className="font-semibold text-ink">$197</span> is simply the
          textbook&apos;s normal price — the month of Club, your VIP room, and your
          session replays all come on top.
        </p>
        <p className="mt-3 flex max-w-[60ch] items-start gap-1.5 text-[12px] leading-relaxed text-soft">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            $197 today · includes your first month of Club · $99/mo after — we&apos;ll
            remind you 3 days before, cancel in one click. Education, not financial
            advice.
          </span>
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-soft">
          <Sparkles className="w-3.5 h-3.5 text-accent" /> See you in the room.
        </p>
      </div>
    </div>
  );
}
