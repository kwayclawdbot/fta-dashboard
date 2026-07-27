"use client";

import { m } from "@/lib/motion";
import {
  Clock,
  Video,
  ShieldCheck,
  CalendarDays,
  CalendarPlus,
  GraduationCap,
  PartyPopper,
  ArrowRight,
} from "lucide-react";
import {
  FIC_CHECKOUT_URL,
  formatClassWhen,
  downloadClassIcs,
  type FreeClassSession,
} from "@/lib/free-class";
import { TopBar } from "@/components/free-class/ui";

/**
 * Post-registration confirmation / signed-in hub. Preserved verbatim from the
 * original single-page funnel — class card + ICS + video + Join-FIC CTA — so the
 * proven closing experience is reused, never degraded.
 */
export default function ConfirmationView({
  session,
  videoUrl,
  firstName,
  signedInHub,
  onExplore,
}: {
  session: FreeClassSession | null;
  videoUrl: string | null;
  firstName: string;
  signedInHub: boolean;
  onExplore: () => void;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <TopBar />
      <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-chip-green flex items-center justify-center mb-4">
            <PartyPopper className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            {signedInHub ? "Your free class" : `You're in${firstName ? `, ${firstName}` : ""}!`}
          </h1>
          <p className="text-soft text-sm mt-2 max-w-sm mx-auto">
            {signedInHub
              ? "Here's everything for the upcoming class, plus a quick look at what's inside."
              : "Here's what happens next. Your free account is ready and your seat is saved."}
          </p>
        </m.div>

        {/* Class card */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="paper-card p-5 mt-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
                {session ? "Your class" : "Next class"}
              </p>
              <h2 className="font-display text-lg font-bold text-ink leading-snug mt-0.5">
                {session?.title || "Cheat Code Club — Free Class"}
              </h2>
              <div className="flex items-center gap-2 text-sm text-soft mt-1.5">
                <Clock className="w-4 h-4 text-gold-600 shrink-0" />
                {session?.scheduled_at
                  ? formatClassWhen(session.scheduled_at)
                  : "We'll email you the time — a class is being scheduled."}
              </div>
              {session?.description && (
                <p className="text-sm text-soft mt-2 leading-relaxed">{session.description}</p>
              )}
              {session && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button
                    onClick={() => downloadClassIcs(session)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-card transition-colors"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
                  </button>
                  {session.zoom_join_url && (
                    <a
                      href={session.zoom_join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sand text-ink text-xs font-display font-semibold hover:bg-card transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" /> Join link
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </m.div>

        {/* Video */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-6"
        >
          <p className="text-center text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700 mb-2">
            Watch first · 2 minutes
          </p>
          <div className="paper-card overflow-hidden">
            {videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-video bg-night-950"
              />
            ) : (
              <div className="w-full aspect-video bg-night-950 flex items-center justify-center text-night-300 text-sm">
                Video coming soon
              </div>
            )}
          </div>
          <p className="text-center text-sm text-soft mt-3 max-w-sm mx-auto">
            A quick look at your upcoming class, the app your family just joined, and why families
            go all-in as members.
          </p>
        </m.div>

        {/* Join FIC */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="paper-card ring-2 ring-gold-400 p-6 mt-6 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-3 shadow-soft">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-ink">Make it a family habit</h3>
          <p className="text-soft text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            Weekly classes, the full course library, kid missions, and the club community —
            everyone under your roof, one membership.
          </p>
          <a
            href={FIC_CHECKOUT_URL}
            className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
          >
            Join FIC — $99/mo <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={onExplore}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-card transition-colors"
          >
            Explore the app free
          </button>
        </m.div>

        <p className="mt-8 text-center text-xs text-soft max-w-sm mx-auto leading-relaxed flex items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Education only — nothing here is financial advice. Practice money only, always.
        </p>
      </div>
    </div>
  );
}
