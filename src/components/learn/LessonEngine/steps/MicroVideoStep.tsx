"use client";

import { useMemo, useRef, useState } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { Play } from "lucide-react";
import type {
  MicroVideoStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { getLessonSkin, EASE_OUT } from "../skin";
import { PrimaryButton, StepPrompt, GuideLine } from "../ui";

/**
 * micro_video (Track A / A6) — plays a Track-B Remotion clip. Autoplay-muted-
 * inline where allowed, poster-first, caption-friendly (WebVTT track), and
 * always skippable. Null-safe: if no asset URL is authored, it degrades to a
 * simple Continue so a lesson can carry the step before the render lands.
 */
export default function MicroVideoStep({
  spec,
  register,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const skin = useMemo(() => getLessonSkin(register), [register]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function play() {
    setStarted(true);
    videoRef.current?.play().catch(() => {});
  }

  return (
    <div>
      {spec.heading && <StepPrompt skin={skin}>{spec.heading}</StepPrompt>}

      {spec.src ? (
        <m.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_OUT }}
          className="relative overflow-hidden rounded-3xl"
          style={{ border: "1.5px solid var(--l-field-border)", background: "#0F1115" }}
        >
          <video
            ref={videoRef}
            className="aspect-video w-full bg-[#0F1115]"
            src={spec.src}
            poster={spec.poster}
            controls={started}
            muted
            autoPlay={!reduce}
            playsInline
            preload="metadata"
            onPlay={() => setStarted(true)}
            onEnded={() => setStarted(true)}
          >
            {spec.captions && (
              <track kind="captions" src={spec.captions} srcLang="en" label="English" default />
            )}
          </video>

          {!started && (
            <button
              onClick={play}
              aria-label="Play video"
              className="absolute inset-0 grid place-items-center bg-black/20 transition-colors hover:bg-black/10"
            >
              <span
                className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition-transform duration-150 active:scale-95"
                style={{ background: "var(--l-accent)" }}
              >
                <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
              </span>
            </button>
          )}
        </m.div>
      ) : (
        <div className="rounded-3xl border border-dashed border-sand px-6 py-10 text-center">
          <p className="font-body text-[15px] text-soft">
            A short clip for this concept is on the way.
          </p>
        </div>
      )}

      {spec.caption && (
        <p className={`mt-4 text-soft ${skin.type.body}`}>{spec.caption}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GuideLine skin={skin} pose="teaching">
            Watch this, then we&apos;ll put it to work.
          </GuideLine>
        </div>
        <PrimaryButton onClick={() => onResolve({})} icon="arrow">
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
