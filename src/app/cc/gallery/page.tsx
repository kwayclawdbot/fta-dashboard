"use client";

/**
 * Cheat Code App v2 — PRIMITIVES GALLERY (dev-only review surface, Phase 0).
 * This is how Kway reviews the v2 foundation before any screen converts. It is
 * NOT a product route: it 404s in production (see the guard below) and lives
 * entirely inside the [data-design="v2"] token scope so it doubles as the
 * v1-non-regression proof — everything here reads from --cc-* tokens only.
 *
 * The root sets data-design="v2" AND data-theme on the SAME element, so the
 * theme toggle flips the light twin exactly the way a converted <html> would.
 * fixed inset-0 escapes the parent /cc 430px phone column so we get a real
 * two-column desktop review (stacked on mobile).
 */
import { notFound } from "next/navigation";
import { useState } from "react";
import {
  Kicker,
  ScriptTitle,
  Card,
  Chip,
  CcMark,
  TickerBadge,
  BeltAvatar,
  Ring,
  Sparkline,
  Delta,
  OrangeButton,
  GhostButton,
  EvidenceChip,
  AlertCard,
  StatRow,
  RankedTile,
  LevelLadder,
  BELT_COLORS,
  type LadderRung,
} from "@/components/cc/ui";
import {
  SubTabs,
  CountdownChip,
  ZoneChart,
} from "@/components/cc/interactive";
import {
  Home,
  Compass,
  Diamond,
  Monitor,
  CircleUser,
  MessageCircle,
  Eye,
  GraduationCap,
  Bell,
  Search,
} from "lucide-react";

/* ── mock data (boards 12 · 18 · 22 + realistic states) ───────────────────── */

const RANKED = [
  { rank: 1, symbol: "NVDA", conviction: 78, rankDelta: 2, halo: true },
  { rank: 2, symbol: "TSLA", conviction: 64, rankDelta: -1 },
  { rank: 3, symbol: "AMD", conviction: 59, rankDelta: 6 },
  { rank: 4, symbol: "PLTR", conviction: 55, rankDelta: 0 },
  { rank: 5, symbol: "MSFT", conviction: 51, rankDelta: 1 },
];

// board 12 — key levels ladder (NVDA)
const KEY_LEVELS: LadderRung[] = [
  { at: 96, label: "Resistance", value: "$1,240", tone: "var(--cc-down)" },
  { at: 72, label: "Prior high", value: "$1,180", tone: "var(--cc-soft)" },
  { at: 52, label: "Here now", value: "$1,142", current: true },
  { at: 30, label: "8-EMA", value: "$1,098", tone: "var(--cc-soft)" },
  { at: 8, label: "Support", value: "$1,040", tone: "var(--cc-up)" },
];

// board 22 — belt ladder (club rank)
const BELT_LADDER: LadderRung[] = [
  { at: 96, label: "Black", value: "500 calls", tone: BELT_COLORS.black },
  { at: 74, label: "Purple", value: "250 calls", tone: BELT_COLORS.purple },
  { at: 54, label: "Blue — you", value: "100 calls", current: true },
  { at: 34, label: "Green", value: "40 calls", tone: BELT_COLORS.green },
  { at: 12, label: "Yellow", value: "10 calls", tone: BELT_COLORS.yellow },
];

const SUBTABS = [
  { id: "feed", label: "Feed" },
  { id: "circles", label: "Circles" },
  { id: "live", label: "Live" },
] as const;

const SPARK = [4, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16];
const SPARK_DOWN = [16, 15, 16, 13, 14, 11, 12, 9, 10, 7, 8, 6];

/* ── section frame ────────────────────────────────────────────────────────── */

function Section({
  script,
  kicker,
  children,
}: {
  script: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <ScriptTitle className="text-[26px]">{script}</ScriptTitle>
      <div className="mt-1">
        <Kicker>{kicker}</Kicker>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

/* ── Shell chrome preview (Phase 1 Lane A) ─────────────────────────────────────
   Static representations of the v2 sidebar / top bar / tab bar in isolation —
   the real components (SidebarV2/TopBarV2/MobileTabBarV2) are fixed-positioned
   and router-driven, so this mirrors their language for review without hijacking
   the page. Every token here is the same --cc-* the live shell reads. */

const SIDE_NAV: {
  label: string;
  icon: React.ElementType;
  active?: boolean;
  accent?: boolean;
}[] = [
  { label: "Home", icon: Home, active: true },
  { label: "Discover", icon: Compass },
  { label: "Club", icon: MessageCircle, accent: true },
  { label: "Watchlist", icon: Eye },
];

function ShellPreview() {
  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div>
        <Kicker tone="soft">top bar · mono title · belt chip · bell · avatar</Kicker>
        <div
          className="mt-2 flex h-14 items-center justify-between rounded-xl px-4"
          style={{ background: "var(--cc-bg)", border: "1px solid var(--cc-line)" }}
        >
          <span className="cc-mono" style={{ color: "var(--cc-soft)" }}>
            Home
          </span>
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4" style={{ color: "var(--cc-dim)" }} />
            <span
              className="flex h-8 items-center gap-2 rounded-full pl-1 pr-2.5"
              style={{ border: "1px solid var(--cc-line)" }}
            >
              <BeltAvatar initials="MH" belt="blue" size={22} />
              <span
                className="font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--cc-soft)" }}
              >
                Blue
              </span>
            </span>
            <Bell className="h-4 w-4" style={{ color: "var(--cc-dim)" }} />
            <BeltAvatar initials="MH" belt="blue" size={28} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Sidebar */}
        <div>
          <Kicker tone="soft">sidebar · active = signal orange · fta = gold lane</Kicker>
          <div
            className="mt-2 w-full max-w-[240px] overflow-hidden rounded-xl"
            style={{ background: "var(--cc-bg)", border: "1px solid var(--cc-line)" }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-4"
              style={{ borderBottom: "1px solid var(--cc-line)" }}
            >
              <CcMark size={24} />
              <span className="flex flex-col leading-none">
                <span className="cc-display text-[17px]" style={{ color: "var(--cc-ink)" }}>
                  Cheat Code
                </span>
                <span
                  className="mt-1 font-[family-name:var(--font-plex-mono)] text-[8px] font-semibold uppercase tracking-[0.4em]"
                  style={{ color: "var(--cc-orange-ink)" }}
                >
                  Club
                </span>
              </span>
            </div>
            <div className="space-y-0.5 p-3">
              {SIDE_NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <div
                    key={n.label}
                    className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                    style={{
                      color: n.active ? "var(--cc-orange-ink)" : "var(--cc-soft)",
                      background: n.active
                        ? "color-mix(in srgb, var(--cc-orange) 12%, transparent)"
                        : "transparent",
                    }}
                  >
                    {n.active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                        style={{ background: "var(--cc-orange)" }}
                      />
                    )}
                    <Icon
                      className="h-[18px] w-[18px]"
                      style={n.accent && !n.active ? { color: "var(--cc-orange-ink)" } : undefined}
                    />
                    <span className="font-medium">{n.label}</span>
                  </div>
                );
              })}
              <div className="px-3 pb-1 pt-4">
                <span className="cc-mono" style={{ color: "var(--cc-dim)" }}>
                  Markets
                </span>
              </div>
              <div
                className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                style={{
                  color: "var(--cc-yellow)",
                  borderTop: "1px solid color-mix(in srgb, var(--cc-yellow) 30%, transparent)",
                }}
              >
                <GraduationCap className="h-[18px] w-[18px]" />
                <span className="cc-display text-[15px]">FTA — Academy</span>
                <span
                  className="ml-auto rounded-full px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase"
                  style={{ background: "var(--cc-yellow)", color: "var(--cc-orange-deep)" }}
                >
                  PRO
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile tab bar */}
        <div>
          <Kicker tone="soft">mobile tab bar · 5 slots · active = orange</Kicker>
          <div
            className="mt-2 flex h-16 items-stretch justify-around rounded-xl px-1"
            style={{ background: "var(--cc-bg)", border: "1px solid var(--cc-line)" }}
          >
            {[
              { label: "Home", icon: Home, active: true },
              { label: "Discover", icon: Compass },
              { label: "Club", icon: Diamond },
              { label: "Watch", icon: Monitor },
              { label: "You", icon: CircleUser },
            ].map((t) => {
              const Icon = t.icon;
              const c = t.active ? "var(--cc-orange)" : "var(--cc-dim)";
              return (
                <div
                  key={t.label}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5"
                >
                  <Icon className="h-[22px] w-[22px]" style={{ color: c }} strokeWidth={t.active ? 2.4 : 1.8} />
                  <span className="text-[10px] font-medium leading-none" style={{ color: c }}>
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[12px]" style={{ color: "var(--cc-soft)" }}>
            Live components: <code style={{ color: "var(--cc-orange-ink)" }}>SidebarV2</code>,{" "}
            <code style={{ color: "var(--cc-orange-ink)" }}>TopBarV2</code>,{" "}
            <code style={{ color: "var(--cc-orange-ink)" }}>MobileTabBarV2</code> — fixed-positioned in the app; previewed statically here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tab, setTab] = useState<(typeof SUBTABS)[number]["id"]>("feed");

  // A live target ~2 days + 4 hours out, for the countdown.
  const target = new Date(Date.now() + (2 * 24 * 60 * 60 + 4 * 60 * 60) * 1000);

  return (
    <div
      data-design="v2"
      data-theme={theme}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "var(--cc-bg)", color: "var(--cc-ink)" }}
    >
      {/* header + theme toggle */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-5 py-3 backdrop-blur"
        style={{
          borderColor: "var(--cc-line)",
          background: "color-mix(in srgb, var(--cc-bg) 88%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <CcMark size={28} />
          <div>
            <span className="cc-display text-[20px]">
              Cheat Code <span style={{ color: "var(--cc-orange)" }}>v2</span> · gallery
            </span>
            <div className="mt-0.5">
              <Kicker tone="soft">
                data-design=&quot;v2&quot; · data-theme=&quot;{theme}&quot; · mode: club (default)
              </Kicker>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="hidden font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em] sm:inline"
            style={{ color: "var(--cc-dim)" }}
          >
            theme
          </span>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded-full px-4 py-2 text-[12px] font-bold"
            style={{ background: "var(--cc-card2)", border: "1px solid var(--cc-line)", color: "var(--cc-ink)" }}
          >
            {theme === "dark" ? "☾ Dark" : "☀ Light"} → flip
          </button>
        </div>
      </header>

      {/* mode note */}
      <div className="px-5 pt-4">
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          Every primitive below renders from <code style={{ color: "var(--cc-orange-ink)" }}>--cc-*</code> tokens only —
          flip the theme to verify the light twin reads with zero layout change. The <code>data-mode</code> axis
          (club / family / fta) is unchanged and re-skins these same components; this gallery previews{" "}
          <strong style={{ color: "var(--cc-ink)" }}>club</strong> mode.
        </p>
      </div>

      {/* two-column desktop, stacked mobile */}
      <main className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        {/* SHELL CHROME (Phase 1 Lane A) — full width */}
        <div className="lg:col-span-2">
          <Section script="shell" kicker="sidebar · top bar · tab bar">
            <ShellPreview />
          </Section>
        </div>

        {/* TYPE VOICES */}
        <Section script="type" kicker="four voices · strict jobs">
          <div className="space-y-3">
            <div className="cc-display text-[40px]">Reading the room</div>
            <div className="cc-script text-[32px]" style={{ color: "var(--cc-ink)" }}>
              discover
            </div>
            <p className="text-[14px]" style={{ color: "var(--cc-ink)" }}>
              Body / UI — Instrument Sans. Everything conversational: posts, descriptions, buttons, forms.
            </p>
            <div className="flex flex-wrap gap-3">
              <Kicker>rising fast</Kicker>
              <Kicker tone="soft">where the club stands</Kicker>
              <Kicker tone="up">buy signal</Kicker>
              <Kicker tone="down">sell signal</Kicker>
            </div>
          </div>
        </Section>

        {/* BRAND + BELTS */}
        <Section script="identity" kicker="marks · belts · streaks">
          <div className="flex flex-wrap items-center gap-4">
            <CcMark size={40} />
            <TickerBadge symbol="NVDA" size={40} />
            <TickerBadge symbol="TSLA" size={40} />
            <TickerBadge symbol="MSFT" size={40} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {Object.keys(BELT_COLORS).map((belt) => (
              <div key={belt} className="flex flex-col items-center gap-1">
                <BeltAvatar initials="MH" belt={belt} size={38} live={belt === "black"} />
                <span
                  className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: "var(--cc-dim)" }}
                >
                  {belt}
                </span>
              </div>
            ))}
          </div>
          <StatRow
            stats={[
              { label: "opinions", value: "4,312" },
              { label: "shift", value: "+14", tone: "up" },
              { label: "black belts", value: "88%", tone: "orange" },
            ]}
          />
        </Section>

        {/* RINGS + SPARKLINES */}
        <Section script="signal" kicker="rings · sparklines · deltas">
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={78} size={92} stroke={7} halo>
              <div className="text-center">
                <div className="cc-display text-[26px]" style={{ color: "var(--cc-orange)" }}>
                  78%
                </div>
                <div className="font-[family-name:var(--font-plex-mono)] text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-dim)" }}>
                  weighted
                </div>
              </div>
            </Ring>
            <Ring value={64} size={72} stroke={6} color="var(--cc-up)">
              <span className="font-[family-name:var(--font-plex-mono)] text-[16px] font-bold" style={{ color: "var(--cc-up)" }}>
                64
              </span>
            </Ring>
            <Ring value={41} size={72} stroke={6} color="var(--cc-blue)">
              <span className="font-[family-name:var(--font-plex-mono)] text-[16px] font-bold" style={{ color: "var(--cc-blue)" }}>
                41
              </span>
            </Ring>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkline points={SPARK} width={90} height={28} />
              <Delta pct={12.4} />
            </div>
            <div className="flex items-center gap-2">
              <Sparkline points={SPARK_DOWN} width={90} height={28} />
              <Delta pct={-4.2} />
            </div>
          </div>
        </Section>

        {/* RANKED RAIL */}
        <Section script="club" kicker="top in the club · rank movement ≠ price">
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pt-2">
            {RANKED.map((r) => (
              <RankedTile key={r.symbol} {...r} />
            ))}
          </div>
        </Section>

        {/* SUB-TABS + CHIPS + BUTTONS */}
        <Section script="controls" kicker="sub-tabs · chips · CTAs">
          <SubTabs tabs={SUBTABS} value={tab} onChange={setTab} />
          <div className="text-[12px]" style={{ color: "var(--cc-soft)" }}>
            active tab: <strong style={{ color: "var(--cc-ink)" }}>{tab}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active>Active</Chip>
            <Chip>Ghost</Chip>
            <Chip>+14 shift</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <OrangeButton>Arm alert</OrangeButton>
            <GhostButton>Dismiss</GhostButton>
            <CountdownChip target={target} prefix="closes " />
          </div>
        </Section>

        {/* EVIDENCE CHIPS */}
        <Section script="evidence" kicker="proof pills · ✓ ✗ value">
          <div className="flex flex-wrap gap-2">
            <EvidenceChip label="RSI reset" state="pass" />
            <EvidenceChip label="Above 8-EMA" state="pass" />
            <EvidenceChip label="Call flow" state="value" value="3.1x" />
            <EvidenceChip label="Club shift" state="value" value="+14" />
            <EvidenceChip label="Below VWAP" state="fail" />
            <EvidenceChip label="Volume dry" state="fail" />
          </div>
        </Section>

        {/* TYPED ALERT TRIO (board 18) */}
        <Section script="alerts" kicker="typed cards · buy · sell · heads-up">
          <AlertCard
            kind="BUY"
            symbol="NVDA"
            kicker="kai's verdict · 6:02 am"
            thesis="Reclaimed the 8-EMA on rising call flow after an RSI reset — the Club's weighted signal flipped to 78%."
            evidence={[
              { label: "RSI reset", state: "pass" },
              { label: "Call flow", state: "value", value: "3.1x" },
              { label: "Club shift", state: "value", value: "+14" },
            ]}
            meta="3/3 met"
            action={
              <>
                <OrangeButton halo={false} className="px-4 py-2 text-[13px]">
                  Arm alert
                </OrangeButton>
                <GhostButton className="px-4 py-2 text-[13px]">Chart</GhostButton>
              </>
            }
          />
          <AlertCard
            kind="SELL"
            symbol="CRWD"
            kicker="rollover · extended"
            thesis="Lost VWAP with a bearish divergence into resistance — first weakness after an overbought run."
            evidence={[
              { label: "Below VWAP", state: "fail" },
              { label: "RSI div", state: "fail" },
              { label: "At resistance", state: "value", value: "$1,240" },
            ]}
            meta="2/3 met"
          />
          <AlertCard
            kind="HEADS_UP"
            symbol="AMD"
            kicker="watching · not yet"
            thesis="Coiling under the prior high — one close above $178 completes the setup."
            evidence={[
              { label: "Under prior high", state: "value", value: "$178" },
              { label: "Vol building", state: "pass" },
            ]}
            meta="1/2 met"
          />
        </Section>

        {/* LADDERS (board 12 + board 22) */}
        <Section script="levels" kicker="key levels · board 12">
          <LevelLadder rungs={KEY_LEVELS} height={230} />
        </Section>

        <Section script="belts" kicker="club-rank ladder · board 22">
          <LevelLadder rungs={BELT_LADDER} height={230} />
        </Section>

        {/* ZONE CHART (board 19) */}
        <Section script="zone" kicker="setup chart · entry + invalidation bands">
          <ZoneChart
            series={[108, 110, 109, 112, 114, 113, 116, 118, 117, 120, 122, 121, 124]}
            entry={{ low: 110, high: 114 }}
            invalidation={{ low: 104, high: 108 }}
            levels={[
              { price: 124, label: "target $124", kind: "target" },
              { price: 112, label: "entry $112", kind: "entry" },
              { price: 106, label: "stop $106", kind: "stop" },
            ]}
            height={200}
          />
          <div>
            <Kicker tone="soft">static fallback · no series</Kicker>
            <div className="mt-2">
              <ZoneChart
                entry={{ low: 110, high: 114 }}
                invalidation={{ low: 104, high: 108 }}
                levels={[
                  { price: 124, label: "target $124", kind: "target" },
                  { price: 112, label: "entry $112", kind: "entry" },
                  { price: 106, label: "stop $106", kind: "stop" },
                ]}
                height={180}
              />
            </div>
          </div>
        </Section>
      </main>

      <footer className="px-5 pb-16 pt-2">
        <Kicker tone="soft">not investment advice · opinions are the club&apos;s, not brokers&apos;</Kicker>
      </footer>
    </div>
  );
}
