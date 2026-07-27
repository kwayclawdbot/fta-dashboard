"use client";

import Link from "next/link";
import { ArrowUpRight, Zap, Sparkles, CalendarClock, Target } from "lucide-react";
import type { BriefResponse } from "@/lib/clubhome/contract";

/**
 * ACT ON THIS — the full-bleed orange action band.
 *
 * Owner directive (round nine): the band carries MARKET / KAI content you can act
 * on, NOT club vanity stats. That change also removed the biggest founding-state
 * risk in the system — market and Kai content exists on day one regardless of how
 * many members the club has, whereas "24.7K posts" reads as single digits live.
 *
 * ARCHITECTURE — a priority queue with TWO display states:
 *
 *   P1  live Kai alert   → URGENT state: takes over the band entirely
 *                          (full-width statement, LIVE dot, timestamp, action)
 *   P2  Kai's read       → chip   (/api/club/brief)
 *   P3  today's catalyst → chip   (earnings / econ — the one new dependency)
 *   P4  your move        → chip   (club_missions, migrations 180/181)
 *
 * So the band escalates when something fires and relaxes to a scrolling digest
 * the rest of the day: never dead, never crying wolf.
 *
 * COLOUR LAW: this band carries ACTIONS, never prices. Nothing in here renders a
 * percentage — price data stays on cream where green and red are legible.
 */

export type ActionItem = {
  id: string;
  kind: "alert" | "kai" | "market" | "mission";
  text: string;
  href: string;
  /** alert only — drives the urgent takeover state */
  urgent?: boolean;
  when?: string;
};

const ICON = {
  alert: Zap,
  kai: Sparkles,
  market: CalendarClock,
  mission: Target,
} as const;

/** Build the queue from what's actually available. Ordered by priority. */
export function buildActionQueue(opts: {
  alert?: { text: string; href: string; when: string } | null;
  brief?: BriefResponse | null;
  catalysts?: { text: string; href: string }[];
  mission?: { text: string; href: string } | null;
}): ActionItem[] {
  const out: ActionItem[] = [];

  if (opts.alert) {
    out.push({
      id: "alert",
      kind: "alert",
      text: opts.alert.text,
      href: opts.alert.href,
      when: opts.alert.when,
      urgent: true,
    });
  }

  // Kai's read — only when the brief is genuinely available, so a degraded LLM
  // never puts a hollow line in the most prominent action slot.
  const lead = opts.brief?.available ? opts.brief.items?.[0] : null;
  if (lead?.text) {
    out.push({ id: "kai", kind: "kai", text: lead.text, href: "/kai" });
  }

  for (const [i, c] of (opts.catalysts ?? []).entries()) {
    out.push({ id: `mkt-${i}`, kind: "market", text: c.text, href: c.href });
  }

  if (opts.mission) {
    out.push({ id: "mission", kind: "mission", text: opts.mission.text, href: opts.mission.href });
  }

  return out;
}

export default function ActionBand({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;

  const urgent = items.find((i) => i.urgent);

  // ── URGENT takeover ──────────────────────────────────────────────────────
  if (urgent) {
    return (
      <section className="club2-band f0-grain relative" aria-label="Kai alert">
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-white" aria-hidden />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">
              Kai alert
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/90">
                Live
              </span>
            </span>
          </div>
          <p className="mt-2 font-display text-[17px] font-bold leading-snug text-white">
            {urgent.text}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Link
              href={urgent.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-display text-[13px] font-bold text-volt-700 transition-transform active:scale-[0.98]"
            >
              Review <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            {urgent.when && (
              <span className="font-mono text-[11px] text-white/75">{urgent.when}</span>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── DIGEST — scrolling chips ─────────────────────────────────────────────
  return (
    <section className="club2-band f0-grain relative" aria-label="Things to act on">
      <div className="mx-auto max-w-2xl px-4 py-3.5 lg:max-w-3xl">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">
          Act on this
        </span>
        <div className="club2-track -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-0.5">
          {items.map((it) => {
            const Icon = ICON[it.kind];
            return (
              <Link
                key={it.id}
                href={it.href}
                // text-ink flips to near-white in dark → white-on-white pill.
                // The chip sits on the theme-invariant orange band, so its type
                // must be invariant too: night-950 is constant in both themes.
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2 font-display text-[13px] font-bold text-night-950 transition-transform active:scale-[0.98]"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-volt-600" aria-hidden />
                <span className="whitespace-nowrap">{it.text}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
