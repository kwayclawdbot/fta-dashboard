"use client";

import {
  Eye,
  BarChart3,
  TrendingUp,
  Activity,
  Sparkles,
  Compass,
  BookOpen,
  FileText,
  ListChecks,
  MessageCircle,
  Search,
  Newspaper,
  LineChart,
  GraduationCap,
  Video,
  Users,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import LockedState from "@/components/dashboard/LockedState";
import { wallFor, type Feature } from "@/lib/entitlements";

/**
 * Every wall CTA lands on the canonical matrix pricing page (/pricing) — the ONE
 * upgrade surface (MONETIZATION-GATES.md "Pricing page"), which then routes to
 * Club checkout. Keeps the walls and the pricing table in lockstep and stops
 * /pricing being an orphan with no inbound links.
 */
const PRICING_HREF = "/pricing";

/**
 * The ONE contextual paywall surface. Renders the verbatim per-feature copy
 * (MONETIZATION-GATES.md) through the shared LockedState silhouette, with the
 * Cheat Code Club checkout CTA. Never a generic "Upgrade to Pro" — every wall
 * names exactly what's behind it.
 *
 * `variant="band"` renders a compact inline lock (for a walled section inside an
 * otherwise-visible page); `"full"` replaces the whole surface.
 *
 * CANVAS v2: the band was the pre-canvas paper card with a gold ring and a gradient
 * `.cta-button`. It is now the board's NEUTRAL white card (`.club-b-card`,
 * hairline `--sand`, 14px radius) with a round orange `.club-b-orb` glyph and a
 * solid orange button — neutral because the band sits inside a page that keeps
 * its own content, and only one object per screen may carry the warm tint. The
 * `full` variant remains the shared tinted `LockedState`.
 *
 * THE GATE IS UNCHANGED. `wallFor()` still supplies the verbatim copy and the
 * caller still decides whether this renders at all.
 */

const ICONS: Record<Feature, LucideIcon> = {
  kai_watch: Eye,
  club_intel: Activity,
  trending_full: TrendingUp,
  sentiment_detailed: BarChart3,
  kai_brief: Sparkles,
  foryou_deep: Compass,
  research_unlimited: BookOpen,
  publish_thesis: FileText,
  watchlist_unlimited: ListChecks,
  kai_chat_full: MessageCircle,
  kai_research_full: Search,
  screener_full: Search,
  news_personalized: Newspaper,
  simulator_advanced: LineChart,
  learning_full: GraduationCap,
  live_sessions_full: Video,
  family_activation: Users,
  fta_section: Trophy,
};

export default function ContextualWall({
  feature,
  ticker,
  variant = "full",
  surface = "paper",
  className = "",
}: {
  feature: Feature;
  /** Ticker for {TICKER} substitution (Club Intelligence). */
  ticker?: string;
  variant?: "full" | "band";
  surface?: "paper" | "midnight";
  className?: string;
}) {
  const copy = wallFor(feature, ticker);
  const Icon = ICONS[feature] ?? Sparkles;

  if (variant === "band") {
    return (
      <div
        className={`club-b-card flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 ${className}`}
      >
        <span className="club-b-orb h-10 w-10 shrink-0">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-[8rem] flex-1">
          <p className="font-display text-[14px] font-extrabold uppercase leading-tight tracking-[-0.01em] text-ink">
            {copy.title}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-soft">{copy.body}</p>
        </div>
        <a
          href={PRICING_HREF}
          className="f0-focus f0-press inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-4 py-2.5 font-display text-[12px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)] sm:w-auto"
        >
          {copy.cta}
        </a>
      </div>
    );
  }

  return (
    <LockedState
      icon={Icon}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      surface={surface}
      cta={{ label: copy.cta, href: PRICING_HREF, external: false }}
      className={className}
    />
  );
}
