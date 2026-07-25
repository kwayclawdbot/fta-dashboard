"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getVipFlag, clearVipFlag, clearChallengeFlag } from "@/lib/funnel";
import ChallengeThankYou from "@/components/free-class/ChallengeThankYou";

/**
 * 5-Day Investing Challenge thank-you (Lane C7). Reached right after a challenge
 * signup — the register route pushes here once the account is created and the
 * client is signed in. Guards for auth (a stray visitor is bounced to the
 * funnel), reads the first name for the celebration, then renders the
 * activation surface (timeline + referral loop + calendar + in-app CTAs).
 */
export default function ChallengeThankYouPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [ages, setAges] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [vipIntent, setVipIntent] = useState(false);
  const [vipEnabled, setVipEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Read the VIP intent flag before it's cleared, so the upsell can lead.
    setVipIntent(getVipFlag());
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!auth?.user) {
        router.replace("/free-class");
        return;
      }
      const meta = auth.user.user_metadata as { display_name?: string } | null;
      setFirstName(meta?.display_name || "");
      // Thank-you context: ages (family-mode surfacing) + paid-VIP status + gate.
      try {
        const ctx = await fetch("/api/challenge/context").then((r) =>
          r.ok ? r.json() : null
        );
        if (mounted && ctx) {
          setAges(ctx.ages ?? null);
          setIsVip(!!ctx.isVip);
          setVipEnabled(!!ctx.vipEnabled);
        }
      } catch {
        /* non-blocking */
      }
      // One-shot flags — clear now that the thank-you has read them.
      clearVipFlag();
      clearChallengeFlag();
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <ChallengeThankYou
      firstName={firstName}
      ages={ages}
      isVip={isVip}
      vipIntent={vipIntent}
      vipEnabled={vipEnabled}
      onExplore={() => router.push("/dashboard?tour=1")}
    />
  );
}
