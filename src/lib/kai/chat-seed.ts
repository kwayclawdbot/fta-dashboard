import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister, type Register } from "@/lib/register";
import { memberMode } from "@/lib/mode";
import { resolveKaiProfile, type KaiProfile } from "@/lib/kai/persona";

export interface KaiThread {
  id: string;
  title: string;
  updated_at: string;
}

/** Everything /kai needs to paint the shell on first paint (chat streams client-side). */
export interface KaiChatSeed {
  userId: string;
  register: Register;
  /** Server-resolved guardrail profile — drives the (cosmetic) suggestion chips. */
  profile: KaiProfile;
  /** Whether this member is a Family-Mode adult who MAY toggle "Deeper analysis". */
  canToggleDeepMode: boolean;
  /** Current state of that opt-in. */
  deepMode: boolean;
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
    .select("role, age_group, track, family_id, kai_deep_mode")
    .eq("id", user.id)
    .maybeSingle();

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  // Solo signal for profile resolution (mirrors the chat route). The member-mode
  // verdict is owned by src/lib/mode.ts (C1). kai_personalization is SECURITY
  // DEFINER so it returns the household past the parent-only family_profiles RLS,
  // hard-scoped to caller.
  const { data: persData } = await supabase.rpc("kai_personalization");
  const persFam = ((persData || {}) as {
    family?: {
      household?: { adults?: number; kids?: number; kid_age_ranges?: string[] } | null;
      hh_completed_at?: string | null;
    } | null;
  }).family;
  const register = deriveRegister(profile);
  const deepMode = profile?.kai_deep_mode === true;
  const solo =
    memberMode({
      household: persFam?.household ?? null,
      completed_at: persFam?.hh_completed_at ?? null,
    }) === "individual";
  const kaiProfile = resolveKaiProfile(register, { solo, deepMode });
  // A Family-Mode adult (not already solo/club) is the only one who may opt in.
  const canToggleDeepMode = register === "adult" && !solo;

  const [tier, threadsRes, usageRes, memoryRes] = await Promise.all([
    getClubTier(supabase, profile?.family_id),
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
    register,
    profile: kaiProfile,
    canToggleDeepMode,
    deepMode,
    tier,
    threads: (threadsRes.data as KaiThread[]) || [],
    usedToday: usageRes.count ?? 0,
    memorySummary: (memoryRes.data?.summary as string) ?? "",
    memoryUpdatedAt: (memoryRes.data?.updated_at as string) ?? null,
  };
}
