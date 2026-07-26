"use client";

import { useMemo } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import type { ExplainerStep as Spec, StepComponentProps } from "@/lib/learn/schema";
import { getLessonSkin, EASE_OUT } from "../skin";
import { PrimaryButton, StepPrompt } from "../ui";
import styles from "../skin.module.css";

/**
 * The passive/read step — but a real editorial moment, not a text box. When it
 * carries a figure, that figure becomes the visual anchor: a big-stat / pull-
 * quote panel at feature scale (the "one idea dominant per step" rule).
 */
export default function ExplainerStep({
  spec,
  register,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const skin = useMemo(() => getLessonSkin(register), [register]);
  const hasFigure = !!spec.figure;

  return (
    <div>
      {spec.heading && <StepPrompt skin={skin}>{spec.heading}</StepPrompt>}

      <div
        className={
          hasFigure
            ? "grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
            : ""
        }
      >
        <div className="space-y-4">
          {spec.body.map((p, i) => (
            <m.p
              key={i}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07, ease: EASE_OUT }}
              className={`text-ink/85 ${i === 0 ? skin.type.lead : skin.type.body}`}
            >
              {p}
            </m.p>
          ))}
        </div>

        {spec.figure && (
          <m.figure
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.42, delay: 0.12, ease: EASE_OUT }}
            className={styles.figure}
          >
            {spec.figure.kind === "stat" ? (
              <div
                className={skin.type.figureStat}
                style={{ color: "var(--l-accent)" }}
              >
                {spec.figure.value}
              </div>
            ) : (
              <div className={`text-ink ${skin.type.lead}`}>
                <span style={{ color: "var(--l-accent)" }}>&ldquo;</span>
                {spec.figure.value}
                <span style={{ color: "var(--l-accent)" }}>&rdquo;</span>
              </div>
            )}
            {spec.figure.caption && (
              <figcaption className="mt-3 font-body text-[13px] font-medium uppercase tracking-wide text-soft">
                {spec.figure.caption}
              </figcaption>
            )}
          </m.figure>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <PrimaryButton onClick={() => onResolve({})} icon="arrow">
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
