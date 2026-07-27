"use client";

import { useState } from "react";
import { SegmentedRail } from "@/components/canvas2";
import { AGE_BANDS, type AgeBand } from "@/lib/family/parent-corner";

/**
 * F8 · age-banded tips (6–8 / 9–12 / 13+).
 *
 * SegmentedRail because it is a one-of-N choice, and every one-of-N control in
 * this system shares that keyboard model — one tab stop, arrows within the
 * group. Three tabs would have been a fourth answer to a question already
 * answered.
 */
export default function AgeBandTips({ initial = "9-12" }: { initial?: AgeBand }) {
  const [band, setBand] = useState<AgeBand>(initial);
  const current = AGE_BANDS.find((b) => b.band === band) ?? AGE_BANDS[1];

  return (
    <div>
      <SegmentedRail
        ariaLabel="Age band"
        fill
        options={AGE_BANDS.map((b) => ({ id: b.band, label: b.label }))}
        value={band}
        onChange={(v) => setBand(v as AgeBand)}
        barClassName="bg-accent"
      />

      <div className="mt-6">
        <p className="font-display text-display-3 font-extrabold text-ink">
          {current.posture}
        </p>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft">{current.how}</p>
        <p className="f0-rule-left mt-6 py-1 pl-4 text-[15px] leading-relaxed text-ink">
          &ldquo;{current.question}&rdquo;
        </p>
      </div>
    </div>
  );
}
