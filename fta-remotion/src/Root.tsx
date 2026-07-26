import React from "react";
import { Composition } from "remotion";
import { ConceptExplainer, conceptSchema, ConceptProps } from "./ConceptExplainer";
import { AnswerReveal, revealSchema, RevealProps } from "./AnswerReveal";
import { COLORS } from "./lib/theme";

const FPS = 30;
const CONCEPT_FRAMES = 900; // 30s
const REVEAL_FRAMES = 600; // 20s

// --- Pilot content: real, verifiable public figures ---
const conceptRevenue: ConceptProps = {
  title: "What is Revenue?",
  definition:
    "Revenue is the total money a company brings in from selling its products and services — before any costs are paid.",
  exampleCompany: "Apple",
  exampleTicker: "AAPL",
  exampleValuePrefix: "$",
  exampleValueNumber: 383.3,
  exampleValueSuffix: "B",
  exampleNote: "Apple's total revenue in fiscal year 2023.",
  glow: COLORS.kai,
};

const revealMeta: RevealProps = {
  company: "Meta",
  ticker: "META",
  setup:
    "Meta reported Q4 2023 earnings. Revenue grew 25% and the company announced its first-ever dividend.",
  question: "Did the stock go UP or DOWN?",
  answer: "up",
  moveValuePrefix: "+",
  moveValueNumber: 20.3,
  moveValueSuffix: "%",
  moveNote:
    "META jumped +20.3% the next day — a record ~$196B single-day gain in market value (Feb 2, 2024).",
  why:
    "Investors saw growth reaccelerating, margins expanding, and cash finally being returned to shareholders — all at once.",
  glow: COLORS.volt,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="concept-revenue-vertical"
        component={ConceptExplainer}
        durationInFrames={CONCEPT_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        schema={conceptSchema}
        defaultProps={conceptRevenue}
      />
      <Composition
        id="concept-revenue-wide"
        component={ConceptExplainer}
        durationInFrames={CONCEPT_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        schema={conceptSchema}
        defaultProps={conceptRevenue}
      />
      <Composition
        id="reveal-meta-vertical"
        component={AnswerReveal}
        durationInFrames={REVEAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        schema={revealSchema}
        defaultProps={revealMeta}
      />
      <Composition
        id="reveal-meta-wide"
        component={AnswerReveal}
        durationInFrames={REVEAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        schema={revealSchema}
        defaultProps={revealMeta}
      />
    </>
  );
};
