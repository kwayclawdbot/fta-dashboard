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
} from "lucide-react";
import {
  FunnelPage,
  FunnelSkeleton,
  TopBar,
  Mast,
  WarmCard,
  IconLine,
  Action,
  QuietAction,
  Terms,
  Spinner,
} from "@/components/free-class/ui";
import { setChallengeFlag } from "@/lib/funnel";

/**
 * One-time VIP offer (Lane C9b) — the page an email-first challenger lands on
 * right after registering. Their spot is already saved; this is the single
 * optional upgrade decision before the streamlined account setup.
 *
 * Two honest exits, no fake urgency: "Go VIP" → the guest VIP checkout with the
 * email prefilled via the continuation token; "No thanks" → the shortened setup.
 * The token never exposes the email in the URL.
 *
 * DRAWN AS: the pricing card on board `light-r1-c1` — a brand-tinted card with
 * the badge pill hung on its top edge, the price as the largest numeral on the
 * screen, a checked perk list, one full-width accent pill, and the terms as
 * fine print directly beneath it. Every commercial string is the one that
 * shipped; only the container changed.
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

  if (!ready) return <FunnelSkeleton />;

  return (
    <FunnelPage>
      <TopBar />
      <div className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center">
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Registered confirmation */}
          <Mast
            eyebrow={
              <>
                <Check className="h-3 w-3" /> You&apos;re registered
              </>
            }
            size="md"
            title="Your spot in the challenge is saved."
            lede="Before you set up your account — one optional upgrade, offered once."
          />

          {/* The VIP ticket object — the screen's one branded card. */}
          <div className="mt-7">
            <WarmCard
              badge={
                <>
                  <Ticket className="h-3 w-3" /> VIP Ticket
                </>
              }
            >
              <div className="px-6 pb-6 pt-5">
                {isVip ? (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <h2 className="font-display text-[1.25rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">
                        You&apos;re already VIP 🎟️
                      </h2>
                      <span className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-ink">
                        $197
                      </span>
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-soft">
                      Your textbook is on the way and your VIP room is open. Let&apos;s finish setting
                      up your account.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <h2 className="font-display text-[1.25rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">
                        Go deeper, with something to hold.
                      </h2>
                      <span className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-ink">
                        $197
                      </span>
                    </div>

                    <div className="mt-5 space-y-2.5">
                      <IconLine icon={BookOpen}>
                        The printed textbook, mailed to you <span className="text-soft">(its normal retail price)</span>
                      </IconLine>
                      <IconLine icon={Sparkles}>Your first month of Cheat Code Club, included</IconLine>
                      <IconLine icon={Lock}>A private VIP room through the challenge</IconLine>
                      <IconLine icon={PlayCircle}>Replays of every live session</IconLine>
                    </div>

                    <div className="mt-6">
                      <Action onClick={goVip} disabled={going || !token}>
                        {going ? (
                          <Spinner />
                        ) : (
                          <>
                            <Ticket className="h-4 w-4" /> Go VIP — $197 <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Action>
                    </div>
                    <div className="mt-3">
                      <Terms icon={ShieldCheck} align="left">
                        $197 today · includes your first month of Club · $99/mo after — we&apos;ll remind
                        you 3 days before, cancel in one click. Education, not financial advice.
                      </Terms>
                    </div>
                  </>
                )}
              </div>
            </WarmCard>
          </div>

          {/* Honest skip */}
          <div className="mt-5">
            <QuietAction onClick={skipToSetup}>
              {isVip ? "Continue to my account" : "No thanks — take me to my account"} →
            </QuietAction>
          </div>

          {!valid && token && (
            <p className="mt-4 text-center text-[12px] text-soft">
              This link looks expired. You can still{" "}
              <button onClick={skipToSetup} className="f0-focus rounded font-semibold text-accent underline">
                finish setting up
              </button>
              .
            </p>
          )}
        </m.div>
      </div>
    </FunnelPage>
  );
}
