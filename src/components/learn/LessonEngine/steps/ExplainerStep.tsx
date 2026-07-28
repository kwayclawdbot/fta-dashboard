"use client";

import { m, useReducedMotion } from "@/lib/motion";
import type { ExplainerStep as Spec, StepComponentProps } from "@/lib/learn/schema";
import { PrimaryButton, StepPrompt, EASE_OUT } from "../ui";
import OrderBookFigure from "../OrderBookFigure";

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
      {/* Long-form reading: a real measure (~65ch), 17px, generous leading.
          The figure is a typographic pull-quote on a rule — not a tinted box. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {spec.body.map((p, i) => (
            <m.p
              key={i}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.06, ease: EASE_OUT }}
              className="max-w-[65ch] text-[17px] leading-[1.65] text-ink"
            >
              {p}
            </m.p>
          ))}
        </div>
        {spec.figure && (
          <m.figure
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: EASE_OUT }}
            className="shrink-0 border-l-2 border-gold-500 py-1 pl-4 sm:w-48"
          >
            {spec.figure.kind === "stat" ? (
              <div className="font-display text-display-2 font-extrabold tabular-nums text-ink">
                {spec.figure.value}
              </div>
            ) : (
              <div className="font-display text-[19px] font-bold leading-snug text-ink">
                “{spec.figure.value}”
              </div>
            )}
            {spec.figure.caption && (
              <figcaption className="mt-2 text-eyebrow font-display font-bold uppercase text-soft">
                {spec.figure.caption}
              </figcaption>
            )}
          </m.figure>
        )}
      </div>
      {/* The authored teaching object, under the prose it belongs to. */}
      {spec.illustration && <OrderBookFigure spec={spec.illustration} />}
      <div className="mt-7 flex justify-end">
        <PrimaryButton onClick={() => onResolve({})} icon="arrow">
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
