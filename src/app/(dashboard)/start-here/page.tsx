"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Landmark,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import {
  ORIENTATION_STEPS,
  getOrientationState,
  markOrientationStep,
  type OrientationStep,
} from "@/lib/fic";
import Celebrate, {
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { KID_FIRST_ADVENTURE } from "@/lib/register";
import { DisplayHead, Meter, TextAction } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";

/**
 * START HERE — the family's orientation, rebuilt in the board-01 card language.
 *
 * Two surfaces from one route, chosen by REGISTER: a kid gets their first
 * adventure (they cannot open a custodial account, so the six grown-up steps are
 * not theirs to see, and no upsell is ever shown to a young member); everyone
 * else gets the six-step setup path. THAT GATE IS UNCHANGED.
 *
 * WHAT DIED (legacy purge): the hairline `f0-ledger` that carried the six steps,
 * the `SectionRule` marks, the `f0-frame` step ordinal and the `f0-rule-top`
 * disclosure panels — all the PREVIOUS version's structure. WHAT REPLACED THEM:
 * a `DisplayHead` masthead, ONE brand-tinted `club-b-warm` "next step" object
 * with the board's round orange orb, and white `club-b-card` step rows each
 * carrying a numeric `club-b-pip` hung off its top-left corner, exactly as the
 * board hangs a rank.
 *
 * COMPLETION IS NOT GREEN. Green and red are PRICE colours and orientation has
 * no price: a finished step reads as a tick in the neutral pip plus the stated
 * word, and the NEXT step is the one wearing the accent (`club-b-pip-lead`),
 * because the accent is the action colour.
 *
 * WRITES UNTOUCHED: `markOrientationStep` still persists every attestation to
 * the family's orientation record, and the 6/6 celebration still fires from the
 * same completed-set transition. The optimistic set update stays ahead of the
 * write exactly as before, so a slow network never blocks the tick.
 */

const ORIENTATION_DECK_URL = "https://fta-start.vercel.app";
const WALKTHROUGH_URL =
  "https://zvkercqohmmeyofycbgr.supabase.co/storage/v1/object/public/community-media/walkthrough/app-walkthrough.mp4";
const WALKTHROUGH_POSTER =
  "https://zvkercqohmmeyofycbgr.supabase.co/storage/v1/object/public/community-media/walkthrough/app-walkthrough-poster.jpg";

/** The two-minute tour, with a poster and an error fallback — never a dead well.
 *  The source is faststart-muxed so `preload="metadata"` resolves immediately
 *  instead of downloading the whole file (the old "spins forever" bug). */
function TourVideo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="night-island flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <PlayCircle className="h-10 w-10 text-accent" aria-hidden />
        <p className="max-w-sm text-[13px] leading-relaxed">
          The tour video didn&apos;t load. You can open it directly in a new tab.
        </p>
        <a
          href={WALKTHROUGH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
        >
          <ExternalLink className="h-4 w-4" />
          Open the tour
        </a>
      </div>
    );
  }

  return (
    <video
      controls
      preload="metadata"
      playsInline
      poster={WALKTHROUGH_POSTER}
      onError={() => setFailed(true)}
      className="night-island aspect-[16/10] w-full"
      src={WALKTHROUGH_URL}
    />
  );
}

/** The board's rank pip, hung half off the card's top-left corner. A done step
 *  carries a tick in the neutral pip; the NEXT step carries the accent. */
function StepPip({
  n,
  state,
}: {
  n: number;
  state: "done" | "next" | "later";
}) {
  return (
    <span
      className={`club-b-pip absolute -left-[7px] -top-[7px] ${
        state === "next" ? "club-b-pip-lead" : ""
      }`}
      aria-hidden
    >
      {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : n}
    </span>
  );
}

/* The step affordance: the shared chip. Structure from .f0-chip, colour from
   here, focus + press from the shared classes. */
const stepAction =
  "f0-chip f0-focus f0-press inline-flex items-center gap-1.5 px-3.5 py-1.5 font-display text-[13px] font-bold text-gold-700 hover:text-gold-600";

export default function StartHerePage() {
  const supabase = createClient();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [register, setRegister] = useState<Register>("parent");
  const [celebration, setCelebration] = useState<CelebrateOptions | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await withTimeout<{
        data: { family_id: string | null; role: string; age_group: string } | null;
      }>(
        supabase
          .from("profiles")
          .select("family_id, role, age_group")
          .eq("id", user.id)
          .single(),
        LOAD_TIMEOUT_MS,
        { data: null }
      );
      const fam = profile?.family_id ?? null;
      setFamilyId(fam);
      const kid = profile?.age_group === "kids" || profile?.role === "child";
      setRegister(
        kid ? "kid" : profile?.age_group === "teens" ? "teen" : "parent"
      );

      let memberIds: string[] = [user.id];
      if (fam) {
        const { data: members } = await withTimeout<{
          data: { id: string }[] | null;
        }>(
          supabase.from("profiles").select("id").eq("family_id", fam),
          LOAD_TIMEOUT_MS,
          { data: null }
        );
        if (members?.length) memberIds = members.map((m) => m.id);
      }

      // Orientation state is progress chrome — cap it so a slow query can't
      // pin the page on a skeleton. On timeout we render with 0 done (the path
      // still shows, the family just sees an un-ticked start).
      const state = await withTimeout(
        getOrientationState(supabase, fam, memberIds),
        LOAD_TIMEOUT_MS,
        { completed: new Set<string>() } as Awaited<
          ReturnType<typeof getOrientationState>
        >
      );
      setCompleted(state.completed);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attest(step: OrientationStep) {
    if (!familyId) return;
    setCompleted((prev) => {
      const next = new Set(prev).add(step.key);
      // Celebrate the moment the family reaches 6/6 (highest-value first action).
      if (next.size >= ORIENTATION_STEPS.length && prev.size < ORIENTATION_STEPS.length) {
        setCelebration({
          variant: "setup",
          register,
          title: "Your family is all set!",
          subtitle: "Orientation complete — welcome to the club.",
        });
      }
      return next;
    });
    await markOrientationStep(supabase, familyId, userId, step.key);
  }

  const doneCount = ORIENTATION_STEPS.filter((s) => completed.has(s.key)).length;
  const total = ORIENTATION_STEPS.length;
  const allDone = doneCount >= total;
  const nextIdx = ORIENTATION_STEPS.findIndex((s) => !completed.has(s.key));
  const nextStep = nextIdx >= 0 ? ORIENTATION_STEPS[nextIdx] : null;

  /** Open the step wherever it actually lives. Same behaviours as before. */
  function openStep(step: OrientationStep) {
    if (step.key === "watch_orientation") {
      setOpenPanel(openPanel === "watch" ? null : "watch");
      return;
    }
    if (step.key === "open_accounts") {
      setOpenPanel(openPanel === "accounts" ? null : "accounts");
      return;
    }
    window.open(ORIENTATION_DECK_URL, "_blank");
  }

  // Kids get a kid Start-Here, not the parent account-setup path (audit #23).
  // The six orientation steps (custodial vs brokerage, opening accounts, the
  // family orientation deck) are things only a parent can do — a child landing
  // here should be pointed at their first adventure, not a grown-up chore list.
  if (register === "kid") {
    return (
      <div className="mx-auto max-w-2xl pb-14">
        <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

        <DisplayHead
          eyebrow="Start Here"
          title="Ready for your first"
          mark="adventure?"
          lede="Your grown-ups take care of the boring account stuff. Your job is the fun part — learning how money grows, one adventure at a time."
        />

        {/* The ONE brand-tinted object: where to go next. */}
        <Link
          href={KID_FIRST_ADVENTURE.href}
          className="club-b-warm f0-focus f0-press mt-9 flex items-center gap-3.5 px-[15px] py-[15px]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
              Start with
            </span>
            <span className="mt-1 block font-display text-[19px] font-extrabold leading-tight text-ink">
              {KID_FIRST_ADVENTURE.title}
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-soft">
              {KID_FIRST_ADVENTURE.body}
            </span>
            <span className="mt-2 block font-display text-[12.5px] font-bold text-gold-700">
              {KID_FIRST_ADVENTURE.cta}
            </span>
          </span>
          <span className="club-b-orb h-10 w-10 shrink-0" aria-hidden>
            <Sparkles className="h-4 w-4" />
          </span>
        </Link>

        <div className="mt-10">
          <BoardSection id="kid-jump-in" label="Or jump" mark="straight in">
            <div className="mt-2.5 space-y-2.5">
              <Link
                href="/missions"
                className="club-b-card f0-focus f0-press flex items-center gap-3 px-4 py-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-bold text-ink">
                    My missions
                  </span>
                  <span className="mt-0.5 block text-[13px] text-soft">
                    Small quests that earn XP.
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-soft" aria-hidden />
              </Link>
              <Link
                href="/games"
                className="club-b-card f0-focus f0-press flex items-center gap-3 px-4 py-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-bold text-ink">
                    Play a game
                  </span>
                  <span className="mt-0.5 block text-[13px] text-soft">
                    Learn by playing — no reading required.
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-soft" aria-hidden />
              </Link>
            </div>
          </BoardSection>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-14">
      <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

      {/* Masthead — paints immediately (no data dependency) */}
      <DisplayHead
        eyebrow="Start Here"
        title="Welcome to the"
        mark="Club"
        lede="We learn first and practice with pretend money. There is no pressure to ever trade for real — this is a family classroom for building smart money habits together. Finish these six steps to get your family set up."
      />

      {/* ── The next step — the ONE brand-tinted object on this surface. It
             paints immediately from local state (step 1 of 6) and re-points as
             orientation progress hydrates: no blank hero, no loading gate. ── */}
      <section
        className="club-b-warm mt-8 px-[15px] py-[15px]"
        aria-labelledby="orientation-next"
      >
        <div className="flex items-start gap-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft tabular-nums">
              {allDone ? "All six steps done" : `Next step · ${doneCount + 1} of ${total}`}
            </p>
            <h2
              id="orientation-next"
              className="mt-1 font-display text-[19px] font-extrabold leading-tight text-ink"
            >
              {allDone ? "Your family is all set" : (nextStep?.title ?? "")}
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
              {allDone
                ? "Head to your home page for This Week in the Club."
                : (nextStep?.blurb ?? "")}
            </p>
          </div>

          {allDone ? (
            <Link
              href="/dashboard"
              aria-label="Go to your home page"
              className="club-b-orb f0-focus f0-press h-10 w-10 shrink-0"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : nextStep?.ctaHref ? (
            <Link
              href={nextStep.ctaHref}
              aria-label={nextStep.ctaLabel}
              className="club-b-orb f0-focus f0-press h-10 w-10 shrink-0"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => nextStep && openStep(nextStep)}
              aria-label={nextStep?.ctaLabel ?? "Open the next step"}
              className="club-b-orb f0-focus f0-press h-10 w-10 shrink-0"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-3">
          <Meter pct={total > 0 ? (doneCount / total) * 100 : 0} className="flex-1" />
          <span className="shrink-0 font-mono text-[11px] font-semibold text-ink tabular-nums">
            {doneCount}/{total}
          </span>
        </div>
      </section>

      {/* ── The six steps — white board cards, each with its rank pip ─────── */}
      <div className="mt-10">
        <BoardSection
          id="orientation-steps"
          label="Your six"
          mark="steps"
          action={
            <span className="shrink-0 font-mono text-[11px] font-semibold text-soft tabular-nums">
              {doneCount}/{total} done
            </span>
          }
        >
          <div className="f0-stagger mt-3.5 space-y-3">
            {ORIENTATION_STEPS.map((step, i) => {
              const done = completed.has(step.key);
              const isNext = !done && i === nextIdx;
              const isAccounts = step.key === "open_accounts";
              const isWatch = step.key === "watch_orientation";
              return (
                <div
                  key={step.key}
                  style={{ "--i": i } as React.CSSProperties}
                  className="relative"
                >
                  <div
                    className={`club-b-card px-4 py-4 ${
                      isNext ? "club-b-card-lead" : ""
                    }`}
                  >
                    <StepPip
                      n={i + 1}
                      state={done ? "done" : isNext ? "next" : "later"}
                    />

                    <div className="flex items-baseline justify-between gap-3">
                      <h3
                        className={`min-w-0 font-display text-[16px] font-extrabold ${
                          done ? "text-soft" : "text-ink"
                        }`}
                      >
                        {step.title}
                      </h3>
                      <span
                        className={`shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] ${
                          done ? "text-soft" : isNext ? "text-accent" : "text-soft/60"
                        }`}
                      >
                        {done ? "Done" : isNext ? "Next" : ""}
                      </span>
                    </div>

                    <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
                      {step.blurb}
                    </p>

                    {!done && (
                      <div className="mt-3.5 flex flex-wrap items-center gap-3">
                        {step.ctaHref ? (
                          <Link href={step.ctaHref} className={stepAction}>
                            {step.ctaLabel}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openStep(step)}
                            className={stepAction}
                          >
                            {isWatch ? <PlayCircle className="h-4 w-4" /> : null}
                            {step.ctaLabel}
                          </button>
                        )}
                        {step.kind === "attest" && (
                          <button
                            type="button"
                            onClick={() => attest(step)}
                            className="f0-focus f0-press font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
                          >
                            {step.attestLabel || "Mark done"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Orientation step — the narrated walkthrough was recorded
                        before the redesign (stale layouts), so the primary path is
                        now the live interactive tour (?tour=1). The old video is
                        kept for reference, folded away and labelled "older layout". */}
                    {isWatch && openPanel === "watch" && (
                      <div className="mt-4 space-y-4 border-t border-sand pt-4">
                        <div>
                          <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-ink">
                            <span className="font-semibold">
                              The app has been updated.
                            </span>{" "}
                            The quickest way to learn your way around is the new
                            interactive tour — it walks the live app, step by
                            step, in about a minute.
                          </p>
                          <Link
                            href="/dashboard?tour=1"
                            className="f0-focus f0-press mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
                          >
                            <Sparkles className="h-4 w-4" />
                            Take the new tour
                          </Link>
                        </div>

                        <details className="border-t border-sand pt-4">
                          <summary className="f0-focus flex cursor-pointer list-none items-center gap-2 text-[13px] text-soft">
                            <PlayCircle className="h-4 w-4 shrink-0" />
                            Prefer a video? Watch the original walkthrough
                            <span className="ml-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-soft">
                              older layout
                            </span>
                          </summary>
                          <div className="mt-3 overflow-hidden rounded-[10px]">
                            <TourVideo />
                          </div>
                          <p className="mt-3 max-w-[60ch] text-[12.5px] leading-relaxed text-soft">
                            Recorded before the redesign — some screens look
                            different now — but the club&apos;s rhythm (home,
                            watchlist, missions, games and classes) is narrated
                            in a hundred seconds.
                          </p>
                          <div className="mt-2">
                            <TextAction href={ORIENTATION_DECK_URL} external>
                              <ExternalLink className="h-4 w-4" />
                              Want the fuller walkthrough? Open the slide deck
                            </TextAction>
                          </div>
                        </details>

                        <button
                          type="button"
                          onClick={() => attest(step)}
                          className={stepAction}
                        >
                          <Check className="h-4 w-4" />
                          {step.attestLabel || "Mark as watched"}
                        </button>
                      </div>
                    )}

                    {/* Accounts guide (education-first, no amount collection) */}
                    {isAccounts && openPanel === "accounts" && (
                      <div className="mt-4 space-y-3 border-t border-sand pt-4">
                        <p className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                          <Landmark className="h-4 w-4 text-accent" />
                          Opening accounts — the plain-English guide
                        </p>
                        <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-ink">
                          A <strong>custodial account</strong> is an investing
                          account a parent or guardian opens and manages on behalf
                          of a child. A <strong>brokerage account</strong> is a
                          regular investing account for an adult. Both are simply
                          where investments can live one day — opening one is a
                          personal family decision, and you never have to.
                        </p>
                        <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-ink">
                          We don&apos;t push any specific broker and we don&apos;t
                          collect any dollar amounts. Whether your family sets aside
                          a small weekly contribution, and how much, is entirely
                          your own decision made privately at home. The habit
                          matters far more than the number — even a few dollars a
                          week teaches consistency.
                        </p>
                        <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
                          Everything in the club is education and practice. No real
                          money is required to take part.
                        </p>
                        <button
                          type="button"
                          onClick={() => attest(step)}
                          className={stepAction}
                        >
                          <Check className="h-4 w-4" />
                          Mark as reviewed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </BoardSection>
      </div>

      {/* Education-first footer */}
      <div className="club-b-card mt-10 flex max-w-[64ch] items-start gap-3 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-soft" aria-hidden />
        <p className="text-[13px] leading-relaxed text-soft">
          <span className="font-semibold text-ink">Our promise:</span> the Family
          Investing Club is a learning space. We practice with pretend money,
          celebrate good thinking over quick wins, and never pressure any family
          to trade real money. Go at your family&apos;s own pace.
        </p>
      </div>
    </div>
  );
}
