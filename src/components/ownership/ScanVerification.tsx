"use client";

/**
 * ScanVerification — the anti-counterfeit theatre for the public scan page.
 *
 * Two registers, both dark-premium and legible without JS:
 *   • tap-verified → a confident gold "TAP VERIFIED · GENUINE" seal that stamps
 *     in once on load (passport-stamp energy), respecting reduced-motion.
 *   • link view    → a quiet, neutral "LINK VIEW · not tap-verified" chip. Never
 *     alarming, never explaining crypto internals — a stranger reading a shared
 *     link should feel informed, not warned.
 *
 * Motion is pure CSS (no framer on the public page). The keyframes live behind
 * `prefers-reduced-motion: no-preference`, so reduced-motion users get the final
 * stamped state with no movement.
 */

import { ShieldCheck, Link2 } from "lucide-react";

const SEAL_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .cc-seal-stamp { animation: cc-stamp 620ms cubic-bezier(0.2, 1.3, 0.35, 1) both; }
  .cc-seal-ring  { animation: cc-ring 900ms ease-out both; }
}
@keyframes cc-stamp {
  0%   { opacity: 0; transform: scale(1.7) rotate(-9deg); filter: blur(2px); }
  55%  { opacity: 1; transform: scale(0.94) rotate(1.5deg); filter: blur(0); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@keyframes cc-ring {
  0%   { opacity: 0.9; transform: scale(0.6); }
  100% { opacity: 0;   transform: scale(1.9); }
}
`;

export function TapVerifiedSeal() {
  return (
    <div className="relative flex items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: SEAL_CSS }} />
      {/* expanding stamp ring */}
      <span
        aria-hidden
        className="cc-seal-ring pointer-events-none absolute inset-0 rounded-full"
        style={{ border: "1.5px solid rgba(230,184,77,0.6)" }}
      />
      <div
        className="cc-seal-stamp flex items-center gap-2.5 rounded-full px-4 py-2"
        style={{
          background:
            "linear-gradient(135deg, rgba(230,184,77,0.18), rgba(230,184,77,0.06))",
          border: "1px solid rgba(230,184,77,0.55)",
          boxShadow:
            "0 0 0 0.5px rgba(230,184,77,0.35), 0 8px 30px -12px rgba(230,184,77,0.5), inset 0 1px 0 rgba(255,243,196,0.25)",
        }}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#9c7a2a)",
            color: "#231a08",
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <span className="flex flex-col leading-none">
          <span
            className="font-display text-[13px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "#FBE9B6" }}
          >
            Tap Verified
          </span>
          <span
            className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.28em]"
            style={{ color: "rgba(230,184,77,0.75)" }}
          >
            Genuine artifact
          </span>
        </span>
      </div>
    </div>
  );
}

export function LinkViewChip() {
  return (
    <div className="flex items-center justify-center">
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-1.5"
        style={{
          background: "rgba(244,241,234,0.05)",
          border: "1px solid rgba(244,241,234,0.14)",
        }}
      >
        <Link2 className="h-3.5 w-3.5" style={{ color: "rgba(244,241,234,0.55)" }} />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(244,241,234,0.62)" }}
        >
          Link view · not tap-verified
        </span>
      </div>
    </div>
  );
}

export default function ScanVerification({ tapVerified }: { tapVerified: boolean }) {
  return tapVerified ? <TapVerifiedSeal /> : <LinkViewChip />;
}
