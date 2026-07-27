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
