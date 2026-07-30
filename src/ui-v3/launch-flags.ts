/**
 * ui-v3 LAUNCH FLAGS — the sections that are correct but premature.
 *
 * Every flag here guards a region that is BUILT, TRANSLATED FROM ITS ARTBOARD,
 * AND HONEST. None of them is off because it is broken. They are off because a
 * network of a few dozen members cannot yet produce the input the region reads,
 * and a band that is permanently empty — or worse, filled from two people —
 * teaches a new member that the screen is decoration.
 *
 * So this file is a launch trim, not a feature-flag system:
 *
 *  - The gated components stay INTACT. Flipping a flag to `true` is the whole
 *    re-enable; nothing has to be rebuilt, and the adapters keep computing the
 *    data so the day the condition is met the number is already right.
 *  - Each flag states, in its comment, THE DATA CONDITION under which it comes
 *    back. That condition is a fact about the club, checkable against the
 *    database — not a date and not a vibe.
 *  - They are compile-time constants, not env vars. A flag that can differ
 *    between environments is a flag whose screenshots stop being proof of what
 *    ships; changing one is a commit and a rebuild, deliberately.
 *
 * `as const` on `false` would make every consumer's `if` provably dead and
 * ESLint would start deleting the branch, so the type is widened to `boolean`.
 */
type Flag = boolean;

/**
 * Discover → "Most divisive". One name, split roughly down the middle.
 *
 * RETURNS WHEN: a bull/bear split within ±20 points of even, on a name carrying
 * at least MIN_POSITIONED_OPINIONS positioned members (src/ui-v3/club-floors.ts),
 * is a COMMON state rather than a rarity — i.e. ≥5 positioned members on at
 * least one name most days. Below that the section is either empty or it is
 * naming three people's disagreement as the Club's.
 */
export const SHOW_MOST_DIVISIVE: Flag = false;

/**
 * Discover → "Black belts are watching".
 *
 * RETURNS WHEN: at least one member holds a Black Belt AND black-belt watchlists
 * cover ≥5 distinct tickers. The ladder tops out at 3,200 lifetime XP
 * (src/lib/xp.ts), so on a founding club this row has literally no members to
 * read from and renders its "no black belts yet" note forever.
 */
export const SHOW_BELT_WATCH: Flag = false;

/**
 * Discover → "Quiet to loud". Names climbing from nowhere.
 *
 * RETURNS WHEN: the attention ledger holds ≥14 days of history for ≥20 tickers,
 * so club_change_14d is a real trajectory rather than the difference between one
 * week of no data and one week of some. "Woke up" needs a before.
 */
export const SHOW_QUIET_TO_LOUD: Flag = false;

/**
 * Belts → the "62% OF CLUB" figure on each rung.
 *
 * RETURNS WHEN: a club-wide belt distribution is actually computed AND the
 * member count is high enough that a percentage is not a headcount in disguise —
 * ≥100 members, below which "20% of Club" means four people. Nothing computes
 * this figure today, so the slot is reserved rather than filled.
 */
export const SHOW_BELT_DISTRIBUTION: Flag = false;

/**
 * Screener → "Save screen".
 *
 * RETURNS WHEN: the v3 screener is wired to `screener_saved_screens`
 * (migration 204, already live and used by the old surface) and has its own
 * saved-screens list to open. Until then the words are a button that does
 * nothing, which is the one thing a launch cannot ship.
 */
export const SHOW_SAVE_SCREEN: Flag = false;
