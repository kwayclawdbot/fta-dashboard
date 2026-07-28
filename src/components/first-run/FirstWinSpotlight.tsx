"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * THE LANDING HALF OF THE FIRST WIN.
 *
 * FirstWin sends a brand-new member to `/research/<TICKER>?firstwin=1` — the
 * company they just named. This is what greets them there: the stance control
 * is scrolled to, ringed, and captioned with the one instruction that matters.
 *
 * WHY A RING AND NOT A TOUR STEP. The tour's spotlight dims the whole page and
 * takes over the pointer, which is what makes it feel like being driven. This
 * points at one control and leaves the member in charge of everything else —
 * they can read the Club's split above it first, which is the point.
 *
 * IT DISARMS ITSELF. The ring is removed the moment the member interacts with
 * anything inside it (the stance is taken, or they simply click), and it never
 * returns: the `firstwin` param is stripped from the URL on mount so a reload,
 * a share, or a back-navigation does not re-light it.
 *
 * NO CLOCK, NO NETWORK, NO WRITES. It is a wrapper.
 */
export default function FirstWinSpotlight({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const armedAtMount = params.get("firstwin") === "1";
  const [lit, setLit] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!armedAtMount) return;
    setLit(true);

    // Strip the flag so this is a one-time arrival, not a property of the URL.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("firstwin");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* non-fatal */
    }

    // Bring it into view on the frame after paint, respecting reduced motion.
    const raf = requestAnimationFrame(() => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      ref.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [armedAtMount]);

  if (!armedAtMount) return <>{children}</>;

  return (
    <div
      ref={ref}
      onPointerDownCapture={() => setLit(false)}
      className={
        lit
          ? "relative rounded-[14px] p-3 outline outline-2 outline-offset-2 outline-[color:var(--accent-solid)] transition"
          : "relative transition"
      }
      style={
        lit
          ? { background: "color-mix(in srgb, var(--accent-solid) 7%, transparent)" }
          : undefined
      }
    >
      {lit && (
        <p className="mb-2 text-[12px] font-semibold leading-snug text-accent">
          Here is where the Club stands. Take your own side — it counts toward
          your rank.
        </p>
      )}
      {children}
    </div>
  );
}
