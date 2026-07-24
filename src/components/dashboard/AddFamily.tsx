"use client";

/**
 * Family Mode activation — the umbrella's killer conversion surface (Cheat Code
 * Club architecture, Lane C1). A solo/individual member already HAS Family Mode
 * in their membership; this surface converts the solo household into a family
 * one so the FIC surfaces (Parent Corner, report cards, kid missions, family
 * strips) light up.
 *
 * Mechanism (display/data only — no billing, no program change):
 *   1. Guided mini-step collects who they're adding (kids ± a partner).
 *   2. Writes family_profiles.household (adults/kids/ages) via the SAME upsert
 *      onboarding uses, preserving experience/goals — this flips isSolo → false.
 *   3. Mints an invite through the EXISTING family-invite plumbing
 *      (family_invites code → /signup/invite/[code]).
 *   4. router.refresh() re-runs the dashboard layout → mode re-derives to
 *      "family" → FIC surfaces appear. (Reverse isn't offered — families don't
 *      demote.)
 *
 * Self-gating: renders nothing unless the viewer is a solo OWNER (parent/admin).
 * Home passes the already-known isSolo/familyId; Settings lets it self-resolve.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Users,
  UserPlus,
  Baby,
  Heart,
  Sparkles,
  ArrowRight,
  Check,
  Copy,
  X,
  Minus,
  Plus,
  PartyPopper,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchFamilyProfile,
  profileToDraft,
  saveFamilyProfile,
  emptyDraft,
  KID_AGE_OPTIONS,
  type KidAgeRange,
} from "@/lib/onboarding-profile";
import { isSoloProfile } from "@/lib/register";

type Variant = "card" | "settings";
type Step = "intro" | "household" | "invite" | "done";

interface AddFamilyProps {
  variant?: Variant;
  /** Pre-known solo flag (Home already derives it) — skips the gating fetch. */
  isSolo?: boolean;
  /** Pre-known family id — skips the gating fetch. */
  familyId?: string;
}

export default function AddFamily({
  variant = "card",
  isSolo: isSoloProp,
  familyId: familyIdProp,
}: AddFamilyProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Resolved eligibility. undefined = still deciding (render nothing to avoid a
  // flash); false = not a solo owner (render nothing); true = show the surface.
  const [eligible, setEligible] = useState<boolean | undefined>(
    isSoloProp === true && familyIdProp ? true : undefined
  );
  const [familyId, setFamilyId] = useState<string>(familyIdProp ?? "");

  useEffect(() => {
    if (isSoloProp !== undefined && familyIdProp) {
      setEligible(isSoloProp === true);
      setFamilyId(familyIdProp);
      return;
    }
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setEligible(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      const canOwn = profile?.role === "parent" || profile?.role === "admin";
      if (!profile?.family_id || !canOwn) {
        if (active) setEligible(false);
        return;
      }
      const { data: fp } = await supabase
        .from("family_profiles")
        .select("household, completed_at")
        .eq("family_id", profile.family_id)
        .maybeSingle();
      if (!active) return;
      setFamilyId(profile.family_id);
      setEligible(isSoloProfile(fp));
    })();
    return () => {
      active = false;
    };
  }, [supabase, isSoloProp, familyIdProp]);

  // ── Flow state ──
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [addKids, setAddKids] = useState(false);
  const [addPartner, setAddPartner] = useState(false);
  const [kidCount, setKidCount] = useState(1);
  const [ranges, setRanges] = useState<KidAgeRange[]>([]);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const canContinue = addKids || addPartner;

  const openFlow = useCallback(() => {
    setStep("intro");
    setAddKids(false);
    setAddPartner(false);
    setKidCount(1);
    setRanges([]);
    setInviteLink("");
    setOpen(true);
  }, []);

  function toggleRange(r: KidAgeRange) {
    setRanges((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  async function commit() {
    if (!familyId || saving) return;
    setSaving(true);

    // Merge the new household into the existing profile so experience/goals are
    // preserved (never wipe the row). Fall back to an empty draft if none.
    const existing = await fetchFamilyProfile(supabase, familyId);
    const draft = existing ? profileToDraft(existing) : emptyDraft();
    draft.household = {
      adults: addPartner ? 2 : 1,
      kids: addKids ? kidCount : 0,
      kid_age_ranges: addKids ? ranges : [],
    };
    await saveFamilyProfile(supabase, familyId, draft, true);

    // Mint an invite via the existing family-invite plumbing.
    try {
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("family_invites").insert({
        family_id: familyId,
        code,
        invited_by: user?.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setInviteLink(`${window.location.origin}/signup/invite/${code}`);
    } catch {
      /* invite is optional — household flip already happened */
    }

    setSaving(false);
    setStep("invite");
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — link stays selectable */
    }
  }

  function finish() {
    setStep("done");
    // Re-derive mode on the server layout — FIC surfaces light up.
    router.refresh();
    setTimeout(() => setOpen(false), 1400);
  }

  if (!eligible) return null;

  // ── Entry affordance ──
  const entry =
    variant === "settings" ? (
      <section id="family" className="scroll-mt-20 mb-10">
        <div className="border-t border-sand mb-8" />
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Family Mode
        </h3>
        <div className="rounded-xl border border-sand bg-paper/50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip-amber text-gold-800">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-ink">
                Bring your family in — it&apos;s included
              </p>
              <p className="text-sm text-soft leading-relaxed mt-1">
                Your membership already includes Family Mode. Add your kids or a
                partner and the family features switch on — report cards, kid
                missions, and a weekly rhythm you do together.
              </p>
              <button
                onClick={openFlow}
                className="cta-button mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              >
                <UserPlus className="h-4 w-4" />
                Add your family
              </button>
            </div>
          </div>
        </div>
      </section>
    ) : (
      <m.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={openFlow}
        className="group w-full text-left rounded-2xl border border-sand bg-gradient-to-br from-chip-amber/50 via-paper to-paper p-5 hover:border-gold-400/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white shadow-soft">
            <Users className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display font-bold text-ink leading-snug">
                Add your family
              </p>
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-gold-800 bg-chip-amber px-1.5 py-0.5 rounded">
                Included
              </span>
            </div>
            <p className="text-sm text-soft leading-snug mt-0.5">
              Family Mode is part of your membership — switch it on and learn
              together.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-gold-700 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </m.button>
    );

  return (
    <>
      {entry}

      <AnimatePresence>
        {open && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <m.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-sand bg-card p-6 shadow-xl"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 text-soft hover:text-ink transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* ── Step: intro ── */}
              {step === "intro" && (
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white shadow-soft mb-4">
                    <Users className="h-6 w-6" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-ink">
                    Family Mode is already yours
                  </h3>
                  <p className="text-sm text-soft leading-relaxed mt-2">
                    It&apos;s part of your Cheat Code Club membership — no extra
                    cost. Add your family and the app grows with you:
                  </p>
                  <ul className="mt-4 space-y-2">
                    {[
                      "Report cards + progress for each child",
                      "Kid Missions — hands-on money quests",
                      "Parent Corner + a weekly family rhythm",
                      "Everyone learning under one membership",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink">
                        <Check className="h-4 w-4 shrink-0 text-gold-600 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setStep("household")}
                    className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm"
                  >
                    Add my family
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* ── Step: household ── */}
              {step === "household" && (
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    Who are you adding?
                  </h3>
                  <p className="text-sm text-soft mt-1">
                    Pick anyone joining you — you can always add more later.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ChoiceCard
                      active={addKids}
                      onClick={() => setAddKids((v) => !v)}
                      icon={<Baby className="h-5 w-5" />}
                      label="My kids"
                    />
                    <ChoiceCard
                      active={addPartner}
                      onClick={() => setAddPartner((v) => !v)}
                      icon={<Heart className="h-5 w-5" />}
                      label="A partner"
                    />
                  </div>

                  {addKids && (
                    <div className="mt-4 rounded-xl border border-sand bg-paper/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">
                          How many kids?
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setKidCount((n) => Math.max(1, n - 1))}
                            aria-label="Fewer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sand text-ink hover:bg-sand/40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-5 text-center font-display font-bold text-ink">
                            {kidCount}
                          </span>
                          <button
                            onClick={() => setKidCount((n) => Math.min(8, n + 1))}
                            aria-label="More"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sand text-ink hover:bg-sand/40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-soft mt-3 mb-2">
                        Their ages (optional)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {KID_AGE_OPTIONS.map((o) => {
                          const on = ranges.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              onClick={() => toggleRange(o.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                on
                                  ? "bg-gold-500 text-white"
                                  : "bg-sand text-ink hover:bg-[#E0D6BE]"
                              }`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={commit}
                    disabled={!canContinue || saving}
                    className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm disabled:opacity-40"
                  >
                    {saving ? "Switching on Family Mode…" : "Turn on Family Mode"}
                    {!saving && <Sparkles className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {/* ── Step: invite ── */}
              {step === "invite" && (
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chip-amber text-gold-800 mb-4">
                    <UserPlus className="h-6 w-6" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-ink">
                    Family Mode is on 🎉
                  </h3>
                  <p className="text-sm text-soft leading-relaxed mt-2">
                    Invite them to join your family. This link expires in 7 days —
                    you can always make a new one from Members.
                  </p>

                  {inviteLink ? (
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        readOnly
                        value={inviteLink}
                        className="flex-1 min-w-0 rounded-lg border border-sand bg-paper px-3 py-2.5 text-sm text-ink truncate"
                      />
                      <button
                        onClick={copyLink}
                        className="shrink-0 rounded-lg border border-sand px-3 py-2.5 text-ink hover:bg-paper transition-colors"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-soft">
                      You can invite members any time from Members.
                    </p>
                  )}

                  <button
                    onClick={finish}
                    className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm"
                  >
                    Done
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* ── Step: done ── */}
              {step === "done" && (
                <div className="py-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white shadow-soft mb-4">
                    <PartyPopper className="h-7 w-7" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-ink">
                    Welcome to Family Investing Club
                  </h3>
                  <p className="text-sm text-soft mt-2">
                    Refreshing your home so the family features appear…
                  </p>
                </div>
              )}
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-colors ${
        active
          ? "border-gold-400 bg-chip-amber/50 text-gold-800"
          : "border-sand bg-paper/60 text-ink hover:border-gold-400/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          active ? "bg-gold-500 text-white" : "bg-sand text-ink"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-display font-semibold">{label}</span>
    </button>
  );
}
