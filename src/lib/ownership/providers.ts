/**
 * Ownership Cards — position provider abstraction.
 *
 * Phase 0 ships MANUAL-FIRST: the member self-reports the position and the card
 * is minted "self-reported" (never "verified"). When SNAPTRADE_CONSUMER_KEY lands,
 * getProvider() returns the SnapTradeProvider instead, enabling verified mints +
 * automatic SEAL_BROKEN detection from live lot quantities — with zero changes to
 * the calling routes (they only ever touch the PositionProvider contract).
 */
import type { PositionProvider } from "./types";

/**
 * ManualProvider — the position is whatever the member typed. verifyPosition is a
 * passthrough that reports `verified: false` (honest "self-reported" provenance),
 * and currentQuantity is unknowable, so it returns null (seal status is
 * self-reported until a brokerage link exists).
 */
export class ManualProvider implements PositionProvider {
  readonly kind = "manual" as const;

  async verifyPosition(): Promise<{ verified: boolean; positionRef: string | null }> {
    return { verified: false, positionRef: null };
  }

  async currentQuantity(): Promise<number | null> {
    return null;
  }
}

/**
 * SnapTradeProvider — stub until SNAPTRADE_CONSUMER_KEY is provisioned. Every
 * method throws the same clear, catchable error so a mis-wire fails loudly rather
 * than silently minting unverified cards under a "verified" label.
 */
export class SnapTradeProvider implements PositionProvider {
  readonly kind = "snaptrade" as const;
  private static readonly NOT_CONFIGURED = "SNAPTRADE_CONSUMER_KEY not configured";

  async verifyPosition(): Promise<{ verified: boolean; positionRef: string | null }> {
    throw new Error(SnapTradeProvider.NOT_CONFIGURED);
  }

  async currentQuantity(): Promise<number | null> {
    throw new Error(SnapTradeProvider.NOT_CONFIGURED);
  }
}

/** True once SnapTrade credentials exist (drives provider selection + labeling). */
export function isSnapTradeConfigured(): boolean {
  return !!process.env.SNAPTRADE_CONSUMER_KEY?.trim();
}

/**
 * Factory: returns the SnapTradeProvider when its consumer key is present, else
 * the ManualProvider. Routes call this and never construct a provider directly.
 */
export function getProvider(): PositionProvider {
  return isSnapTradeConfigured() ? new SnapTradeProvider() : new ManualProvider();
}
