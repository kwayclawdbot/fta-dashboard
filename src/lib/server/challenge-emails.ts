/**
 * Challenge-pass lifecycle emails (Lane C7) — hand-built, framework-free,
 * email-client-safe HTML in the SAME visual system as the welcome drips
 * (src/lib/server/drip-templates.ts): warm-paper palette, 600px table shell,
 * bulletproof gold CTA, inline styles only.
 *
 * PURE renderers (no imports) so both the expiry cron and an owner-approval test
 * script can call them. Three kinds:
 *   warn_3d / warn_1d — friendly heads-up (no dark patterns): keep going at
 *     $99/mo OR drop to the free tier; progress/belts/watchlists all stay.
 *   expired — the pass has ended: one-tap continue at $99/mo, plus the FTA
 *     Challenge Offer ($1,500 = FTA lifetime + a year of Club).
 */

export type ChallengeEmailKind = "warn_3d" | "warn_1d" | "expired";

export interface ChallengeEmailCtx {
  firstName: string;
  /** Whole days remaining (3, 1, or 0). */
  daysLeft: number;
  appUrl: string; // https://app.familyinvestingclub.com
  continueUrl: string; // $99/mo Club checkout
  ftaUrl: string; // $1,500 FTA Challenge Offer checkout
  unsubUrl: string;
}

/* ── palette (mirrors drip-templates) ────────────────────────────────────── */

const C = {
  paper: "#FBF7EF",
  card: "#FFFFFF",
  ink: "#101828",
  soft: "#5B6472",
  faint: "#98A2B3",
  sand: "#EAE2D0",
  sandSoft: "#F3EDE1",
  accent: "#B45309",
  accentDark: "#92400E",
  accentSoft: "#FEF3C7",
  accentInk: "#7A3E06",
  green: "#047857",
  greenSoft: "#D1FAE5",
};
const CTA_GRADIENT = "linear-gradient(180deg,#C2610B 0%,#B45309 100%)";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cta(label: string, href: string, fill = C.accent, ink = "#FFFFFF"): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 0;">
    <tr>
      <td align="center" bgcolor="${fill}" style="border-radius:12px;background-color:${fill};background-image:${fill === C.accent ? CTA_GRADIENT : "none"};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:${ink};text-decoration:none;border-radius:12px;">
          ${esc(label)} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function keepPanel(): string {
  const item = (t: string) => `
    <tr><td style="padding:4px 0;font-family:${FONT};font-size:15px;color:${C.ink};">
      <span style="color:${C.green};font-weight:800;">&#10003;</span>&nbsp; ${esc(t)}
    </td></tr>`;
  return `
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.greenSoft};border:1px solid ${C.sand};border-radius:16px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.green};margin-bottom:6px;">Whatever you choose, you keep</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${item("Your XP and every belt you've earned")}
          ${item("Your watchlists and everything you've saved")}
          ${item("Your account, progress, and community profile")}
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
function divider(): string {
  return `<tr><td style="padding:20px 28px 0;"><div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`;
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
          <div style="font-family:${FONT};font-size:13px;color:${C.soft};margin-top:4px;">The 5-Day Investing Challenge</div>
          <div style="display:inline-block;margin-top:12px;padding:5px 12px;background-color:${C.accentSoft};border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;color:${C.accentInk};">${esc(badge)}</div>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:${C.card};border:1px solid ${C.sand};border-radius:22px;overflow:hidden;">
        <tr><td style="height:6px;line-height:6px;font-size:6px;background-color:${C.accent};background-image:${CTA_GRADIENT};">&nbsp;</td></tr>
        ${inner}
        <tr><td style="padding:26px 28px 30px;">
          <div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;margin-bottom:18px;">&nbsp;</div>
          <div style="font-family:${FONT};font-size:12px;color:${C.faint};line-height:1.7;">
            You're getting this because you joined the 5-Day Investing Challenge. We only send a couple of these around your challenge window.<br /><br />
            <strong style="color:${C.soft};">Cheat Code Club</strong><br />
            <a href="${unsubUrl}" target="_blank" style="color:${C.faint};text-decoration:underline;">Unsubscribe from challenge emails</a>
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

export interface RenderedChallengeEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderChallengeEmail(
  kind: ChallengeEmailKind,
  ctx: ChallengeEmailCtx
): RenderedChallengeEmail {
  const { firstName, daysLeft, continueUrl, ftaUrl, unsubUrl } = ctx;
  const name = firstName || "there";

  if (kind === "expired") {
    const subject = "Your challenge access has wrapped — here's how to keep going";
    const inner =
      sectionHead(`That's a wrap, ${esc(name)} 👏`) +
      paragraph(
        `Your 5-Day Investing Challenge access has ended, so your account has dropped to the free Cheat Code tier. No charge happened — we never put a card on file.`
      ) +
      paragraph(
        `If the habit stuck, keeping the full Club is one tap. And nothing you built is going anywhere:`
      ) +
      keepPanel() +
      ctaRow(cta("Continue the Club — $99/mo", continueUrl)) +
      divider() +
      sectionHead("Want to go all the way?") +
      paragraph(
        `The <strong>FTA Challenge Offer</strong> is <strong>$1,500 once</strong> — Family Trading Academy for life, <em>plus</em> a full year of the Club bundled in. It's the trade-ready track on top of everything you already know.`
      ) +
      ctaRow(cta("See the FTA offer — $1,500", ftaUrl, C.card, C.accent)) +
      paragraph(
        `<span style="font-size:13px;color:${C.faint};">No pressure either way — the free tier keeps your progress, belts, and watchlists for whenever you're ready.</span>`
      );
    return {
      subject,
      html: shell("Your challenge access has ended — keep the Club, or stay free.", "CHALLENGE COMPLETE", inner, unsubUrl),
      text: plain(
        subject,
        [
          `Hi ${name},`,
          "Your 5-Day Investing Challenge access has ended and your account moved to the free tier. No charge — we never put a card on file.",
          `Keep the full Club for $99/mo: ${continueUrl}`,
          `Go all the way — FTA Challenge Offer, $1,500 (FTA for life + a year of Club): ${ftaUrl}`,
          "Whatever you choose, your XP, belts, and watchlists all stay.",
        ],
        unsubUrl
      ),
    };
  }

  // warn_3d / warn_1d
  const dayWord =
    daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const subject =
    daysLeft <= 1
      ? "Your challenge access ends tomorrow"
      : `${daysLeft} days left in your challenge`;
  const inner =
    sectionHead(`${daysLeft <= 1 ? "Last day" : `${daysLeft} days to go`}, ${esc(name)}`) +
    paragraph(
      `Your 5-Day Investing Challenge access ends <strong>${dayWord}</strong>. When it does, your account simply drops to the free Cheat Code tier — no charge, no surprise, because there's no card on file.`
    ) +
    paragraph(
      `Loving it? Keep the full Club — Kai, the community, live classes, the screener, all of it — for $99/mo. Not ready? Do nothing and stay on the free tier. Either way:`
    ) +
    keepPanel() +
    ctaRow(cta("Keep the Club — $99/mo", continueUrl)) +
    paragraph(
      `<span style="font-size:13px;color:${C.faint};">No card was ever charged, and nothing auto-renews. This is just a friendly heads-up.</span>`
    );
  return {
    subject,
    html: shell(
      `Your challenge access ends ${dayWord} — keep the Club or stay free.`,
      daysLeft <= 1 ? "1 DAY LEFT" : `${daysLeft} DAYS LEFT`,
      inner,
      unsubUrl
    ),
    text: plain(
      subject,
      [
        `Hi ${name},`,
        `Your 5-Day Investing Challenge access ends ${dayWord}. When it does, your account drops to the free tier — no charge, no card on file.`,
        `Keep the full Club for $99/mo: ${continueUrl}`,
        "Either way, your XP, belts, and watchlists all stay.",
      ],
      unsubUrl
    ),
  };
}

/* ── shared checkout links (env-overridable) ─────────────────────────────── */

/** $99/mo Cheat Code Club (reuses the existing FIC product buy link). */
export const CLUB_CONTINUE_URL =
  process.env.CLUB_CONTINUE_URL?.trim() ||
  "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";

/** $1,500 FTA — Challenge Offer (FTA lifetime + 12mo Club). */
export const FTA_CHALLENGE_URL =
  process.env.FTA_CHALLENGE_URL?.trim() ||
  "https://buy.stripe.com/cNi28r0oHbxPdxacxBbEA0c";
