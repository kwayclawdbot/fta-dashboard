"use client";

import UpsellCard, { type UpsellContext } from "./UpsellCard";

/**
 * Shown in place of a locked member feature for FREE-tier families. Thin wrapper
 * over the shared UpsellCard so every locked door speaks in one voice — it names
 * what's behind the door and offers the forward path (join FIC).
 */
export default function FreeLocked({ context }: { context: UpsellContext }) {
  return <UpsellCard context={context} variant="full" />;
}
