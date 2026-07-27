"use client";

/**
 * Canvas screen surfaces — pixel-faithful rebuilds of the owner's App-UI
 * artboards (03 My Signals · 05 Kai Watch · 09 Screener · 10 Missions ·
 * 11 Leaderboard · 12 Practice Portfolio · 14 Alerts).
 *
 * Each surface is a near-verbatim port of the artboard composition onto the
 * live club tokens. Data is typed and defaults to the artboard's founding
 * example set (the owner's chosen representative values — a designed founding
 * state to the same visual standard, never a sad-empty screen). Real data is
 * threaded in via props by the mounting route where an endpoint exists.
 */

import {
  Screen, Display, Sub, ChipRow, Chip, Card, SectionLabel, Logo, Spark, Money, Delta,
  V, sora, mono, inter,
} from "./kit";

const PAD = { padding: "16px 18px 0" } as const;

/* ============================ 03 · MY SIGNALS ============================ */
export type SignalState = "TRIGGERED" | "BUILDING" | "GETTING CLOSE" | "COOLED";
export interface SignalRow {
  symbol: string; name: string; price: string; change: string; up: boolean; state: SignalState;
}
const SIGNAL_TONE: Record<SignalState, { bg: string; text: string }> = {
  TRIGGERED: { bg: V.greenSoft, text: V.green },
  BUILDING: { bg: V.goldSoft, text: V.gold },
  "GETTING CLOSE": { bg: V.voltSoft, text: V.voltText },
  COOLED: { bg: "rgba(37,99,255,.16)", text: "#5E82E6" },
};
const SIGNALS_FOUNDING: SignalRow[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", price: "$173.42", change: "4.72%", up: true, state: "TRIGGERED" },
  { symbol: "HOOD", name: "Robinhood Markets", price: "$24.81", change: "7.38%", up: true, state: "BUILDING" },
  { symbol: "TSLA", name: "Tesla, Inc.", price: "$248.31", change: "2.11%", up: false, state: "GETTING CLOSE" },
  { symbol: "PLTR", name: "Palantir Technologies", price: "$22.16", change: "2.21%", up: false, state: "COOLED" },
];
const EARNINGS_FOUNDING = [
  { symbol: "NVDA", name: "NVIDIA Corporation", when: "May 22 · After close" },
  { symbol: "SNOW", name: "Snowflake Inc.", when: "May 23 · After close" },
  { symbol: "CRM", name: "Salesforce, Inc.", when: "May 29 · After close" },
];

export function MySignals({
  rows = SIGNALS_FOUNDING,
  counts = { all: 12, triggered: 3, building: 4, cooled: 2 },
  earnings = EARNINGS_FOUNDING,
}: {
  rows?: SignalRow[];
  counts?: { all: number; triggered: number; building: number; cooled: number };
  earnings?: { symbol: string; name: string; when: string }[];
}) {
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <Display size={30}>My Signals</Display>
      </div>
      <div style={{ ...PAD, paddingTop: 16 }}>
        <ChipRow>
          <Chip active>All {counts.all}</Chip>
          <Chip>Triggered {counts.triggered}</Chip>
          <Chip>Building {counts.building}</Chip>
          <Chip>Cooled {counts.cooled}</Chip>
        </ChipRow>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const tone = SIGNAL_TONE[r.state];
          return (
            <Card key={r.symbol} style={{ display: "flex", alignItems: "center", gap: 12, padding: 13 }}>
              <Logo symbol={r.symbol} name={r.name} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 16px/1.2 ${sora}`, color: V.ink }}>{r.symbol}</div>
                <div style={{ font: `400 11px/1.4 ${inter}`, color: V.soft }}>{r.name}</div>
                <div style={{ display: "inline-block", marginTop: 6, padding: "4px 8px", borderRadius: 6, background: tone.bg, font: `700 9px/1 ${inter}`, letterSpacing: ".08em", color: tone.text }}>
                  {r.state}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Money>{r.price}</Money>
                <div><Delta up={r.up}>{r.change}</Delta></div>
              </div>
            </Card>
          );
        })}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <SectionLabel>Upcoming Earnings</SectionLabel>
          <span style={{ font: `600 12px/1 ${inter}`, color: V.voltText }}>View calendar →</span>
        </div>
        <Card style={{ overflow: "hidden" }}>
          {earnings.map((e, i) => (
            <div key={e.symbol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderBottom: i < earnings.length - 1 ? `1px solid ${V.sand}` : "none" }}>
              <Logo symbol={e.symbol} name={e.name} size={30} radius={9} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 13px/1.2 ${sora}`, color: V.ink }}>{e.symbol}</div>
                <div style={{ font: `400 11px/1.3 ${inter}`, color: V.soft }}>{e.when}</div>
              </div>
              <span style={{ color: V.faint }}>→</span>
            </div>
          ))}
        </Card>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ============================ 05 · KAI WATCH ============================ */
export interface WatchCard {
  symbol: string; name: string; price: string; change: string; up: boolean;
  state: "TRIGGERED" | "GETTING CLOSE"; note: string; spark: number[];
}
const KAIWATCH_FOUNDING: WatchCard[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", price: "$173.42", change: "4.72%", up: true, state: "TRIGGERED", note: "Momentum + volume, earnings beat and guide up.", spark: [4, 8, 6, 15, 12, 21, 18, 30] },
  { symbol: "TSLA", name: "Tesla, Inc.", price: "$248.31", change: "0.35%", up: false, state: "GETTING CLOSE", note: "Key level breakout watch. Above $250 sets it up.", spark: [22, 14, 8, 12, 9, 17, 14, 24] },
];

export function KaiWatch({
  cards = KAIWATCH_FOUNDING,
  counts = { all: 4, triggered: 1, building: 1, cooled: 1 },
}: {
  cards?: WatchCard[];
  counts?: { all: number; triggered: number; building: number; cooled: number };
}) {
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <div style={{ color: V.soft, font: `600 16px/1 ${inter}`, marginBottom: 10 }}>←</div>
        <Display size={30} color={V.volt}>Kai Watch</Display>
        <Sub>Live command center</Sub>
      </div>
      <div style={{ ...PAD, paddingTop: 14 }}>
        <ChipRow>
          <Chip tone={{ text: V.voltText, border: V.volt }}>ALL {counts.all}</Chip>
          <Chip tone={{ text: V.green, border: "color-mix(in srgb, var(--cv-green) 40%, transparent)" }}>TRIGGERED {counts.triggered}</Chip>
          <Chip tone={{ text: V.gold, border: "rgba(230,184,77,.5)" }}>BUILDING {counts.building}</Chip>
          <Chip tone={{ text: "#5E82E6", border: "rgba(94,130,230,.5)" }}>COOLED {counts.cooled}</Chip>
        </ChipRow>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 11 }}>
        {cards.map((c) => {
          const trig = c.state === "TRIGGERED";
          return (
            <Card key={c.symbol} style={{ padding: 13, border: trig ? `1px solid color-mix(in srgb, var(--cv-green) 30%, ${V.sand})` : `1px solid ${V.sand}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, font: `700 10px/1 ${inter}`, letterSpacing: ".1em", color: trig ? V.green : V.voltText }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: trig ? V.green : V.volt, display: "inline-block", animation: trig ? "ccpulse 2s ease-in-out infinite" : undefined }} />
                {c.state}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Logo symbol={c.symbol} name={c.name} size={30} radius={9} />
                    <div>
                      <div style={{ font: `700 20px/1.1 ${sora}`, color: V.ink }}>{c.symbol}</div>
                      <div style={{ font: `400 11px/1.4 ${inter}`, color: V.soft }}>{c.name}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Spark points={c.spark} color={c.up ? V.green : V.red} w={150} h={34} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Money size={20}>{c.price}</Money>
                  <div><Delta up={c.up}>{c.change}</Delta></div>
                </div>
              </div>
              <div style={{ font: `400 12px/1.5 ${inter}`, color: V.soft, marginTop: 9 }}>{c.note}</div>
            </Card>
          );
        })}

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, background: V.voltSoft, border: `1px solid ${V.volt}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 14px/1.2 ${sora}`, color: V.ink }}>Never miss a setup</div>
            <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft }}>Enable push alerts</div>
          </div>
          <div style={{ padding: "8px 16px", borderRadius: 18, border: `1px solid ${V.volt}`, font: `700 12px/1 ${inter}`, color: V.voltText }}>Enable</div>
        </div>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ============================ 09 · SCREENER ============================ */
export interface ScreenRow {
  symbol: string; name: string; reason: string; price: string; change: string; up: boolean; spark: number[];
}
const SCREENER_FOUNDING: ScreenRow[] = [
  { symbol: "SOUN", name: "SoundHound AI", reason: "Vol 4.2× avg", price: "$8.42", change: "22%", up: true, spark: [4, 8, 6, 14, 19] },
  { symbol: "RDDT", name: "Reddit, Inc.", reason: "52w high break", price: "$74.10", change: "19%", up: true, spark: [5, 7, 11, 12, 18] },
  { symbol: "ARM", name: "Arm Holdings", reason: "Reclaimed 50MA", price: "$132.60", change: "10%", up: true, spark: [6, 5, 10, 11, 16] },
  { symbol: "MSTR", name: "MicroStrategy", reason: "Volatility expansion", price: "$412.05", change: "9%", up: true, spark: [7, 12, 8, 13, 15] },
  { symbol: "AFRM", name: "Affirm Holdings", reason: "Gap fill in progress", price: "$41.88", change: "3%", up: false, spark: [16, 12, 13, 8, 5] },
];

export function Screener({
  rows = SCREENER_FOUNDING,
  matches = 28,
}: {
  rows?: ScreenRow[];
  matches?: number;
}) {
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <Display size={26}>Screener</Display>
        <Sub>Find setups before the club does</Sub>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px", borderRadius: 20, background: V.card, border: `1px solid ${V.sand}`, font: `400 13px/1 ${inter}`, color: V.faint }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          Momentum + volume, under $50…
        </div>
        <ChipRow>
          <Chip active>Momentum</Chip>
          <Chip>Breakout</Chip>
          <Chip>Oversold</Chip>
          <Chip>Earnings soon</Chip>
        </ChipRow>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: `600 12px/1 ${inter}`, color: V.soft }}>{matches} matches · sorted by club heat</span>
          <span style={{ font: `600 12px/1 ${inter}`, color: V.voltText }}>Filters</span>
        </div>
        <Card style={{ overflow: "hidden" }}>
          {rows.map((r, i) => (
            <div key={r.symbol} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderBottom: i < rows.length - 1 ? `1px solid ${V.sand}` : "none" }}>
              <Logo symbol={r.symbol} name={r.name} size={32} radius={9} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 14px/1.2 ${sora}`, color: V.ink }}>{r.symbol}</div>
                <div style={{ font: `400 11px/1.3 ${inter}`, color: V.faint }}>{r.reason}</div>
              </div>
              <Spark points={r.spark} color={r.up ? V.green : V.red} w={52} h={22} />
              <div style={{ textAlign: "right" }}>
                <div style={{ font: `600 13px/1.3 ${mono}`, color: V.ink }}>{r.price}</div>
                <div style={{ font: `600 11px/1 ${mono}`, color: r.up ? V.green : V.red }}>{r.up ? "▲" : "▼"}{r.change}</div>
              </div>
            </div>
          ))}
        </Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, background: `linear-gradient(135deg, ${V.kaiSoft}, ${V.greenSoft})`, border: `1px solid color-mix(in srgb, var(--kai-blue) 35%, transparent)` }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 13px/1.2 ${sora}`, color: V.ink }}>Screen in plain English</div>
            <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft }}>&quot;Semis under $60 with rising volume&quot;</div>
          </div>
          <span style={{ color: V.ink }}>→</span>
        </div>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ============================ 10 · MISSIONS ============================ */
export interface ClubMission {
  slug: string; title: string; sub: string; xp: number; accent: "teal" | "kai" | "gold" | "volt";
  done?: boolean; href?: string;
}
export interface MissionsData {
  hero: { title: string; done: number; total: number; xp: number };
  active: ClubMission[];
  streak: { headline: string; sub: string };
}
const ACCENT_CHIP: Record<string, { bg: string; border: string }> = {
  teal: { bg: V.greenSoft, border: "color-mix(in srgb, var(--cv-green) 35%, transparent)" },
  kai: { bg: V.kaiSoft, border: "color-mix(in srgb, var(--kai-blue) 35%, transparent)" },
  gold: { bg: V.goldSoft, border: "rgba(230,184,77,.4)" },
  volt: { bg: V.voltSoft, border: "color-mix(in srgb, var(--g500) 40%, transparent)" },
};
const MISSIONS_FOUNDING: MissionsData = {
  hero: { title: "Rate five tickers you actually own", done: 3, total: 5, xp: 150 },
  active: [
    { slug: "club-write-bear-case", title: "Write one bear case", sub: "On a name you're long · +80 XP", xp: 80, accent: "teal" },
    { slug: "club-backtest-breakout", title: "Backtest a breakout", sub: "In practice portfolio · +120 XP", xp: 120, accent: "kai" },
    { slug: "club-attend-live-room", title: "Attend a live room", sub: "Completed Tuesday · +60 XP", xp: 60, accent: "gold", done: true },
  ],
  streak: { headline: "2 weeks from the Analyst badge", sub: "Keep the mission streak alive" },
};

export function Missions({ data = MISSIONS_FOUNDING }: { data?: MissionsData }) {
  const pct = Math.round((data.hero.done / data.hero.total) * 100);
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <Display size={26}>Missions</Display>
        <Sub>Small reps. Real conviction.</Sub>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* THIS WEEK hero */}
        <div style={{ borderRadius: 16, background: V.card, border: `1px solid ${V.volt}`, padding: 14, boxShadow: "var(--sh-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ font: `700 11px/1 ${inter}`, letterSpacing: ".12em", color: V.voltText }}>THIS WEEK</div>
            <div style={{ font: `600 12px/1 ${mono}`, color: V.soft }}>{data.hero.done} / {data.hero.total} done</div>
          </div>
          <div style={{ font: `700 19px/1.3 ${sora}`, color: V.ink, marginTop: 8 }}>{data.hero.title}</div>
          <div style={{ height: 7, borderRadius: 4, background: V.card2, marginTop: 12 }}>
            <div style={{ width: `${pct}%`, height: 7, borderRadius: 4, background: V.volt }} />
          </div>
          <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft, marginTop: 9 }}>+{data.hero.xp} XP on completion · resets Sunday</div>
        </div>

        <SectionLabel>Active Missions</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {data.active.map((m) => {
            const chip = ACCENT_CHIP[m.accent];
            return (
              <Card key={m.slug} style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, opacity: m.done ? 0.62 : 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: m.done ? V.card2 : chip.bg, border: m.done ? "none" : `1px solid ${chip.border}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: `700 14px/1.25 ${sora}`, color: V.ink }}>{m.title}</div>
                  <div style={{ font: `400 11px/1.4 ${inter}`, color: V.soft }}>{m.sub}</div>
                </div>
                {m.done ? (
                  <span style={{ font: `700 12px/1 ${inter}`, color: V.green }}>Done</span>
                ) : (
                  <span style={{ padding: "7px 13px", borderRadius: 16, background: V.volt, color: "#fff", font: `700 11px/1 ${inter}` }}>Start</span>
                )}
              </Card>
            );
          })}
        </div>

        <SectionLabel>Streak Reward</SectionLabel>
        <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(140deg,#4A3416,#7A5420)", border: `1px solid ${V.volt}` }} />
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 14px/1.25 ${sora}`, color: V.ink }}>{data.streak.headline}</div>
            <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft, marginTop: 2 }}>{data.streak.sub}</div>
          </div>
        </Card>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ============================ 11 · LEADERBOARD ============================ */
export interface Ranked { rank: number; name: string; calls: number; acc: number; you?: boolean; }
const PODIUM_FOUNDING = [
  { name: "Dre", acc: 78, rank: 2, grad: "linear-gradient(140deg,#2E3A2C,#4A5C42)" },
  { name: "Simone", acc: 84, rank: 1, grad: "linear-gradient(140deg,#4A3416,#7A5420)" },
  { name: "Maya", acc: 76, rank: 3, grad: "linear-gradient(140deg,#4A2E2E,#6B4242)" },
];
const RANKS_FOUNDING: Ranked[] = [
  { rank: 4, name: "Alex Chen", calls: 128, acc: 74 },
  { rank: 5, name: "Tasha B.", calls: 96, acc: 73 },
  { rank: 6, name: "You", calls: 382, acc: 71, you: true },
  { rank: 7, name: "Marcus H.", calls: 214, acc: 69 },
  { rank: 8, name: "Junior", calls: 44, acc: 68 },
];
const AV_GRAD = ["linear-gradient(140deg,#2A3340,#3E4A5C)", "linear-gradient(140deg,#3A2E40,#54425C)", "linear-gradient(140deg,#3B3226,#5B4A34)", "linear-gradient(140deg,#243A32,#36564A)", "linear-gradient(140deg,#402E2E,#5C4242)"];

export function Leaderboard({
  podium = PODIUM_FOUNDING,
  ranks = RANKS_FOUNDING,
}: {
  podium?: typeof PODIUM_FOUNDING;
  ranks?: Ranked[];
}) {
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <Display size={26}>Leaderboard</Display>
        <Sub>Ranked by conviction accuracy, not luck</Sub>
      </div>
      <div style={{ ...PAD, paddingTop: 14 }}>
        <ChipRow>
          <Chip active>This month</Chip>
          <Chip>All time</Chip>
          <Chip>Rookies</Chip>
        </ChipRow>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Podium */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          {podium.map((p) => {
            const first = p.rank === 1;
            return (
              <div key={p.name} style={{ flex: first ? 1.15 : 1, textAlign: "center", padding: first ? "18px 8px" : "14px 8px", borderRadius: 14, background: first ? V.voltSoft : V.card, border: first ? `1px solid ${V.volt}` : `1px solid ${V.sand}` }}>
                <div style={{ width: first ? 52 : 42, height: first ? 52 : 42, margin: "0 auto", borderRadius: 26, background: p.grad, border: first ? `2px solid ${V.volt}` : "none" }} />
                <div style={{ font: `700 ${first ? 14 : 13}px/1.3 ${inter}`, color: V.ink, marginTop: 8 }}>{p.name}</div>
                <div style={{ font: `600 ${first ? 13 : 12}px/1.3 ${mono}`, color: first ? V.green : V.soft }}>{p.acc}%</div>
                <div style={{ font: `700 ${first ? 13 : 12}px/1 ${sora}`, color: first ? V.voltText : V.faint, marginTop: 6 }}>{p.rank}</div>
              </div>
            );
          })}
        </div>
        {/* Ranks */}
        <Card style={{ overflow: "hidden" }}>
          {ranks.map((r, i) => (
            <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", background: r.you ? V.voltSoft : "transparent", borderBottom: i < ranks.length - 1 ? `1px solid ${V.sand}` : "none" }}>
              <div style={{ width: 22, font: `${r.you ? 700 : 600} 13px/1 ${mono}`, color: r.you ? V.voltText : V.faint }}>{r.rank}</div>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: AV_GRAD[i % AV_GRAD.length], border: r.you ? `1.5px solid ${V.volt}` : "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `${r.you ? 700 : 600} 13px/1.2 ${inter}`, color: V.ink }}>{r.name}</div>
                <div style={{ font: `400 11px/1.3 ${inter}`, color: r.you ? V.soft : V.faint }}>{r.calls} calls rated</div>
              </div>
              <div style={{ font: `${r.you ? 700 : 600} 13px/1 ${mono}`, color: r.acc >= 70 ? V.green : V.soft }}>{r.acc}%</div>
            </div>
          ))}
        </Card>
        {/* How rank works */}
        <Card style={{ padding: 13 }}>
          <div style={{ font: `700 11px/1 ${sora}`, letterSpacing: ".12em", color: V.ink, textTransform: "uppercase" }}>How rank works</div>
          <div style={{ font: `400 12px/1.5 ${inter}`, color: V.soft, marginTop: 7 }}>Every call you rate is scored 30 days later. Accuracy is weighted by conviction, so loud wrong calls cost more than quiet ones.</div>
        </Card>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ======================= 12 · PRACTICE PORTFOLIO ======================= */
export interface Position { symbol: string; name: string; shares: string; value: string; change: string; up: boolean; }
const POSITIONS_FOUNDING: Position[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", shares: "64 sh · avg $141.20", value: "$11,099", change: "22.8%", up: true },
  { symbol: "HOOD", name: "Robinhood Markets", shares: "400 sh · avg $19.05", value: "$9,924", change: "30.2%", up: true },
  { symbol: "PLTR", name: "Palantir Technologies", shares: "300 sh · avg $25.80", value: "$6,648", change: "14.1%", up: false },
  { symbol: "ARM", name: "Arm Holdings", shares: "50 sh · avg $118.40", value: "$6,630", change: "12.0%", up: true },
];

export function PracticePortfolio({
  total = "$112,480",
  gain = "▲ $12,480 (+12.48%) all time",
  cash = "$18,240",
  equity = [8, 14, 10, 22, 16, 30, 26, 40, 34, 48, 44, 58, 66],
  positions = POSITIONS_FOUNDING,
  review = "You size winners well, but you cut them early.",
}: {
  total?: string; gain?: string; cash?: string; equity?: number[]; positions?: Position[]; review?: string;
}) {
  return (
    <Screen>
      <div style={{ padding: "0 18px" }}>
        <Display size={24}>Practice Portfolio</Display>
        <Sub>Paper money. Real habits.</Sub>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: 15, borderRadius: 16 }}>
          <div style={{ font: `400 12px/1 ${inter}`, color: V.soft }}>Total value</div>
          <div style={{ font: `600 34px/1.2 ${mono}`, color: V.ink }}>{total}</div>
          <div style={{ font: `600 13px/1.4 ${mono}`, color: V.green }}>{gain}</div>
          <div style={{ marginTop: 12 }}>
            <Spark points={equity} color={V.green} w={322} h={80} fill={V.greenSoft} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 18, background: V.volt, color: "#fff", font: `700 12px/1 ${inter}` }}>Buy</div>
            <div style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 18, border: `1px solid ${V.sand}`, color: V.ink, font: `700 12px/1 ${inter}` }}>Sell</div>
            <div style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 18, border: `1px solid ${V.sand}`, color: V.ink, font: `700 12px/1 ${inter}` }}>Reset</div>
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <SectionLabel>Positions</SectionLabel>
          <span style={{ font: `600 12px/1 ${inter}`, color: V.soft }}>Cash {cash}</span>
        </div>
        <Card style={{ overflow: "hidden" }}>
          {positions.map((p, i) => (
            <div key={p.symbol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderBottom: i < positions.length - 1 ? `1px solid ${V.sand}` : "none" }}>
              <Logo symbol={p.symbol} name={p.name} size={32} radius={9} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 14px/1.2 ${sora}`, color: V.ink }}>{p.symbol}</div>
                <div style={{ font: `400 11px/1.3 ${inter}`, color: V.faint }}>{p.shares}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ font: `600 13px/1.3 ${mono}`, color: V.ink }}>{p.value}</div>
                <div style={{ font: `600 11px/1 ${mono}`, color: p.up ? V.green : V.red }}>{p.up ? "▲" : "▼"} {p.change}</div>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, background: `linear-gradient(135deg, ${V.kaiSoft}, ${V.greenSoft})`, border: `1px solid color-mix(in srgb, var(--kai-blue) 35%, transparent)` }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 13px/1.2 ${sora}`, color: V.ink }}>Kai reviewed your week</div>
            <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft, marginTop: 2 }}>{review}</div>
          </div>
          <span style={{ color: V.ink }}>→</span>
        </div>
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}

/* ============================ 14 · ALERTS ============================ */
export type AlertKind = "signal" | "kai" | "person" | "event" | "neutral" | "level" | "badge";
export interface AlertRow { kind: AlertKind; title: string; sub: string; highlight?: boolean; }
const ICON_BG: Record<AlertKind, string> = {
  signal: "color-mix(in srgb, var(--cv-green) 16%, transparent)",
  kai: "var(--kai-blue-soft)",
  person: "linear-gradient(140deg,#4A2E2E,#6B4242)",
  event: "rgba(185,28,28,.14)",
  neutral: "color-mix(in srgb, var(--card) 70%, var(--sand))",
  level: "linear-gradient(140deg,#4A3416,#7A5420)",
  badge: "color-mix(in srgb, var(--card) 70%, var(--sand))",
};
const ALERTS_TODAY: AlertRow[] = [
  { kind: "signal", title: "NVDA triggered your momentum signal", sub: "Crossed $172.00 on 3.1× volume · 9:38 AM", highlight: true },
  { kind: "kai", title: "Kai finished your NVDA deep dive", sub: "Three catalysts, one risk flag · 9:31 AM" },
  { kind: "person", title: "Maya replied to your PLTR thesis", sub: "\"The margin story is the tell\" · 8:52 AM" },
  { kind: "event", title: "Live room starts in 20 minutes", sub: "Options Flow Masterclass · 8:40 AM" },
];
const ALERTS_YESTERDAY: AlertRow[] = [
  { kind: "neutral", title: "HOOD moved to Building", sub: "Accumulation pattern confirmed · 4:12 PM" },
  { kind: "level", title: "You unlocked Level 14", sub: "Market Maven · 360 XP to Level 15 · 2:05 PM" },
  { kind: "badge", title: "Weekly missions reset", sub: "Five new reps waiting · 9:00 AM" },
];

export function Alerts({
  today = ALERTS_TODAY,
  yesterday = ALERTS_YESTERDAY,
  count = 12,
}: {
  today?: AlertRow[]; yesterday?: AlertRow[]; count?: number;
}) {
  const Item = (a: AlertRow, i: number) => (
    <div key={i} style={{ display: "flex", gap: 11, padding: "12px 13px", borderRadius: 14, background: a.highlight ? V.voltSoft : V.card, border: a.highlight ? `1px solid ${V.volt}` : `1px solid ${V.sand}`, boxShadow: a.highlight ? "none" : "var(--sh-soft)" }}>
      <div style={{ width: 34, height: 34, borderRadius: a.kind === "person" ? 17 : 10, background: ICON_BG[a.kind], border: (a.kind === "signal" || a.kind === "kai" || a.kind === "event") ? "1px solid color-mix(in srgb, currentColor 30%, transparent)" : "none", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ font: `700 13px/1.3 ${inter}`, color: V.ink }}>{a.title}</div>
        <div style={{ font: `400 12px/1.4 ${inter}`, color: V.soft, marginTop: 2 }}>{a.sub}</div>
      </div>
    </div>
  );
  return (
    <Screen>
      <div style={{ padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Display size={26}>Alerts</Display>
        <span style={{ font: `600 12px/1 ${inter}`, color: V.voltText }}>Mark all read</span>
      </div>
      <div style={{ ...PAD, paddingTop: 14 }}>
        <ChipRow>
          <Chip active>All {count}</Chip>
          <Chip>Signals</Chip>
          <Chip>Club</Chip>
          <Chip>Kai</Chip>
        </ChipRow>
      </div>
      <div style={{ ...PAD, display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ font: `700 11px/1 ${inter}`, letterSpacing: ".12em", color: V.faint }}>TODAY</div>
        {today.map(Item)}
        <div style={{ font: `700 11px/1 ${inter}`, letterSpacing: ".12em", color: V.faint, marginTop: 6 }}>YESTERDAY</div>
        {yesterday.map(Item)}
      </div>
      <div style={{ height: 24 }} />
    </Screen>
  );
}
