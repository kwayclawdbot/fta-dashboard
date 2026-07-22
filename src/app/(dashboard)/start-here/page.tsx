"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

const ORIENTATION_DECK_URL = "https://fta-start.vercel.app";

export default function StartHerePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, role, age_group")
        .eq("id", user.id)
        .single();
      const fam = profile?.family_id ?? null;
      setFamilyId(fam);
      const kid = profile?.age_group === "kids" || profile?.role === "child";
      setRegister(
        kid ? "kid" : profile?.age_group === "teens" ? "teen" : "parent"
      );

      let memberIds: string[] = [user.id];
      if (fam) {
        const { data: members } = await supabase
          .from("profiles")
          .select("id")
          .eq("family_id", fam);
        if (members?.length) memberIds = members.map((m) => m.id);
      }

      const state = await getOrientationState(supabase, fam, memberIds);
      setCompleted(state.completed);
      setLoading(false);
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-sand/60" />
        <div className="h-40 rounded-2xl bg-sand/40" />
        <div className="h-64 rounded-2xl bg-sand/40" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Celebrate opts={celebration} onDone={() => setCelebration(null)} />

      {/* Header */}
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

      {/* App walkthrough video — the two-minute tour */}
      <div className="paper-card overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h2 className="font-display text-base font-bold text-ink">Watch: the two-minute app tour</h2>
          <p className="text-[13px] text-soft mt-0.5">Everything in the club — home, watchlist, missions, games and classes — narrated in a hundred seconds.</p>
        </div>
        <video
          controls
          preload="metadata"
          playsInline
          className="w-full aspect-[16/10] bg-ink"
          src="https://zvkercqohmmeyofycbgr.supabase.co/storage/v1/object/public/community-media/walkthrough/app-walkthrough.mp4"
        />
      </div>

      {/* Progress — the setup journey */}
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

      {/* Orientation deck */}
      <div className="paper-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-sand">
          <PlayCircle className="w-4 h-4 text-gold-600" />
          <h2 className="font-display text-sm font-semibold text-ink">
            Family orientation
          </h2>
          <a
            href={ORIENTATION_DECK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800"
          >
            Open full screen <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="aspect-video bg-paper">
          <iframe
            src={ORIENTATION_DECK_URL}
            title="Family orientation"
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        {ORIENTATION_STEPS.map((step, i) => {
          const done = completed.has(step.key);
          const isAccounts = step.key === "open_accounts";
          return (
            <motion.div
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
                            isAccounts
                              ? setOpenPanel(
                                  openPanel === "accounts" ? null : "accounts"
                                )
                              : window.open(ORIENTATION_DECK_URL, "_blank")
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-400/15 text-gold-700 border border-gold-400/30 text-sm font-medium hover:bg-gold-400/25 transition-colors"
                        >
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
            </motion.div>
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
