"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
import { startSession, getStoredFunnelId } from "@/lib/funnel";

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

  useEffect(() => {
    let mounted = true;
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
  const showSocial = registered >= 5;
  const showSeats = typeof seats === "number" && seats > 0;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar />

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md text-center"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-5">
            <Sparkles className="w-3 h-3" /> Free weekly class
          </span>
          <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-4xl font-bold text-ink">
            Is your family raising <span className="text-gradient-gold">investors</span> — or
            spenders?
          </h1>
          <p className="text-soft mt-4 text-[15px] leading-relaxed max-w-sm mx-auto">
            Join a free live class with the Family Investing Club. In one session your family
            learns how the market actually works — and how to start the habit together. Reserve
            your seat in 30 seconds.
          </p>

          {session?.scheduled_at && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sand bg-white/40 px-4 py-2 text-sm text-ink">
              <CalendarDays className="w-4 h-4 text-gold-600" />
              <span className="font-semibold">This week:</span>
              <span className="text-soft">{formatClassWhen(session.scheduled_at)}</span>
            </div>
          )}

          {/* Honest social proof + seat scarcity (both hide themselves) */}
          {(showSocial || showSeats) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
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
            </div>
          )}

          <button
            onClick={begin}
            disabled={starting}
            className="cta-button mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] disabled:opacity-60"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Reserve my seat <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="mt-3 text-xs text-soft">
            Free · No card required · The whole family welcome
          </p>
        </motion.div>
      </div>
    </div>
  );
}
