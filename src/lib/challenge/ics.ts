/**
 * The challenge calendar, built from the DATABASE rather than from constants.
 *
 * `src/lib/free-class.ts` already ships a client-side .ics builder whose five
 * session times are hardcoded (`new Date("2026-09-02T23:00:00Z")` + i days). It
 * works, and it stays — but it cannot honour an owner who moves a date in
 * `challenge_days`. This builder takes the rows and emits the same calendar, so
 * the served file and the in-app countdown can never disagree.
 *
 * Server-side only (the route sets Content-Type + Content-Disposition), which
 * also means the file is fetchable by a mail client / calendar subscription,
 * not only by a browser that can build a Blob.
 */

export interface IcsSession {
  day_no: number;
  title: string;
  theme: string;
  session_at: string;
  session_minutes: number;
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps a content line at 75 octets; fold with CRLF + one space. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/**
 * Build the calendar for a cohort's sessions.
 *
 * Copy is capability-only — what you will be able to DO — with no income,
 * return or performance framing anywhere, matching the compliance floor the
 * existing challenge .ics already holds.
 */
export function buildChallengeIcsFromDays(
  sessions: IcsSession[],
  appUrl: string
): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cheat Code Club//5-Day Investing Challenge//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:5-Day Investing Challenge",
  ];

  for (const s of sessions) {
    const start = new Date(s.session_at);
    if (!Number.isFinite(start.getTime())) continue;
    const end = new Date(start.getTime() + (s.session_minutes || 60) * 60_000);
    const summary = `Day ${s.day_no} — ${s.title} (live)`;
    const description =
      `${s.theme}. Join us live at 7:00 PM ET — we work through it together in the room. ` +
      `Education only, practice money always.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:challenge-session-${s.day_no}-${start.getUTCFullYear()}@familyinvestingclub.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${esc(summary)}`),
      fold(`DESCRIPTION:${esc(description)}`),
      `URL:${appUrl}/challenge/hq`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(summary)}`),
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
