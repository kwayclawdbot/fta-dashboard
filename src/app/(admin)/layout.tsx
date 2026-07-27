export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { resolveViewAs } from "@/lib/server/view-as";

export default async function AdminLayout({
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

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Same gate as the dashboard: the cookie is only read once the REAL profile
  // has been resolved and found to be an admin (src/lib/server/view-as.ts).
  const viewAs = await resolveViewAs(profile.role);

  return <AdminShell viewAs={viewAs}>{children}</AdminShell>;
}
