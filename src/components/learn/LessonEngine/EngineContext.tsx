"use client";

import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Shared runtime the engine hands to steps that touch the live product
 *  (real-world actions). Kept minimal + own-row scoped. */
export interface EngineRuntime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  userId: string | null;
  familyId: string | null;
}

const Ctx = createContext<EngineRuntime | null>(null);

export function EngineProvider({
  value,
  children,
}: {
  value: EngineRuntime;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngineRuntime(): EngineRuntime | null {
  return useContext(Ctx);
}
