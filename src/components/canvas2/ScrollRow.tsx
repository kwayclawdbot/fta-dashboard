"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/* ══════════════════════════════════════════════════════════════════════════
   SCROLL ROW — the one horizontal track in the app.

   Eight surfaces (community, changed-my-mind, compose, alerts, live classes,
   the FTA hub, the club watchlist and the screener) each ran a row of pills or
   tabs off the right edge of the phone with NO affordance: the last option was
   sheared mid-word and nothing said the row moved. Two of them were worse than
   that — PostTypeControl and the FTA hub header used `overflow-hidden`, so the
   clipped options could not be reached at all.

   The system already had the answer (`.f0-strip-fade`) and one hand-rolled
   user of it. This is that pattern as an object, so the ninth track does not
   get re-decided:

     • the track scrolls (never hides) and keeps club2-track's scrollbar
       suppression + overscroll containment
     • a fade marks the live edge, and CLEARS when the track is scrolled to the
       end — a fade that never clears promises a scroll that cannot happen
     • the fade knows what it sits on (`tone`), because a page-coloured fade on
       a card reads as a pale block rather than as depth
     • the whole thing is invisible when the row fits, which is most desktops

   The ref forwards to the TRACK, not the wrapper, so a caller that queries its
   own cells (SegmentedRail's roving tab stop) is unaffected. Every other prop
   spreads onto the track too, so `role` / `aria-label` land where the a11y tree
   needs them and this can replace a bare <div> in place.
   ══════════════════════════════════════════════════════════════════════════ */

export interface ScrollRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The surface under the track — what the fade fades TO. */
  tone?: "paper" | "card";
  /** Classes for the outer positioning wrapper (rarely needed). */
  wrapperClassName?: string;
}

const ScrollRow = forwardRef<HTMLDivElement, ScrollRowProps>(function ScrollRow(
  { tone = "paper", className = "", wrapperClassName = "", children, ...rest },
  ref
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => trackRef.current as HTMLDivElement, []);

  // Starts hidden: a row that fits must never show a fade, and the first
  // measurement lands in the same paint as mount.
  const [showFade, setShowFade] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 1px of slack — sub-pixel layout leaves a permanent 0.5px remainder on
    // some zoom levels, which would pin the fade on for a row that is fully
    // scrolled.
    setShowFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The track's own box AND its contents: a row whose pills arrive with data
    // (ticker chips, filter counts) changes width without the track resizing.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure, children]);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <div
        {...rest}
        ref={trackRef}
        onScroll={measure}
        className={`club2-track overflow-x-auto ${className}`}
      >
        {children}
      </div>
      <span
        aria-hidden
        className={`f0-strip-fade ${showFade ? "" : "opacity-0"}`}
        style={
          tone === "card"
            ? ({ "--strip-fade-to": "var(--card)" } as React.CSSProperties)
            : undefined
        }
      />
    </div>
  );
});

export default ScrollRow;
