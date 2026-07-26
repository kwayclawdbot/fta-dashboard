export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveRegister } from "@/lib/register";
import ScreenerSurface from "@/components/screener/ScreenerSurface";

/**
 * /screener — the standalone Stock Screener route. The screener itself now lives
 * in a shared client component (ScreenerSurface) so the exact same surface can
 * also render as the "Screener" tab on the Discover research hub. This route
 * keeps working as it always did (full-page chrome), so every existing deep link
 * to /screener — sidebar rows, the research breadcrumb, the Discover "Launch
 * Stock Finder" CTA, the app tour — stays live.
 *
 * Gating (belt-and-suspenders with the nav, which never surfaces the screener to
 * young kids): a kid reaching /screener directly is redirected server-side —
 * they were never meant to browse the full ~11.5k-ticker universe. Teens and
 * adults keep full access. The data door is closed to match by RLS
 * (migration 137, viewer_is_kid).
 */
export default async function ScreenerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track")
    .eq("id", user.id)
    .single();

  if (deriveRegister(profile) === "kid") redirect("/dashboard");

  return <ScreenerSurface />;
}
