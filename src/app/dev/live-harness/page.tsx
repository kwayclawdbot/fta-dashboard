/**
 * Dev harness for LiveEventCard — renders all FIVE lifecycle states + the
 * LiveNowStrip in the Club register (data-mode="club" → volt accent). Static
 * mock data; no auth, no network. Used for the S2.5 pixel review / screenshots.
 * Additive + isolated (lane-owned route); not part of any product surface.
 */

import LiveEventCard, { LiveNowStrip } from "@/components/live/LiveEventCard";
import type { LiveEventCardData } from "@/lib/live/types";

export const dynamic = "force-static";

const HOST = { name: "Cheat Code Club", avatarUrl: null };

// Anchor "now" so the countdown is stable in the harness.
const IN_2_DAYS = new Date(Date.now() + 2 * 864e5).toISOString();
const IN_12_MIN = new Date(Date.now() + 12 * 60000).toISOString();
const HOUR_AGO = new Date(Date.now() - 60 * 60000).toISOString();

const STATES: { label: string; event: LiveEventCardData }[] = [
  {
    label: "scheduled",
    event: {
      id: "00000000-0000-4000-8000-000000000001",
      status: "scheduled",
      room_type: "class",
      title: "Day 1 — Your first practice watchlist",
      description:
        "Night one of the 5-Day Investing Challenge. We build your very first practice watchlist together — no experience needed.",
      tickers: [],
      host: HOST,
      viewer_count: 0,
      interested_count: 112,
      starts_at: IN_2_DAYS,
      ended_at: null,
      duration_min: 60,
      join_url: null,
      replay_url: null,
      interested: false,
    },
  },
  {
    label: "starting_soon",
    event: {
      id: "00000000-0000-4000-8000-000000000002",
      status: "starting_soon",
      room_type: "class",
      title: "Day 2 — Research with Kai",
      description: "We get to know one company together, with Kai.",
      tickers: ["NVDA", "AAPL"],
      host: HOST,
      viewer_count: 0,
      interested_count: 138,
      starts_at: IN_12_MIN,
      ended_at: null,
      duration_min: 60,
      join_url: "https://example.com/room",
      replay_url: null,
      interested: true,
    },
  },
  {
    label: "live",
    event: {
      id: "00000000-0000-4000-8000-000000000003",
      status: "live",
      room_type: "class",
      title: "Day 3 — The Community Watchlist",
      description: "We plug into what the room is watching, together.",
      tickers: ["TSLA", "AMD", "PLTR"],
      host: HOST,
      viewer_count: 74,
      interested_count: 160,
      starts_at: HOUR_AGO,
      ended_at: null,
      duration_min: 60,
      join_url: "https://example.com/room",
      replay_url: null,
      interested: true,
    },
  },
  {
    label: "ended (recap)",
    event: {
      id: "00000000-0000-4000-8000-000000000004",
      status: "ended",
      room_type: "class",
      title: "Day 4 — Screener & practice",
      description: "Find a name you'd never have thought of, then practice risk-free.",
      tickers: ["SOFI", "RKLB", "HOOD"],
      host: HOST,
      viewer_count: 0,
      interested_count: 155,
      starts_at: HOUR_AGO,
      ended_at: new Date().toISOString(),
      duration_min: 58,
      join_url: null,
      replay_url: null,
      kai_summary: null,
      top_questions: [
        { q: "How do I pick which screener filters matter?" },
        { q: "Is a paper-trade the same as practicing with real money?" },
      ],
      interested: false,
    },
  },
  {
    label: "replay_ready",
    event: {
      id: "00000000-0000-4000-8000-000000000005",
      status: "replay_ready",
      room_type: "class",
      title: "Day 5 — Putting it all together",
      description: "We connect the dots into a routine you keep.",
      tickers: ["SPY", "QQQ"],
      host: HOST,
      viewer_count: 0,
      interested_count: 171,
      starts_at: HOUR_AGO,
      ended_at: new Date().toISOString(),
      duration_min: 62,
      join_url: null,
      replay_url: "https://example.com/replay",
      kai_summary:
        "We closed the challenge by turning five nights of work into one weekly routine: refresh your watchlist Monday, research one name with Kai, check the community watchlist, screen for one fresh idea, then paper-trade it.",
      top_questions: [{ q: "What should my first week after the challenge look like?" }],
      interested: false,
    },
  },
];

export default function LiveHarnessPage() {
  return (
    <div data-mode="club" className="min-h-screen bg-paper p-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-[28px] font-bold text-ink">LiveEventCard</h1>
        <p className="mb-6 text-[13px] text-soft">
          All five lifecycle states + LiveNowStrip · Club register (volt)
        </p>

        <div className="mb-8">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-soft">
            LiveNowStrip (above-mode-strip)
          </div>
          <LiveNowStrip event={STATES[2].event} />
        </div>

        <div className="space-y-6">
          {STATES.map(({ label, event }) => (
            <div key={event.id}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-soft">
                {label}
              </div>
              <LiveEventCard event={event} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
