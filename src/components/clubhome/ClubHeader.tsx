"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { LiveDot } from "./parts";

/**
 * §1 Header — premium, time-aware greeting (no "gm", no emoji), the live
 * "minds connected" line (scale-aware → founding copy below floor), and a
 * universal "Search the Club" field. The global notifications + avatar live in
 * the app top bar (DashboardTopBar); this is the page's editorial opening line,
 * on the sand, closed by a hairline — not a boxed header.
 */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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
    <header className="border-b border-sand pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
            {greeting()}, {firstName || "there"}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-soft">
            <LiveDot tone="teal" />
            {floorMet && connectedMinds != null ? (
              <span>
                <span className="font-mono font-semibold tabular-nums text-teal-700">
                  {connectedMinds.toLocaleString()}
                </span>{" "}
                minds connected
              </span>
            ) : (
              <span className="font-medium text-teal-700">
                Founding era — you&apos;re early
              </span>
            )}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          role="search"
          className="group relative w-full shrink-0 sm:w-72"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft transition-colors group-focus-within:text-volt-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Club…"
            aria-label="Search the Club"
            className="h-10 w-full rounded-xl border border-sand bg-card pl-9 pr-3 text-sm text-ink placeholder:text-soft outline-none transition-colors focus:border-volt-400"
          />
        </form>
      </div>
    </header>
  );
}
