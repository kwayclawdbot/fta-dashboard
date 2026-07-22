"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  ArrowRight,
  Video,
  CalendarPlus,
  MessageCircle,
  Lock,
  GraduationCap,
  Sparkles,
  BookOpen,
  Eye,
  Target,
  Gamepad2,
} from "lucide-react";
import {
  FIC_CHECKOUT_URL,
  formatClassWhen,
  downloadClassIcs,
  type FreeClassSession,
  type NextClassResponse,
} from "@/lib/free-class";

/**
 * FREE-tier dashboard home. A calm, limited surface: the "Your free class"
 * card (reachable confirmation view), a read-only nudge into the community,
 * a peek at everything membership unlocks, and the Join-FIC CTA.
 */
export default function FreeHome({ firstName }: { firstName: string }) {
  const [session, setSession] = useState<FreeClassSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/free-class/next")
      .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
      .then((d) => {
        if (!mounted) return;
        setSession(d?.session ?? null);
        setLoaded(true);
      })
      .catch(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Greeting */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em]">
          <Sparkles className="w-3 h-3" /> Free member
        </span>
        <h1 className="font-display text-2xl font-bold text-ink mt-3">
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-soft mt-1">
          Your free seat is saved. Here&apos;s your class — and a look at what the
          club unlocks.
        </p>
      </div>

      {/* Your free class */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6 text-gold-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
              Your free class
            </p>
            <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
              {session?.title || "Family Investing Club — Free Class"}
            </h2>
            <div className="flex items-center gap-2 text-sm text-soft mt-1.5">
              <Clock className="w-4 h-4 text-gold-600 shrink-0" />
              {loaded
                ? session?.scheduled_at
                  ? formatClassWhen(session.scheduled_at)
                  : "A class is being scheduled — we'll email you the time."
                : "Loading…"}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Link
                href="/free-class"
                className="cta-button inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm"
              >
                <Video className="w-4 h-4" /> Class info & video
              </Link>
              {session && (
                <button
                  onClick={() => downloadClassIcs(session)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-sand text-ink text-sm font-display font-semibold hover:bg-white/50 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4 text-gold-600" /> Add to
                  calendar
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Community (read-only) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Link
          href="/community"
          className="paper-card p-5 flex items-center gap-4 hover:border-gold-300 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-gold-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-ink">
              Look inside the club community
            </p>
            <p className="text-sm text-soft">
              See what real families are learning and sharing. Join FIC to post,
              like, and comment.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gold-700 shrink-0" />
        </Link>
      </motion.div>

      {/* What membership unlocks */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="paper-card ring-2 ring-gold-400 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center shrink-0 shadow-soft">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Everything the club unlocks
            </h3>
            <p className="text-sm text-soft">
              One membership. The whole family.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: BookOpen, label: "Full course library" },
            { icon: Video, label: "Weekly live classes" },
            { icon: Eye, label: "Family watchlist" },
            { icon: Target, label: "Kid missions" },
            { icon: Gamepad2, label: "Games & practice" },
            { icon: Sparkles, label: "Badges & progress" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2.5 rounded-xl border border-sand bg-white/40 px-3 py-2.5"
            >
              <f.icon className="w-4 h-4 text-gold-600 shrink-0" />
              <span className="text-sm text-ink font-medium truncate">
                {f.label}
              </span>
              <Lock className="w-3.5 h-3.5 text-soft ml-auto shrink-0" />
            </div>
          ))}
        </div>
        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
        >
          Join FIC — $99/mo <ArrowRight className="w-4 h-4" />
        </a>
        <Link
          href="/upgrade"
          className="mt-2.5 block text-center text-xs text-gold-700 font-semibold"
        >
          See the full comparison
        </Link>
      </motion.div>
    </div>
  );
}
