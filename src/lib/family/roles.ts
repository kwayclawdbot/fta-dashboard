/**
 * WHO COUNTS AS A PARENT — one definition, used by every gate.
 *
 * The household surfaces are parent surfaces, and they were each deciding that
 * for themselves. `getFamilyContext` (src/lib/family/queries.ts) already admits
 * admins — the owner's own account is an admin, and narrowing to parent-only
 * locked it out of every parent screen once before. The client screens that do
 * their own profile read (/family/overview, /family/members) were still on the
 * narrow `role === 'parent'` test, so /family linked straight into pages that
 * bounced the viewer with no message.
 *
 * This module is deliberately dependency-free so a client component can import
 * the predicate without pulling the server query layer into the bundle.
 */
export function isParentRole(role: string | null | undefined): boolean {
  return role === "parent" || role === "admin";
}
