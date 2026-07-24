/**
 * FTA year-1 Club-clock lifecycle emails (migration 127) — hand-built,
 * framework-free, email-client-safe HTML in the SAME visual system as the
 * challenge + welcome drips (warm-paper palette, 600px table shell, bulletproof
 * gold CTA, inline styles only). PURE renderers (no imports) so both the cron
 * and an owner-approval test script can call them.
 *
 * The honest promise, in every kind: Family Trading Academy access is KEPT FOR
 * LIFE. Only the bundled 12-month Cheat Code Club membership is ending, and it
 * continues at $99/mo if the member wants Kai, the community, the watchlist,
 * alerts and the screener. No dark patterns, no "you'll lose everything".
 *   warn_14d — Club window closes in ~2 weeks
 *   warn_3d  — Club window closes in ~3 days
 *   lapsed   — window has closed; academy intact, Club is one tap at $99
 */

export type ClubClockEmailKind = "warn_14d" | "warn_3d" | "lapsed";

export interface ClubClockEmailCtx {
  firstName: string;
  /** Whole days remaining (14, 3, or 0). */
  daysLeft: number;
  appUrl: string; // https://app.familyinvestingclub.com
  continueUrl: string; // $99/mo Club checkout
  unsubUrl: string;
}

/* ── palette (mirrors challenge-emails / drip-templates) ─────────────────── */

const C = {
  paper: "#FBF7EF",
  card: "#FFFFFF",
  ink: "#101828",
  soft: "#5B6472",
  faint: "#98A2B3",
  sand: "#EAE2D0",
  accent: "#B45309",
  accentInk: "#7A3E06",
  accentSoft: "#FEF3C7",
  green: "#047857",
  greenSoft: "#D1FAE5",
};
const CTA_GRADIENT = "linear-gradient(180deg,#C2610B 0%,#B45309 100%)";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cta(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 0;">
    <tr>
      <td align="center" bgcolor="${C.accent}" style="border-radius:12px;background-color:${C.accent};background-image:${CTA_GRADIENT};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:12px;">
          ${esc(label)} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

/** The reassurance panel: what the member KEEPS for life, no matter what. */
function keepPanel(): string {
  const item = (t: string) => `
    <tr><td style="padding:4px 0;font-family:${FONT};font-size:15px;color:${C.ink};">
      <span style="color:${C.green};font-weight:800;">&#10003;</span>&nbsp; ${esc(t)}
    </td></tr>`;
  return `
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.greenSoft};border:1px solid ${C.sand};border-radius:16px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.green};margin-bottom:6px;">Yours for life — nothing changes here</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${item("The full Family Trading Academy — every course & module")}
          ${item("Every live-class recording, forever")}
          ${item("The FTA community room and your coach")}
          ${item("Your XP, belts, and everything you've saved")}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function paragraph(html: string): string {
  return `<tr><td style="padding:10px 28px 0;font-family:${FONT};font-size:16px;color:${C.soft};line-height:1.65;">${html}</td></tr>`;
}
function sectionHead(text: string): string {
  return `<tr><td style="padding:20px 28px 0;font-family:${FONT};font-size:22px;font-weight:800;color:${C.ink};line-height:1.3;">${esc(text)}</td></tr>`;
}
function ctaRow(inner: string): string {
  return `<tr><td align="center" style="padding:22px 28px 4px;">${inner}</td></tr>`;
}

function shell(preheader: string, badge: string, inner: string, unsubUrl: string): string {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Cheat Code Club</title>
  <!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.paper};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};font-size:1px;line-height:1px;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.paper};">
    <tr><td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
        <tr><td align="center" style="padding:4px 0 18px;">
          <div style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-.01em;color:${C.ink};">Cheat Code Club</div>
          <div style="font-family:${FONT};font-size:13px;color:${C.soft};margin-top:4px;">Family Trading Academy</div>
          <div style="display:inline-block;margin-top:12px;padding:5px 12px;background-color:${C.accentSoft};border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;color:${C.accentInk};">${esc(badge)}</div>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:${C.card};border:1px solid ${C.sand};border-radius:22px;overflow:hidden;">
        <tr><td style="height:6px;line-height:6px;font-size:6px;background-color:${C.accent};background-image:${CTA_GRADIENT};">&nbsp;</td></tr>
        ${inner}
        <tr><td style="padding:26px 28px 30px;">
          <div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;margin-bottom:18px;">&nbsp;</div>
          <div style="font-family:${FONT};font-size:12px;color:${C.faint};line-height:1.7;">
            You're getting this because your Family Trading Academy purchase included 12 months of the Cheat Code Club. We only send a couple of these around that window.<br /><br />
            <strong style="color:${C.soft};">Cheat Code Club</strong><br />
            <a href="${unsubUrl}" target="_blank" style="color:${C.faint};text-decoration:underline;">Unsubscribe from these emails</a>
          </div>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
        <tr><td align="center" style="padding:18px 8px 0;font-family:${FONT};font-size:11px;color:${C.faint};">
          &copy; ${new Date().getFullYear()} Cheat Code Club. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function plain(subject: string, lines: string[], unsubUrl: string): string {
  return `${subject}\n\n${lines.join("\n\n")}\n\n—\nCheat Code Club\nUnsubscribe: ${unsubUrl}\n`;
}

export interface RenderedClubClockEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderClubClockEmail(
  kind: ClubClockEmailKind,
  ctx: ClubClockEmailCtx
): RenderedClubClockEmail {
  const { firstName, daysLeft, continueUrl, unsubUrl } = ctx;
  const name = firstName || "there";

  if (kind === "lapsed") {
    const subject = "Your Academy is still yours — here's how the Club continues";
    const inner =
      sectionHead(`Your Academy access is safe, ${esc(name)}`) +
      paragraph(
        `The 12 months of Cheat Code Club that came bundled with your Family Trading Academy have wrapped. Here's the important part: <strong>your Academy access doesn't end — it's yours for life.</strong> Every course, every recording, the FTA room, all of it stays exactly where it is.`
      ) +
      paragraph(
        `What paused is the Club layer on top — Kai, the member community, the watchlist, trade alerts and the screener. If those were part of your routine, keeping them going is one tap at $99/mo.`
      ) +
      keepPanel() +
      ctaRow(cta("Keep your Club membership — $99/mo", continueUrl)) +
      paragraph(
        `<span style="font-size:13px;color:${C.faint};">No pressure — your Academy, progress and belts are all still here whether or not you continue the Club.</span>`
      );
    return {
      subject,
      html: shell(
        "Your FTA Academy access stays for life. The Club continues at $99/mo.",
        "ACADEMY: KEPT FOR LIFE",
        inner,
        unsubUrl
      ),
      text: plain(
        subject,
        [
          `Hi ${name},`,
          "The 12 months of Cheat Code Club bundled with your Family Trading Academy have ended. Your Academy access does NOT end — it's yours for life (every course, recording, and the FTA room).",
          "What paused is the Club layer: Kai, the community, the watchlist, alerts and the screener.",
          `Keep the Club going for $99/mo: ${continueUrl}`,
          "Your Academy, progress and belts stay either way.",
        ],
        unsubUrl
      ),
    };
  }

  // warn_14d / warn_3d
  const dayWord =
    daysLeft <= 1
      ? "tomorrow"
      : daysLeft <= 3
        ? `in ${daysLeft} days`
        : "in about two weeks";
  const subject =
    kind === "warn_3d"
      ? "Your bundled Club year ends in a few days (your Academy stays)"
      : "A heads-up on your Club year (your Academy stays for life)";
  const inner =
    sectionHead(
      kind === "warn_3d" ? `A few days to go, ${esc(name)}` : `Quick heads-up, ${esc(name)}`
    ) +
    paragraph(
      `The 12 months of Cheat Code Club that came with your Family Trading Academy end <strong>${dayWord}</strong>. When they do, <strong>your Academy access keeps going for life</strong> — nothing there changes.`
    ) +
    paragraph(
      `The only thing that pauses is the Club layer: Kai, the community, the watchlist, trade alerts and the screener. Want to keep those? Continue the Club for $99/mo. Rather just keep the Academy? Do nothing — it stays yours.`
    ) +
    keepPanel() +
    ctaRow(cta("Keep the Club — $99/mo", continueUrl)) +
    paragraph(
      `<span style="font-size:13px;color:${C.faint};">There's no card on file for the Club and nothing auto-renews. This is just an honest heads-up.</span>`
    );
  return {
    subject,
    html: shell(
      `Your bundled Club year ends ${dayWord} — your Academy stays for life.`,
      kind === "warn_3d" ? "CLUB YEAR ENDING" : "CLUB YEAR REMINDER",
      inner,
      unsubUrl
    ),
    text: plain(
      subject,
      [
        `Hi ${name},`,
        `The 12 months of Cheat Code Club bundled with your Family Trading Academy end ${dayWord}. Your Academy access keeps going for life — nothing there changes.`,
        "What pauses is the Club layer: Kai, the community, the watchlist, alerts and the screener.",
        `Keep the Club going for $99/mo: ${continueUrl}`,
        "No card on file, nothing auto-renews — just a heads-up.",
      ],
      unsubUrl
    ),
  };
}
