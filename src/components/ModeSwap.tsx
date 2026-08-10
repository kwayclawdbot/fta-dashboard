"use client";

import type { ReactNode } from "react";
import { useAppMode } from "@/lib/useAppMode";

/**
 * ModeSwap — the client-side door for SERVER pages (.planning/
 * CLUB-TERMINAL-STYLE.md, 2026-08-09). A server component builds BOTH subtrees
 * (so commercial copy can be byte-preserved in each) and hands them here; this
 * renders the family subtree on the server / first paint (the historical
 * default — the family tree never flickers) and swaps to the club subtree on
 * mount when the shell's data-mode says so. Kid/free walls are unaffected:
 * this is a skin branch, both subtrees are produced by the same guarded page.
 */
export default function ModeSwap({
  club,
  family,
}: {
  club: ReactNode;
  family: ReactNode;
}) {
  return useAppMode() === "club" ? <>{club}</> : <>{family}</>;
}
