export const dynamic = "force-dynamic";

import { redirectKids } from "@/lib/server/viewer-register";

/**
 * VIP room — kids out, server-side.
 *
 * The page itself is a client component and doubles as the $197 VIP TICKET
 * offer for anyone who is not already a holder, so a kid reaching it by URL was
 * shown a purchase. The nav never linked it to them; that was the only thing
 * stopping them. This is the actual door, and being a layout it covers anything
 * added under the segment later.
 */
export default async function VipRoomGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectKids();
  return <>{children}</>;
}
