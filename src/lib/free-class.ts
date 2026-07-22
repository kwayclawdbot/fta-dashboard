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
