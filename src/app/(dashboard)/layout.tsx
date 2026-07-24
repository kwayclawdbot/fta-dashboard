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

  // Challenge-pass window (Lane C7): a family whose tier is 'fic' MAY actually
  // be a 5-Day Challenge pass-holder (full Club until expires_at, then free).
  // Surface the expiry so the shell can show a friendly days-left banner. Only
  // meaningful while the pass is still active; once expired the tier is 'free'.
  let challengeExpiresAt: string | null = null;
  if (profile?.family_id && tier === "fic") {
    const { data: pass } = await supabase
      .from("enrollments")
      .select("expires_at")
      .eq("family_id", profile.family_id)
      .eq("program", "challenge_pass")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    challengeExpiresAt = (pass?.expires_at as string | null) ?? null;
  }

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

  return (
    <DashboardShell user={userData} challengeExpiresAt={challengeExpiresAt}>
      {children}
    </DashboardShell>
  );
}
