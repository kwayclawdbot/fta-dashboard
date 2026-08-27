import { createClient } from "@/lib/supabase/server";
import { getLiveEvent } from "@/lib/live/queries";
import { fixturesAllowed } from "@/lib/clubhome/client";
import type { ChatMe } from "@/lib/useChatRoom";
import type { LiveEventCardData } from "@/lib/live/types";
import LiveRoomClient from "./LiveRoomClient";

/**
 * /community/live/[id] — a REAL Live Room bound to a live_event row
 * (board 13). The event is composed on the SERVER via getLiveEvent; the
 * viewer's ChatMe is resolved here too so the room chat (useChatRoom scoped to
 * the event id) can post immediately. Auth is enforced by the (dashboard)
 * layout.
 *
 * When no matching row exists AND fixtures are allowed (preview / dev only,
 * never production), a single design-review demo room renders so the
 * composition is reviewable before real rooms run. In production a missing
 * event degrades to an honest "room isn't live" state.
 */
export const dynamic = "force-dynamic";

const DEMO_EVENT: LiveEventCardData = {
  id: "demo-live-room",
  status: "live",
  room_type: "market",
  title: "Options Flow Masterclass",
  description: "Reading the tape and the flow live.",
  tickers: ["NVDA", "AMD", "SPY"],
  host: { name: "Marcus Hill", avatarUrl: null },
  viewer_count: 1204,
  interested_count: 0,
  starts_at: new Date(Date.now() - 38 * 60_000).toISOString(),
  ended_at: null,
  duration_min: 60,
  join_url: null,
  replay_url: null,
  interested: false,
  kai_summary: "Recap pinned: three setups, two risk rules.",
  top_questions: [],
};

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const viewer = auth.user ?? null;

  let me: ChatMe | null = null;
  if (viewer) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, display_name, role, age_group, family_id, avatar_url, username")
      .eq("id", viewer.id)
      .maybeSingle();
    if (p) {
      me = {
        id: p.id as string,
        display_name: (p.display_name as string) ?? null,
        role: (p.role as string) ?? null,
        age_group: (p.age_group as string) ?? null,
        family_id: (p.family_id as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        username: (p.username as string) ?? null,
      };
    }
  }

  let event = await getLiveEvent(supabase, id, viewer?.id ?? null).catch(() => null);
  if (!event && fixturesAllowed()) event = DEMO_EVENT;

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
          This room isn&apos;t live
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-base leading-relaxed text-soft">
          The room may have ended or moved. Head back to The Club to see what&apos;s on the air now.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <LiveRoomClient event={event} me={me} />
    </div>
  );
}
