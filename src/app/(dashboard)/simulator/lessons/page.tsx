"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SCENARIOS, type ScenarioDefinition } from "@/lib/simulator/scenarios";
import { createClient } from "@/lib/supabase/client";
import SimulatorTabs from "@/components/simulator/SimulatorTabs";

/**
 * PRACTICE · PATTERN PRACTICE — the index of scenarios.
 *
 * Same scenarios, same completion source (`sim_scenario_scores`, passed only),
 * same links. The four-across card grid is gone: each pattern is now one ruled
 * line in a hairline ledger under a section rule, which is also what lets the
 * list carry the description without the cards all growing to match.
 *
 * COLOUR LAW: nothing here is a price, so nothing here is green or red — the
 * old difficulty pills spent the price colours on a label. Difficulty and bias
 * are mono type; a passed pattern is marked with the brand check.
 */

export default function LessonsPage() {
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScores() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from("sim_scenario_scores")
          .select("scenario_id, passed")
          .eq("user_id", user.id)
          .eq("passed", true);

        if (data) {
          setCompletedScenarios(new Set(data.map((d) => d.scenario_id)));
        }
      } catch {
        // tables may not exist yet
      }
      setLoading(false);
    }
    loadScores();
  }, []);

  const chartPatterns = SCENARIOS.filter((s) => s.category === "chart");
  const candlestickPatterns = SCENARIOS.filter((s) => s.category === "candlestick");
  const totalPassed = completedScenarios.size;
  const pct = SCENARIOS.length > 0 ? (totalPassed / SCENARIOS.length) * 100 : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-7 pb-24">
        <SimulatorTabs />
        <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
          Loading your patterns…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <SimulatorTabs />

      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Practice
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold text-ink">
          Pattern practice
        </h1>
        <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-soft">
          Watch a pattern form bar by bar, call it, then watch how it actually
          resolved. Chart patterns and candlesticks, one decision at a time.
        </p>

        {/* Progress — a meter, not a stat card. Progress toward something you
            can act on is volt by law. */}
        <div className="mt-5 flex max-w-sm items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuenow={totalPassed}
            aria-valuemin={0}
            aria-valuemax={SCENARIOS.length}
          >
            <div
              className="h-full rounded-full bg-volt-500 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
            {totalPassed}/{SCENARIOS.length} passed
          </span>
        </div>
      </header>

      <ScenarioLedger
        id="chart-patterns"
        label={`Chart patterns · ${chartPatterns.length}`}
        scenarios={chartPatterns}
        completed={completedScenarios}
      />

      <ScenarioLedger
        id="candlestick-patterns"
        label={`Candlestick patterns · ${candlestickPatterns.length}`}
        scenarios={candlestickPatterns}
        completed={completedScenarios}
      />
    </div>
  );
}

function ScenarioLedger({
  id,
  label,
  scenarios,
  completed,
}: {
  id: string;
  label: string;
  scenarios: ScenarioDefinition[];
  completed: Set<string>;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="f0-section-rule mb-1 font-display text-eyebrow font-bold uppercase text-soft"
      >
        <span className="shrink-0 whitespace-nowrap">{label}</span>
      </h2>

      {scenarios.length === 0 ? (
        <p className="py-4 text-[13.5px] leading-relaxed text-soft">
          No patterns in this set yet.
        </p>
      ) : (
        <div className="f0-ledger">
          {scenarios.map((s) => {
            const done = completed.has(s.id);
            return (
              <Link
                key={s.id}
                href={`/simulator/lessons/${s.id}`}
                className="f0-ledger-row group"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight text-ink">
                    {s.name}
                    {done && (
                      <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-gold-700">
                        <Check className="h-3 w-3" />
                        Passed
                      </span>
                    )}
                  </p>
                  <p className="mt-1 max-w-xl text-[12.5px] leading-snug text-soft">
                    {s.description}
                  </p>
                </div>
                <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                  <span className="block">{s.difficulty}</span>
                  <span className="mt-0.5 block">
                    {s.correctAction === "buy"
                      ? "Bullish"
                      : s.correctAction === "sell"
                        ? "Bearish"
                        : "Neutral"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
