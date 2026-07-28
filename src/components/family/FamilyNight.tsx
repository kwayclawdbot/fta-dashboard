"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import WatchlistVote from "@/components/family/WatchlistVote";
import type { CircleVote, FamilyMember, WatchlistEntry } from "@/lib/family/queries";
import {
  FamilyCard,
  Chip,
  Eyebrow,
  SectionLabel,
  XpTag,
  AbsenceNote,
  FoundingState,
  TextAction,
  Bar,
} from "@/components/family/canvas";

/* ══════════════════════════════════════════════════════════════════════════
   RUN FAMILY NIGHT — one guided surface, five steps.

   Family night already existed in this product as four separate errands: vote
   on /family/watchlist, read up on /research/<ticker>, find questions on
   /family/corner, and then nothing at all for attendance because there was no
   write path for it. A household that wanted to actually run the evening had to
   assemble it themselves, and the XP the watchlist card promised for "showing
   up" was never paid by anything. This is that evening as ONE flow, and the
   last step is the write that was missing.

   NOTHING HERE IS DECORATIVE. Step 1 casts real votes (the same WatchlistVote
   component the watchlist page uses — not a fork, so there is exactly one vote
   implementation and one XP guard). Step 5 posts to /api/family/night, which
   pays real xp_events rows, and the panel reports what the server said landed
   rather than what the button hoped for.
   ══════════════════════════════════════════════════════════════════════════ */

export interface NightNumber {
  label: string;
  value: string;
}

export interface NightBrief {
  ticker: string;
  companyName: string;
  /** The plain-English "what is this company" line. Null when nobody has one. */
  plain: string | null;
  plainSource: "household" | "market" | null;
  /** Real, non-price figures — at most two, each labelled with what it is. */
  numbers: NightNumber[];
  /** Named absences, in the aggregate's own terms. Never a placeholder value. */
  missing: string[];
  /** The one question that closes the one-pager. */
  question: string;
}

interface AttendeeResult {
  id: string;
  awarded: boolean;
  alreadyAwarded: boolean;
  xp: number;
}

type StepId = "pick" | "brief" | "questions" | "roster" | "done";

const STEPS: { id: StepId; label: string }[] = [
  { id: "pick", label: "The pick" },
  { id: "brief", label: "One-pager" },
  { id: "questions", label: "Questions" },
  { id: "roster", label: "Who came" },
  { id: "done", label: "XP" },
];

export default function FamilyNight({
  familyId,
  viewerId,
  isParent,
  night,
  nightLabel,
  members,
  options,
  seedVotes,
  brief,
  questions,
  xpPerAttendee,
  alreadyPaid,
}: {
  familyId: string;
  viewerId: string;
  isParent: boolean;
  /** YYYY-MM-DD, computed on the SERVER. No clock is read in this render. */
  night: string;
  nightLabel: string;
  members: FamilyMember[];
  options: WatchlistEntry[];
  seedVotes: CircleVote[];
  /** Null when tonight has no winning pick yet — step 1 decides it. */
  brief: NightBrief | null;
  questions: string[];
  xpPerAttendee: number;
  /** Member ids already paid for THIS night — read from xp_events on the server. */
  alreadyPaid: string[];
}) {
  const router = useRouter();
  // Always opens on the pick, even when tonight is already decided: the first
  // thing a household needs to see is WHICH company it is about to spend the
  // evening on, and a late voter can still change it from that step.
  const [step, setStep] = useState<StepId>("pick");
  const [qIndex, setQIndex] = useState(0);
  const [present, setPresent] = useState<string[]>(() =>
    members.filter((m) => alreadyPaid.includes(m.id)).map((m) => m.id)
  );
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<AttendeeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function go(id: StepId) {
    setStep(id);
    setError(null);
  }

  function togglePresent(id: string) {
    setPresent((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function logNight() {
    if (saving || !present.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/family/night", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          night,
          attendeeIds: present,
          ticker: brief?.ticker,
          companyName: brief?.companyName,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        results?: AttendeeResult[];
      };
      if (!res.ok) {
        setError(payload.error || "That did not save. Nothing was recorded.");
        setSaving(false);
        return;
      }
      setResults(payload.results ?? []);
      setStep("done");
      // The household's XP totals moved; the surfaces behind this one are
      // server-rendered, so they are re-resolved rather than left stale.
      router.refresh();
    } catch {
      setError("That did not save. Nothing was recorded.");
    }
    setSaving(false);
  }

  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name || "Member";

  return (
    <div>
      {/* ── The rail ─────────────────────────────────────────────────────
          Five steps, one bar. Not a progress bar for its own sake: it is the
          only thing telling a parent mid-evening how much is left. */}
      <div className="mt-6">
        <Bar pct={((stepIndex + 1) / STEPS.length) * 100} height={6} />
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <Eyebrow tone="accent">
            Step {stepIndex + 1} of {STEPS.length} · {STEPS[stepIndex].label}
          </Eyebrow>
          <span className="font-mono text-[10.5px] text-soft">{nightLabel}</span>
        </div>
      </div>

      {/* ══ 1 · TONIGHT'S PICK ═══════════════════════════════════════════*/}
      {step === "pick" && (
        <div className="mt-5">
          <SectionLabel>Tonight&rsquo;s pick</SectionLabel>
          {brief ? (
            <>
              <FamilyCard tone="lead" className="mt-3">
                <Eyebrow tone="accent">The house has decided</Eyebrow>
                <p className="mt-1.5 font-display text-[20px] font-extrabold text-ink">
                  {brief.companyName}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-soft">{brief.ticker}</p>
              </FamilyCard>
              <p className="mt-3 text-[12px] leading-relaxed text-soft">
                Anyone who has not voted still can — the ballot below stays open
                and a late vote can change the pick.
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] leading-relaxed text-soft">
              No vote is in for tonight yet. Decide it here — one tap each, and
              the name in the middle is whoever is leading.
            </p>
          )}

          <div className="mt-4">
            <WatchlistVote
              familyId={familyId}
              viewerId={viewerId}
              members={members}
              options={options}
              seed={seedVotes}
              night={night}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {brief ? (
              <StepButton onClick={() => go("brief")}>
                Open the one-pager &rarr;
              </StepButton>
            ) : (
              <StepButton onClick={() => router.refresh()}>
                The pick is in &mdash; build the one-pager &rarr;
              </StepButton>
            )}
          </div>
          {!brief && (
            <AbsenceNote>
              The one-pager is built from the winning company, so it arrives once
              a vote exists. Nothing is drafted in advance.
            </AbsenceNote>
          )}
        </div>
      )}

      {/* ══ 2 · THE ONE-PAGER ════════════════════════════════════════════*/}
      {step === "brief" && brief && (
        <div className="mt-5">
          <SectionLabel action={<Chip tone="accent">Read this out</Chip>}>
            {brief.ticker} in plain English
          </SectionLabel>

          <FamilyCard tone="warm" className="mt-3">
            <p className="font-display text-[19px] font-extrabold leading-snug text-ink">
              {brief.companyName}
            </p>

            {brief.plain ? (
              <>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{brief.plain}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                  {brief.plainSource === "household"
                    ? "Written by this household"
                    : "From the company's own filing profile"}
                </p>
              </>
            ) : (
              <div className="mt-3">
                <FoundingState
                  title="Nobody has written the plain-English version yet"
                  body="This is the one thing the house has to supply itself: what does this company actually sell, in a sentence a nine-year-old repeats back correctly? Write it once on the research card and it is here every night after."
                  action={
                    <TextAction href={`/research/${encodeURIComponent(brief.ticker)}`}>
                      Open {brief.ticker}&rsquo;s research &rarr;
                    </TextAction>
                  }
                />
              </div>
            )}

            {brief.numbers.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {brief.numbers.map((n) => (
                  <div
                    key={n.label}
                    className="flex items-baseline justify-between gap-3 rounded-lg bg-paper px-3 py-2"
                  >
                    <span className="min-w-0 text-[12px] leading-snug text-soft">
                      {n.label}
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-semibold tabular-nums text-ink">
                      {n.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {brief.missing.length > 0 && (
              <AbsenceNote>
                Not shown tonight: {brief.missing.join(", ")}. We hold no figure
                for {brief.missing.length === 1 ? "it" : "those"}, so the line is
                left out rather than filled with a number nobody measured.
              </AbsenceNote>
            )}

            <div className="mt-4 rounded-lg border-l-[3px] border-l-transparent bg-card p-3">
              <Eyebrow tone="accent">Ask the table</Eyebrow>
              <p className="mt-1.5 text-[13.5px] font-display font-bold leading-snug text-ink">
                {brief.question}
              </p>
            </div>
          </FamilyCard>

          <p className="mt-3 text-[11.5px] leading-relaxed text-soft">
            No price appears on this page on purpose. What a company sells and
            whether it earns money are the things worth arguing about at the
            table; the quote lives on{" "}
            <span className="font-mono">{brief.ticker}</span>&rsquo;s research
            page for whoever wants it after.
          </p>

          <StepNav
            onBack={() => go("pick")}
            backLabel="Back to the pick"
            onNext={() => {
              setQIndex(0);
              go("questions");
            }}
            nextLabel="Start the questions →"
          />
        </div>
      )}

      {/* ══ 3 · THE QUESTIONS ════════════════════════════════════════════*/}
      {step === "questions" && (
        <div className="mt-5">
          <SectionLabel action={<Chip>{qIndex + 1} / {questions.length}</Chip>}>
            Discussion
          </SectionLabel>

          <FamilyCard className="mt-3">
            <Eyebrow tone="accent">Question {qIndex + 1}</Eyebrow>
            <p className="mt-2.5 font-display text-[20px] font-extrabold leading-snug text-ink">
              {questions[qIndex]}
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-soft">
              Let the answer be wrong out loud. The reasoning is the lesson.
            </p>
          </FamilyCard>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuietButton
              onClick={() => (qIndex === 0 ? go("brief") : setQIndex(qIndex - 1))}
            >
              ← {qIndex === 0 ? "One-pager" : "Previous"}
            </QuietButton>
            {qIndex < questions.length - 1 ? (
              <StepButton onClick={() => setQIndex(qIndex + 1)}>
                Next question →
              </StepButton>
            ) : (
              <StepButton onClick={() => go("roster")}>
                That&rsquo;s the last one →
              </StepButton>
            )}
          </div>
        </div>
      )}

      {/* ══ 4 · WHO SHOWED UP ════════════════════════════════════════════*/}
      {step === "roster" && (
        <div className="mt-5">
          <SectionLabel action={<Chip tone="accent">Each = ⚡ +{xpPerAttendee}</Chip>}>
            Who showed up
          </SectionLabel>

          <FamilyCard className="mt-3">
            <p className="font-display text-[15px] font-extrabold text-ink">
              Tap everybody who was here
            </p>
            <Eyebrow className="mt-1">Showing up is the habit</Eyebrow>

            <div className="mt-3 flex flex-wrap gap-4">
              {members.map((m) => {
                const on = present.includes(m.id);
                const paid = alreadyPaid.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePresent(m.id)}
                    aria-pressed={on}
                    className="f0-focus f0-press w-[68px] rounded-xl text-center"
                  >
                    <span className="flex justify-center">
                      <Avatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        role={m.role}
                        xp={m.xp}
                        size="lg"
                        className={on ? "" : "opacity-45"}
                      />
                    </span>
                    <span className="mt-1.5 block truncate text-[10px] text-soft">
                      {m.display_name || "Member"} {on ? "✓" : "…"}
                    </span>
                    {paid && (
                      <span className="mt-0.5 block font-mono text-[9px] font-bold text-gold-700">
                        Already paid
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </FamilyCard>

          {!isParent && (
            <AbsenceNote>
              A parent records the night. You can run the whole evening from this
              page — the XP is written by whoever holds the parent account, so
              hand them the phone for this last step.
            </AbsenceNote>
          )}

          {error && (
            <p
              className="mt-4 rounded-xl border border-sand bg-card p-3 text-[13px] leading-relaxed text-ink shadow-soft"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuietButton onClick={() => go("questions")}>← Questions</QuietButton>
            {isParent && (
              <StepButton onClick={logNight} disabled={saving || present.length === 0}>
                {saving
                  ? "Recording…"
                  : present.length === 0
                    ? "Tap at least one person"
                    : `Log the night for ${present.length} →`}
              </StepButton>
            )}
          </div>
        </div>
      )}

      {/* ══ 5 · WHAT LANDED ══════════════════════════════════════════════*/}
      {step === "done" && (
        <div className="mt-5">
          <SectionLabel>Recorded</SectionLabel>

          <FamilyCard tone="lead" className="mt-3">
            <Eyebrow tone="accent">Family night · {nightLabel}</Eyebrow>
            <p className="mt-1.5 font-display text-[19px] font-extrabold leading-snug text-ink">
              {brief ? `${brief.companyName} is on the record` : "Tonight is on the record"}
            </p>

            <div className="mt-3 flex flex-col gap-1.5">
              {(results ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 border-b border-sand/70 pb-1.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate font-display text-[13px] font-bold text-ink">
                    {nameOf(r.id)}
                  </span>
                  {r.awarded ? (
                    <XpTag amount={r.xp} className="shrink-0" />
                  ) : (
                    <span className="shrink-0 font-mono text-[10.5px] text-soft">
                      {r.alreadyAwarded ? "already paid tonight" : "not recorded"}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {(results ?? []).some((r) => !r.awarded && !r.alreadyAwarded) && (
              <AbsenceNote>
                One or more payouts did not land. Nothing was invented on their
                behalf — try again and the ones already paid stay paid.
              </AbsenceNote>
            )}
          </FamilyCard>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuietButton onClick={() => go("roster")}>← Add somebody</QuietButton>
            <TextAction href="/family">Back to Family Mode →</TextAction>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── The two buttons ──────────────────────────────────────────────────────
   The canvas has exactly two actions: the solid accent pill and the quiet
   text one. PillAction/TextAction in the canvas set are Links; these are the
   same objects as buttons, because every step here advances state rather than
   navigating. Kept local so the canvas set stays link-shaped. */
function StepButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[12.5px] font-extrabold text-night-950 disabled:opacity-55"
    >
      {children}
    </button>
  );
}

function QuietButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="f0-focus f0-press inline-flex items-center gap-1 font-display text-[12.5px] font-bold text-soft transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

function StepNav({
  onBack,
  backLabel,
  onNext,
  nextLabel,
}: {
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <QuietButton onClick={onBack}>← {backLabel}</QuietButton>
      <StepButton onClick={onNext}>{nextLabel}</StepButton>
    </div>
  );
}
