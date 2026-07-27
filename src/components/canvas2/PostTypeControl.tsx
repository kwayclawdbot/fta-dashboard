"use client";

import SegmentedRail from "./Segmented";

/* ══════════════════════════════════════════════════════════════════════════
   POST TYPE CONTROL — canvas v2 §1.2 (Club Screens 05, "Post type").

   The structured composer requires a member to say what KIND of contribution
   they are making before they write it: a thesis, a risk, a chart, or a change
   of mind. That is the whole leverage of the structured composer — a feed of
   typed contributions can be filtered, weighted and answered; a feed of
   untyped text boxes can only be scrolled.

   ── FORM ─────────────────────────────────────────────────────────────────
   The canvas draws four filled pills, one black and three outlined. That is
   pill soup by the brand register: four rounded rectangles of equal weight
   where the chosen one is told apart by fill alone. This uses the system's
   existing "one of N" answer instead — a hairline rail with the choice marked
   by weight and a bar (see Segmented.tsx for the full argument).

   Unlike StanceControl the cells are NOT distributed evenly: "CHANGED MY MIND"
   is four times the width of "RISK", and forcing four unequal labels to equal
   width at 390px either truncates the long one or leaves three cells mostly
   empty. They pack left and the rail scrolls.

   ── COLOUR ───────────────────────────────────────────────────────────────
   The bar is the ACCENT, by law: choosing a post type is an authoring ACTION,
   and action is the brand colour — Club orange, Family gold, FTA metallic.
   It is deliberately NOT StanceControl's lime: the two controls sit inches
   apart in the composer and mean different things (what I am doing vs what the
   club thinks), so they must not share a "selected" colour.

   `bg-accent` rather than `bg-volt-500` — a neutral primitive that hardcodes
   volt paints Club orange onto Family surfaces, which is the mode-isolation
   defect the f0 primitives were repointed to fix. Caught here in Family dark.
   The hint line uses text-gold-700 for the same reason it is used everywhere
   else: the volt ramp is frozen across themes and volt-700 lands ~2.5:1 on the
   dark page, while gold IS volt in club mode and lifts in both registers.

   ── BELOW FLOOR ──────────────────────────────────────────────────────────
   There is no data floor here (it is a form control, not a signal), but there
   IS an empty state: nothing is selected until the member picks, and the hint
   line says what to do rather than describing a type nobody chose.
   ══════════════════════════════════════════════════════════════════════════ */

export type PostType = "thesis" | "risk" | "chart" | "changed_mind";

export interface PostTypeDef {
  key: PostType;
  label: string;
  /** One line telling the member what belongs under this type. Shown under the
   *  rail for the CURRENT selection — the composer's whole job is getting a
   *  better post, and this is the cheapest place to ask for one. */
  hint: string;
}

/** Canvas order. `changed_mind` is last and is the one the Club actually
 *  rewards — see the Changed My Mind destination (Club Screens 03). */
export const POST_TYPES: PostTypeDef[] = [
  {
    key: "thesis",
    label: "Thesis",
    hint: "What you believe and why. Lead with the claim, then the evidence you ran.",
  },
  {
    key: "risk",
    label: "Risk",
    hint: "What would break this. The specific thing that makes you wrong, not a hedge.",
  },
  {
    key: "chart",
    label: "Chart",
    hint: "The level or pattern you are reading, and what it would take to invalidate it.",
  },
  {
    key: "changed_mind",
    label: "Changed my mind",
    hint: "What you said before, and what changed it. The Club rewards the update, not the ego.",
  },
];

export const POST_TYPE_BY_KEY: Record<PostType, PostTypeDef> = Object.fromEntries(
  POST_TYPES.map((t) => [t.key, t])
) as Record<PostType, PostTypeDef>;

export interface PostTypeControlProps {
  value: PostType | null;
  onChange: (t: PostType) => void;
  /** Restrict the offered types (the Changed My Mind destination composes only
   *  one kind of post; a chart-less surface can drop "chart"). */
  allow?: PostType[];
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  /** Hides the hint line where space is genuinely unavailable. */
  showHint?: boolean;
  ariaLabel?: string;
  className?: string;
}

export default function PostTypeControl({
  value,
  onChange,
  allow,
  disabled = false,
  loading = false,
  size = "md",
  showHint = true,
  ariaLabel = "Post type",
  className = "",
}: PostTypeControlProps) {
  const types = allow ? POST_TYPES.filter((t) => allow.includes(t.key)) : POST_TYPES;

  // ── LOADING — the rail's shape, nothing selected, no hint claimed ────────
  if (loading) {
    return (
      <div className={className} aria-busy="true">
        <div className="club2-track flex gap-6 overflow-hidden border-b border-sand">
          {[16, 10, 12, 24].map((w, i) => (
            <div key={i} className="pb-3">
              <div
                className="h-2.5 rounded-full bg-sand motion-safe:animate-pulse"
                style={{ width: w * 4 }}
              />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading post types</span>
      </div>
    );
  }

  const hint = value
    ? POST_TYPE_BY_KEY[value].hint
    : "Pick what kind of post this is — it decides who sees it and how it gets answered.";

  return (
    <div className={className}>
      <SegmentedRail
        options={types.map((t) => ({ id: t.key, label: t.label }))}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        disabled={disabled}
        size={size}
        // The ACCENT fill, not bg-volt-500. Hardcoding volt here would paint
        // Club orange onto a Family or FTA composer — the exact mode-isolation
        // defect that forced f0-section-rule and f0-ledger-row onto
        // --accent-solid. bg-accent resolves to family gold / club orange / FTA
        // metallic for free, and holds its value in both themes.
        barClassName="bg-accent"
        activeTextClassName="text-ink"
      />
      {showHint && (
        <p
          className={`mt-2 text-[12.5px] leading-snug ${
            value ? "text-soft" : "text-gold-700"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
