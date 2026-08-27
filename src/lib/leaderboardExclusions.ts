/**
 * WHO IS KEPT OFF THE PUBLIC BOARD.
 *
 * /leaderboard was ranking the people who BUILT the product alongside the
 * people using it: `admin`, `Test`, `cardtest`, `cardtest2`, three "Demo …"
 * seeds, a probe account, and the owner showing up as three separate
 * identities. A board is a claim about the community, and staff plus fixtures
 * are not the community — they are the scaffolding.
 *
 * TWO RULES, BOTH DELIBERATE:
 *
 *   1. ROLE. `role = 'admin'` never appears on the public board. Staff hold
 *      admin accounts that get XP from testing every surface, so they would sit
 *      at the top of a board they are not competing on. This is the rule that
 *      also removes the owner's own admin identity.
 *
 *   2. NAME. A short, CLOSED denylist of the fixture accounts, matched exactly
 *      (case- and space-insensitive) against username OR display name, plus one
 *      prefix rule for the auto-generated probe accounts, which are minted with
 *      a timestamp suffix and so cannot be listed by name.
 *
 * The denylist is EXACT-match on purpose. A `startsWith("test")` rule would
 * silently delete a real member called "Tester" or "Testa Rossa" from the board
 * they earned a place on, and a member vanishing from a leaderboard with no
 * explanation is a worse failure than a fixture appearing on one.
 *
 * Nothing here hides a real member from themselves: the surface states that
 * staff and test accounts are kept off the board rather than pretending the
 * viewer has no rank.
 */

/** The fixture accounts, matched against username OR display name. */
export const LEADERBOARD_DENYLIST: readonly string[] = [
  "admin",
  // Build fixture (canvasb-proof@example.com, minted 2026-07-27 by the canvas
  // proof script). It carries the OWNER'S display name, "Kway", and 2,840 XP,
  // so the board showed "Kway · PURPLE II · 2,415 XP" while that same person's
  // /progress read "White Belt · 55 XP" from their real account. Two profiles,
  // one name — the board was ranking the fixture. Matched on USERNAME, because
  // denying the display name would delete the real member from the board.
  "canvasb-proof",
  "cardtest",
  "cardtest2",
  // The V2 Demo Club household (@cheatcode-qa.dev, minted 2026-07-28 to dress
  // the redesigned feed). None of the six has EVER signed in, yet they carried
  // 250–3,400 XP onto the public board next to real members. Their content is
  // removed by .planning/PURGE-SEED-SOCIAL-20260731.sql; this list is the code
  // half, so the board stays honest even if a fixture row is ever re-seeded.
  "datadive",
  "deshawnk",
  "jcharts",
  "mayainvests",
  "optionsog",
  "tiffanyr",
  "demo club member",
  "demo family parent",
  "demo kid",
  // test@gmail.com, display name "kway" — same collision, matched by username.
  "kway-2",
  "kwayclawdbot",
  "test",
];

/** Auto-generated fixtures whose names carry a timestamp (`fic-probe-…`). */
export const LEADERBOARD_DENY_PREFIXES: readonly string[] = ["fic-probe-"];

/** Roles that never appear on the public board. */
export const LEADERBOARD_DENY_ROLES: readonly string[] = ["admin"];

/** Lowercase, collapse whitespace — "Demo Club Member" === "demo club member". */
function normalize(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function nameIsFixture(name: string | null | undefined): boolean {
  const n = normalize(name);
  if (!n) return false;
  if (LEADERBOARD_DENYLIST.includes(n)) return true;
  return LEADERBOARD_DENY_PREFIXES.some((p) => n.startsWith(p));
}

export interface LeaderboardIdentity {
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
}

/** True when this identity is staff or a fixture and belongs off the board. */
export function isOffBoardIdentity(row: LeaderboardIdentity): boolean {
  if (row.role && LEADERBOARD_DENY_ROLES.includes(row.role)) return true;
  return nameIsFixture(row.username) || nameIsFixture(row.display_name);
}
