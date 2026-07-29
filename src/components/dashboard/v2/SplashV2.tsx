"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DesignManager from "./DesignManager";

/**
 * SPLASH — v2, canvas board 09. The signed-out landing: the CcMark held in two
 * concentric halo rings (the outer one pings, the board's live figure), the
 * display wordmark, the mono "CLUB" line and the script "trade with your
 * people" tagline — full-bleed on the warm-black radial. The doors are the
 * existing sign-in / join CTAs (same destinations as v1).
 *
 * Deliberately NOT adopted from board 09: the "Reading the room…" progress bar
 * (a fake loader under an already-loaded page) and any member-count/claim line.
 */
export default function SplashV2() {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-16"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 20%, #221109 0%, var(--cc-bg, #141216) 55%)",
        color: "var(--cc-ink, #f4f0ec)",
      }}
    >
      <DesignManager />

      <main className="relative flex w-full max-w-sm flex-col items-center text-center">
        {/* CcMark in two concentric halo rings — the board's live figure. */}
        <div className="relative grid h-[120px] w-[120px] place-items-center">
          <span
            aria-hidden
            className="cc-ping absolute inset-0 rounded-full"
            style={{ border: "1.5px solid rgba(255,122,26,.35)" }}
          />
          <span
            aria-hidden
            className="absolute -inset-4 rounded-full"
            style={{ border: "1px solid rgba(255,122,26,.15)" }}
          />
          <div
            className="grid h-[92px] w-[92px] place-items-center rounded-full"
            style={{
              background: "var(--cc-orange, #ff7a1a)",
              boxShadow: "0 0 30px rgba(255,122,26,.3)",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                background: "var(--cc-orange-deep, #0d0b0e)",
                transform: "rotate(45deg)",
                borderRadius: 5,
              }}
            />
          </div>
        </div>

        <h1
          className="cc-display mt-9 text-[44px]"
          style={{ color: "var(--cc-ink, #f4f0ec)" }}
        >
          Cheat Code
        </h1>
        <p
          className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase"
          style={{ letterSpacing: "0.42em", paddingLeft: "0.42em", color: "var(--cc-orange-ink, #ff7a1a)" }}
        >
          Club
        </p>
        <p
          className="cc-script mt-5 text-[22px]"
          style={{ color: "var(--cc-soft, #8d8794)" }}
        >
          trade with your people
        </p>

        <div className="mt-11 flex w-full flex-col items-stretch gap-4">
          <Link
            href="/login"
            className="cc-halo inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold"
            style={{
              background: "var(--cc-orange, #ff7a1a)",
              color: "var(--cc-orange-deep, #0d0b0e)",
            }}
          >
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[13.5px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
            New here?{" "}
            <a
              href="https://familyinvestingclub.com"
              className="font-bold transition-colors"
              style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}
            >
              Join the club
            </a>
          </p>
        </div>
      </main>

      <p
        className="absolute inset-x-0 bottom-9 text-center text-[11px]"
        style={{ color: "var(--cc-dim, #5d5865)" }}
      >
        &copy; {new Date().getFullYear()} Cheat Code Club. All rights reserved.
      </p>
    </div>
  );
}
