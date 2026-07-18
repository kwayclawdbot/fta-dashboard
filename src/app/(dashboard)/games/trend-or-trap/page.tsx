"use client";

import GameSession from "@/components/dashboard/GameSession";

export default function TrendOrTrapPage() {
  return (
    <GameSession
      game="trend-or-trap"
      title="Trend or Trap"
      tagline="Is price climbing, or is it a trap? Make the call."
      optionA={{ label: "CLIMBING", value: "CLIMBING", tone: "green" }}
      optionB={{ label: "FALLING", value: "FALLING", tone: "red" }}
      backHref="/games"
      backLabel="Back to games"
    />
  );
}
