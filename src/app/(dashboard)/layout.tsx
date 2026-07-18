export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("role, age_group, track, display_name, onboarding_complete")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding");
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
  };

  return <DashboardShell user={userData}>{children}</DashboardShell>;
}
