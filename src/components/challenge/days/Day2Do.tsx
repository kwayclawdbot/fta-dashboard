"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import {
  RESEARCH_QUESTIONS,
  fmtPct,
  fmtUsd,
  priceTone,
  type Day2Payload,
  type DaySeed,
  type Quote,
} from "./data";
import {
  ErrorLine,
  KaiNote,
  PILL,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  Panel,
} from "./parts";

/**
 * DAY 2 · DO — THE GUIDED DIG.
 *
 * The canvas draws Kai streaming a live revenue split ("Data center 87% · Gaming
 * 8%") under the label "Kai pulled this live". We hold no revenue-segment data,
 * and inventing a plausible one is the single worst thing this lane could ship:
 * it is a fabricated fundamental sitting inside a research exercise. So the
 * panel keeps its shape and its position and fills with the numbers we DO hold —
 * `screener_metrics`, the same table the screener reads — under a label that
 * says exactly what they are and how stale they can be.
 *
 * The exercise itself is unchanged from the board: four questions, one screen
 * each, a four-stop progress ledger underneath, and the answers in the member's
 * own words. Those four answers ARE the research card.
 *
 * KAI: blue appears here and nowhere else in the flow, and it carries an
 * INVITATION with a working door to the real assistant — never a paragraph of
 * analysis attributed to a model that was not called.
 */
export default function Day2Do({
  seed,
  onSubmit,
  busy,
  error,
}: {
  seed: DaySeed;
  onSubmit: (payload: Day2Payload) => void;
  busy: boolean;
  error: string | null;
}) {
  /* The candidate list is the member's OWN Day-1 watchlist where they made one;
     otherwise whatever the cohort seed could supply. */
  const candidates = useMemo(() => {
    const mine = seed.mine[1];
    const fromDay1 = mine?.tickers?.length ? mine.tickers : [];
    const all = fromDay1.length ? fromDay1 : Object.keys(seed.quotes);
    return all.slice(0, 8);
  }, [seed.mine, seed.quotes]);

  const saved = seed.doPayload as Day2Payload | null;

  const [ticker, setTicker] = useState<string>(
    saved?.ticker ?? candidates[0] ?? ""
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => ({ ...(saved?.answers ?? {}) }) as Record<string, string>
  );
  /* Resume where they stopped: the first question still short of an answer. */
  const [idx, setIdx] = useState(() => {
    const first = RESEARCH_QUESTIONS.findIndex(
      (rq) => ((saved?.answers ?? {})[rq.key] ?? "").trim().length < 8
    );
    return first === -1 ? RESEARCH_QUESTIONS.length - 1 : first;
  });

  const q = RESEARCH_QUESTIONS[idx];
  const quote: Quote | null = seed.quotes[ticker] ?? null;
  const answered = RESEARCH_QUESTIONS.filter(
    (rq) => (answers[rq.key] ?? "").trim().length >= 8
  ).length;
  const current = (answers[q.key] ?? "").trim();
  const canAdvance = current.length >= 8;
  const last = idx === RESEARCH_QUESTIONS.length - 1;

  const next = () => {
    if (!canAdvance) return;
    if (!last) {
      setIdx((i) => i + 1);
      return;
    }
    onSubmit({
      ticker,
      company: quote?.name ?? null,
      answers: {
        sells: answers.sells?.trim(),
        money: answers.money?.trim(),
        rivals: answers.rivals?.trim(),
        worry: answers.worry?.trim(),
      },
    });
  };

  return (
    <div className="f0-stagger space-y-7">
      {/* the company under the microscope */}
      <div className="space-y-3">
        <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
          {quote?.name ?? (ticker || "Pick a company")} · question {q.n} of 4
        </p>
        <MissionHead align="left">{q.prompt}</MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">{q.helper}</p>
      </div>

      {candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
            The company
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Company">
            {candidates.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={t === ticker}
                onClick={() => setTicker(t)}
                style={PILL}
                className={`f0-chip f0-focus f0-press px-3.5 py-2 font-mono text-[13px] font-bold tracking-wide ${
                  t === ticker ? "f0-chip-accent text-ink" : "text-soft hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* the real numbers — the honest replacement for the drawn revenue split */}
      <Panel
        label="What we hold on this name"
        meta={quote ? "latest close · screener" : undefined}
      >
        {quote ? (
          <div className="f0-ledger">
            <FactRow label="Last close" value={fmtUsd(quote.price)} />
            <FactRow
              label="Change today"
              value={fmtPct(quote.chg)}
              tone={priceTone(quote.chg)}
            />
            <FactRow
              label="Change, 1 month"
              value={fmtPct(quote.chg1m)}
              tone={priceTone(quote.chg1m)}
            />
            <FactRow
              label="Change, 3 months"
              value={fmtPct(quote.chg3m)}
              tone={priceTone(quote.chg3m)}
            />
            <FactRow
              label="From its 52-week high"
              value={fmtPct(quote.distHigh)}
              tone={priceTone(quote.distHigh)}
            />
            <FactRow label="Sector" value={quote.sector ?? "—"} />
          </div>
        ) : (
          <p className="py-2 text-[14px] leading-relaxed text-soft">
            We hold no reading for {ticker || "this name"} yet. That does not stop
            the exercise — the four questions are answered in your words, not from
            a number.
          </p>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-soft">
          Price and moves only. Nothing here tells you what the company sells or
          how it earns — that is what you are about to work out.
        </p>
      </Panel>

      {/* the answer */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
            Your answer
          </span>
          <textarea
            rows={4}
            maxLength={600}
            value={answers[q.key] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
            placeholder={q.placeholder}
            className="f0-focus mt-2 w-full resize-none rounded-lg bg-sand/50 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-soft/70"
          />
        </label>
        {!canAdvance && current.length > 0 && (
          <Note>A few more words — one honest line beats a good-sounding one.</Note>
        )}
      </div>

      <KaiNote>
        working on {ticker || "a name"}? Open me in a new tab and ask &ldquo;
        {q.prompt.toLowerCase().replace(/\?$/, "")} for {ticker || "this company"}
        ?&rdquo; — I will pull what I can find, and you decide what it means.
        <Link
          href="/kai"
          className="ml-1.5 inline-flex items-center gap-1 font-display font-bold text-kai-blue underline underline-offset-2"
        >
          Open Kai <ArrowUpRight className="h-3 w-3" />
        </Link>
      </KaiNote>

      {/* the four-stop ledger */}
      <div>
        <p className="mb-2 text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
          Your research card so far
        </p>
        <div className="grid grid-cols-4 gap-2">
          {RESEARCH_QUESTIONS.map((rq, i) => {
            const done = (answers[rq.key] ?? "").trim().length >= 8;
            const here = i === idx;
            return (
              <button
                key={rq.key}
                type="button"
                onClick={() => setIdx(i)}
                aria-current={here ? "step" : undefined}
                className={`f0-focus f0-press grid place-items-center gap-1 rounded-xl px-1 py-3 ${
                  here ? "f0-brief-field" : "border border-sand bg-card"
                }`}
              >
                <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-ink">
                  Q{rq.n}
                  {done && <Check className="h-3 w-3 text-gold-700" aria-hidden />}
                </span>
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.1em] text-soft">
                  {rq.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton onClick={next} disabled={!canAdvance || !ticker} busy={busy}>
          {last
            ? `Finish the card · ${answered} of 4 answered`
            : `Next: ${RESEARCH_QUESTIONS[idx + 1].short.toLowerCase()}`}
        </MissionButton>
      </MissionFooter>
    </div>
  );
}

function FactRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="f0-ledger-row justify-between gap-3">
      <span className="min-w-0 flex-1 text-[14px] text-soft">{label}</span>
      <span
        className={`shrink-0 font-mono text-[14px] font-semibold tabular-nums ${
          tone ?? "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
