"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "@/lib/motion";
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
  const supabaseRef = useRef(createClient());

  const register = profile ? deriveRegister(profile) : "adult";
  const isKid = register === "kid";
  const isFree = isFreeTier(tier);
  const canUse = !viewerLoading && !!me && !isFree;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameState, setFrameState] = useState<"loading" | "ok" | "error">("loading");
  const [frameNonce, setFrameNonce] = useState(0);
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
    supabase: supabaseRef.current,
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

  // Re-arm the loading overlay whenever we reload the frame.
  useEffect(() => {
    setFrameState("loading");
  }, [frameNonce]);

  if (viewerLoading) {
    return (
      <div className="space-y-4">
        <SimulatorTabs />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-gold-400/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-400 animate-spin" />
            <Bot className="absolute inset-0 m-auto h-5 w-5 text-gold-500" />
          </div>
          <p className="font-display text-sm font-semibold text-midnight-200">Loading Simbot…</p>
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
              ? "Simbot is a hands-on trading practice room. Ask a grown-up to open your Family Investing Club to jump in."
              : "Simbot is a full price-action practice terminal — learn to read charts and place practice trades with zero real risk. It opens up when you join the Family Investing Club."
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
    <div className="space-y-4">
      <Celebrate
        opts={celebrateQueue[0] ?? null}
        onDone={() => setCelebrateQueue((q) => q.slice(1))}
      />
      <SimulatorTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-midnight-100">
            <Bot className="h-5 w-5 text-gold-500" />
            Simbot
          </h1>
          <p className="text-xs text-midnight-400">
            A hands-on price-action simulator — lessons, practice trades, and a
            Live Market mode. Every price is practice; no real money.
          </p>
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-lg border border-sand"
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
            setFrameState("ok");
            // Push theme once the frame is up (belt-and-suspenders with ?theme=).
            pushTheme();
          }}
          onError={() => setFrameState("error")}
        />

        {frameState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper text-center">
            <div className="relative h-11 w-11">
              <div className="absolute inset-0 rounded-full border-2 border-gold-400/25" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
              <Bot className="absolute inset-0 m-auto h-4 w-4 text-gold-600" />
            </div>
            <p className="font-display text-sm font-semibold text-ink">Warming up Simbot…</p>
          </div>
        )}

        {frameState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
            <Bot className="h-8 w-8 text-gold-600" />
            <p className="max-w-sm text-sm text-ink">
              Simbot didn&apos;t load. Try again, or open it in a new tab.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFrameNonce((n) => n + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-display font-semibold text-white transition-colors hover:bg-gold-600"
              >
                <RotateCw className="h-4 w-4" />
                Try again
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/60"
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
