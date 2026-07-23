"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m as mm } from "@/lib/motion";
import {
  CheckCircle2,
  Circle,
  Compass,
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
      <div className="aspect-[16/10] w-full bg-ink/90 flex flex-col items-center justify-center gap-3 text-center px-6">
        <PlayCircle className="w-10 h-10 text-gold-400" />
        <p className="text-sm text-paper/90 max-w-sm">
          The tour video didn&apos;t load. You can open it directly in a new tab.
        </p>
        <a
          href={WALKTHROUGH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-500 text-ink text-sm font-semibold hover:bg-gold-400 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
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
      className="w-full aspect-[16/10] bg-ink"
      src={WALKTHROUGH_URL}
    />
  );
}

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
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <Celebrate opts={celebration} onDone={() => setCelebration(null)} />
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            Start Here
          </span>
          <h1 className="font-display text-2xl font-bold text-ink mt-2">
            Ready for your first adventure?
          </h1>
          <p className="text-soft mt-1 leading-relaxed">
            Your grown-ups take care of the boring account stuff. Your job is the
            fun part — learning how money grows, one adventure at a time.
          </p>
        </div>

        <Link
          href={KID_FIRST_ADVENTURE.href}
          className="paper-card p-6 flex items-center gap-4 hover:border-gold-400/50 transition-colors group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <PlayCircle className="w-8 h-8 text-gold-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold text-ink">
              {KID_FIRST_ADVENTURE.title}
            </p>
            <p className="text-sm text-soft mt-0.5">{KID_FIRST_ADVENTURE.body}</p>
            <span className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-gold-500 text-white text-sm font-display font-semibold group-hover:bg-gold-600 transition-colors">
              <Sparkles className="w-4 h-4" />
              {KID_FIRST_ADVENTURE.cta}
            </span>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/missions"
            className="paper-card p-4 flex items-center gap-2.5 hover:border-gold-400/50 transition-colors"
          >
            <span className="text-2xl leading-none">🎯</span>
            <span className="font-display font-semibold text-ink text-sm">
              My missions
            </span>
          </Link>
          <Link
            href="/games"
            className="paper-card p-4 flex items-center gap-2.5 hover:border-gold-400/50 transition-colors"
          >
            <span className="text-2xl leading-none">🎮</span>
            <span className="font-display font-semibold text-ink text-sm">
              Play a game
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

      {/* Header — paints immediately (no data dependency) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            Start Here
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome to the Family Investing Club
        </h1>
        <p className="text-soft mt-1 max-w-2xl leading-relaxed">
          We learn first and practice with pretend money. There is no pressure
          to ever trade for real — this is a family classroom for building smart
          money habits together. Finish these six steps to get your family set up.
        </p>
      </div>

      {/* HERO — the setup journey. This is the make-or-break motivator, so it
          leads and paints immediately from local state (0/6), then fills in as
          orientation progress hydrates — no blank hero box, no loading gate. */}
      <SetupTrail
        steps={ORIENTATION_STEPS.map((s) => ({ key: s.key, title: s.title }))}
        completed={completed}
        allDone={allDone}
      />
      {allDone && (
        <p className="text-sm text-green-600 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          Head to your home page for This Week in FIC.
        </p>
      )}

      {/* Checklist — the two-minute tour is folded into the "Watch the
          orientation" step below (no standalone hero embed). */}
      <div className="space-y-3">
        {ORIENTATION_STEPS.map((step, i) => {
          const done = completed.has(step.key);
          const isAccounts = step.key === "open_accounts";
          const isWatch = step.key === "watch_orientation";
          return (
            <mm.div
              key={step.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`paper-card p-5 ${done ? "border-green-500/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                {done ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                ) : (
                  <Circle className="w-6 h-6 text-midnight-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-ink">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="text-sm text-soft mt-1 leading-relaxed">
                    {step.blurb}
                  </p>

                  {!done && (
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {step.ctaHref ? (
                        <Link
                          href={step.ctaHref}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-400/15 text-gold-700 border border-gold-400/30 text-sm font-medium hover:bg-gold-400/25 transition-colors"
                        >
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
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-400/15 text-gold-700 border border-gold-400/30 text-sm font-medium hover:bg-gold-400/25 transition-colors"
                        >
                          {isWatch ? (
                            <PlayCircle className="w-4 h-4" />
                          ) : null}
                          {step.ctaLabel}
                        </button>
                      )}
                      {step.kind === "attest" && (
                        <button
                          onClick={() => attest(step)}
                          className="text-sm font-medium text-soft hover:text-ink transition-colors"
                        >
                          {step.attestLabel || "Mark done"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Orientation tour — the two-minute walkthrough, folded in
                      here instead of a standalone hero embed. */}
                  {isWatch && openPanel === "watch" && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-sand bg-paper">
                      <TourVideo />
                      <div className="p-4 space-y-3">
                        <p className="text-sm text-soft leading-relaxed">
                          Everything in the club — home, watchlist, missions,
                          games and classes — narrated in a hundred seconds.
                        </p>
                        <a
                          href={ORIENTATION_DECK_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:text-gold-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Want the fuller walkthrough? Open the slide deck
                        </a>
                        <div>
                          <button
                            onClick={() => attest(step)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-400/15 text-gold-700 border border-gold-400/30 text-sm font-medium hover:bg-gold-400/25 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {step.attestLabel || "Mark as watched"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Accounts guide (education-first, no amount collection) */}
                  {isAccounts && openPanel === "accounts" && (
                    <div className="mt-4 p-4 rounded-xl bg-paper border border-sand space-y-3">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-gold-700" />
                        <p className="font-display text-sm font-semibold text-ink">
                          Opening accounts — the plain-English guide
                        </p>
                      </div>
                      <p className="text-sm text-ink leading-relaxed">
                        A <strong>custodial account</strong> is an investing
                        account a parent or guardian opens and manages on behalf
                        of a child. A <strong>brokerage account</strong> is a
                        regular investing account for an adult. Both are simply
                        where investments can live one day — opening one is a
                        personal family decision, and you never have to.
                      </p>
                      <p className="text-sm text-ink leading-relaxed">
                        We don&apos;t push any specific broker and we don&apos;t
                        collect any dollar amounts. Whether your family sets aside
                        a small weekly contribution, and how much, is entirely
                        your own decision made privately at home. The habit
                        matters far more than the number — even a few dollars a
                        week teaches consistency.
                      </p>
                      <p className="text-sm text-soft leading-relaxed">
                        Everything in the club is education and practice. No real
                        money is required to take part.
                      </p>
                      <button
                        onClick={() => attest(step)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-400/15 text-gold-700 border border-gold-400/30 text-sm font-medium hover:bg-gold-400/25 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark as reviewed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </mm.div>
          );
        })}
      </div>

      {/* Education-first footer */}
      <div className="paper-card p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
        <p className="text-sm text-soft leading-relaxed">
          <span className="text-ink font-medium">Our promise:</span> the Family
          Investing Club is a learning space. We practice with pretend money,
          celebrate good thinking over quick wins, and never pressure any family
          to trade real money. Go at your family&apos;s own pace.
        </p>
      </div>
    </div>
  );
}
