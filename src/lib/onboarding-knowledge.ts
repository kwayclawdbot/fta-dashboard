/**
 * Onboarding knowledge checks — the fun, kid-safe true/false quick-checks the
 * signup wizard runs between the profile questions. Two jobs at once:
 *   1. ENGAGEMENT — a light, game-y beat so the questionnaire never feels like a
 *      form (big True / False cards, instant "nice!" feedback).
 *   2. CALIBRATION — the score seeds a comprehension level that shapes how deep
 *      and how simply Kai talks to this member (kai_user_memory + profile field,
 *      migration 115). It is NEVER a gate or a grade shown as pass/fail — every
 *      answer is celebrated; a "wrong" one just teaches the fact.
 *
 * Register-aware (kid / teen / adult): kids get concrete, playful money facts;
 * teens/adults get investing basics. All questions are things the platform then
 * teaches — so "getting it wrong" is the whole point of joining.
 */

import type { Register } from "@/lib/register";

export interface KnowledgeCheck {
  id: string;
  /** The claim the member judges true or false. */
  statement: string;
  answer: boolean;
  /** One warm line shown after they answer — teaches, never scolds. */
  teach: string;
}

const ADULT_CHECKS: KnowledgeCheck[] = [
  {
    id: "own",
    statement: "A share of stock is a small piece of ownership in a real company.",
    answer: true,
    teach: "Exactly — buy a share of Apple and you own a tiny slice of Apple.",
  },
  {
    id: "guaranteed",
    statement: "If you buy a stock, its price is guaranteed to go up over time.",
    answer: false,
    teach: "Nope — prices rise and fall. That's why we learn to choose carefully and think long-term.",
  },
  {
    id: "diversify",
    statement: "Spreading your money across several companies is safer than betting it all on one.",
    answer: true,
    teach: "Right — that's called diversifying, and it's one of the first habits we'll build together.",
  },
  {
    id: "earnings",
    statement: "A company's \"earnings\" are basically how much profit it makes.",
    answer: true,
    teach: "You've got it — earnings are the profit left after a company pays its bills.",
  },
];

const TEEN_CHECKS: KnowledgeCheck[] = [
  {
    id: "own",
    statement: "When you buy a stock, you own a tiny piece of that company.",
    answer: true,
    teach: "Exactly — one share of Nike means you own a little bit of Nike.",
  },
  {
    id: "guaranteed",
    statement: "The stock market always goes up and never goes down.",
    answer: false,
    teach: "Nope — it moves both ways. Learning to handle that is a real superpower.",
  },
  {
    id: "compound",
    statement: "Money you invest early can grow on its own growth over the years.",
    answer: true,
    teach: "Yes — that's compounding, and starting young is your biggest advantage.",
  },
  {
    id: "diversify",
    statement: "Putting all your money into one single company is the safest plan.",
    answer: false,
    teach: "Not quite — spreading it out is safer. We'll show you how.",
  },
];

const KID_CHECKS: KnowledgeCheck[] = [
  {
    id: "own",
    statement: "When you buy a stock, you own a tiny piece of a real company.",
    answer: true,
    teach: "Yes! Own one share of a toy company and a little piece is yours.",
  },
  {
    id: "save",
    statement: "Saving money means keeping some of it to use later.",
    answer: true,
    teach: "That's right — saving is like planting seeds for later.",
  },
  {
    id: "alwaysup",
    statement: "The stock market always goes up and never goes down.",
    answer: false,
    teach: "Nope — sometimes it goes down too. That's totally normal!",
  },
  {
    id: "budget",
    statement: "A budget is a plan for how to use your money.",
    answer: true,
    teach: "You got it — a budget helps you decide where your money goes.",
  },
];

/** The check set for a member's register (adult / teen / kid). */
export function checksForRegister(register: Register): KnowledgeCheck[] {
  if (register === "kid") return KID_CHECKS;
  if (register === "teen") return TEEN_CHECKS;
  return ADULT_CHECKS;
}

export type Comprehension = "beginner" | "developing" | "proficient";

/**
 * Map a raw score to a comprehension seed. Deliberately generous — this only
 * tunes Kai's default depth; the member always drives from there.
 */
export function comprehensionFromScore(correct: number, total: number): Comprehension {
  if (total <= 0) return "developing";
  const pct = correct / total;
  if (pct >= 0.75) return "proficient";
  if (pct >= 0.4) return "developing";
  return "beginner";
}

/** Human-friendly label for the celebration + Kai memory line. */
export const COMPREHENSION_LABEL: Record<Comprehension, string> = {
  beginner: "just getting started",
  developing: "building the basics",
  proficient: "already comfortable with the basics",
};

/**
 * Compose the compact first-line Kai memory seed from onboarding. Kept short —
 * kai_user_memory caps ~1200 chars and this is only the initial seed the chat
 * route's rolling summary later builds on. Kid seeds carry NO personal detail
 * beyond learning context (privacy posture, migration 109).
 */
export function composeKaiSeed(opts: {
  register: Register;
  comprehension: Comprehension;
  correct: number;
  total: number;
  experience?: string | null;
  marketInterest?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `New member — onboarding quick-check ${opts.correct}/${opts.total}, comprehension: ${opts.comprehension} (${COMPREHENSION_LABEL[opts.comprehension]}).`
  );
  if (opts.register === "kid") {
    parts.push("This is a KID account — keep explanations simple, playful, and encouraging; use small concrete examples.");
  } else if (opts.register === "teen") {
    parts.push("Teen account — clear, respectful tone; real examples, no baby talk.");
  }
  if (opts.experience) parts.push(`States investing experience: ${opts.experience}.`);
  if (opts.marketInterest) parts.push(`Interested in: ${opts.marketInterest}.`);
  parts.push("Meet them at this level and build up from here.");
  return parts.join(" ").slice(0, 1000);
}
