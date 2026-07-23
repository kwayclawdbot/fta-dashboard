"use client";

import { Lock, Sparkles } from "lucide-react";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaChatRoom from "@/components/fta/FtaChatRoom";
import LockedState from "@/components/dashboard/LockedState";

/**
 * /fta/chat — the FTA Traders room as a dedicated Discord-vibe page (moved out
 * of the Club Chat drawer). FTA members only: FIC members hit a LockedState
 * upsell; free members never reach here (DashboardShell shows FreeLocked first).
 */
export default function FtaChatPage() {
  const { loading, me, isFta } = useFtaViewer();

  if (loading || !me) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-28 rounded-2xl bg-sand/40" />
        <div className="h-[62vh] min-h-[440px] rounded-2xl bg-sand/30" />
      </div>
    );
  }

  if (!isFta) {
    return (
      <LockedState
        icon={Sparkles}
        lockBadge
        eyebrow="FTA — Trading Academy"
        title="Unlock the Traders Chat"
        body="The always-on FTA traders room — live setups, cohort talk, and class discussion — opens with the Family Trading Academy. Your FIC club chat stays right where it is."
        cta={{ label: "Unlock FTA", href: "/upgrade", icon: Lock }}
      />
    );
  }

  return <FtaChatRoom me={me} />;
}
