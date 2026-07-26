import { redirect } from "next/navigation";

/**
 * /club — the canonical Club entry used by go-live push notifications
 * (src/lib/live/notify.ts builds `/club?live={id}`). The Club itself lives at
 * /community (Feed · Lounge · Live). This bridges the push deep-link into the
 * Live tab, focused on the room that just went live.
 *
 *   /club                → /community
 *   /club?live={id}      → /community?mode=live&live={id}
 */
export const dynamic = "force-dynamic";

export default async function ClubEntry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.live) ? sp.live[0] : sp.live;
  const live = raw ? raw.trim() : "";
  if (live) {
    redirect(`/community?mode=live&live=${encodeURIComponent(live)}`);
  }
  redirect("/community");
}
