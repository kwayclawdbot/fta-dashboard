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

/** Generic (non-personalized) challenge link for the share loop — a guest buyer
 *  isn't authenticated here yet, so they get their personal referral link on the
 *  in-app thank-you once they're signed in. */
const CHALLENGE_PUBLIC_URL = "https://cheatcode-club.vercel.app/challenge/";

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
        <div className="max-w-lg mx-auto px-5 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            We couldn&apos;t find that checkout
          </h1>
          <p className="text-soft text-sm mt-3 max-w-sm mx-auto leading-relaxed">
            This link looks incomplete or expired. If you just completed a VIP
            purchase, check your email for your receipt — or reach us at{" "}
            <a href="mailto:hello@familyinvestingclub.com" className="text-gold-700 font-semibold">
              hello@familyinvestingclub.com
            </a>{" "}
            and we&apos;ll sort it out right away.
          </p>
          <a
            href="/free-class"
            className="cta-button mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm"
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
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-chip-amber flex items-center justify-center mb-4">
            <PartyPopper className="w-7 h-7 text-gold-700" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-3">
            <Ticket className="w-3 h-3" /> You&apos;re VIP
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
            You&apos;re in{firstName ? `, ${firstName}` : ""} — welcome to VIP.
          </h1>
          <p className="text-soft text-sm mt-2.5 max-w-sm mx-auto leading-relaxed">
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
          className="paper-card ring-2 ring-gold-400 p-6 mt-7"
        >
          {accountState === "new" ? (
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0 mx-auto">
                <KeyRound className="w-6 h-6 text-gold-700" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink mt-3">
                One step to finish
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed max-w-sm mx-auto">
                We set up your account with the email you used at checkout. Set a
                password and you&apos;ll drop straight into the Club — VIP room and
                all.
              </p>
              {setupUrl ? (
                <a
                  href={setupUrl}
                  className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px]"
                >
                  <KeyRound className="w-4 h-4" /> Set my password &amp; enter{" "}
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <p className="mt-4 text-sm text-soft">
                  Check your email for a sign-in link to finish setting up your
                  account.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0 mx-auto">
                <LogIn className="w-6 h-6 text-gold-700" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink mt-3">
                You&apos;re upgraded — log in
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed max-w-sm mx-auto">
                That email already has a Club account, so we added VIP right to it.
                Log in and your VIP room is waiting.
              </p>
              <a
                href="/login?next=/vip-room"
                className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px]"
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
          className="paper-card p-5 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                Your textbook
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                On its way to you
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed">
                Your printed copy of <em>The Investing Textbook</em> is being
                prepared and will ship
                {hasAddress ? " to:" : " to the address you entered at checkout."}
              </p>
              {hasAddress && (
                <div className="mt-3 rounded-xl border border-sand bg-card px-4 py-3 text-sm text-ink leading-relaxed">
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
              <p className="text-[12px] text-soft mt-2.5">
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
          className="paper-card p-5 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                VIP room
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                Your private space is open
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed">
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
                Five live sessions, {CHALLENGE_DATES_LABEL}, at{" "}
                {CHALLENGE_SESSION_TIME_LABEL} each morning — we do it together in
                the room.
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

        {/* Share loop */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="paper-card ring-1 ring-gold-300 p-6 mt-6"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-ink">
              Bring someone with you
            </h3>
            <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              The room is more fun with people you know — invite a friend to the
              free challenge and go through the five days together.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-night-950 text-sm font-semibold hover:bg-gold-600 transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            <a
              href={targets.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-chip-green text-green-700 hover:bg-green-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a
              href={targets.mailto}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-sand text-ink hover:bg-[#E0D6BE] transition-colors"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          </div>
        </m.div>

        {/* Value anchor + billing disclosure */}
        <p className="mt-6 text-center text-[13px] text-soft max-w-sm mx-auto leading-relaxed">
          Your <span className="font-semibold text-ink">$197</span> is simply the
          textbook&apos;s normal price — the month of Club, your VIP room, and your
          session replays all come on top.
        </p>
        <p className="mt-3 text-center text-[12px] text-soft max-w-sm mx-auto leading-relaxed flex items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          $197 today · includes your first month of Club · $99/mo after — we&apos;ll
          remind you 3 days before, cancel in one click. Education, not financial
          advice.
        </p>
        <p className="mt-4 text-center text-[12px] text-soft flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-gold-500" /> See you in the room.
        </p>
      </div>
    </div>
  );
}
