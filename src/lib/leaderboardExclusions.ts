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
  "cardtest",
  "cardtest2",
  "demo club member",
  "demo family parent",
  "demo kid",
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
