"use client";

import GameSession from "@/components/dashboard/GameSession";

export default function CandleBattlePage() {
  return (
    <GameSession
      game="candle-battle"
      title="Candle Battle"
      tagline="One candle is one battle. Who won it — the green team or the red team?"
      optionA={{ label: "GREEN TEAM", value: "GREEN TEAM", tone: "green" }}
      optionB={{ label: "RED TEAM", value: "RED TEAM", tone: "red" }}
      backHref="/games"
      backLabel="Back to games"
    />
  );
}
