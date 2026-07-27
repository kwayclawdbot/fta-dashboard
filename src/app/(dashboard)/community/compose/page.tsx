import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import ShareYourCallClient from "./ShareYourCallClient";

/**
 * /community/compose — SHARE YOUR CALL. Canvas v2, Club Screens 05.
 *
 * The structured composer: a contribution must declare the COMPANY it is about,
 * the member's STANCE on it, and what KIND of post it is, before the body is
 * worth reading. That is the whole leverage — a feed of typed, ticker-bound,
 * stance-carrying contributions can be filtered, weighted, answered and fed to
 * the intel layer; a feed of untyped text boxes can only be scrolled.
 *
 * The lightweight inline composer on the Feed is deliberately untouched: not
 * every message in a club is a call, and forcing a stance onto "does anyone know
 * when earnings are" would make members stop posting. This destination is where
 * a call goes.
 *
 * ?ticker= and ?type= prefill it (the Changed My Mind destination links in with
 * type=changed_mind). Auth is enforced by the (dashboard) layout.
 */
export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [sp, { data: auth }] = await Promise.all([searchParams, supabase.auth.getUser()]);
  const user = auth?.user ?? null;

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

  interface ComposerProfile {
    role: string | null;
    age_group: string | null;
    family_id: string | null;
    track: string | null;
  }

  let profile: ComposerProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, age_group, family_id, track")
      .eq("id", user.id)
      .single();
    profile = (data ?? null) as ComposerProfile | null;
  }

  return (
    <ShareYourCallClient
      userId={user?.id ?? null}
      familyId={profile?.family_id ?? null}
      isKid={deriveRegister(profile) === "kid"}
      initialTicker={(one(sp.ticker) ?? "").toUpperCase().replace(/[^A-Z.]/g, "") || null}
      initialType={one(sp.type)}
    />
  );
}
