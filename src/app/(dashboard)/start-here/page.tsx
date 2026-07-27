"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
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
import SetupTrail from "@/components/fic/SetupTrail";
import Celebrate, {
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { KID_FIRST_ADVENTURE } from "@/lib/register";
import { LedgerLink, SectionRule, TextAction } from "@/components/f0/parts";

/**
 * START HERE — the family's orientation, canvas v2.
 *
 * Two surfaces from one route, chosen by REGISTER: a kid gets their first
 * adventure (they cannot open a custodial account, so the six grown-up steps are
 * not theirs to see, and no upsell is ever shown to a young member); everyone
 * else gets the six-step setup ledger.
 *
 * CANVAS V2 PASS: one annotated word in each masthead; the step actions are now
 * the shared chip (.f0-chip) rather than a bespoke tinted button, so they answer
 * the keyboard and the thumb like every other control in the app; the primary
 * affordances ride `bg-accent` + text-night-950 (never white on gold, never
 * text-ink on a fill); and the kid entry point is a hairline-ruled object rather
 * than a bordered panel.
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
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 bg-night-950 px-6 text-center">
        <PlayCircle className="h-10 w-10 text-volt-400" />
        <p className="max-w-sm text-sm text-night-100">
          The tour video didn&apos;t load. You can open it directly in a new tab.
        </p>
        <a
          href={WALKTHROUGH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-night-950"
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
      className="aspect-[16/10] w-full bg-night-950"
      src={WALKTHROUGH_URL}
    />
  );
}

/** The step marker: an ordinal in the mono register, or a completion tick.
 *  Completion is NOT green — green belongs to price. Done reads in the brand
 *  action colour and the row itself steps back. */
function StepMark({ done, n }: { done: boolean; n: number }) {
  if (done) {
    return (
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
        <Check className="h-3.5 w-3.5 text-night-950" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center f0-frame rounded-full font-mono text-[11px] font-bold tabular-nums text-soft">
      {n}
    </span>
  );
}

/* The step affordance. Was a bespoke tinted button with its own border, fill and
   hover — a fourth answer to "a small action" in an app that already has one.
   It is now the shared chip: structure from .f0-chip, colour from the caller,
   focus + press from the shared classes. */
const quietAction =
  "f0-chip f0-focus f0-press px-4 py-2 text-sm font-display font-semibold text-gold-700 hover:text-gold-600";

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
      // pin the page on a skeleton. On timeout we render with 0 done (the trail
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

  // Kids get a kid Start-Here, not the parent account-setup trail (audit #23).
  // The six orientation steps (custodial vs brokerage, opening accounts, the
  // family orientation deck) are things only a parent can do — a child landing
  // here should be pointed at their first adventure, not a grown-up chore list.
  if (register === "kid") {
    return (
      <div className="mx-auto max-w-2xl pb-14">
        <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

        <header>
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            Start Here
          </p>
          <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
            Ready for your first{" "}
            <span className="f0-underline-mark">adventure</span>?
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
            Your grown-ups take care of the boring account stuff. Your job is the
            fun part — learning how money grows, one adventure at a time.
          </p>
        </header>

        <Link
          href={KID_FIRST_ADVENTURE.href}
          className="f0-focus f0-press group mt-9 flex gap-4 border-l-[3px] border-accent pl-4 sm:pl-5"
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-display-3 font-extrabold text-ink">
              {KID_FIRST_ADVENTURE.title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
              {KID_FIRST_ADVENTURE.body}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-night-950">
              <Sparkles className="h-4 w-4" />
              {KID_FIRST_ADVENTURE.cta}
            </span>
          </div>
        </Link>

        <section className="mt-10">
          <SectionRule>Or jump straight in</SectionRule>
          <div className="f0-ledger mt-1">
            <LedgerLink href="/missions" label="My missions" sub="Small quests that earn XP." />
            <LedgerLink href="/games" label="Play a game" sub="Learn by playing — no reading required." />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-14">
      <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

      {/* Masthead — paints immediately (no data dependency) */}
      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Start Here
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
          Welcome to the <span className="f0-underline-mark">Club</span>
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft">
          We learn first and practice with pretend money. There is no pressure to
          ever trade for real — this is a family classroom for building smart
          money habits together. Finish these six steps to get your family set up.
        </p>
      </header>

      {/* The setup journey. This is the make-or-break motivator, so it leads and
          paints immediately from local state (0/6), then fills in as orientation
          progress hydrates — no blank hero box, no loading gate. */}
      <div className="mt-8">
        <SetupTrail
          steps={ORIENTATION_STEPS.map((s) => ({ key: s.key, title: s.title }))}
          completed={completed}
          allDone={allDone}
        />
      </div>
      {allDone && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-display font-semibold text-gold-700">
          <Sparkles className="h-4 w-4" />
          Head to your home page for This Week in the Club.
        </p>
      )}

      {/* The six steps — a ruled ledger, not a stack of boxes. The two-minute
          tour is folded into the "Watch the orientation" step (no standalone
          hero embed). */}
      <section className="mt-10">
        <SectionRule
          action={
            <span className="font-mono text-[13px] font-bold tabular-nums text-soft">
              {doneCount}/{total}
            </span>
          }
        >
          Your six steps
        </SectionRule>

        <div className="f0-ledger f0-stagger mt-1">
          {ORIENTATION_STEPS.map((step, i) => {
            const done = completed.has(step.key);
            const isAccounts = step.key === "open_accounts";
            const isWatch = step.key === "watch_orientation";
            return (
              <div
                key={step.key}
                style={{ "--i": i } as React.CSSProperties}
                className="py-5"
              >
                <div className="flex gap-4">
                  <StepMark done={done} n={i + 1} />
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-display text-[17px] font-extrabold ${
                        done ? "text-soft" : "text-ink"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-soft">
                      {step.blurb}
                    </p>

                    {!done && (
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        {step.ctaHref ? (
                          <Link href={step.ctaHref} className={quietAction}>
                            {step.ctaLabel}
                          </Link>
                        ) : (
                          <button
                            onClick={() =>
                              isWatch
                                ? setOpenPanel(
                                    openPanel === "watch" ? null : "watch"
                                  )
                                : isAccounts
                                  ? setOpenPanel(
                                      openPanel === "accounts" ? null : "accounts"
                                    )
                                  : window.open(ORIENTATION_DECK_URL, "_blank")
                            }
                            className={quietAction}
                          >
                            {isWatch ? <PlayCircle className="h-4 w-4" /> : null}
                            {step.ctaLabel}
                          </button>
                        )}
                        {step.kind === "attest" && (
                          <button
                            onClick={() => attest(step)}
                            className="f0-focus f0-press text-sm font-display font-bold text-soft transition-colors hover:text-ink"
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
                      <div className="f0-rule-top mt-5 space-y-4 pt-5">
                        <div className="border-l-[3px] border-accent pl-4">
                          <p className="max-w-[60ch] text-sm leading-relaxed text-ink">
                            <span className="font-semibold">
                              The app has been updated.
                            </span>{" "}
                            The quickest way to learn your way around is the new
                            interactive tour — it walks the live app, step by
                            step, in about a minute.
                          </p>
                          <Link
                            href="/dashboard?tour=1"
                            className="f0-focus f0-press mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-night-950"
                          >
                            <Sparkles className="h-4 w-4" />
                            Take the new tour
                          </Link>
                        </div>

                        <details className="f0-rule-top pt-4">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-soft">
                            <PlayCircle className="h-4 w-4 shrink-0" />
                            Prefer a video? Watch the original walkthrough
                            <span className="ml-1 text-eyebrow font-display font-bold uppercase text-soft">
                              older layout
                            </span>
                          </summary>
                          <div className="mt-3 overflow-hidden rounded-xl">
                            <TourVideo />
                          </div>
                          <p className="mt-3 max-w-[60ch] text-[13px] leading-relaxed text-soft">
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
                          onClick={() => attest(step)}
                          className={quietAction}
                        >
                          <Check className="h-4 w-4" />
                          {step.attestLabel || "Mark as watched"}
                        </button>
                      </div>
                    )}

                    {/* Accounts guide (education-first, no amount collection) */}
                    {isAccounts && openPanel === "accounts" && (
                      <div className="f0-rule-top mt-5 space-y-3 pt-5">
                        <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">
                          <Landmark className="h-4 w-4 text-gold-700" />
                          Opening accounts — the plain-English guide
                        </p>
                        <p className="max-w-[62ch] text-sm leading-relaxed text-ink">
                          A <strong>custodial account</strong> is an investing
                          account a parent or guardian opens and manages on behalf
                          of a child. A <strong>brokerage account</strong> is a
                          regular investing account for an adult. Both are simply
                          where investments can live one day — opening one is a
                          personal family decision, and you never have to.
                        </p>
                        <p className="max-w-[62ch] text-sm leading-relaxed text-ink">
                          We don&apos;t push any specific broker and we don&apos;t
                          collect any dollar amounts. Whether your family sets aside
                          a small weekly contribution, and how much, is entirely
                          your own decision made privately at home. The habit
                          matters far more than the number — even a few dollars a
                          week teaches consistency.
                        </p>
                        <p className="max-w-[62ch] text-sm leading-relaxed text-soft">
                          Everything in the club is education and practice. No real
                          money is required to take part.
                        </p>
                        <button
                          onClick={() => attest(step)}
                          className={quietAction}
                        >
                          <Check className="h-4 w-4" />
                          Mark as reviewed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Education-first footer */}
      <p className="f0-rule-top mt-10 flex max-w-[64ch] items-start gap-3 pt-5 text-sm leading-relaxed text-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
        <span>
          <span className="font-medium text-ink">Our promise:</span> the Family
          Investing Club is a learning space. We practice with pretend money,
          celebrate good thinking over quick wins, and never pressure any family
          to trade real money. Go at your family&apos;s own pace.
        </span>
      </p>
    </div>
  );
}
