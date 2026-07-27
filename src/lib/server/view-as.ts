import { cookies } from "next/headers";
import { parseViewAs, VIEW_AS_COOKIE, type ViewAs } from "@/lib/view-as";

/**
 * THE GATE for the admin "View as" preview (see src/lib/view-as.ts).
 *
 * The cookie is never the authority. Every caller must resolve the REAL session
 * profile first (auth.getUser() → profiles.role) and pass that role in here; if
 * it is anything other than 'admin' this returns null WITHOUT EVEN READING the
 * cookie. A forged `cc_view_as` on a member's browser therefore has no effect
 * whatsoever — the shell renders their real register, because the only code
 * that turns the cookie into context is behind this check.
 *
 * Hiding the switcher UI is not the gate; this is. The write side (the route
 * that sets the cookie) is separately gated by requireAdmin().
 */
export async function resolveViewAs(
  realRole: string | null | undefined
): Promise<ViewAs | null> {
  if (realRole !== "admin") return null;
  const jar = await cookies();
  return parseViewAs(jar.get(VIEW_AS_COOKIE)?.value);
}
