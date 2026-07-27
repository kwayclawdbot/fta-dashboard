"use client";

/**
 * ClubHome — the LIVE ALERT feed behind the action band's P1 (urgent) slot.
 *
 * The band escalates to its takeover state only when something has genuinely
 * fired. The one client-reachable source of a fired Kai object today is the
 * SETUP lifecycle (`GET /api/alerts/setups?state=live`, backed by `alert_setups`
 * — migration 158). A setup in `confirmed` state is a live trigger; `waiting` is
 * a setup on deck, which is NOT urgent and must never take the band over
 * (crying wolf is the failure mode the band was designed against).
 *
 * Everything degrades to null: unauthenticated, RLS-empty, 404, or a parse
 * failure all mean "no alert", and the band relaxes to its digest state. No
 * fabricated alert is ever synthesised.
 */

import { useEffect, useState } from "react";

export interface LiveAlert {
  text: string;
  href: string;
  when: string;
}

interface SetupRow {
  id: string;
  ticker?: string | null;
  direction?: string | null;
  thesis?: string | null;
  state?: string | null;
  state_entered_at?: string | null;
  created_at?: string | null;
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function toAlert(row: SetupRow): LiveAlert | null {
  const ticker = (row.ticker || "").trim().toUpperCase();
  if (!ticker) return null;
  const dir = row.direction === "short" ? "short" : row.direction === "long" ? "long" : null;
  const head = dir ? `$${ticker} ${dir} setup confirmed` : `$${ticker} setup confirmed`;
  const thesis = (row.thesis || "").trim();
  const raw = thesis ? `${head} — ${thesis}` : head;
  return {
    text: raw.length > 170 ? `${raw.slice(0, 167).trimEnd()}…` : raw,
    href: "/alerts",
    when: relTime(row.state_entered_at || row.created_at),
  };
}

/**
 * The single most recent CONFIRMED setup, or null. `enabled=false` (kid
 * register, fixture preview) never touches the network.
 */
export function useLiveAlert(enabled = true): LiveAlert | null {
  const [alert, setAlert] = useState<LiveAlert | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    let mounted = true;

    void (async () => {
      try {
        const res = await fetch("/api/alerts/setups?state=live&limit=10", {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { setups?: SetupRow[] };
        const rows = Array.isArray(json.setups) ? json.setups : [];
        // `state=live` returns waiting + confirmed; only confirmed is urgent.
        const fired = rows.find((r) => r.state === "confirmed");
        if (!mounted || !fired) return;
        setAlert(toAlert(fired));
      } catch {
        /* absent = no alert; the band relaxes to its digest state */
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [enabled]);

  // `enabled` gates the RESULT as well as the fetch, so a disabled hook never
  // has to clear state (and never surfaces a stale alert if it flips off).
  return enabled ? alert : null;
}
