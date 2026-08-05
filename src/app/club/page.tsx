import { redirect } from "next/navigation";

/**
 * /club — the canonical Club entry used by go-live push notifications
 * (src/lib/live/notify.ts builds `/club?live={id}`). The Club itself lives at
 * /community, which is the chat area again (owner restore, 2026-07-31) and no
 * longer carries a Live tab — so a go-live deep-link goes to the live sessions
 * surface, which is where the room actually is.
 *
 *   /club                → /community
 *   /club?live={id}      → /live-sessions?live={id}
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
    redirect(`/live-sessions?live=${encodeURIComponent(live)}`);
  }
  redirect("/community");
}
