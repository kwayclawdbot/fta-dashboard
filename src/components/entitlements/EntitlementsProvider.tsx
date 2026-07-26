"use client";

import { createContext, useContext } from "react";
import type { EntitlementState } from "@/lib/entitlements";

/**
 * Client access to the server-computed EntitlementState. The (dashboard) layout
 * computes the snapshot ONCE (getEntitlements) and provides it here, so every
 * client <Gated> reads one authority instead of re-deriving tier client-side.
 *
 * Defaults to the free, no-challenge posture so a surface rendered outside the
 * provider (or before hydration) walls rather than leaks — fail closed.
 */
const FREE_DEFAULT: EntitlementState = {
  tier: "free",
  realTier: "free",
  register: "adult",
  clubLapsed: false,
  challenge: null,
};

const EntitlementsContext = createContext<EntitlementState>(FREE_DEFAULT);

export function EntitlementsProvider({
  value,
  children,
}: {
  value: EntitlementState;
  children: React.ReactNode;
}) {
  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

/** The current member's entitlement snapshot (fail-closed free default). */
export function useEntitlements(): EntitlementState {
  return useContext(EntitlementsContext);
}
