"use client";

import { m, useReducedMotion } from "@/lib/motion";
import type { ExplainerStep as Spec, StepComponentProps } from "@/lib/learn/schema";
import { PrimaryButton, StepPrompt, EASE_OUT } from "../ui";

/** Non-interactive concept block. The "video is one block type" idea, in text/
 *  figure form — a passive step the member reads, then continues. */
export default function ExplainerStep({
  spec,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  return (
    <div>
      {spec.heading && <StepPrompt>{spec.heading}</StepPrompt>}
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-3">
          {spec.body.map((p, i) => (
            <m.p
              key={i}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.06, ease: EASE_OUT }}
              className="font-body text-[15px] leading-relaxed text-ink/85"
            >
              {p}
            </m.p>
          ))}
        </div>
        {spec.figure && (
          <m.figure
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
            className="rounded-2xl bg-gradient-to-br from-gold-400/15 to-chip-sky/40 px-5 py-6 text-center sm:w-52"
          >
            {spec.figure.kind === "stat" ? (
              <div className="font-display text-4xl font-black tracking-tight text-gold-700">
                {spec.figure.value}
              </div>
            ) : (
              <div className="font-display text-lg font-semibold leading-snug text-ink">
                “{spec.figure.value}”
              </div>
            )}
            {spec.figure.caption && (
              <figcaption className="mt-2 font-body text-xs text-soft">
                {spec.figure.caption}
              </figcaption>
            )}
          </m.figure>
        )}
      </div>
      <div className="mt-7 flex justify-end">
        <PrimaryButton onClick={() => onResolve({})} icon="arrow">
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
