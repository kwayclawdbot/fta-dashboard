"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "@/lib/motion";
import {
  ArrowRight,
  Sparkles,
  CalendarDays,
  Users,
  Loader2,
  Flame,
} from "lucide-react";
import { formatClassWhen, type NextClassResponse } from "@/lib/free-class";
import { TopBar } from "@/components/free-class/ui";
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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

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
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md text-center"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-5">
            {challenge ? (
              <>
                <Flame className="w-3 h-3" /> 5-Day Investing Challenge · Starts Sept 1
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" /> Free weekly class
              </>
            )}
          </span>
          {challenge ? (
            <>
              <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-4xl font-bold text-ink">
                The <span className="text-gradient-gold">5-Day Investing Challenge</span> — learn
                the market in one week.
              </h1>
              <p className="text-soft mt-4 text-[15px] leading-relaxed max-w-sm mx-auto">
                Five days, one clear step each day, inside the Cheat Code Club. Sign up now and
                your full membership unlocks immediately — every tool, Kai, the community, live
                classes — right through the challenge. No card required.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-4xl font-bold text-ink">
                Is your family raising <span className="text-gradient-gold">investors</span> — or
                spenders?
              </h1>
              <p className="text-soft mt-4 text-[15px] leading-relaxed max-w-sm mx-auto">
                Join a free live class with the Cheat Code Club. In one session your family
                learns how the market actually works — and how to start the habit together. Reserve
                your seat in about a minute.
              </p>
            </>
          )}

          {/* Weekly-class date — SUPPRESSED for the challenge variant, which is a
              fixed Sept 1 cohort. Showing "this week: Wed Jul 29" under a
              "Starts Sept 1" hook is the date-leak bug (Review P1 #1). */}
          {!challenge && session?.scheduled_at && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sand bg-white/40 px-4 py-2 text-sm text-ink">
              <CalendarDays className="w-4 h-4 text-gold-600" />
              <span className="font-semibold">This week:</span>
              <span className="text-soft">{formatClassWhen(session.scheduled_at)}</span>
            </div>
          )}

          {/* Honest social proof + seat scarcity, with an always-on soft
              fallback so the hook is never left with zero trust signal. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            {showSoft && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-chip-green px-3 py-1 text-green-700 font-display font-semibold">
                <Users className="w-3.5 h-3.5" />
                Families across the club are learning this week
              </span>
            )}
            {(showSocial || showSeats) && (
              <>
              {showSocial && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-chip-green px-3 py-1 text-green-700 font-display font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  {registered.toLocaleString()} families registered
                </span>
              )}
              {showSeats && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-chip-amber px-3 py-1 text-gold-800 font-display font-semibold">
                  <Flame className="w-3.5 h-3.5" />
                  {seats} seats left
                </span>
              )}
              </>
            )}
          </div>

          <button
            onClick={begin}
            disabled={starting}
            className="cta-button mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-60"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {challenge ? "Start the challenge" : "Reserve my seat"}{" "}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="mt-3 text-xs text-soft">
            {challenge
              ? "Full Club access now · No card required · Keep it for $99/mo or drop to free after"
              : "Free · No card required · The whole family welcome"}
          </p>
        </m.div>
      </div>
    </div>
  );
}
