"use client";

import NotificationsBell from "@/components/notifications/NotificationsBell";

/**
 * NotificationsBellV2 — v2 skin for the top-bar notifications bell (TopBarV2).
 *
 * WRAP, DON'T REWRITE: the bell's data loading, Realtime unread subscription,
 * mark-all-read, and deep-linking all stay in the shared <NotificationsBell/>.
 * This wrapper only re-grounds it to the canvas by (a) reshaping the trigger
 * into a 32px round ghost control matching CommandSearchV2 and (b) remapping the
 * v1 raw colour vars used by the trigger + dropdown panel (--m* midnight scale,
 * --g* gold scale) to --cc-* equivalents within the `.cc-notif-v2` scope. The
 * panel is a `fixed`/absolute DOM descendant, so its `bg-midnight-900`,
 * `border-midnight-*`, `text-midnight-*`, `bg-gold-*`/`text-gold-*` utilities
 * all recolour off these vars with zero edits to the underlying component.
 *
 * Known remaining v1 inside the panel: the unread badge's ink colour is a
 * hardcoded `text-night-950` (dark) baked into @theme (not a remappable raw
 * var) — it reads as correct dark ink-on-orange, so it is left as-is.
 */
export default function NotificationsBellV2() {
  return (
    <div className="cc-notif-v2 relative inline-flex">
      <style>{`
        .cc-notif-v2 {
          /* midnight scale → v2 dark surfaces/text (panel is inverted for light
             in v1; here it reads --cc-* on both themes). */
          --m900: var(--cc-card);    /* panel bg */
          --m950: var(--cc-card2);   /* row hover + footer bg */
          --m800: var(--cc-line);    /* row hairlines */
          --m700: var(--cc-line);    /* panel border */
          --m100: var(--cc-ink);     /* strong text */
          --m200: var(--cc-ink);     /* body text */
          --m400: var(--cc-soft);    /* secondary text + resting bell */
          --m500: var(--cc-dim);     /* tertiary text */
          --m600: var(--cc-dim);     /* empty-state icon */
          /* gold scale → orange signal (badge, unread accents, mark-all link). */
          --g400: var(--cc-orange);
          --g500: var(--cc-orange);
          --g600: var(--cc-orange);
          --g700: var(--cc-orange-ink);
        }
        /* Trigger → 32px round ghost control (matches CommandSearchV2). */
        .cc-notif-v2 > button {
          width: 32px; height: 32px; padding: 0; margin: 0;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 9999px;
          background: var(--cc-card2);
          border: 1px solid var(--cc-line);
          color: var(--cc-soft);
        }
        .cc-notif-v2 > button:hover { border-color: var(--cc-orange); color: var(--cc-ink); }
      `}</style>
      <NotificationsBell />
    </div>
  );
}
