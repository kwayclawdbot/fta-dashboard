"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { FamilyTier } from "@/lib/tier";
import KaiPanel from "@/components/kai/KaiPanel";
import FloatingKaiButton from "@/components/dashboard/FloatingKaiButton";

/**
 * KaiSheetProvider — Kai as a SYSTEM CAPABILITY, not a destination (PART IV).
 *
 * Owns the contextual Kai sheet (desktop right side-sheet / mobile bottom-sheet,
 * both rendered by <KaiPanel> → <KaiChatShared variant="panel">). Any surface can
 * open Kai WITH page context via `useKaiSheet().openKai({ chip, query })`:
 *   • the floating Kai FAB (no context)
 *   • an "Ask Kai about …" row in universal search (chip = the entity, query = it)
 *   • a ticker / lesson / thesis / alert page's "Ask Kai" action (chip = the object)
 *
 * The chip appears in the sheet header (Kai-blue) so Kai — and the member — can
 * see what context Kai already has; the query prefills the composer. The /kai
 * page still exists as the full view; this sheet is the primary, in-context path.
 *
 * Free tier is gated out (Kai is members-only, walled server-side) — openKai is a
 * no-op and the FAB is hidden, so a free member never reaches a bounce.
 */
export interface KaiContext {
  /** Short label of the current surface (e.g. "NVDA", "Lesson: Candles"). */
  chip?: string | null;
  /** A query to prefill the composer with. */
  query?: string | null;
}

interface KaiSheetApi {
  openKai: (ctx?: KaiContext) => void;
}

const Ctx = createContext<KaiSheetApi>({ openKai: () => {} });

/** Open the contextual Kai sheet from anywhere under the dashboard shell. */
export function useKaiSheet(): KaiSheetApi {
  return useContext(Ctx);
}

export default function KaiSheetProvider({
  tier,
  role,
  ageGroup,
  isSolo,
  children,
}: {
  tier?: FamilyTier;
  role?: string;
  ageGroup?: string;
  isSolo?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ctx, setCtx] = useState<KaiContext | null>(null);
  const [nonce, setNonce] = useState(0);

  const isFree = (tier ?? "fic") === "free";

  const openKai = useCallback(
    (next?: KaiContext) => {
      if (isFree) return;
      setCtx(next ?? null);
      setNonce((n) => n + 1);
      setMounted(true);
      setOpen(true);
    },
    [isFree]
  );

  const close = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openKai }}>
      {children}
      {/* The persistent FAB entry point — self-gates on tier/route. */}
      <FloatingKaiButton
        role={role}
        ageGroup={ageGroup}
        tier={tier}
        isSolo={isSolo}
        onOpen={() => openKai()}
      />
      {mounted && (
        <KaiPanel
          open={open}
          onClose={close}
          contextChip={ctx?.chip ?? null}
          initialInput={ctx?.query ?? null}
          contextNonce={nonce}
        />
      )}
    </Ctx.Provider>
  );
}
