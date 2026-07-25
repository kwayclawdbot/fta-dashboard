"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import {
  Ticket,
  BookOpen,
  Sparkles,
  Lock,
  PlayCircle,
  Check,
  ShieldCheck,
  ArrowRight,
  Loader2,
  PartyPopper,
} from "lucide-react";
import { TopBar } from "@/components/free-class/ui";
import { setChallengeFlag } from "@/lib/funnel";

/**
 * One-time VIP offer (Lane C9b) — the page an email-first challenger lands on
 * right after registering. Their spot is already saved; this is the single
 * optional upgrade decision before the streamlined account setup.
 *
 * Two honest exits, no fake urgency: "Go VIP" → the guest VIP checkout with the
 * email prefilled via the continuation token; "No thanks" → the shortened setup.
 * The token never exposes the email in the URL.
 */
export default function VipOfferPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [src, setSrc] = useState("funnel");
  const [going, setGoing] = useState(false);

  useEffect(() => {
    setChallengeFlag(true); // CCC branding in the TopBar
    let mounted = true;
    const t = new URLSearchParams(window.location.search).get("t");
    setToken(t);
    (async () => {
      if (!t) {
        if (mounted) setReady(true);
        return;
      }
      try {
        const r = await fetch(`/api/challenge/continuation?t=${encodeURIComponent(t)}`).then((x) => x.json());
        if (!mounted) return;
        setValid(!!r.valid);
        setIsVip(!!r.isVip);
        if (r.src) setSrc(String(r.src));
      } catch {
        /* invalid */
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function goVip() {
    if (!token) return;
    setGoing(true);
    // Guest VIP checkout with the email prefilled from the token (server-side).
    window.location.href = `/api/challenge/vip-checkout?t=${encodeURIComponent(token)}&src=${encodeURIComponent(src)}`;
  }

  function skipToSetup() {
    if (token) router.push(`/free-class/setup?t=${encodeURIComponent(token)}`);
    else router.push("/free-class?challenge=1");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />
      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Registered confirmation */}
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-chip-green flex items-center justify-center mb-3">
              <PartyPopper className="w-6 h-6 text-green-600" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-green text-green-700 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-3">
              <Check className="w-3 h-3" /> You&apos;re registered
            </span>
            <h1 className="font-display text-[1.6rem] leading-tight sm:text-3xl font-bold text-ink">
              Your spot in the challenge is saved.
            </h1>
            <p className="text-soft text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              Before you set up your account — one optional upgrade, offered once.
            </p>
          </div>

          {/* The VIP ticket object */}
          <div className="paper-card ring-2 ring-gold-400 mt-6 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-teal-500" />
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gold-700">
                  <Ticket className="w-5 h-5" />
                  <span className="text-[11px] font-display font-bold uppercase tracking-wider">
                    VIP Ticket
                  </span>
                </div>
                <span className="font-display text-2xl font-bold text-ink">$197</span>
              </div>

              {isVip ? (
                <div className="mt-4">
                  <h2 className="font-display text-xl font-bold text-ink">You&apos;re already VIP 🎟️</h2>
                  <p className="text-soft text-sm mt-2 leading-relaxed">
                    Your textbook is on the way and your VIP room is open. Let&apos;s finish setting
                    up your account.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold text-ink mt-3">
                    Go deeper, with something to hold.
                  </h2>
                  <div className="mt-4 space-y-2.5">
                    <Perk icon={BookOpen}>
                      The printed textbook, mailed to you <span className="text-soft">(its normal retail price)</span>
                    </Perk>
                    <Perk icon={Sparkles}>Your first month of Cheat Code Club, included</Perk>
                    <Perk icon={Lock}>A private VIP room through the challenge</Perk>
                    <Perk icon={PlayCircle}>Replays of every live session</Perk>
                  </div>

                  <button
                    onClick={goVip}
                    disabled={going || !token}
                    className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-60"
                  >
                    {going ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Ticket className="w-4 h-4" /> Go VIP — $197 <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="mt-3 text-[12px] text-soft leading-relaxed flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    $197 today · includes your first month of Club · $99/mo after — we&apos;ll remind
                    you 3 days before, cancel in one click. Education, not financial advice.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Honest skip */}
          <button
            onClick={skipToSetup}
            className="mt-5 w-full text-center text-sm font-display font-semibold text-soft hover:text-ink transition-colors"
          >
            {isVip ? "Continue to my account" : "No thanks — take me to my account"} →
          </button>

          {!valid && token && (
            <p className="mt-4 text-center text-xs text-soft">
              This link looks expired. You can still{" "}
              <button onClick={skipToSetup} className="text-gold-700 font-semibold underline">
                finish setting up
              </button>
              .
            </p>
          )}
        </m.div>
      </div>
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
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gold-700" />
      </span>
      <span className="text-[15px] text-ink leading-snug">{children}</span>
    </div>
  );
}
