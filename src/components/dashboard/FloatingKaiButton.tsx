"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useReducedMotion } from "@/lib/motion";
import { showsKaiFab } from "@/lib/kai-fab";
import type { FamilyTier } from "@/lib/tier";

/* ══════════════════════════════════════════════════════════════════════════
   THE KAI MARK.

   What shipped was a lucide robot glyph on a flat cobalt disc — a stock icon on
   a solid colour, which is the one thing the brand register names outright: an
   object with no identity. It also fought the canvas, because everything else on
   these boards is warm stock with a drawn object on it, and this was the single
   saturated blob in the corner of every screen.

   Drawn to the illustration brief that governs src/components/art: ONE line
   weight (2px, non-scaling), ONE flat fill per object, no gradients, no shadow
   inside the drawing. The form is warm — card stock, the same paper the boards
   are printed on — and Kai-blue is the ACCENT on it (the line, the eyes, the
   spark), not the ground. That is the .f0-kai-mark language stated as a drawing
   rather than as a gradient chip.

   Geometry (viewBox 28 × 28): a rounded lens, slightly wider than tall, with two
   eyes and a four-point spark clearing its top-right corner. The spark is what
   makes it Kai and not a face — it is the same mark the "Ask Kai" actions use
   throughout, drawn once at FAB size instead of borrowed from an icon set.

   `tone` is the state, not the theme: `line` is the resting mark on warm stock,
   `solid` is the inverted mark once the ground fills with Kai-blue.
   ══════════════════════════════════════════════════════════════════════════ */
function KaiMark({
  tone = "line",
  thinking = false,
  reduced = false,
  size = 26,
}: {
  tone?: "line" | "solid";
  /** Kai is opening / working: the eyes become a three-dot thought. */
  thinking?: boolean;
  reduced?: boolean;
  size?: number;
}) {
  // On warm stock the drawing is Kai-blue with a pale blue fill; once the ground
  // is Kai-blue the same drawing inverts to paper. One geometry, two tints.
  const line = tone === "solid" ? "var(--paper)" : "var(--kai-blue, #2563FF)";
  const fill =
    tone === "solid"
      ? "color-mix(in srgb, var(--paper) 18%, transparent)"
      : "color-mix(in srgb, var(--kai-blue, #2563FF) 12%, transparent)";

  // Resting: two eyes. Thinking: three dots across the lens. Reduced motion gets
  // the same three dots without the stagger — the state still reads, it just
  // does not move.
  const eyes = thinking ? [9.5, 14, 18.5] : [11, 17];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <g
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        {/* the lens — Kai's one form */}
        <path
          d="M8 7.5H20C22.2 7.5 24 9.3 24 11.5V17.5C24 19.7 22.2 21.5 20 21.5H8C5.8 21.5 4 19.7 4 17.5V11.5C4 9.3 5.8 7.5 8 7.5Z"
          fill={fill}
        />
        {/* the spark, clearing the top-right corner */}
        <path d="M22.5 2.5L23.4 5.1L26 6L23.4 6.9L22.5 9.5L21.6 6.9L19 6L21.6 5.1Z" fill={fill} />
      </g>
      {eyes.map((cx, i) => (
        <circle
          key={cx}
          cx={cx}
          cy={14.5}
          r={1.6}
          fill={line}
          className={thinking && !reduced ? "animate-pulse" : undefined}
          style={
            thinking && !reduced
              ? { animationDelay: `${i * 160}ms`, animationDuration: "900ms" }
              : thinking
                ? { opacity: 0.75 }
                : undefined
          }
        />
      ))}
    </svg>
  );
}

/**
 * FloatingKaiButton — the persistent Kai entry point (Cheat Code Club redesign,
 * R2). Kai left the primary nav when the five-item scheme landed; this Kai-blue
 * FAB is its always-reachable replacement.
 *
 * The FAB OPENS THE CONTEXTUAL KAI SHEET (owned by <KaiSheetProvider>) inline
 * instead of navigating to /kai, so members talk to Kai without leaving the page
 * they're on. The conversation lives in the same thread/usage/streaming APIs as
 * the full page (the sheet and /kai both render <KaiChatShared>), so nothing is a
 * throwaway. The FAB is the no-context entry point; contextual "Ask Kai" actions
 * and search rows call useKaiSheet().openKai({ chip, query }) directly.
 *
 * It is also COLLAPSIBLE: a small tuck control on the FAB's edge slides it away
 * to a slim edge sliver (still discoverable, tap to restore). The preference
 * persists per member (localStorage) across sessions and routes.
 *
 * Visibility is NOT decided here — it is decided by `showsKaiFab()` in
 * src/lib/kai-fab.ts (the single-FAB rule), because DashboardShell has to reach
 * the same answer to know how much bottom room the page must reserve. Read that
 * file for the three reasons the FAB stands down. Kids and teens see it: the
 * panel Kai is the same age-scoped, kid-strict-server-side experience they
 * already reach from their nav, just one tap closer — not an unscoped AI.
 *
 * LAYOUT. Bottom-right, clearing the mobile tab bar (4rem) plus the iOS safe
 * area plus a real gap, and the shell pads `<main>` by the FAB's whole footprint
 * so the last row of a list is never parked underneath it. Stacking is explicit:
 * the FAB is z-40/z-0 within its own group and the tuck control is z-10 above
 * it — the chevron used to be drawn under the button's 4px paper ring, which is
 * why "Tuck Kai away" looked broken.
 *
 * Kai-blue (#2563FF, the AI surface colour) in every mode so it never competes
 * with the volt-orange brand actions; the panel itself follows the mode/register
 * skin (club volt · family gold · kid).
 */

interface FloatingKaiButtonProps {
  role?: string;
  ageGroup?: string;
  tier?: FamilyTier;
  isSolo?: boolean;
  /** Open the contextual Kai sheet (owned by KaiSheetProvider). */
  onOpen: () => void;
}

const GENERIC_KEY = "cc:kai-fab-collapsed";

export default function FloatingKaiButton({
  tier,
  onOpen,
}: FloatingKaiButtonProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion() ?? false;

  const [collapsed, setCollapsed] = useState(false);
  const uidRef = useRef<string>("");

  /* THE FAB YIELDS WHILE YOU READ.
     A bottom reserve can only protect the END of a document. Home, Discover and
     Family are narrow centred columns whose rows set their values flush right,
     so the disc sits over a number at every scroll position in between — and no
     amount of padding fixes that, because the button is fixed to the viewport
     and the content is not. So it gets out of the way: while the page is
     actually moving the FAB steps down to a quiet, smaller mark, and it comes
     back the moment you stop. It is never hidden (a control you cannot find is
     worse than one you can see through) and it is never inert — it stays
     clickable in the yielded state. */
  const [yielding, setYielding] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setYielding(true);
      if (t) clearTimeout(t);
      t = setTimeout(() => setYielding(false), 550);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, []);

  /* ACTIVE / THINKING. The sheet is owned by KaiSheetProvider and this button is
     not told when it opens, so the honest signal it DOES own is its own launch:
     from the tap until the sheet has had time to mount, the mark shows the
     three-dot thought instead of its eyes. That is a real state (something is
     happening because you pressed it), not a decorative loop. */
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    if (!launching) return;
    const t = setTimeout(() => setLaunching(false), 900);
    return () => clearTimeout(t);
  }, [launching]);

  // Resolve the persisted collapse preference on the client (per user id, with a
  // device-wide fallback for the first paint). Kept out of the render initializer
  // to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const generic = localStorage.getItem(GENERIC_KEY);
      if (generic != null) setCollapsed(generic === "1");
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        uidRef.current = user.id;
        const perUser = localStorage.getItem(`${GENERIC_KEY}:${user.id}`);
        if (perUser != null) setCollapsed(perUser === "1");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    try {
      const v = next ? "1" : "0";
      localStorage.setItem(GENERIC_KEY, v);
      if (uidRef.current) localStorage.setItem(`${GENERIC_KEY}:${uidRef.current}`, v);
    } catch {
      /* ignore */
    }
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
    persistCollapsed(true);
  }, [persistCollapsed]);
  const restore = useCallback(() => {
    setCollapsed(false);
    persistCollapsed(false);
  }, [persistCollapsed]);

  if (!showsKaiFab(pathname, tier)) return null;

  // Reduced motion collapses every transition on this button to a 120ms fade.
  const dur = reduced ? "120ms" : "220ms";

  // Bottom offset — MUST stay in step with MAIN_PADDING_WITH_FAB in
  // src/lib/kai-fab.ts: the tab bar is 4rem tall plus the safe area, and the FAB
  // sits a 0.75rem gap above it. There is no longer a raised variant, because
  // there is no longer a screen where a second floating button shares this
  // corner (see the single-FAB rule).
  const bottomClass =
    "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6";

  return (
    <>
      {collapsed ? (
        // Slim edge sliver — pinned to the right edge, still discoverable.
        <button
          type="button"
          data-tour="kai-float"
          onClick={restore}
          aria-label="Show Kai"
          title="Show Kai"
          className={`group fixed right-0 z-40 flex h-14 w-[22px] flex-col items-center justify-center gap-1 rounded-l-xl bg-kai-500 text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--kai-blue,#2563FF)_40%,transparent)] ring-1 ring-white/10 transition-[width,transform] duration-200 hover:w-6 active:scale-95 ${bottomClass}`}
          style={{ marginBottom: "0" }}
        >
          <ChevronLeft className="h-3 w-3 opacity-80" strokeWidth={2.4} />
          <KaiMark tone="solid" size={14} reduced={reduced} />
        </button>
      ) : (
        <div className={`fixed right-4 z-40 ${bottomClass}`}>
          <div className="group relative">
            {/* THE STATES, and what each one is for.
                  resting  — warm card stock, a Kai-blue hairline and the drawn
                             mark. It sits ON the canvas instead of punching a
                             cobalt hole in it.
                  hover    — the ground fills with Kai-blue and the mark inverts
                             to paper: the colour arrives on intent, which is the
                             only moment it earns the whole corner.
                  pressed  — 0.94, the same press the f0 primitives use.
                  thinking — the mark's eyes become a three-dot thought while the
                             sheet mounts (see `launching`).
                  yielding — quiet and small while the page is scrolling, so a
                             row's right-hand value is never read through it.
                Reduced motion collapses all of it to a 120ms opacity fade: no
                scale, no pulse, the state still legible by tint alone. */}
            <button
              type="button"
              data-tour="kai-float"
              onClick={() => {
                setLaunching(true);
                onOpen();
              }}
              aria-label="Ask Kai"
              aria-busy={launching || undefined}
              title="Ask Kai — your AI research co-pilot"
              style={{
                transitionDuration: dur,
                opacity: yielding ? 0.5 : 1,
                transform: reduced || !yielding ? undefined : "scale(0.86)",
              }}
              className={`group/fab f0-focus relative z-0 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-[0_6px_20px_-8px_color-mix(in_srgb,var(--kai-blue,#2563FF)_60%,transparent)] ring-4 ring-[var(--paper)] transition-[opacity,transform,background-color] ease-out ${
                reduced ? "" : "hover:scale-105 active:scale-[0.94]"
              } hover:bg-kai-500`}
            >
              {/* The Kai-blue hairline that makes the warm disc read as Kai's
                  and not as one more card. Drawn as a ring INSIDE the paper
                  ring, so the two never touch. */}
              <span
                aria-hidden
                style={{ transitionDuration: dur }}
                className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-kai-500/45 transition-opacity group-hover/fab:opacity-0"
              />
              <span style={{ transitionDuration: dur }} className="transition-opacity group-hover/fab:opacity-0">
                <KaiMark tone="line" thinking={launching} reduced={reduced} />
              </span>
              {/* The inverted mark, revealed as the ground fills. Two marks
                  cross-fading is what keeps the line weight honest — tinting one
                  drawing mid-transition would have made the stroke crawl. */}
              <span style={{ transitionDuration: dur }} className="absolute opacity-0 transition-opacity group-hover/fab:opacity-100">
                <KaiMark tone="solid" thinking={launching} reduced={reduced} />
              </span>
              {/* "Kai is on" — the teal AI accent, kept as a dot rather than a
                  glow so it survives both themes at 10px. */}
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-[var(--card)] transition-colors group-hover/fab:ring-kai-500" />
            </button>
            {/* Tuck-away control — collapses the FAB to the edge sliver.
                STACKING: the FAB carries a 4px paper ring, and the chevron sat
                inside that ring's radius with no z-index of its own, so it read
                as being drawn UNDER the button. It now sits clear of the circle
                and explicitly above it (z-10 over the button's z-0), on the
                card ground with a page-coloured ring so it reads as a separate
                control rather than a smudge on the FAB. */}
            <button
              type="button"
              onClick={collapse}
              aria-label="Tuck Kai away"
              title="Tuck away"
              /* TOUCH HAS NO HOVER. The reveal-on-hover treatment left phones
                 with a permanent 90%-opacity "›" floating off the FAB's corner
                 on a card-coloured disc — against warm paper that reads as a
                 loose glyph rather than a control, and there is no pointer to
                 explain it. On a touch layout it now sits tucked against the
                 FAB as a filled ink chip: unmistakably a button, and clearly
                 attached to the thing it acts on. From `md` up the original
                 quiet reveal is exactly as it was. */
              className="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper shadow-soft ring-2 ring-[var(--paper)] transition-all active:scale-95 md:-left-2 md:-top-2 md:bg-card md:text-soft md:opacity-0 md:hover:bg-sand md:hover:text-ink md:group-hover:opacity-100"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
