"use client";

import { can, onChallengePass, type Feature } from "@/lib/entitlements";
import { useEntitlements } from "./EntitlementsProvider";
import ContextualWall from "./ContextualWall";
import ChallengePassRibbon from "./ChallengePassRibbon";

/**
 * <Gated feature="…"> — the ONE gate primitive.
 *
 * Renders, by entitlement state:
 *   • entitled (real Club/FTA member)          → children
 *   • entitled via an unexpired Challenge Pass → the countdown ribbon + children
 *     ("Included with your Challenge Pass · N days remaining" — loss aversion,
 *      NOT a paywall)
 *   • not entitled                             → the contextual wall
 *
 * Client convenience over the server truth: EVERY gated API route ALSO enforces
 * server-side (never UI-only — the screener lesson). This component is the
 * presentation half; it must be paired with a server check on the data path.
 *
 * Kid walls COMPOSE — pass already-age-filtered children; this only handles the
 * tier/entitlement axis.
 */
export default function Gated({
  feature,
  ticker,
  children,
  fallback,
  wallVariant = "full",
  wallSurface = "paper",
  showRibbon = true,
  className = "",
}: {
  feature: Feature;
  /** Ticker for {TICKER} substitution on the Club Intelligence wall. */
  ticker?: string;
  children: React.ReactNode;
  /** Custom wall; defaults to the standard ContextualWall for the feature. */
  fallback?: React.ReactNode;
  wallVariant?: "full" | "band";
  wallSurface?: "paper" | "midnight";
  /** Show the pass-countdown ribbon above children for Challenge holders. */
  showRibbon?: boolean;
  className?: string;
}) {
  const state = useEntitlements();

  if (!can(state, feature)) {
    return (
      fallback ?? (
        <ContextualWall
          feature={feature}
          ticker={ticker}
          variant={wallVariant}
          surface={wallSurface}
          className={className}
        />
      )
    );
  }

  // Entitled. If it's via a Challenge Pass, surface the countdown ribbon.
  if (showRibbon && onChallengePass(state)) {
    return (
      <div className={className}>
        <ChallengePassRibbon
          daysRemaining={state.challenge!.daysRemaining}
          className="mb-4"
        />
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
