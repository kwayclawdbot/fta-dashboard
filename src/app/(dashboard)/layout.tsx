export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFamilyTier } from "@/lib/tier";
import { isSoloProfile } from "@/lib/register";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, display_name, avatar_url, onboarding_complete, family_id")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding");
  }

  // Family membership tier (FIC/FTA) — kids inherit the family's tier.
  const tier = await getFamilyTier(supabase, profile?.family_id);

  // Solo (individual, non-parent) member — a family of one. Only owners
  // (parent/admin) can be solo; kids/teens always belong to a parent's family.
  // Derived from a COMPLETED family_profiles household so unfinished/default
  // rows never read as solo, and the nav keeps its family framing for them.
  let isSolo = false;
  if (
    profile?.family_id &&
    (profile.role === "parent" || profile.role === "admin")
  ) {
    const { data: fp } = await supabase
      .from("family_profiles")
      .select("household, completed_at")
      .eq("family_id", profile.family_id)
      .maybeSingle();
    isSolo = isSoloProfile(fp);
  }

  const userData = {
    email: user.email,
    display_name:
      profile?.display_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name,
    role: profile?.role ?? undefined,
    age_group: profile?.age_group ?? undefined,
    track: profile?.track ?? undefined,
    avatar_url: profile?.avatar_url ?? undefined,
    tier,
    isSolo,
  };

  return <DashboardShell user={userData}>{children}</DashboardShell>;
}
