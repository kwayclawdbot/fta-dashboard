"use client";

import { useState } from "react";
import { AGE_BANDS, type AgeBand } from "@/lib/family/parent-corner";
import { FamilyCard } from "@/components/family/canvas";

/**
 * F8 · age-banded tips (6–8 / 9–12 / 13+), drawn as the board draws them: a row
 * of pill tabs with the selected one filled in the accent, and the guidance in
 * a card beneath with the question set off in a warm quote block.
 *
 * A real tablist rather than three buttons: one tab stop, arrows within the
 * group, which is the keyboard model every one-of-N control in this system
 * shares.
 */
export default function AgeBandTips({ initial = "9-12" }: { initial?: AgeBand }) {
  const [band, setBand] = useState<AgeBand>(initial);
  const current = AGE_BANDS.find((b) => b.band === band) ?? AGE_BANDS[1];

  function move(delta: number) {
    const i = AGE_BANDS.findIndex((b) => b.band === band);
    const nextBand = AGE_BANDS[(i + delta + AGE_BANDS.length) % AGE_BANDS.length];
    setBand(nextBand.band);
    document.getElementById(`age-tab-${nextBand.band}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Age band" className="flex flex-wrap gap-2">
        {AGE_BANDS.map((b) => {
          const on = b.band === band;
          return (
            <button
              key={b.band}
              id={`age-tab-${b.band}`}
              role="tab"
              type="button"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setBand(b.band)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  move(1);
                }
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  move(-1);
                }
              }}
              className={`f0-focus f0-press rounded-full px-3.5 py-1.5 font-display text-[11.5px] font-bold transition-colors ${
                on
                  ? "bg-accent text-night-950"
                  : "border border-sand bg-card text-soft hover:text-ink"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      <FamilyCard className="mt-3">
        <p className="text-[13px] leading-relaxed text-ink">
          <strong className="font-display font-extrabold">{current.posture}</strong>{" "}
          {current.how}
        </p>
        <div
          className="mt-3 rounded-r-lg border-l-[3px] p-3 text-[12px] italic leading-relaxed text-soft"
          style={{
            borderLeftColor: "var(--accent-solid)",
            background: "color-mix(in srgb, var(--accent-solid) 12%, var(--card))",
          }}
        >
          💡 &ldquo;{current.question}&rdquo;
        </div>
      </FamilyCard>
    </div>
  );
}
