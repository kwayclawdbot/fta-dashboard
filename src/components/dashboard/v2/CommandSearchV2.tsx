"use client";

import CommandSearch from "@/components/search/CommandSearch";

/**
 * CommandSearchV2 — v2 skin for the universal ⌘K command surface (TopBarV2).
 *
 * WRAP, DON'T REWRITE: the palette logic, keyboard handling, /api/search, and
 * intent rows all stay in the shared <CommandSearch/> component. This wrapper
 * only re-grounds it to the canvas by (a) reshaping the top-bar trigger into a
 * 32px round ghost control and (b) remapping the v1 raw colour vars
 * (--paper/--sand/--card/--ink/--soft/--accent-*) to their --cc-* equivalents
 * within the `.cc-cmdsearch-v2` scope. Every v1 utility inside the trigger AND
 * the modal (both DOM descendants — the modal is `fixed`, not portalled) reads
 * those vars, so the whole surface recolours with zero edits to the underlying
 * component. Scoped so nothing leaks to the rest of the app.
 *
 * Known remaining v1 inside the modal: the "Ask Kai" row icon + the empty-state
 * "Ask Kai instead" button use `bg-kai-blue`, which is intentionally Kai=blue
 * per DESIGN-UX-SPEC law (Kai surfaces are blue) — left as-is.
 */
export default function CommandSearchV2() {
  return (
    <div className="cc-cmdsearch-v2 inline-flex">
      <style>{`
        /* Re-ground every v1 token utility (trigger + modal) to --cc-*. */
        .cc-cmdsearch-v2 {
          --paper: var(--cc-card2);
          --sand: var(--cc-line);
          --card: var(--cc-card);
          --ink: var(--cc-ink);
          --soft: var(--cc-soft);
          --accent-solid: var(--cc-orange);
          --accent-strong: var(--cc-orange);
        }
        /* Trigger → 32px round ghost control (canvas proportion). */
        .cc-cmdsearch-v2 > button[data-tour="search"] {
          width: 32px; height: 32px; min-width: 32px; padding: 0;
          border-radius: 9999px;
          justify-content: center;
          background: var(--cc-card2);
          border: 1px solid var(--cc-line);
          color: var(--cc-soft);
        }
        .cc-cmdsearch-v2 > button[data-tour="search"]:hover {
          border-color: var(--cc-orange);
          color: var(--cc-ink);
        }
        /* Collapse the desktop "Search anything…" label + ⌘K kbd — the round
           control is icon-only on every breakpoint. */
        .cc-cmdsearch-v2 > button[data-tour="search"] > span,
        .cc-cmdsearch-v2 > button[data-tour="search"] > kbd { display: none !important; }
      `}</style>
      <CommandSearch />
    </div>
  );
}
