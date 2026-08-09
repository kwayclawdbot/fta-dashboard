"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Gem, X } from "lucide-react";

import type { BriefResponse } from "@/lib/clubhome/contract";

/**
 * KAI MORNING BRIEF — the mockup board's brief card, verbatim.
 *
 * The reference home (board 10_07_23, top-left phone) draws ONE contained card
 * directly under the greeting:
 *
 *   HEADER — "KAI MORNING BRIEF" in Kai's own colour (purple in club-dark),
 *   the brief's timestamp in muted gray RIGHT BESIDE the label, and a dismiss
 *   "×" at the far right. No icon tile, no filled band.
 *
 *   BODY — the brief's items as bullet rows, each led by a small green gem
 *   mark, the ticker in bold with NO "$" prefix ("NVDA momentum strong
 *   overnight."), verbatim from the Kai brief. Three states stay distinct:
 *   loading shimmers inside the real card, `available:false` renders the
 *   preserved unavailable line, and zero items renders the founding line.
 *
 *   FOOTER — "{n} things need your attention →" in Kai's colour, into /alerts.
 *
 * The board's card carries NOTHING else: the index-chip row and the "derived"
 * footnote of the previous build are gone from this surface.
 *
 * DISMISS. The board's "×" hides the card; persisted per-brief (keyed on
 * `updatedAt` in localStorage) so a NEW brief reappears while the dismissed one
 * stays gone. No brief identity (no updatedAt) → dismissal lasts the session.
 *
 * KID: the caller strips sentiment items before they reach here (ClubHomeV2),
 * so no bull/bear read can arrive on this surface.
 */
// A store that never changes: hydration is a one-way, render-time fact.
const subscribeNever = () => () => {};

/* ── dismissal store ─────────────────────────────────────────────────────────
   The board's "×" hides the card. Dismissal is an EXTERNAL fact (localStorage
   plus a session mark), so it rides useSyncExternalStore like every other
   impure read on this surface — never a setState inside an effect. The server
   snapshot is null, so SSR and the first client render agree the card is up. */
const DISMISS_KEY = "ccc:brief-dismissed";
const dismissListeners = new Set<() => void>();
/** Session-scoped mark: the persisted id, or "session" for an id-less brief. */
let sessionDismissed: string | null = null;

function subscribeDismiss(cb: () => void): () => void {
  dismissListeners.add(cb);
  return () => dismissListeners.delete(cb);
}
function getDismissSnapshot(): string | null {
  if (sessionDismissed) return sessionDismissed;
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null; /* private mode — the card simply stays */
  }
}
const getDismissServerSnapshot = () => null;

function markDismissed(id: string | null) {
  sessionDismissed = id ?? "session";
  if (id) {
    try {
      localStorage.setItem(DISMISS_KEY, id);
    } catch {
      /* private mode — session-only dismissal */
    }
  }
  dismissListeners.forEach((l) => l());
}

export default function TodayIn30({
  brief,
  loading = false,
}: {
  brief?: BriefResponse | null;
  /** LOADING ≠ EMPTY — see the header. */
  loading?: boolean;
}) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? true;

  // The header's time — only formatted on the CLIENT, so server HTML never
  // carries a timezone guess. The store trick makes hydration exact: the
  // server snapshot says "not yet", the client snapshot says "now", and the
  // stamp appears without a setState-in-effect cascade.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const updatedAt = brief?.updatedAt ?? null;
  let stamp: string | null = null;
  if (hydrated && updatedAt) {
    const d = new Date(updatedAt);
    if (!Number.isNaN(d.getTime())) {
      stamp = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  }

  // DISMISSAL — keyed on the brief's own identity, so a NEW brief reappears
  // while the dismissed one stays gone. An id-less brief dismisses for the
  // session only.
  const dismissedMark = useSyncExternalStore(
    subscribeDismiss,
    getDismissSnapshot,
    getDismissServerSnapshot
  );
  const dismissed =
    dismissedMark != null &&
    (updatedAt ? dismissedMark === updatedAt : dismissedMark === "session");

  if (dismissed) return null;

  const n = items.length;

  return (
    <section
      className="overflow-hidden rounded-[16px] border border-sand bg-card px-4 pb-4 pt-[14px]"
      aria-labelledby="club-today"
    >
      {/* header row — label + stamp side by side, dismiss at the far right */}
      <div className="flex items-center gap-2.5">
        <h2
          id="club-today"
          className="min-w-0 truncate font-display text-[11.5px] font-bold uppercase leading-none tracking-[0.1em]"
          style={{ color: "var(--kai-blue)" }}
        >
          Kai morning brief
        </h2>
        {stamp && (
          <span className="shrink-0 text-[11px] leading-none text-soft">
            {stamp}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => markDismissed(updatedAt)}
          aria-label="Dismiss the morning brief"
          className="f0-focus f0-press -m-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-soft transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="pt-3.5">
        {loading ? (
          <div className="space-y-2.5" aria-busy="true">
            <div className="h-2.5 w-[88%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-2.5 w-[72%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
            <div className="h-2.5 w-[56%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
            <span className="sr-only">Loading today&apos;s brief</span>
          </div>
        ) : !available ? (
          <p className="text-[12.5px] font-medium leading-snug text-soft">
            Kai is temporarily unavailable — here&apos;s what the Club&apos;s
            activity shows.
          </p>
        ) : n > 0 ? (
          <ul className="space-y-[12px]">
            {items.map((it, i) => (
              <li
                key={`${it.ticker ?? ""}-${i}`}
                className="flex items-start gap-[10px] text-[13px] leading-snug text-ink"
              >
                {/* the board's small green gem mark on every line */}
                <Gem
                  className="mt-[1.5px] h-3 w-3 shrink-0 text-price-up"
                  aria-hidden
                />
                <span className="min-w-0">
                  {it.ticker && (
                    <span className="mr-1.5 font-bold">{it.ticker}</span>
                  )}
                  {it.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] font-medium leading-snug text-soft">
            Your brief fills in as the Club moves — check back once a little
            more activity lands.
          </p>
        )}

        {!loading && available && n > 0 && (
          <Link
            href="/alerts"
            className="f0-focus f0-press mt-4 inline-block rounded-md text-[13px] font-semibold"
            style={{ color: "var(--kai-blue)" }}
          >
            {n} thing{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} your
            attention →
          </Link>
        )}
      </div>
    </section>
  );
}
