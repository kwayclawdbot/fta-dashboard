/**
 * F8 · PARENT CORNER — the written content.
 *
 * "Tools to guide conversations that build wealth and values." This is editorial
 * copy, not data, so it lives in the codebase rather than pretending to be a
 * feed. It is written in the adult register the brand asks for: a parent is
 * being handed something to use tonight, not being coached at.
 *
 * Nothing here is investment advice and nothing here names a security. These are
 * conversation prompts about money, work and value — the layer underneath any
 * ticker.
 */

export type AgeBand = "6-8" | "9-12" | "13+";

export interface BandGuidance {
  band: AgeBand;
  label: string;
  /** The one-line posture for this band. */
  posture: string;
  /** How to run the conversation at this age. */
  how: string;
  /** A question that actually opens something. */
  question: string;
}

export const AGE_BANDS: BandGuidance[] = [
  {
    band: "6-8",
    label: "Ages 6–8",
    posture: "Make it concrete and visual.",
    how: "Abstractions do not land yet — money is what you can see, count and swap. Use the objects already in the room: the cereal box, the shoes, the game they play. Let them handle real coins and physically split a pile into spend, save and give. One idea per conversation is plenty, and the conversation should be shorter than you think.",
    question: "Who do you think gets the money when we buy this?",
  },
  {
    band: "9-12",
    label: "Ages 9–12",
    posture: "Move from things to systems.",
    how: "This is the age where a company stops being a logo and becomes a thing that employs people and sells something. Trace one product all the way back — who made it, who shipped it, who got paid at each step. Let them be wrong out loud; the point is the reasoning, not the answer. Introduce waiting: something worth saving three weeks for teaches more than anything you can say about patience.",
    question: "If you owned this company, what would you change first — and why?",
  },
  {
    band: "13+",
    label: "Teens 13+",
    posture: "Treat them as a junior partner, not an audience.",
    how: "They can hold two competing ideas now, so give them both: the case for a company and the case against it, and let them argue a side. Talk about the real trade-offs in your own household budget where you can — teens spot a sanitised version instantly. Above all, let them make a decision on their paper account and be wrong without rescuing them from it. A loss they survive at fifteen is the cheapest tuition they will ever pay.",
    question: "What would have to be true for you to change your mind about this one?",
  },
];

/**
 * ALWAYS-ON GUIDANCE — the five standing principles.
 *
 * These are carried across VERBATIM from the retired `/parent-corner` route,
 * which held the substantial education-first material this surface was missing.
 * They are the most load-bearing copy in Family Mode: the first ("Education
 * first, never a stock tip") and the last ("Keep it safe and pressure-free")
 * are compliance posture as much as they are parenting advice, and the wording
 * is deliberate. Restyle freely; do not rewrite, summarise or drop one.
 *
 * The old route rendered each of these behind a gold icon disc. The icons are
 * gone (canvas language: hierarchy from type and rules, not from chrome) but
 * every word is intact.
 */
export interface GuidancePrinciple {
  id: string;
  title: string;
  body: string;
}

export const ALWAYS_ON_GUIDANCE: GuidancePrinciple[] = [
  {
    id: "education-first",
    title: "Education first, never a stock tip",
    body: "Nothing in the club is advice to buy or sell. We study how real businesses work so your kids build judgment. If a lesson ever starts to feel like a hot tip, steer it back to “what does this company actually do, and how does it make money?”",
  },
  {
    id: "risk",
    title: "How to talk about risk",
    body: "Every company — even the biggest — has things that could go wrong. Normalize this. When your child names a strength, gently ask for a risk too. “What could make people buy less of this?” builds the habit of looking at both sides before forming an opinion.",
  },
  {
    id: "patience",
    title: "Patience and the long game",
    body: "Investing rewards patience, and kids feel the pull to “win” fast. Remind them we’re building a habit — one company a week — not chasing quick money. The gambler hopes; the investor studies and waits.",
  },
  {
    id: "process",
    title: "Praise the process, not the price",
    body: "Celebrate good questions and careful research, not whether a practice pick went up. “Great thinking on that risk” teaches more than “nice, it went up.” This keeps confidence tied to effort, which is the skill that lasts.",
  },
  {
    id: "pressure-free",
    title: "Keep it safe and pressure-free",
    body: "No real money is required to take part, and there’s no pressure to open accounts or contribute. Whether and how much your family sets aside is a private decision you make at home. Let each kid go at their own pace.",
  },
];

/**
 * THIS WEEK'S COACHING — the labels for the six parent fields on `fic_weeks`.
 *
 * Also carried from the retired route. The order is editorial (what happened →
 * how to open it → how to explain it → what to avoid → risk → patience) and the
 * icons that used to sit beside each are gone for the same reason as above.
 */
export const WEEKLY_PARENT_FIELDS: {
  key:
    | "parent_what_child_learned"
    | "parent_dinner_questions"
    | "parent_explain_simply"
    | "parent_what_not_to_do"
    | "parent_risk_talk"
    | "parent_patience";
  title: string;
}[] = [
  { key: "parent_what_child_learned", title: "What your child learned" },
  // (see CHILD_LEARNED_KEY below — this one field is a report, and a report
  //  about a week nobody has opened yet is a claim the app cannot make.)
  { key: "parent_dinner_questions", title: "Dinner-table questions" },
  { key: "parent_explain_simply", title: "Explain it simply" },
  { key: "parent_what_not_to_do", title: "What not to do" },
  { key: "parent_risk_talk", title: "The risk talk" },
  { key: "parent_patience", title: "On patience" },
];

/**
 * THE ONE FIELD THAT IS A REPORT.
 *
 * Five of the six weekly notes are instructions to a parent — how to open it,
 * how to explain it, what to avoid. They are true the moment they are
 * published. The sixth is different: "What your child learned" is written in
 * the past tense about a specific child ("Your child learned that a stock is a
 * small piece of ownership…"), and the Parent Corner rendered it to every
 * household the day a week went live — including households whose kids have
 * earned no XP and completed no mission all week. That is the app telling a
 * parent something happened that did not happen.
 *
 * The content is still the right content; only the CLAIM is wrong. So when
 * there is no child activity behind it, the same note ships as the week's
 * CURRICULUM — what the family is about to cover — under its own heading and in
 * the forward voice. When the kids have actually been in it, the report stands
 * as written.
 */
export const CHILD_LEARNED_KEY = "parent_what_child_learned" as const;

/** The heading the note carries when it is a plan rather than a report. */
export const CHILD_LEARNED_LOOKAHEAD_TITLE = "This week's lesson";

/**
 * Turn the report into the plan. Two narrow, deliberate substitutions on the
 * editor's own sentence — the tense of the claim and nothing else. We do not
 * paraphrase editorial copy at render time; we only stop it from asserting a
 * past that has not occurred.
 */
export function asLookaheadVoice(body: string): string {
  return body
    .replace(
      /^\s*your (?:child|kid|kids|children) learned\b/i,
      "This week your family learns"
    )
    .replace(/\bWe used\b/g, "We use");
}

/**
 * FAMILY NIGHT — the four questions the guided flow walks a household through,
 * one at a time.
 *
 * NOT NEW COPY. Every string returned here is already written above and already
 * rendered on /family/corner; family night simply sequences four of them so a
 * parent is not reading a wall of prompts at the table. Writing a second set
 * would have split the editorial voice across two files and left the corner and
 * the night saying different things about the same evening.
 *
 * The first three are the OPENING prompt of each conversation topic — the
 * prompts are written in escalating order, so the openers are the ones that
 * work cold. The closer is the age-band question, the only prompt tuned to who
 * is actually in the room, and the one worth landing on last.
 */

/**
 * The question the kid-level one-pager ends on.
 *
 * Lifted verbatim from the "How to talk about risk" principle above, where it
 * is already given to parents as the question that builds the both-sides habit.
 * It is the right closer for a one-pager because it is about THIS company and it
 * cannot be answered with a price. Deliberately not one of the four discussion
 * questions — nothing in this flow asks the same thing twice.
 */
export const ONE_PAGER_QUESTION = "What could make people buy less of this?";
export function bandForAgeGroup(ageGroup: string | null | undefined): BandGuidance {
  // Profiles carry the coarse app-wide vocabulary ("kids" / "teens" / "adults"),
  // not the editorial bands. Teens map cleanly; "kids" spans 6–12, and the 9–12
  // posture is the safe middle — it reads fine to an eight-year-old's parent,
  // whereas the 6–8 posture would talk down to a twelve-year-old's.
  if (ageGroup === "teens") return AGE_BANDS[2];
  return AGE_BANDS[1];
}

export function familyNightQuestions(ageGroup: string | null | undefined): string[] {
  return [
    ...CONVERSATION_TOPICS.map((t) => t.prompts[0]),
    bandForAgeGroup(ageGroup).question,
  ];
}

export interface ConversationTopic {
  id: string;
  title: string;
  sub: string;
  /** Three prompts, in escalating order. */
  prompts: string[];
}

export const CONVERSATION_TOPICS: ConversationTopic[] = [
  {
    id: "mindset",
    title: "Money Mindset",
    sub: "Help kids think about money",
    prompts: [
      "What is one thing money can help you do that has nothing to do with buying something?",
      "Do you think being good with money is something you are born with, or something you practise?",
      "Tell me about a time you wanted something badly and then stopped wanting it. What changed?",
    ],
  },
  {
    id: "needs-wants",
    title: "Needs vs. Wants",
    sub: "Teach smart choices early",
    prompts: [
      "Pick three things in this room. Which one could we live without, and who decides?",
      "If we could only buy one of these this month, which would you choose — and what are you giving up?",
      "What is something you were sure was a need last year that turned out to be a want?",
    ],
  },
  {
    id: "earning",
    title: "Earning & Saving",
    sub: "Build habits that last",
    prompts: [
      "How does the place I work actually make its money? Ask me until it makes sense.",
      "What is a job you would do for free, and what is one you would only do for money?",
      "If you saved every week for a year, what would you want to have at the end of it?",
    ],
  },
];
