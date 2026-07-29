/**
 * V2Skeleton — the single flag-on loading skeleton for the Cheat Code App
 * conversion (design-project-v2). Rendered by each converted route's
 * loading.tsx ONLY when `designV2Enabled()` (the loading files keep their v1
 * skeleton untouched for the flag-off path). Draws shimmer bars in the
 * card-anatomy footprint of the surface that is arriving, on the v2
 * warm-black/paper ground (`--cc-*` tokens), so the route transition paints an
 * instant shape-match instead of the old warm-sand `club-b-card` / paper
 * `DashboardSkeleton` flash.
 *
 * Server-renderable (no "use client"): the loading segment streams immediately
 * and stays out of the JS bundle. All motion is CSS and collapses under
 * `prefers-reduced-motion`.
 *
 * §0.4 loading ≠ empty: this is the SHAPE of content arriving, never a founding
 * state's copy — those are designed elements inside each surface.
 */
import type { ReactNode } from "react";

export type V2SkeletonVariant =
  | "home" // /dashboard — masthead + hero island + signal rows
  | "detail" // /research/[ticker] — rail + chart body
  | "feed" // /community — composer + post cards
  | "list" // /circles — row cards
  | "narrow" // /upgrade — stacked pitch cards
  | "sessions" // /live-sessions — filter pills + hero + board rows
  | "board" // /leaderboard — strip + ranked rows
  | "ladder" // /belts — lede + rung rows
  | "profile"; // /progress — ringed avatar + dial + tiles

/* Shimmer bar — a raised `--cc-card2` block with a single sweeping highlight.
   The keyframe + class ship once inline (identical across mounts, so a repeat
   is inert) and self-disable under reduced motion. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`cc-sk-bar rounded ${className}`} />;
}

function CcCard({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--cc-line)] bg-[var(--cc-card)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Masthead: glyph dot + script-word bar — the top-left identity of every board. */
function Masthead() {
  return (
    <div className="flex items-center gap-3">
      <div className="cc-sk-bar h-8 w-8 shrink-0 rounded-full" />
      <Bar className="h-9 w-40" />
    </div>
  );
}

const SHIMMER_STYLE = `
@keyframes ccSkShimmer { 100% { transform: translateX(100%); } }
.cc-sk-bar { position: relative; overflow: hidden; background: var(--cc-card2); }
.cc-sk-bar::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  animation: ccSkShimmer 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .cc-sk-bar::after { animation: none; } }
`;

export default function V2Skeleton({ variant = "home" }: { variant?: V2SkeletonVariant }) {
  let body: ReactNode;

  switch (variant) {
    case "detail":
      body = (
        <div className="mx-auto max-w-4xl" aria-busy="true">
          <Masthead />
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            <div className="space-y-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Bar key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="space-y-4">
              <CcCard className="h-64" />
              <CcCard className="h-28" />
              <Bar className="h-3.5 w-full" />
              <Bar className="h-3.5 w-5/6" />
            </div>
          </div>
          <span className="sr-only">Loading</span>
        </div>
      );
      break;
    case "feed":
      body = (
        <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
          <Masthead />
          <CcCard className="h-24" />
          {[0, 1, 2].map((i) => (
            <CcCard key={i} className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <div className="cc-sk-bar h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Bar className="h-3 w-32" />
                  <Bar className="h-2.5 w-20" />
                </div>
              </div>
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-11/12" />
              <Bar className="h-40 w-full rounded-xl" />
            </CcCard>
          ))}
          <span className="sr-only">Loading the feed</span>
        </div>
      );
      break;
    case "list":
      body = (
        <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
          <Masthead />
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <CcCard key={i} className="flex items-center gap-4 p-4">
                <div className="cc-sk-bar h-12 w-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-4 w-1/2" />
                  <Bar className="h-3 w-3/4" />
                </div>
                <Bar className="h-8 w-20 rounded-full" />
              </CcCard>
            ))}
          </div>
          <span className="sr-only">Loading</span>
        </div>
      );
      break;
    case "narrow":
      body = (
        <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
          <Masthead />
          <CcCard className="h-32" />
          <CcCard className="h-40" />
          <CcCard className="h-28" />
          <span className="sr-only">Loading</span>
        </div>
      );
      break;
    case "sessions":
      body = (
        <div className="mx-auto w-full max-w-2xl" aria-busy="true">
          <Masthead />
          <div className="mt-5 flex gap-2">
            {[0, 1, 2].map((i) => (
              <Bar key={i} className="h-10 w-28 rounded-[14px]" />
            ))}
          </div>
          <CcCard className="mt-5 h-52" />
          <div className="mt-6 flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <CcCard key={i} className="flex items-center gap-3 p-3">
                <div className="cc-sk-bar h-[54px] w-[54px] shrink-0 rounded-[10px]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-3 w-2/3" />
                  <Bar className="h-2.5 w-1/3" />
                </div>
                <Bar className="h-8 w-20 shrink-0 rounded-[10px]" />
              </CcCard>
            ))}
          </div>
          <span className="sr-only">Loading the live schedule</span>
        </div>
      );
      break;
    case "board":
      body = (
        <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
          <Masthead />
          <Bar className="h-8 w-full" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CcCard key={i} className="h-[62px] rounded-[14px]" />
            ))}
          </div>
          <span className="sr-only">Loading the board</span>
        </div>
      );
      break;
    case "ladder":
      body = (
        <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
          <Masthead />
          <Bar className="h-8 w-full max-w-md" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <CcCard key={i} className="h-[62px] rounded-[13px]" />
            ))}
          </div>
          <span className="sr-only">Loading the belt ladder</span>
        </div>
      );
      break;
    case "profile":
      body = (
        <div className="mx-auto max-w-2xl space-y-4 pb-16" aria-busy="true">
          <Masthead />
          <div className="flex items-center gap-4 pt-2">
            <div className="cc-sk-bar h-[92px] w-[92px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Bar className="h-6 w-40" />
              <Bar className="h-3.5 w-28" />
              <Bar className="h-3 w-36" />
            </div>
            <div className="cc-sk-bar h-16 w-16 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CcCard className="h-[104px] rounded-[16px] sm:flex-1" />
            <CcCard className="h-[104px] rounded-[16px] sm:flex-[1.5]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <CcCard key={i} className="h-[52px] min-w-[64px] flex-1 rounded-[13px]" />
            ))}
          </div>
          <CcCard className="h-[68px] rounded-[16px]" />
          <span className="sr-only">Loading your profile</span>
        </div>
      );
      break;
    default: // "home"
      body = (
        <div className="mx-auto max-w-2xl space-y-5" aria-busy="true">
          <Masthead />
          <CcCard className="h-56" />
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <CcCard key={i} className="flex items-center gap-3 p-4">
                <div className="cc-sk-bar h-11 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bar className="h-3.5 w-2/3" />
                  <Bar className="h-2.5 w-2/5" />
                </div>
                <Bar className="h-9 w-16 shrink-0 rounded-lg" />
              </CcCard>
            ))}
          </div>
          <span className="sr-only">Loading</span>
        </div>
      );
  }

  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      {body}
    </>
  );
}
