import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import ChangedMyMindClient from "./ChangedMyMindClient";
import { EMPTY_CHANGED_MINDS, type ChangedMindsFeed } from "@/lib/social/stance";

/**
 * /community/changed-my-mind — CHANGED MY MIND, promoted to a destination.
 * Canvas v2, Club Screens 03.
 *
 * The flip flow already existed (migration 151) but lived buried at the bottom
 * of a single ticker's research page, where it could only ever be a widget about
 * one company. The canvas is right that it is the strongest idea in the archive,
 * and an idea that strong needs an address: this is the club-wide record of
 * every member who publicly revised a position, with a RESPECT reaction that
 * answers the update rather than the conclusion.
 *
 * SERVER-SEEDED (plan §0.4): the feed is read here and handed down, so the page
 * paints with real rows on first paint instead of flashing its founding state
 * while a client fetch is in flight. A failed read passes the empty feed and the
 * client renders the designed founding state — which is correct, because a
 * failed read genuinely has nothing to show.
 */
export const dynamic = "force-dynamic";

export default async function ChangedMyMindPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: feed }, profileRes] = await Promise.all([
    supabase.rpc("get_changed_minds", { p_limit: 30 }),
    user
      ? supabase.from("profiles").select("role, age_group, track").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const seed: ChangedMindsFeed = {
    ...EMPTY_CHANGED_MINDS,
    ...((feed ?? {}) as Partial<ChangedMindsFeed>),
  };

  return (
    <ChangedMyMindClient
      seed={seed}
      userId={user?.id ?? null}
      isKid={deriveRegister(profileRes.data) === "kid"}
    />
  );
}
