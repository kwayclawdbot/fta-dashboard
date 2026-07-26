"use client";

import Avatar from "@/components/Avatar";
import { SectionLabel, CountUp } from "./parts";
import type { CollectiveResponse } from "@/lib/clubhome/contract";

/**
 * §3 The Collective — the network identity moment (teal = network/collective).
 *
 * AT SCALE: a live "actions added today" counter + an avatar constellation +
 * an activity breakdown rendered as one hairline mono ledger (not chips).
 *
 * FOUNDING (below floor): the section BECOMES the growth engine — founding-era
 * framing + the invite mechanics as the centerpiece (passed in via `invite`).
 * Cold start reads as momentum, never an empty/sad state.
 */

function Constellation({
  avatars,
  faces,
}: {
  avatars: CollectiveResponse["avatars"];
  faces: boolean;
}) {
  const real = avatars.slice(0, 12);
  // Decorative fallback: if no avatars are available yet (e.g. before the
  // collective endpoint is live, or a kid's faceless view), draw abstract teal
  // nodes so the network motif still reads — these carry no identity/count.
  const decorative = real.length === 0 || !faces;
  const nodes = real.length
    ? real
    : Array.from({ length: 8 }).map((_, i) => ({ id: `ph-${i}`, name: null as string | null, url: null }));
  const cx = 50;
  const cy = 50;
  // Two rings so a dense crowd reads as a network, not a ring.
  const positions = nodes.map((n, i) => {
    const ring = i % 2 === 0 ? 30 : 42;
    const count = nodes.length;
    const angle = (i / count) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.4);
    return {
      ...n,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring * 0.82,
    };
  });

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[360px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="club-core-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-teal-400)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-teal-600)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {positions.map((p, i) => (
          <line
            key={`l-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-teal-400)"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}
        {positions.map((p, i) => {
          const next = positions[(i + 2) % positions.length];
          return (
            <line
              key={`n-${i}`}
              x1={p.x}
              y1={p.y}
              x2={next.x}
              y2={next.y}
              stroke="var(--color-teal-500)"
              strokeWidth="0.35"
              opacity="0.28"
            />
          );
        })}
        {/* luminous drifting core */}
        <circle className="club-core-glow" cx={cx} cy={cy} r="16" fill="url(#club-core-grad)" style={{ transformBox: "fill-box" }} />
        <circle cx={cx} cy={cy} r="9" fill="var(--color-teal-400)" opacity="0.18" />
        <circle cx={cx} cy={cy} r="9" fill="none" stroke="var(--color-teal-500)" strokeWidth="1" />
      </svg>

      {/* center mark — the network core */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: "50%" }}
      >
        <span className="text-gradient-teal font-display text-xl font-black leading-none">∞</span>
      </div>

      {/* avatar nodes — subtle drift + twinkle for an electric, alive network */}
      {positions.map((p, i) => (
        <div
          key={p.id}
          className="club-node absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${(i % 6) * 0.5}s` }}
        >
          {!decorative && p.name ? (
            <Avatar name={p.name} size="sm" className="ring-2 ring-card shadow-soft" />
          ) : (
            <span
              className="club-node-dot block h-3.5 w-3.5 rounded-full bg-teal-400 ring-2 ring-card club-livedot-teal"
              style={{ opacity: 0.6 + (i % 3) * 0.13, animationDelay: `${(i % 5) * 0.4}s` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Breakdown({ b }: { b: CollectiveResponse["breakdown"] }) {
  const rows = [
    { label: "Watches", value: b.watches },
    { label: "Reactions", value: b.reactions },
    { label: "Comments", value: b.comments },
    { label: "Saves", value: b.saves },
    { label: "Kai questions", value: b.kaiQuestions },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-sand border-t border-sand sm:grid-cols-5 sm:divide-y-0">
      {rows.map((r) => (
        <div key={r.label} className="px-3 py-3 first:pl-0">
          <div className="font-mono text-xl font-extrabold tabular-nums text-ink">
            <CountUp value={r.value} duration={900} />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{r.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Collective({
  collective,
  isKid,
  invite,
}: {
  collective: CollectiveResponse | null;
  isKid: boolean;
  invite?: React.ReactNode;
}) {
  const floorMet = collective?.floorMet ?? false;
  const avatars = collective?.avatars ?? [];

  // ── FOUNDING — the growth engine ─────────────────────────────────────────
  if (!floorMet) {
    return (
      <section aria-label="The Collective — founding era" className="club-field-teal rounded-2xl p-5 sm:p-7">
        <SectionLabel tone="teal" live liveTone="teal">
          The Collective
        </SectionLabel>
        <div className="mt-4 grid items-center gap-6 lg:grid-cols-2">
          <div>
            <p className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-[26px]">
              This is the ground floor.
            </p>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-soft">
              The Club gets smarter with every mind in it. Right now it&apos;s a
              tight room of founding members{isKid ? "" : " — every person you bring makes the collective stronger"}.
            </p>
            {!isKid && invite && <div className="mt-5">{invite}</div>}
            {isKid && (
              <p className="mt-4 text-sm font-semibold text-teal-700">
                Keep learning — you&apos;re one of the first here.
              </p>
            )}
          </div>
          <Constellation avatars={avatars} faces={!isKid} />
        </div>
      </section>
    );
  }

  // ── AT SCALE — the live network ──────────────────────────────────────────
  return (
    <section aria-label="The Collective" className="club-field-teal rounded-2xl p-5 sm:p-7">
      <SectionLabel tone="teal" live liveTone="teal">
        The Collective
      </SectionLabel>
      <div className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="text-gradient-teal font-display text-6xl font-black leading-none tracking-tight sm:text-7xl">
            <CountUp value={collective!.actionsToday} />
          </div>
          <p className="mt-2 text-[15px] font-semibold text-ink">actions added today</p>
          <p className="mt-1 text-sm text-soft">
            {collective!.connectedMinds.toLocaleString()} minds, moving together in real time.
          </p>
        </div>
        <Constellation avatars={avatars} faces={!isKid} />
      </div>
      <Breakdown b={collective!.breakdown} />
    </section>
  );
}
