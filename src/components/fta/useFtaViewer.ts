"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister } from "@/lib/register";
import type { ChatMe } from "@/lib/useChatRoom";
import type { Role } from "@/lib/feed";

/**
 * Shared viewer + tier resolver for the FTA hub pages (/fta/chat|courses|
 * recordings). One place that answers "who is looking, and can they open the
 * FTA side?" so the three pages gate identically. FIC members get a LockedState
 * upsell; free members never reach these pages (DashboardShell renders
 * FreeLocked first), but we still resolve so a defensive gate can render.
 */

export interface FtaProfile {
  role: Role;
  age_group: string | null;
  track: string | null;
  family_id: string | null;
}

export function useFtaViewer() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<ChatMe | null>(null);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [profile, setProfile] = useState<FtaProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name, role, age_group, track, family_id, avatar_url, username")
        .eq("id", user.id)
        .single();
      const t = await getFamilyTier(supabase, data?.family_id);
      if (!mounted) return;
      setMe({
        id: user.id,
        display_name: data?.display_name || "You",
        role: (data?.role as Role) || "parent",
        age_group: data?.age_group ?? null,
        family_id: data?.family_id ?? null,
        avatar_url: data?.avatar_url ?? null,
        username: data?.username ?? null,
      });
      setProfile({
        role: (data?.role as Role) || "parent",
        age_group: data?.age_group ?? null,
        track: data?.track ?? null,
        family_id: data?.family_id ?? null,
      });
      setTier(t);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // KID GATE (214). `isFta` was the tier alone, so a kid in an FTA household
  // opened the FTA hub — including /fta/chat's composer. The database refuses
  // those writes (207 confines kids to the Main Circle), so the UI was offering
  // an action that could only fail. FTA is an adult room; a kid gets the
  // LockedState instead. Same precedence as viewer_is_kid() server-side.
  const isKid = profile ? deriveRegister(profile) === "kid" : false;

  return { loading, me, tier, profile, isFta: tier === "fta" && !isKid };
}
