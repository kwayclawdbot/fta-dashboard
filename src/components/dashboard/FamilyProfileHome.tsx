"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  ArrowRight,
  X,
  Sparkles,
  Home,
  Target,
  Compass,
  Star,
  LineChart,
  CalendarDays,
  BookOpen,
  Users,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchFamilyProfile,
  deriveRecommendations,
  isRecommendationsFresh,
  type Recommendation,
} from "@/lib/onboarding-profile";

/**
 * Home-page surface for the family profile — the visible payoff of onboarding.
 *
 * Self-contained (fetches its own data, renders null when nothing to show), so
 * the dashboard only needs to drop <FamilyProfileHome familyId /> once for
 * parents. Two mutually-exclusive states, both server-derived from
 * family_profiles — no scattered flags:
 *   • no completed profile → a QUIET "Finish your family profile" backfill card.
 *     As of the Lane 8R wizard rebuild, the profile questionnaire IS the signup
 *     flow: every NEW member of every entry path completes it inside the
 *     full-screen /onboarding wizard before ever reaching the dashboard. So the
 *     only families that land here WITHOUT a completed profile are PRE-WIZARD
 *     members (onboarded before the wizard existed, family_profiles never
 *     filled). They get a low-key backfill nudge — not the old loud card — that
 *     retires after two dismissals. New members never see it.
 *   • completed within the first week → the "recommended next" card whose picks
 *     map directly to their household / experience / interest / goals answers.
 */

// Quiet backfill card for pre-wizard incomplete profiles (Lane 8R). We count
// dismissals in localStorage rather than a one-shot flag so a single accidental
// close doesn't bury it — it comes back next login, and only a deliberate second
// dismissal retires it.
const DISMISS_MAX = 2;

const ICONS: Record<string, LucideIcon> = {
  Target,
  Compass,
  Star,
  LineChart,
  CalendarDays,
  BookOpen,
  Users,
};

type View =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "backfill" }
  | { kind: "recommend"; recs: Recommendation[] };

export default function FamilyProfileHome({ familyId }: { familyId: string }) {
  const supabase = createClient();
  const [view, setView] = useState<View>({ kind: "loading" });

  const dismissKey = `fta:family-profile-prompt-dismissed:${familyId}`;

  function dismissCount(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(dismissKey);
    if (!raw) return 0;
    // Back-compat: the old one-shot flag stored "1" (a single dismissal).
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const profile = await fetchFamilyProfile(supabase, familyId);

      if (!profile || !profile.completed_at) {
        // Backfill prompt — stays prominent until dismissed DISMISS_MAX times.
        if (!mounted) return;
        setView(dismissCount() >= DISMISS_MAX ? { kind: "hidden" } : { kind: "backfill" });
        return;
      }

      if (isRecommendationsFresh(profile.completed_at)) {
        const recs = deriveRecommendations(profile);
        if (!mounted) return;
        setView(recs.length ? { kind: "recommend", recs } : { kind: "hidden" });
        return;
      }

      if (!mounted) return;
      setView({ kind: "hidden" });
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  function dismissBackfill() {
    try {
      localStorage.setItem(dismissKey, String(dismissCount() + 1));
    } catch {
      /* private mode — fine, it'll just show again next visit */
    }
    setView({ kind: "hidden" });
  }

  if (view.kind === "loading" || view.kind === "hidden") return null;

  if (view.kind === "backfill") {
    // Quiet, low-key backfill (Lane 8R) — only pre-wizard members reach this.
    return (
      <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <Link
          href="/onboarding/profile"
          className="flex items-center gap-3 rounded-xl border border-sand bg-card px-4 py-3 pr-9 hover:border-gold-400/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gold-400/12 flex items-center justify-center shrink-0">
            <Home className="w-4 h-4 text-gold-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-medium text-sm text-ink">Finish your family profile</p>
            <p className="text-xs text-soft truncate">
              A few quick questions so we can tailor lessons and Kai to your family.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-soft shrink-0" />
        </Link>
        <button
          onClick={dismissBackfill}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-soft hover:text-ink hover:bg-sand/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </m.div>
    );
  }

  // recommend
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="paper-card p-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-gold-600" />
        <h3 className="font-display text-base font-semibold text-ink">
          Recommended for your family
        </h3>
      </div>
      <p className="text-sm text-soft mb-4">Picked from what you told us. Start anywhere.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {view.recs.map((r) => {
          const Icon = ICONS[r.icon] ?? BookOpen;
          return (
            <Link
              key={r.key}
              href={r.href}
              className="p-4 rounded-xl border border-sand bg-paper hover:border-gold-400/50 transition-colors group flex flex-col"
            >
              <div className="w-10 h-10 rounded-lg bg-gold-400/15 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-gold-700" />
              </div>
              <p className="font-display font-semibold text-sm text-ink flex items-center gap-1.5">
                {r.title}
                <ArrowRight className="w-3.5 h-3.5 text-midnight-500 group-hover:text-gold-700 group-hover:translate-x-0.5 transition-all" />
              </p>
              <p className="text-xs text-soft mt-1 leading-relaxed">{r.sub}</p>
            </Link>
          );
        })}
      </div>
    </m.div>
  );
}
