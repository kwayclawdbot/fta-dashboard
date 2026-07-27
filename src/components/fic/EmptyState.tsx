"use client";

import Link from "next/link";
import { SunCircle, LeafSprig, Sparkle } from "@/components/fic/glyphs/motifs";

/**
 * Designed empty states — an empty screen is an invitation, not a blank. Small
 * warm-paper SVG art built from the shared motif kit, so first-run screens carry
 * brand warmth and point at the first action.
 */

function EmptyState({
  art,
  title,
  copy,
  cta,
}: {
  art: React.ReactNode;
  title: string;
  copy: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-sand bg-midnight-900 p-10 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60">
        <SunCircle className="h-40 w-40" />
      </div>
      <div className="relative mx-auto mb-4 h-20 w-20">{art}</div>
      <h2 className="relative font-display text-lg font-bold text-ink">{title}</h2>
      <p className="relative mx-auto mt-1 max-w-md text-sm text-soft">{copy}</p>
      {cta && (
        <Link
          href={cta.href}
          className="cta-button relative mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** A rolled mission scroll waiting to be opened. */
export function EmptyMissions() {
  return (
    <EmptyState
      title="New missions are on the way"
      copy="Your family's playful investing quests land here soon. Check back — there's a set of emblems to collect."
      art={
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden="true">
          <rect x="18" y="20" width="44" height="40" rx="4" fill="var(--g100)" stroke="var(--g600)" strokeWidth="2" />
          <path d="M18 26h44M18 34h30M18 42h34M18 50h24" stroke="var(--g500)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <ellipse cx="18" cy="40" rx="6" ry="20" fill="var(--g400)" stroke="var(--g600)" strokeWidth="2" />
          <ellipse cx="62" cy="40" rx="6" ry="20" fill="var(--g400)" stroke="var(--g600)" strokeWidth="2" />
          <g transform="translate(52 12)">
            <Sparkle className="h-4 w-4" />
          </g>
        </svg>
      }
    />
  );
}

/** A corkboard with one pin — start your research board. */
export function EmptyWatchlist({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-sand bg-midnight-900 p-10 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50">
        <SunCircle className="h-44 w-44" />
      </div>
      <div className="relative mx-auto mb-4 h-24 w-24">
        <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden="true">
          {/* Themed surfaces, not literal cream/white — on the dark theme the
              hardcoded board lit up as a bright rectangle on near-black. */}
          <rect x="10" y="14" width="76" height="60" rx="6" fill="var(--paper)" stroke="var(--sand)" strokeWidth="2" />
          <rect x="30" y="30" width="30" height="24" rx="2" fill="var(--card)" stroke="var(--g500)" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="45" cy="26" r="4" fill="#DC2626" />
          <line x1="45" y1="30" x2="45" y2="34" stroke="#B91C1C" strokeWidth="1.5" />
          <g transform="translate(64 40)"><LeafSprig className="h-4 w-8" /></g>
        </svg>
      </div>
      <h2 className="relative font-display text-lg font-bold text-ink">
        Start your research board
      </h2>
      <p className="relative mx-auto mt-1 max-w-md text-sm text-soft">
        Pin the first company your family already knows and loves — the snack, the
        sneakers, the game, the phone. Everything starts in Watching.
      </p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="cta-button relative mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
        >
          Add your first company
        </button>
      )}
    </div>
  );
}
