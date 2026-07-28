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
import { BoardSection } from "@/components/clubhome/board";
import {
  FunnelPage,
  TopBar,
  Mast,
  Card,
  CardMark,
  WarmCard,
  Action,
  Terms,
} from "@/components/free-class/ui";

/**
 * Post-registration confirmation / signed-in hub. The experience is preserved
 * exactly — class card + ICS + video + Join-FIC CTA, same copy, same links —
 * and rebuilt in the board's vocabulary: an accent orb for the celebration, a
 * white hairline card for the class, a section mark over the video, ONE brand
 * -tinted card for the membership offer, and a deliberate dark island for the
 * video itself (the only dark moment on the page).
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
    <FunnelPage>
      <TopBar />
      <div className="mx-auto w-full max-w-lg px-5 py-8 sm:py-12">
        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex justify-center">
            <CardMark icon={PartyPopper} size={56} round />
          </div>
          <Mast
            title={signedInHub ? "Your free class" : `You're in${firstName ? `, ${firstName}` : ""}!`}
            lede={
              signedInHub
                ? "Here's everything for the upcoming class, plus a quick look at what's inside."
                : "Here's what happens next. Your free account is ready and your seat is saved."
            }
          />
        </m.div>

        {/* Class card */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-6"
        >
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <CardMark icon={CalendarDays} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {session ? "Your class" : "Next class"}
                </p>
                <h2 className="mt-1 font-display text-[1.0625rem] font-extrabold leading-snug tracking-[-0.015em] text-ink">
                  {session?.title || "Cheat Code Club — Free Class"}
                </h2>
                <div className="mt-1.5 flex items-center gap-2 text-[14px] text-soft">
                  <Clock className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {session?.scheduled_at
                    ? formatClassWhen(session.scheduled_at)
                    : "We'll email you the time — a class is being scheduled."}
                </div>
                {session?.description && (
                  <p className="mt-2 text-[14px] leading-relaxed text-soft">{session.description}</p>
                )}
                {session && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Action tone="quiet" size="sm" full={false} onClick={() => downloadClassIcs(session)}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
                    </Action>
                    {session.zoom_join_url && (
                      <a
                        href={session.zoom_join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="f0-press f0-focus inline-flex items-center justify-center gap-2 rounded-full border border-sand bg-card px-4 py-2.5 font-display text-[13px] font-bold text-ink transition-colors hover:border-[color:var(--accent-solid)]"
                      >
                        <Video className="h-3.5 w-3.5" /> Join link
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </m.div>

        {/* Video — the page's one dark island */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-7"
        >
          <BoardSection id="free-class-watch" label="Watch first" mark="· 2 minutes">
            <div className="night-island mt-3">
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-[14px] opacity-70">
                  Video coming soon
                </div>
              )}
            </div>
          </BoardSection>
          <p className="mx-auto mt-3 max-w-sm text-center text-[14px] text-soft">
            A quick look at your upcoming class, the app your family just joined, and why families
            go all-in as members.
          </p>
        </m.div>

        {/* Join FIC — the page's one brand-tinted object */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-7"
        >
          <WarmCard>
            <div className="px-6 py-6 text-center">
              <div className="mb-3 flex justify-center">
                <CardMark icon={GraduationCap} size={48} round />
              </div>
              <h3 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em] text-ink">
                Make it a family habit
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-soft">
                Weekly classes, the full course library, kid missions, and the club community —
                everyone under your roof, one membership.
              </p>
              <div className="mt-5">
                <Action href={FIC_CHECKOUT_URL} external>
                  Join FIC — $99/mo <ArrowRight className="h-4 w-4" />
                </Action>
              </div>
              <div className="mt-3">
                <Action tone="quiet" size="md" onClick={onExplore}>
                  Explore the app free
                </Action>
              </div>
            </div>
          </WarmCard>
        </m.div>

        <div className="mx-auto mt-8 max-w-sm">
          <Terms icon={ShieldCheck}>
            Education only — nothing here is financial advice. Practice money only, always.
          </Terms>
        </div>
      </div>
    </FunnelPage>
  );
}
