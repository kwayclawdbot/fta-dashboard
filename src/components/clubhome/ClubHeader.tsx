"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * §1 Header — mock-faithful: the "gm, Alex 👋" greeting (owner reverted to the
 * mock vernacular), the live "N minds connected" line (scale-aware → founding
 * copy below floor), and a universal "Search the Club…" field with a ⌘K hint.
 * Notifications + avatar live in the app's global top bar (DashboardTopBar); this
 * is the page's opening line, on the warm sand — closed by nothing (the mock has
 * no rule here), so it sits directly above Live Pulse.
 */

export default function ClubHeader({
  firstName,
  connectedMinds,
  floorMet,
}: {
  firstName: string;
  connectedMinds: number | null;
  floorMet: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t) router.push(`/research/${encodeURIComponent(t)}`);
  }

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight text-ink sm:text-[34px]">
          gm, {firstName || "there"} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-soft">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400 club-livedot-teal" />
          </span>
          {floorMet && connectedMinds != null ? (
            <span>
              <span className="font-mono font-semibold tabular-nums text-ink">
                {connectedMinds.toLocaleString()}
              </span>{" "}
              minds connected
            </span>
          ) : (
            <span className="font-medium text-teal-700">Founding era — you&apos;re early</span>
          )}
        </p>
      </div>

      <form onSubmit={onSubmit} role="search" className="group relative w-full shrink-0 sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-soft transition-colors group-focus-within:text-volt-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the Club…"
          aria-label="Search the Club"
          className="h-11 w-full rounded-xl border border-sand bg-card pl-10 pr-14 text-sm text-ink placeholder:text-soft outline-none transition-colors focus:border-volt-400"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-sand bg-paper px-1.5 py-0.5 font-mono text-[11px] font-semibold text-soft">
          ⌘K
        </kbd>
      </form>
    </header>
  );
}
