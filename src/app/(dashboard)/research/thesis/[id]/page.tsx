import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import { getClubTier } from "@/lib/tier";
import ThesisObjectClient from "./ThesisObjectClient";
import type { ResearchObject, ThesisUpdate } from "@/lib/social/research-object";

/**
 * /research/thesis/[id] — a Research Object (structured thesis) page. Server-first:
 * the object + updates are read via the definer RPC and handed to the client,
 * which layers live % move, informational reactions, section-anchored comments,
 * and (for the author) the THESIS UPDATE lifecycle. Auth is enforced by the
 * (dashboard) layout.
 */
export const dynamic = "force-dynamic";

export default async function ThesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_research_object", { p_id: id });
  const raw = (data ?? null) as { object: ResearchObject | null; updates: ThesisUpdate[] } | null;
  if (!raw?.object) notFound();

  let isKid = false;
  let tier: string = "free";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, track, family_id")
      .eq("id", user.id)
      .single();
    isKid = deriveRegister(profile) === "kid";
    tier = await getClubTier(supabase, profile?.family_id);
  }

  return (
    <ThesisObjectClient
      object={raw.object}
      initialUpdates={raw.updates}
      userId={user?.id ?? null}
      isKid={isKid}
      isMember={tier !== "free"}
    />
  );
}
