"use client";

import type { ComponentType } from "react";
import type { StepComponentProps, StepType } from "@/lib/learn/schema";
import ExplainerStep from "./steps/ExplainerStep";
import MultipleChoiceStep from "./steps/MultipleChoiceStep";
import TrueFalseStep from "./steps/TrueFalseStep";
import MatchPairsStep from "./steps/MatchPairsStep";
import PredictionStep from "./steps/PredictionStep";
import RealWorldStep from "./steps/RealWorldStep";

/**
 * Step registry — StepType → component. Unknown types resolve to undefined and
 * the engine skips them gracefully (forward-compat: authored JSON can reference
 * a step type a given client build doesn't ship yet).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STEP_REGISTRY: Partial<Record<StepType, ComponentType<StepComponentProps<any>>>> = {
  explainer: ExplainerStep,
  multiple_choice: MultipleChoiceStep,
  true_false: TrueFalseStep,
  match_pairs: MatchPairsStep,
  prediction: PredictionStep,
  real_world: RealWorldStep,
};
