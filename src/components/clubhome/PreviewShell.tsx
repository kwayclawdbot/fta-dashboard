"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import ModeManager from "@/components/ModeManager";
import { Toaster } from "@/components/ui/Toast";
import ClubHomeV2 from "./ClubHomeV2";
import type { ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

/**
 * PreviewShell — a design-review harness for ClubHome v2. Reachable ONLY in
 * dev / vercel preview (the /club/preview server page 404s in production), it
 * mimics the club-mode app chrome (data-mode="club") without the auth gate so
 * the page can be Playwright-reviewed in every scale state × register without a
 * session. Not a production surface.
 */

const SCALES: ClubScale[] = ["scale", "founding"];

const SUBSCRIBE = () => () => {};
const CLIENT_HOUR = () => Math.floor(Date.now() / 3_600_000);
const SERVER_HOUR = () => null;
const REGISTERS: Register[] = ["adult", "teen", "kid"];

export default function PreviewShell({
  scale,
  register,
  challenge,
  live = false,
}: {
  scale: ClubScale;
  register: Register;
  challenge: boolean;
  /** live=true → fixtures OFF: fetch the real /api/club/* and show graceful fallback */
  live?: boolean;
}) {
  // Preview-only stand-in for an active pass. Read through the same hour-bucket
  // external store ChallengeSlot uses, so this harness does not call an impure
  // function during render either (and the fake expiry is stable per hour rather
  // than moving on every re-render).
  const hour = useSyncExternalStore(SUBSCRIBE, CLIENT_HOUR, SERVER_HOUR);
  const challengeExpiresAt =
    challenge && hour != null
      ? new Date(hour * 3_600_000 + 3 * 86_400_000).toISOString()
      : null;
  const qs = (over: {
    scale?: ClubScale;
    register?: Register;
    challenge?: boolean;
    data?: string;
  } = {}) => {
    const s = over.scale ?? scale;
    const r = over.register ?? register;
    const ch = over.challenge ?? challenge;
    const dv = over.data !== undefined ? over.data : live ? "live" : "";
    const parts = [`scale=${s}`, `register=${r}`];
    if (ch) parts.push("challenge=1");
    if (dv) parts.push(`data=${dv}`);
    return "?" + parts.join("&");
  };

  return (
    <div data-mode="club" className="min-h-screen bg-paper">
      <ModeManager mode="club" />

      {/* review controls (harness chrome, not part of the design) */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sand bg-card/95 px-4 py-2 backdrop-blur">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-volt-700">
          ClubHome v2 · preview
        </span>
        <Group label="scale" current={scale}>
          {SCALES.map((s) => (
            <Pill key={s} active={s === scale} href={qs({ scale: s })}>
              {s}
            </Pill>
          ))}
        </Group>
        <Group label="register" current={register}>
          {REGISTERS.map((r) => (
            <Pill key={r} active={r === register} href={qs({ register: r })}>
              {r}
            </Pill>
          ))}
        </Group>
        <Pill active={challenge} href={qs({ challenge: !challenge })}>
          challenge {challenge ? "on" : "off"}
        </Pill>
        <Pill active={live} href={qs({ data: live ? "" : "live" })}>
          data {live ? "live" : "fixtures"}
        </Pill>
      </div>

      <main className="px-4 pt-6 lg:px-8">
        <ClubHomeV2
          firstName="Alex"
          register={register}
          learning={{
            title: "Reading a company's real story in its numbers",
            href: "/courses",
            context: "Foundations · Module 3",
          }}
          challengeExpiresAt={challengeExpiresAt}
          preview={{ fixtures: !live, scale }}
        />
      </main>

      <Toaster />
    </div>
  );
}

function Group({ label, children }: { label: string; current: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-soft">{label}</span>
      {children}
    </span>
  );
}

function Pill({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        active ? "bg-volt-500 text-white" : "border border-sand bg-paper text-soft hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
