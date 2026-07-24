import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister, type Register } from "@/lib/register";

export interface KaiThread {
  id: string;
  title: string;
  updated_at: string;
}

/** Everything /kai needs to paint the shell on first paint (chat streams client-side). */
export interface KaiChatSeed {
  userId: string;
  register: Register;
  tier: FamilyTier;
  threads: KaiThread[];
  usedToday: number;
  memorySummary: string | null;
  memoryUpdatedAt: string | null;
}

/**
 * Server-first seed for /kai (speed pass). The page previously hid the whole
 * shell behind a spinner until auth → profile → register/tier → threads +
 * usage + memory all resolved client-side. This composes those same reads on the
 * SERVER (under the member's authed session) so the shell (header + empty state +
 * thread sidebar) paints on first paint. Streaming chat, thread open/delete, the
 * composer and the memory-clear action all stay on the client.
 */
export async function getKaiChatSeed(
  supabase: SupabaseClient
): Promise<KaiChatSeed | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, age_group, track, family_id")
    .eq("id", user.id)
    .maybeSingle();

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [tier, threadsRes, usageRes, memoryRes] = await Promise.all([
    getFamilyTier(supabase, profile?.family_id),
    supabase
      .from("kai_chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("kai_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", dayStart.toISOString()),
    supabase
      .from("kai_user_memory")
      .select("summary, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    register: deriveRegister(profile),
    tier,
    threads: (threadsRes.data as KaiThread[]) || [],
    usedToday: usageRes.count ?? 0,
    memorySummary: (memoryRes.data?.summary as string) ?? "",
    memoryUpdatedAt: (memoryRes.data?.updated_at as string) ?? null,
  };
}
