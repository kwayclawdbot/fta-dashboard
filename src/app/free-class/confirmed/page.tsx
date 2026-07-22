"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type NextClassResponse } from "@/lib/free-class";
import ConfirmationView from "@/components/free-class/ConfirmationView";

/**
 * Confirmation / signed-in hub. Reached on full registration (?welcome=1) or by
 * an already-signed-in visitor landing on the funnel. Reuses the original,
 * proven confirmation experience component — class card, ICS, video, Join FIC.
 */
function ConfirmedInner() {
  const router = useRouter();
  const supabase = createClient();
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";

  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<NextClassResponse | null>(null);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: auth }, nextRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch("/api/free-class/next")
          .then((r) => (r.ok ? (r.json() as Promise<NextClassResponse>) : null))
          .catch(() => null),
      ]);
      if (!mounted) return;
      if (!auth?.user) {
        router.replace("/free-class");
        return;
      }
      const meta = auth.user.user_metadata as { display_name?: string } | null;
      setFirstName(meta?.display_name || "");
      setMeta(nextRes);
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
    <ConfirmationView
      session={meta?.session ?? null}
      videoUrl={meta?.video_url ?? null}
      firstName={firstName}
      signedInHub={!welcome}
      onExplore={() => router.push("/dashboard")}
    />
  );
}

export default function ConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-paper">
          <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
        </div>
      }
    >
      <ConfirmedInner />
    </Suspense>
  );
}
