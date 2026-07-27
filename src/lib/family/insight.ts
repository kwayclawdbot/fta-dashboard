/**
 * Deterministic family insight — the Parent Corner weekly report, derived with
 * ZERO LLM from `skill_mastery` (migration 166) + the `skills` graph (164).
 *
 * The signature line ("ahead on charts, behind on patience") and the coaching
 * body + conversation starters are computed from each child's per-DOMAIN average
 * mastery. Strongest domain → "ahead on X"; weakest studied domain → "behind on
 * Y". Every string is a fixed template keyed off the domain — reproducible,
 * auditable, no model in the loop.
 */

/** A mastery row as read from `skill_mastery` (only the fields we need). */
export interface MasteryRow {
  skill_id: string;
  mastery_score: number;
  attempts: number;
}

/** The `skills` graph rows we join against for domain grouping. */
export interface SkillRow {
  id: string;
  domain: string;
}

/** The five skill domains, given parent-facing plain-English identities. */
const DOMAIN: Record<
  string,
  { short: string; label: string; nails: string; skips: string; nudge: string }
> = {
  business: {
    short: "the business side",
    label: "Business basics",
    nails: "can explain what a company sells and how it makes money",
    skips: "rushes past why that business actually wins",
    nudge:
      "Ask them to name one company they'd never sell — and to say out loud why not.",
  },
  markets: {
    short: "how markets work",
    label: "How markets work",
    nails: "gets how buyers and sellers set a price",
    skips: "still mixes up a good company with a good stock",
    nudge:
      "Ask: \"Where does the money actually come from when a stock goes up?\"",
  },
  technical: {
    short: "charts",
    label: "Chart reading",
    nails: "nails the pattern questions",
    skips: "skips the “why” step behind the pattern",
    nudge: "Ask them to explain one chart call out loud this week.",
  },
  risk: {
    short: "patience",
    label: "Patience & risk",
    nails: "spots strengths quickly",
    skips: "forgets to name what could go wrong",
    nudge:
      "When they praise a company, ask for one risk before you move on.",
  },
  psychology: {
    short: "patience",
    label: "Patience & risk",
    nails: "gets excited about the ideas",
    skips: "feels the pull to “win” fast instead of studying",
    nudge:
      "Remind them: the gambler hopes, the investor studies and waits.",
  },
};

/** Conversation starters keyed to the domain that needs the most work. */
const STARTERS: Record<string, string[]> = {
  business: [
    "“Name a company you'd never sell. Why not?”",
    "“What would make you change your mind about it?”",
    "“Where does the money actually come from?”",
  ],
  markets: [
    "“Why does a stock go up when more people want it?”",
    "“Can a great company still be a bad stock? How?”",
    "“What's the difference between price and value?”",
  ],
  technical: [
    "“What is that chart actually telling you?”",
    "“Why did you make that call — walk me through it.”",
    "“What would prove you wrong here?”",
  ],
  risk: [
    "“What could make people buy less of this?”",
    "“If this went down 20%, would you still want it?”",
    "“Name one thing that could go wrong.”",
  ],
  psychology: [
    "“Why do we study one company a week instead of chasing fast wins?”",
    "“What's the difference between hoping and investing?”",
    "“What would make a patient investor wait here?”",
  ],
};

export interface FamilyInsight {
  /** Signature headline, e.g. "Kojo is ahead on charts, behind on patience". */
  headline: string;
  /** Deterministic coaching body. */
  body: string;
  /** Three conversation starters keyed to the weakest domain. */
  starters: string[];
  /** Per-domain average mastery (0–100) for the strengths bars. */
  strengths: { domain: string; label: string; score: number }[];
  /** True when the child has enough attempts for a real read. */
  hasSignal: boolean;
}

/**
 * Compute the deterministic weekly insight for one child.
 * `starterFallback` (e.g. the week's dinner questions) is used only when there
 * isn't enough mastery signal yet.
 */
export function familyInsight(
  childName: string,
  mastery: MasteryRow[],
  skills: SkillRow[],
  starterFallback: string[] = []
): FamilyInsight {
  const domainOf = new Map(skills.map((s) => [s.id, s.domain]));

  // Average mastery per domain (only domains the child has actually touched).
  const agg: Record<string, { sum: number; n: number; attempts: number }> = {};
  for (const row of mastery) {
    const d = domainOf.get(row.skill_id);
    if (!d) continue;
    if (!agg[d]) agg[d] = { sum: 0, n: 0, attempts: 0 };
    agg[d].sum += row.mastery_score;
    agg[d].n += 1;
    agg[d].attempts += row.attempts;
  }

  const strengths = Object.entries(agg)
    .map(([domain, v]) => ({
      domain,
      label: DOMAIN[domain]?.label ?? domain,
      score: Math.round(v.sum / v.n),
    }))
    .sort((a, b) => b.score - a.score);

  const totalAttempts = Object.values(agg).reduce((s, v) => s + v.attempts, 0);
  const hasSignal = strengths.length >= 2 && totalAttempts >= 3;

  if (!hasSignal) {
    return {
      headline: `${childName} is just getting started`,
      body: `Not enough practice yet to read strengths. Once ${childName} finishes a few more lessons and checks, the weekly report fills in here.`,
      starters:
        starterFallback.length > 0
          ? starterFallback.slice(0, 3)
          : STARTERS.business,
      strengths,
      hasSignal: false,
    };
  }

  const strong = strengths[0];
  const weak = strengths[strengths.length - 1];
  const strongMeta = DOMAIN[strong.domain];
  const weakMeta = DOMAIN[weak.domain];

  const headline = `${childName} is ahead on ${strongMeta.short}, behind on ${weakMeta.short}`;
  const body = `They ${strongMeta.nails}, but ${weakMeta.skips}. ${weakMeta.nudge}`;

  return {
    headline,
    body,
    starters: STARTERS[weak.domain] ?? STARTERS.business,
    strengths,
    hasSignal: true,
  };
}
