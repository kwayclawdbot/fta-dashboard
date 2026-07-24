/**
 * Free-class funnel shared helpers — types, the FIC purchase link, and a
 * hand-rolled ICS builder (no dependency; the confirmation page offers a
 * calendar download).
 */

/** FIC membership Stripe checkout — $99/mo. Mirrors upgrade/page.tsx FIC_URL. */
export const FIC_CHECKOUT_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";

export interface FreeClassSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  zoom_join_url: string | null;
}

export interface NextClassResponse {
  session: FreeClassSession | null;
  video_url: string | null;
  seats_left?: number | null;
  registered_count?: number | null;
}

/** Pretty date + time, e.g. "Tuesday, Jul 29 · 7:00 PM". */
export function formatClassWhen(iso: string | null): string {
  if (!iso) return "Time to be announced";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function icsStamp(d: Date): string {
  // UTC basic format: YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Build a downloadable .ics VEVENT for a free class. */
export function buildClassIcs(session: FreeClassSession): string {
  const start = session.scheduled_at ? new Date(session.scheduled_at) : new Date();
  const end = new Date(start.getTime() + (session.duration_min || 45) * 60 * 1000);
  const url = session.zoom_join_url || "";
  const desc = [session.description || "", url ? `Join: ${url}` : ""]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Investing Club//Free Class//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:free-class-${session.id}@familyinvestingclub.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(session.title || "Family Investing Club — Free Class")}`,
    desc ? `DESCRIPTION:${icsEscape(desc)}` : "",
    url ? `URL:${icsEscape(url)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Trigger a client-side .ics download for a session. */
export function downloadClassIcs(session: FreeClassSession): void {
  const blob = new Blob([buildClassIcs(session)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "family-investing-club-free-class.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// ── 5-Day Investing Challenge calendar (Lane C7 thank-you) ───────────────────
// Fixed cohort: kickoff Sept 1, 2026 at 9:30 AM ET (EDT = UTC-4 in September),
// then one daily mission each morning Sept 1–5. Mirrors app_settings
// challenge_start; kept as a constant so the thank-you .ics needs no round-trip.

/** Day-by-day mission themes (mirror the challenge_sequences day steps). */
const CHALLENGE_DAYS: { title: string; capability: string }[] = [
  { title: "Day 1 · Foundations", capability: "Learn how the market actually works." },
  { title: "Day 2 · Research with Kai", capability: "Look up any company and understand it." },
  { title: "Day 3 · Community Watchlist", capability: "Build a watchlist worth following." },
  { title: "Day 4 · Screener + practice", capability: "Find companies that fit what you look for." },
  { title: "Day 5 · Putting it together", capability: "Explain any position you hold, out loud." },
];

function challengeEventLines(
  uid: string,
  start: Date,
  end: Date,
  summary: string,
  description: string
): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@familyinvestingclub.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "URL:https://app.familyinvestingclub.com/dashboard",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/**
 * Build the challenge .ics: the Sept 1 kickoff plus the five daily missions.
 * `includeDailyMissions=false` emits only the kickoff event. Education-only copy
 * throughout — capability language, never any income/return framing.
 */
export function buildChallengeIcs(includeDailyMissions = true): string {
  // Sept 1, 2026 · 9:30 AM ET (EDT, UTC-4) → 13:30 UTC. 45-minute blocks.
  const kickoffStart = new Date("2026-09-01T13:30:00Z");
  const kickoffEnd = new Date(kickoffStart.getTime() + 45 * 60 * 1000);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Investing Club//5-Day Investing Challenge//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...challengeEventLines(
      "challenge-kickoff-2026",
      kickoffStart,
      kickoffEnd,
      "5-Day Investing Challenge — Day 1 kickoff",
      "The challenge begins. Your full Club access is already open — hop in and start Day 1. Education only; nothing here is financial advice."
    ),
  ];

  if (includeDailyMissions) {
    for (let i = 0; i < CHALLENGE_DAYS.length; i++) {
      // Same 9:30 AM ET slot, i days after Sept 1.
      const start = new Date(kickoffStart.getTime() + i * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 45 * 60 * 1000);
      const d = CHALLENGE_DAYS[i];
      lines.push(
        ...challengeEventLines(
          `challenge-day-${i + 1}-2026`,
          start,
          end,
          `${d.title} — 5-Day Investing Challenge`,
          `${d.capability} Do today's mission inside the Club. Education only, practice money always.`
        )
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a client-side .ics download for the challenge calendar. */
export function downloadChallengeIcs(includeDailyMissions = true): void {
  const blob = new Blob([buildChallengeIcs(includeDailyMissions)], {
    type: "text/calendar;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "5-day-investing-challenge.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
