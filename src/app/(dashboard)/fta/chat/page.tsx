"use client";

import { Lock, Sparkles } from "lucide-react";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaChatRoom from "@/components/fta/FtaChatRoom";
import LockedState from "@/components/dashboard/LockedState";

/**
 * /fta/chat — the FTA Traders room as a dedicated page (moved out of the Club
 * Chat drawer). FTA members only: FIC members hit a LockedState upsell; free
 * members never reach here (DashboardShell shows FreeLocked first).
 *
 * The gate is unchanged. Only the loading state was rebuilt: it mirrors the
 * metallic desk masthead and the room panel — now the board's white
 * `.club-b-card` rather than a bare tinted rectangle — so LOADING is visibly
 * distinct from both the locked state and an empty room (§0.4).
 */
export default function FtaChatPage() {
  const { loading, me, isFta } = useFtaViewer();
  const isChild = me?.role === "child";

  if (loading || !me) {
    return (
      <div className="mx-auto w-full max-w-3xl pb-10" aria-busy="true">
        <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
        <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-11 w-64 animate-pulse rounded bg-sand" />
        <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
        <div className="club-b-card mt-8 flex h-[62vh] min-h-[440px] flex-col justify-end gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 w-2/3 animate-pulse rounded-xl bg-sand/50"
            />
          ))}
          <div className="h-11 w-full animate-pulse rounded-xl bg-sand/40" />
        </div>
        <span className="sr-only">Loading the FTA traders room</span>
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
        body={
          isChild
            ? "The FTA traders room is part of your family's Family Trading Academy. Ask a parent about joining the Academy to unlock it."
            : "The always-on FTA traders room — live setups, cohort talk, and class discussion — opens with the Family Trading Academy. Your Club chat stays right where it is."
        }
        cta={isChild ? undefined : { label: "Unlock FTA", href: "/upgrade", icon: Lock }}
      />
    );
  }

  return <FtaChatRoom me={me} />;
}
