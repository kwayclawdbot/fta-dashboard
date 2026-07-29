import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ArrowLeft, Fingerprint, Layers, Gift } from "lucide-react";

export const metadata: Metadata = {
  title: "What is a Cheat Code Ownership Card?",
  description:
    "A living collectible for something you actually own — the app is the registry, the card is the artifact, and the tap is the proof.",
};

const BG = "#060708";
const INK = "#F4F1EA";
const SUB = "rgba(244,241,234,0.66)";
const FAINT = "rgba(244,241,234,0.42)";
const HAIRLINE = "rgba(244,241,234,0.12)";

const BEATS = [
  {
    icon: Fingerprint,
    title: "It's a title, not a trinket",
    body: "Every card stands for something real you own, recorded in a registry you control. The card never holds the asset itself — it points to it, and proves it. Tap the artifact and the truth verifies on the spot.",
  },
  {
    icon: Layers,
    title: "It's alive",
    body: "The face shows what it's worth now and how far it's come since you got it. The frame gets richer the longer you hold — 100 days, a year, a thousand days — so the object quietly becomes a record of your patience.",
  },
  {
    icon: Gift,
    title: "It's meant to be kept — and given",
    body: "Hold it for decades. Pass it down. When a card changes hands, its story travels with it: who gave it, when, and what it was worth that day. That provenance is permanent.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden" style={{ background: BG, color: INK }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{ background: "#E6B84D", opacity: 0.1, filter: "blur(90px)" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-12 pt-6">
        <Link
          href="/collection"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: SUB }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-[5px]"
              style={{ background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#9c7a2a)" }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.32em]" style={{ color: SUB }}>
              Cheat Code
            </span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight" style={{ color: INK }}>
            A collectible for what you actually own.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: SUB }}>
            You just tapped a Cheat Code Ownership Card. Here&apos;s what it is,
            in three beats.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {BEATS.map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="rounded-2xl px-5 py-5"
                style={{ background: "rgba(244,241,234,0.035)", border: `1px solid ${HAIRLINE}` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: "rgba(230,184,77,0.12)", border: "1px solid rgba(230,184,77,0.35)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "#E6B84D" }} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: FAINT }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h2 className="mt-3.5 font-display text-lg font-extrabold" style={{ color: INK }}>
                  {b.title}
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: SUB }}>
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>

        <div
          className="mt-8 rounded-2xl px-5 py-4"
          style={{ background: "rgba(230,184,77,0.06)", border: "1px solid rgba(230,184,77,0.22)" }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: SUB }}>
            One house rule sits under all of it:{" "}
            <span style={{ color: INK }}>own things worth keeping, and keep them.</span>{" "}
            A card celebrates holding — never trading, never a promise about where
            a price is headed.
          </p>
        </div>

        <Link
          href="/collection"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold"
          style={{
            background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#c8991f)",
            color: "#231a08",
            boxShadow: "0 10px 34px -12px rgba(230,184,77,0.55)",
          }}
        >
          Start your own collection
          <ArrowUpRight className="h-4 w-4" />
        </Link>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
          Cheat Code Ownership Cards
        </p>
      </div>
    </main>
  );
}
