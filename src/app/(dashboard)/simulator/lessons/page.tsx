"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SCENARIOS, type ScenarioDefinition } from "@/lib/simulator/scenarios";
import { createClient } from "@/lib/supabase/client";
import { Meter } from "@/components/f0/parts";
import SimulatorTabs from "@/components/simulator/SimulatorTabs";

/**
 * PRACTICE · PATTERN PRACTICE — the index of scenarios, canvas v2.
 *
 * Canvas reference: the "21 Micro Lesson" progress header (App Light
 * L1642-1646) supplies the track + counter, and the ledger row is the archive's
 * own list device. No card grid, no boxes: each pattern is one ruled line under
 * a section rule, which is also what lets the list carry a description without
 * every card growing to match the tallest.
 *
 * BACKEND: every number on this page is the member's own record read from
 * `sim_scenario_scores` — which patterns they passed AND their best score on
 * each. The best score used to be discarded even though it was already being
 * written on every attempt.
 *
 * LOADING ≠ EMPTY: reading the record paints a skeleton ledger; a member who
 * has never passed anything gets a designed founding line, not a blank meter.
 *
 * COLOUR LAW: nothing here is a price, so nothing here is green or red — the
 * old difficulty pills spent the price colours on a label. Difficulty and bias
 * are mono type; a passed pattern is marked with the brand check.
 */

interface ScoreRecord {
  passed: boolean;
  best: number;
  attempts: number;
}

export default function LessonsPage() {
  const [records, setRecords] = useState<Record<string, ScoreRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScores() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from("sim_scenario_scores")
          .select("scenario_id, passed, total_score")
          .eq("user_id", user.id);

        if (data) {
          const next: Record<string, ScoreRecord> = {};
          for (const row of data) {
            const id = row.scenario_id as string;
            const score = Number(row.total_score) || 0;
            const prev = next[id];
            next[id] = {
              passed: (prev?.passed ?? false) || !!row.passed,
              best: Math.max(prev?.best ?? 0, score),
              attempts: (prev?.attempts ?? 0) + 1,
            };
          }
          setRecords(next);
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
  const totalPassed = Object.values(records).filter((r) => r.passed).length;
  const pct = SCENARIOS.length > 0 ? (totalPassed / SCENARIOS.length) * 100 : 0;

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
          {loading ? (
            /* LOADING — the track pulses empty. It does not draw a 0% fill,
               which would read as a real "nothing passed" result. */
            <div
              className="h-1.5 flex-1 animate-pulse rounded-full bg-sand"
              aria-busy="true"
              aria-label="Reading your record"
            />
          ) : (
            <Meter pct={pct} className="flex-1" />
          )}
          <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
            {loading ? "Reading your record" : `${totalPassed}/${SCENARIOS.length} passed`}
          </span>
        </div>

        {/* FOUNDING — the true state of a member who has not passed one yet.
            Designed, not a zeroed meter left to speak for itself. */}
        {!loading && totalPassed === 0 && (
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-soft">
            You haven&apos;t cleared a pattern yet. Start anywhere — each one runs
            in under a minute, and a pass banks XP the first time you get it.
          </p>
        )}
      </header>

      <ScenarioLedger
        id="chart-patterns"
        label={`Chart patterns · ${chartPatterns.length}`}
        scenarios={chartPatterns}
        records={records}
        loading={loading}
      />

      <ScenarioLedger
        id="candlestick-patterns"
        label={`Candlestick patterns · ${candlestickPatterns.length}`}
        scenarios={candlestickPatterns}
        records={records}
        loading={loading}
      />
    </div>
  );
}

function ScenarioLedger({
  id,
  label,
  scenarios,
  records,
  loading,
}: {
  id: string;
  label: string;
  scenarios: ScenarioDefinition[];
  records: Record<string, ScoreRecord>;
  loading: boolean;
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
            const rec = records[s.id];
            const done = !!rec?.passed;
            return (
              <Link
                key={s.id}
                href={`/simulator/lessons/${s.id}`}
                className="f0-focus f0-ledger-row group"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[15px] font-extrabold tracking-tight text-ink">
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

                <span className="shrink-0 self-start text-right font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                  {/* The member's OWN best on this pattern — a practice score,
                      not an accuracy claim. Pending reads say so. */}
                  <span className="block">
                    {loading ? (
                      <span className="inline-block h-2 w-10 animate-pulse rounded bg-sand align-middle" />
                    ) : rec ? (
                      <span className="font-semibold tabular-nums text-ink">
                        {rec.best}
                        <span className="text-soft">/100</span>
                      </span>
                    ) : (
                      "Not run"
                    )}
                  </span>
                  <span className="mt-0.5 block">{s.difficulty}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
