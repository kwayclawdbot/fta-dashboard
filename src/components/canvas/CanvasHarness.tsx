"use client";

import { useEffect, useState } from "react";
import ModeManager from "@/components/ModeManager";
import {
  MySignals, KaiWatch, Screener, Missions, Leaderboard, PracticePortfolio, Alerts,
} from "./screens";
import { V, sora, inter } from "./kit";

/**
 * CanvasHarness — a prod-guarded, walk-in review harness (no auth) that renders
 * the seven pixel-faithful club-mode screen rebuilds in 390×844 phone frames,
 * exactly as the owner's App-UI artboard board presents them, with the same
 * Light/Dark toggle. This is the side-by-side surface the owner reviews against
 * .planning/design-project. Each screen ALSO ships in-app at its real route.
 */

const FRAMES: { id: string; num: string; label: string; el: React.ReactNode }[] = [
  { id: "03-my-signals", num: "03", label: "My Signals", el: <MySignals /> },
  { id: "05-kai-watch", num: "05", label: "Kai Watch", el: <KaiWatch /> },
  { id: "09-screener", num: "09", label: "Screener", el: <Screener /> },
  { id: "10-missions", num: "10", label: "Missions", el: <Missions /> },
  { id: "11-leaderboard", num: "11", label: "Leaderboard", el: <Leaderboard /> },
  { id: "12-practice-portfolio", num: "12", label: "Practice Portfolio", el: <PracticePortfolio /> },
  { id: "14-alerts", num: "14", label: "Alerts", el: <Alerts /> },
];

export default function CanvasHarness() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
    };
  }, [theme]);

  const stage = theme === "light" ? "#EFE2C9" : "#0A0A0B";

  return (
    <div style={{ minHeight: "100vh", background: stage, padding: "40px 32px 80px", fontFamily: inter }}>
      <ModeManager mode="club" />
      <div style={{ maxWidth: 1720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
          <div>
            <div style={{ font: `700 12px/1 ${inter}`, letterSpacing: ".18em", textTransform: "uppercase", color: V.volt, marginBottom: 10 }}>Cheat Code Club · Mobile</div>
            <div style={{ font: `800 40px/1.05 ${sora}`, letterSpacing: "-.02em", color: V.ink }}>App UI — canvas rebuild</div>
            <div style={{ font: `400 15px/1.5 ${inter}`, color: V.soft, marginTop: 8, maxWidth: "56ch" }}>Pixel-faithful club-mode rebuilds of the owner artboards, on the live app tokens.</div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: 6, borderRadius: 14, background: V.card, border: `1px solid ${V.sand}` }}>
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  padding: "9px 20px", borderRadius: 10, cursor: "pointer", border: "none",
                  font: `700 13px/1 ${inter}`,
                  background: theme === t ? V.volt : "transparent",
                  color: theme === t ? "#fff" : V.soft,
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 32px" }}>
          {FRAMES.map((f) => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ font: `700 12px/1 ${inter}`, letterSpacing: ".14em", textTransform: "uppercase", color: V.faint }}>
                {f.num} · {f.label}
              </div>
              <div
                data-canvas-frame={f.id}
                style={{
                  width: 390, height: 844, borderRadius: 42, overflow: "hidden auto",
                  background: V.paper, border: `1px solid ${V.sand}`,
                  boxShadow: "0 24px 60px rgba(0,0,0,.35)",
                }}
              >
                {/* status + logo header — shell chrome, reproduced here so the frame
                    reads as a complete phone the way the artboard does */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px 4px", font: `600 14px/1 ${inter}`, color: V.ink }}>
                  <span>9:41</span>
                  <span style={{ font: `600 11px/1 'IBM Plex Mono',monospace`, letterSpacing: ".1em", color: V.soft }}>LTE ▮▮▮ 100%</span>
                </div>
                <div style={{ paddingTop: 8 }}>{f.el}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
