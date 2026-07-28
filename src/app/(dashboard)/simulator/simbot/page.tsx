"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, RotateCw, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import { deriveRegister, celebrateRegister } from "@/lib/register";
import { isFreeTier } from "@/lib/tier";
import { getResolvedTheme, THEME_EVENT, type ResolvedTheme } from "@/lib/theme";
import { useSimbotBridge, type SimbotAward } from "@/lib/simbot-bridge";
import SimulatorTabs from "@/components/simulator/SimulatorTabs";
import LockedState from "@/components/dashboard/LockedState";
import Celebrate, { type CelebrateOptions } from "@/components/fic/Celebrate";
import {
  useNewMemberHints,
  HintReopen,
} from "@/components/hints/useNewMemberHints";

/**
 * /simulator/simbot — the embedded Simbot price-action simulator.
 *
 * Same-origin iframe (public/sim/index.html) so localStorage is per platform
 * user (?uid) and the milestone bridge is trusted. The frame opens in Live
 * Market mode by default (real delayed data via the same-origin /api/market
 * proxy); the Practice Engine (simulated) is opt-in and each user's last
 * mode + ticker persist per-user inside the frame. Platform XP is awarded only
 * on the defined milestones (see useSimbotBridge). Free tier is locked; kids
 * see no upsell.
 */

export default function SimbotPage() {
  const { loading: viewerLoading, me, tier, profile } = useFtaViewer();
  // A lazily-initialised STATE value, not a ref: the bridge consumes it during
  // render, and a ref read at render time is a correctness hazard (it is not
  // part of the render output contract). The initialiser runs exactly once, so
  // the client is still a singleton for this page.
  const [supabaseClient] = useState(() => createClient());

  const register = profile ? deriveRegister(profile) : "adult";
  const isKid = register === "kid";
  const isFree = isFreeTier(tier);
  const canUse = !viewerLoading && !!me && !isFree;

  // The descriptive "what Simbot is" blurb expires for seasoned members; the
  // "every price is practice" safety line stays permanent (Lane 7A).
  const simbotHint = useNewMemberHints("simbot-intro");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameNonce, setFrameNonce] = useState(0);
  // The settled outcome is stamped with the nonce it belongs to, so reloading
  // the frame re-arms the loading overlay by DERIVATION rather than by writing
  // state from an effect (which cascades a second render before the reload).
  const [settled, setSettled] = useState<{ nonce: number; state: "ok" | "error" } | null>(
    null
  );
  const frameState: "loading" | "ok" | "error" =
    settled && settled.nonce === frameNonce ? settled.state : "loading";
  const [celebrateQueue, setCelebrateQueue] = useState<CelebrateOptions[]>([]);

  // Push the current resolved theme into the sim iframe.
  const pushTheme = useCallback((theme?: ResolvedTheme) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "fta-theme", theme: theme ?? getResolvedTheme() }, "*");
  }, []);

  // Award celebration -> queue a register-correct moment (XP pop + belt ceremony).
  const onAward = useCallback(
    (award: SimbotAward) => {
      setCelebrateQueue((q) => [
        ...q,
        award.belt
          ? {
              variant: "levelup",
              register: celebrateRegister(register),
              title: award.belt.title,
              subtitle: award.belt.subtitle,
              beltHex: award.belt.beltHex,
              beltBorderHex: award.belt.beltBorderHex,
              beltInitial: award.belt.beltInitial,
              xp: award.xp,
            }
          : {
              variant: "mission",
              register: celebrateRegister(register),
              title: isKid ? "Nice work!" : award.label,
              subtitle: isKid ? award.label : undefined,
              xp: award.xp,
            },
      ]);
    },
    [register, isKid]
  );

  useSimbotBridge({
    supabase: supabaseClient,
    enabled: canUse && frameState !== "error",
    isKid,
    onReady: () => pushTheme(),
    onAward,
  });

  // Keep the frame theme in sync with the app theme toggle.
  useEffect(() => {
    if (!canUse) return;
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<ResolvedTheme>).detail;
      pushTheme(detail);
    };
    window.addEventListener(THEME_EVENT, onThemeChange as EventListener);
    return () => window.removeEventListener(THEME_EVENT, onThemeChange as EventListener);
  }, [canUse, pushTheme]);

  if (viewerLoading) {
    return (
      <div className="space-y-4">
        <SimulatorTabs />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-sand" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-500" />
            <Bot className="absolute inset-0 m-auto h-5 w-5 text-gold-600" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
            Loading Simbot…
          </p>
        </div>
      </div>
    );
  }

  if (isFree) {
    // Kids never see an upsell (standing rule). Adults on free tier get the
    // normal locked door with an upgrade CTA.
    return (
      <div className="space-y-4">
        <SimulatorTabs />
        <LockedState
          icon={Bot}
          title={isKid ? "Simbot unlocks with your club" : "Practice with Simbot"}
          body={
            isKid
              ? "Simbot is a hands-on trading practice room. Ask a grown-up to open your Club to jump in."
              : "Simbot is a full price-action practice terminal — learn to read charts and place practice trades with zero real risk. It opens up when you join the Club."
          }
          {...(isKid
            ? { lockBadge: false as const, tone: "amber" as const }
            : { cta: { label: "See membership", href: "/upgrade" } })}
        />
      </div>
    );
  }

  const src = `/sim/index.html?embed=1&uid=${encodeURIComponent(
    me!.id
  )}&theme=${getResolvedTheme()}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <Celebrate
        opts={celebrateQueue[0] ?? null}
        onDone={() => setCelebrateQueue((q) => q.slice(1))}
      />
      <SimulatorTabs />
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            Practice
          </p>
          <h1 className="mt-2 flex items-center gap-2.5 font-display text-display-1 font-extrabold text-ink">
            Simbot
            {simbotHint.showReopen && (
              <HintReopen onClick={simbotHint.reopen} label="How Simbot works" />
            )}
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-soft">
            {simbotHint.show &&
              "A hands-on price-action simulator — lessons, practice trades, and a Live Market mode. "}
            Every price is practice; no real money.
          </p>
        </div>

        {/* The canvas sets a permanent PAPER MONEY mark against a practice
            account (New Screens "1a Portfolio" L215-218). Simbot is the same
            kind of account, so it carries the same mark — this surface must
            never be mistakable for a real one. */}
        <span className="f0-chip shrink-0 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-soft">
          Paper money
        </span>
      </header>

      <div
        className="f0-frame relative w-full overflow-hidden rounded-xl"
        style={{ height: "calc(100vh - 190px)", minHeight: 520 }}
      >
        <iframe
          key={frameNonce}
          ref={iframeRef}
          className="absolute inset-0 h-full w-full border-0"
          src={src}
          title="Simbot trading simulator"
          allow="autoplay"
          onLoad={() => {
            setSettled({ nonce: frameNonce, state: "ok" });
            // Push theme once the frame is up (belt-and-suspenders with ?theme=).
            pushTheme();
          }}
          onError={() => setSettled({ nonce: frameNonce, state: "error" })}
        />

        {frameState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper text-center">
            <div className="relative h-11 w-11">
              <div className="absolute inset-0 rounded-full border-2 border-gold-400/25" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
              <Bot className="absolute inset-0 m-auto h-4 w-4 text-gold-600" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
              Warming up Simbot…
            </p>
          </div>
        )}

        {frameState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
            <Bot className="h-8 w-8 text-gold-600" />
            <p className="max-w-sm text-[13.5px] leading-relaxed text-ink">
              Simbot didn&apos;t load. Try again, or open it in a new tab.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFrameNonce((n) => n + 1)}
                className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-4 py-2 text-[13px]"
              >
                <RotateCw className="h-4 w-4" />
                Try again
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-xl border border-sand px-4 py-2 font-display text-[13px] font-bold text-ink transition-colors hover:border-gold-400 hover:text-gold-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
