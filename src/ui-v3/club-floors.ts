/**
 * Floors shared by every v3 screen that turns Club opinion counts into a
 * percentage.
 *
 * A share is only meaningful once enough members have actually taken a side.
 * Below the floor, "100% bullish" is one person clicking a button — so the
 * screens that would print a percentage fall back to a unit that cannot lie
 * (the raw club score) rather than dressing a single opinion as a consensus.
 *
 * This is the same number the Discover surface has always used to pick its
 * "most divisive" name; it lives here so Home, Discover and the Screener are
 * provably reading one constant instead of three copies that can drift.
 */
export const MIN_POSITIONED_OPINIONS = 5;
