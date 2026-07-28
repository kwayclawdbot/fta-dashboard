"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import {
  ArrowRight,
  Sparkles,
  CalendarDays,
  Users,
  Flame,
} from "lucide-react";
import { formatClassWhen, type NextClassResponse } from "@/lib/free-class";
import {
  FunnelPage,
  FunnelSkeleton,
  TopBar,
  Mast,
  Marked,
  Card,
  Pill,
  Action,
  Terms,
  Spinner,
} from "@/components/free-class/ui";
import {
  startSession,
  getStoredFunnelId,
  setChallengeFlag,
  getChallengeFlag,
  setVipFlag,
} from "@/lib/funnel";

/**
 * Funnel landing / hook — step 0 of the multi-page free-class funnel.
 * Creates (or resumes) a funnel_sessions row on mount (capturing UTM), shows the
 * class date, honest social proof + seat scarcity, then routes into /q/1.
 * Only visitors who have ACTUALLY registered for a free class (a
 * free_class_registrations row, checked server-side) are sent to the
 * confirmation hub; every other visitor — signed out, or a member/admin/free
 * user who never registered — sees the funnel normally.
 *
 * DRAWN AS: board 01's card language. Mono-caps eyebrow in the accent, a Sora
 * display hook with the accent underline under its one emphasised phrase, the
 * class date as the screen's single warm-hairline object, trust as neutral
 * hairline pills (success and scarcity are not price, so they are not green and
 * not amber), and one solid accent pill for the action.
 */
export default function FreeClassLanding() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<NextClassResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [challenge, setChallenge] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Detect the club-site Challenge CTA (?challenge=1) and persist it for the
    // rest of the funnel. Sticky: a resumed challenge funnel stays challenge.
    try {
      const params = new URLSearchParams(window.location.search);
      const wantsChallenge = params.get("challenge") === "1";
      if (wantsChallenge) setChallengeFlag(true);
      setChallenge(wantsChallenge || getChallengeFlag());
      // VIP intent (?vip=1) — persisted for the thank-you upsell. VIP entrants
      // are also challenge entrants, so ensure the challenge flag is set too.
      if (params.get("vip") === "1") {
        setVipFlag(true);
        setChallengeFlag(true);
        setChallenge(true);
      }
    } catch {
      /* ignore */
    }
    (async () => {
      const [status, nextRes] = await Promise.all([
        fetch("/api/free-class/status")
          .then((r) => (r.ok ? (r.json() as Promise<{ registered?: boolean }>) : null))
          .catch(() => null),
        fetch("/api/free-class/next")
          .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
          .catch(() => null),
      ]);
      if (!mounted) return;
      if (status?.registered) {
        router.replace("/free-class/confirmed");
        return;
      }
      setMeta(nextRes);
      // Create-or-resume the funnel session (UTM captured on first create).
      await startSession(getStoredFunnelId());
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function begin() {
    setStarting(true);
    router.push("/free-class/q/1");
  }

  if (!ready) return <FunnelSkeleton />;

  const session = meta?.session ?? null;
  const registered = meta?.registered_count ?? 0;
  const seats = meta?.seats_left ?? null;
  // Honest threshold: only show a hard numeric count once it's a genuinely
  // impressive social signal (>= 50). Below that, the soft always-on line
  // carries the trust signal instead of exposing a tiny "2 families" number
  // (Challenge Funnel Review P1 #3).
  const showSocial = registered >= 50;
  const showSeats = typeof seats === "number" && seats > 0;
  const showSoft = !showSocial;

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
          <Mast
            eyebrow={
              challenge ? (
                <>
                  <Flame className="h-3 w-3" /> 5-Day Investing Challenge · Starts Sept 1
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> Free weekly class
                </>
              )
            }
            title={
              challenge ? (
                <>
                  The <Marked>5-Day Investing Challenge</Marked> — learn the market in one week.
                </>
              ) : (
                <>
                  Is your family raising <Marked>investors</Marked> — or spenders?
                </>
              )
            }
            lede={
              challenge
                ? "Five days, one clear step each day, inside the Cheat Code Club. Sign up now and your full membership unlocks immediately — every tool, Kai, the community, live classes — right through the challenge. No card required."
                : "Join a free live class with the Cheat Code Club. In one session your family learns how the market actually works — and how to start the habit together. Reserve your seat in about a minute."
            }
          />

          {/* Weekly-class date — SUPPRESSED for the challenge variant, which is a
              fixed Sept 1 cohort. Showing "this week: Wed Jul 29" under a
              "Starts Sept 1" hook is the date-leak bug (Review P1 #1). */}
          {!challenge && session?.scheduled_at && (
            <Card className="mt-6 flex items-center justify-center gap-2 px-4 py-3 text-[14px]">
              <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="font-display font-bold text-ink">This week:</span>
              <span className="text-soft">{formatClassWhen(session.scheduled_at)}</span>
            </Card>
          )}

          {/* Honest social proof + seat scarcity, with an always-on soft
              fallback so the hook is never left with zero trust signal. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {showSoft && (
              <Pill>
                <Users className="h-3 w-3" />
                Families across the club are learning this week
              </Pill>
            )}
            {(showSocial || showSeats) && (
              <>
                {showSocial && (
                  <Pill>
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{registered.toLocaleString()} families registered</span>
                  </Pill>
                )}
                {showSeats && (
                  <Pill tone="accent">
                    <Flame className="h-3 w-3" />
                    <span className="tabular-nums">{seats} seats left</span>
                  </Pill>
                )}
              </>
            )}
          </div>

          <div className="mt-7">
            <Action onClick={begin} disabled={starting}>
              {starting ? (
                <Spinner />
              ) : (
                <>
                  {challenge ? "Start the challenge" : "Reserve my seat"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Action>
          </div>
          <div className="mt-3">
            <Terms>
              {challenge
                ? "Full Club access now · No card required · Keep it for $99/mo or drop to free after"
                : "Free · No card required · The whole family welcome"}
            </Terms>
          </div>
        </m.div>
      </div>
    </FunnelPage>
  );
}
