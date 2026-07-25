/**
 * Welcome-drip email templates (Lane 13B) — hand-built, framework-free,
 * email-client-safe HTML.
 *
 * DESIGN CONTRACT (why this file has no imports):
 *   These renderers are PURE. They take primitive strings/numbers and return
 *   {subject, html, text}. That keeps them importable from BOTH the Next cron
 *   route (real sends) and a standalone test script (owner-approval sends)
 *   without dragging in the app runtime, the @ alias, or the belt libs. The
 *   cron computes the D7 merge stats (xp / belt label / lessons) with the real
 *   libraries and passes the finished strings in via `ctx.stats`.
 *
 * VISUAL SYSTEM (the owner's "visually robust, engaging" bar):
 *   - Table-based, 600px max, inline styles only (Gmail / Apple Mail / Outlook
 *     tolerable). Bulletproof CTA buttons; images width-capped + display:block.
 *   - Warm-paper brand palette (page #FBF7EF, card #FFFFFF, ink #101828, gold
 *     #B45309). A per-variant accent bar + accent CTA reinforce the identity.
 *   - Dark-mode meta hints; explicit bg/color on every cell so an inverting
 *     client can't wash the layout out.
 *   - Alternating image/text feature blocks reusing the marketing screenshots
 *     hosted under the app's /email/ path.
 *
 * VARIANTS:
 *   parent — family-with-kids framing (amber accent).
 *   solo   — individual adult; no "family" language (blue accent).
 *   fta    — Family Trading Academy tier; gold accents + FTA-hub features.
 */

export type DripVariant = "parent" | "solo" | "fta";
export type DripStep = 0 | 1 | 3 | 5 | 7;

export const DRIP_STEPS: readonly DripStep[] = [0, 1, 3, 5, 7] as const;

export interface DripStats {
  xp: number;
  beltLabel: string; // e.g. "Yellow Belt" / "Blue Belt II"
  lessons: number;
}

export interface DripCtx {
  firstName: string;
  appUrl: string; // canonical origin, no trailing slash (https://app.familyinvestingclub.com)
  unsubUrl: string;
  stats?: DripStats; // required for D7
}

/* ── palette + per-variant theme ─────────────────────────────────────────── */

const C = {
  paper: "#FBF7EF",
  card: "#FFFFFF",
  ink: "#101828",
  soft: "#5B6472",
  faint: "#98A2B3",
  sand: "#EAE2D0",
  sandSoft: "#F3EDE1",
};

interface Theme {
  accent: string; // primary accent + CTA fill
  accentDark: string; // gradient end / hover feel
  accentSoft: string; // chip bg
  accentInk: string; // text on soft chip
  onAccent: string; // text on filled CTA
  brandLine1: string;
  brandLine2: string;
  badge: string;
  ctaGradient: string; // background-image for CTA (Outlook falls back to accent)
}

const THEMES: Record<DripVariant, Theme> = {
  parent: {
    accent: "#B45309",
    accentDark: "#92400E",
    accentSoft: "#FEF3C7",
    accentInk: "#7A3E06",
    onAccent: "#FFFFFF",
    brandLine1: "Family Investing Club",
    brandLine2: "Where families learn to invest — together",
    badge: "FAMILY MEMBERSHIP",
    ctaGradient: "linear-gradient(180deg,#C2610B 0%,#B45309 100%)",
  },
  solo: {
    accent: "#2563EB",
    accentDark: "#1D4ED8",
    accentSoft: "#E0F2FE",
    accentInk: "#0C4A6E",
    onAccent: "#FFFFFF",
    brandLine1: "Cheat Code Club",
    brandLine2: "Your seat at the table starts now",
    badge: "MEMBER",
    ctaGradient: "linear-gradient(180deg,#2F6BF0 0%,#2563EB 100%)",
  },
  fta: {
    accent: "#B45309",
    accentDark: "#92400E",
    accentSoft: "#FDF3D6",
    accentInk: "#7A3E06",
    onAccent: "#1A1204",
    brandLine1: "Family Trading Academy",
    brandLine2: "The trade-ready track",
    badge: "FTA",
    ctaGradient: "linear-gradient(180deg,#F5C24B 0%,#E0A11E 55%,#B45309 100%)",
  },
};

/* ── low-level builders ──────────────────────────────────────────────────── */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Bulletproof, rounded CTA. Outlook shows a solid accent rectangle (no radius). */
function cta(t: Theme, label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 0;">
    <tr>
      <td align="center" bgcolor="${t.accent}" style="border-radius:12px;background-color:${t.accent};background-image:${t.ctaGradient};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:${t.onAccent};text-decoration:none;border-radius:12px;">
          ${esc(label)} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

/** Small inline text link (accent). */
function textLink(t: Theme, label: string, href: string): string {
  return `<a href="${href}" target="_blank" style="color:${t.accent};font-weight:600;text-decoration:none;">${esc(label)} &rsaquo;</a>`;
}

/** A screenshot rendered inside a soft "phone" frame, centered. */
function shot(appUrl: string, file: string, alt: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td style="padding:8px;background-color:${C.sandSoft};border:1px solid ${C.sand};border-radius:20px;">
        <img src="${appUrl}/email/${file}" width="220" alt="${esc(alt)}" style="display:block;width:220px;max-width:220px;height:auto;border-radius:14px;border:1px solid ${C.sand};" />
      </td>
    </tr>
  </table>`;
}

/**
 * An alternating feature block: screenshot on one side, copy on the other.
 * On narrow clients the two cells stack (align + width fallbacks keep it sane).
 */
function feature(
  t: Theme,
  appUrl: string,
  opts: {
    file: string;
    alt: string;
    imageSide: "left" | "right";
    kicker: string;
    heading: string;
    body: string;
    link?: { label: string; href: string };
  }
): string {
  const img = `<td width="248" valign="top" style="padding:0 0 16px;">${shot(appUrl, opts.file, opts.alt)}</td>`;
  const copy = `
    <td valign="top" style="padding:6px 8px 16px;font-family:${FONT};">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${t.accent};margin:0 0 6px;">${esc(opts.kicker)}</div>
      <div style="font-size:19px;font-weight:800;color:${C.ink};line-height:1.25;margin:0 0 8px;">${esc(opts.heading)}</div>
      <div style="font-size:15px;color:${C.soft};line-height:1.6;margin:0 0 10px;">${opts.body}</div>
      ${opts.link ? `<div style="font-size:15px;">${textLink(t, opts.link.label, opts.link.href)}</div>` : ""}
    </td>`;
  const cells = opts.imageSide === "left" ? img + copy : copy + img;
  return `
  <tr><td style="padding:4px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>${cells}</tr>
    </table>
  </td></tr>`;
}

/** Section heading row inside the card. */
function sectionHead(text: string): string {
  return `<tr><td style="padding:20px 28px 0;font-family:${FONT};font-size:22px;font-weight:800;color:${C.ink};line-height:1.3;">${esc(text)}</td></tr>`;
}

function paragraph(html: string): string {
  return `<tr><td style="padding:10px 28px 0;font-family:${FONT};font-size:16px;color:${C.soft};line-height:1.65;">${html}</td></tr>`;
}

function ctaRow(t: Theme, label: string, href: string): string {
  return `<tr><td align="center" style="padding:22px 28px 4px;">${cta(t, label, href)}</td></tr>`;
}

function divider(): string {
  return `<tr><td style="padding:22px 28px 0;"><div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`;
}

/* ── D7 live-stats panel ─────────────────────────────────────────────────── */

function statsPanel(t: Theme, stats: DripStats): string {
  const cell = (value: string, label: string) => `
    <td width="33.33%" align="center" valign="top" style="padding:14px 6px;">
      <div style="font-family:${FONT};font-size:26px;font-weight:800;color:${t.accent};line-height:1;">${esc(value)}</div>
      <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${C.faint};margin-top:6px;">${esc(label)}</div>
    </td>`;
  return `
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${t.accentSoft};border:1px solid ${C.sand};border-radius:16px;">
      <tr>
        ${cell(String(stats.xp), "XP earned")}
        ${cell(stats.beltLabel, "Your belt")}
        ${cell(String(stats.lessons), stats.lessons === 1 ? "lesson done" : "lessons done")}
      </tr>
    </table>
  </td></tr>`;
}

/* ── page shell ──────────────────────────────────────────────────────────── */

function shell(t: Theme, preheader: string, inner: string, ctx: DripCtx): string {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${esc(t.brandLine1)}</title>
  <!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.paper};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};font-size:1px;line-height:1px;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.paper};">
    <tr><td align="center" style="padding:28px 12px 40px;">

      <!-- header / wordmark -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
        <tr><td align="center" style="padding:4px 0 18px;">
          <div style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-.01em;color:${C.ink};">
            ${esc(t.brandLine1)}
          </div>
          <div style="font-family:${FONT};font-size:13px;color:${C.soft};margin-top:4px;">${esc(t.brandLine2)}</div>
          <div style="display:inline-block;margin-top:12px;padding:5px 12px;background-color:${t.accentSoft};border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;color:${t.accentInk};">${esc(t.badge)}</div>
        </td></tr>
      </table>

      <!-- card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:${C.card};border:1px solid ${C.sand};border-radius:22px;overflow:hidden;">
        <!-- belt-color accent bar -->
        <tr><td style="height:6px;line-height:6px;font-size:6px;background-color:${t.accent};background-image:${t.ctaGradient};">&nbsp;</td></tr>
        ${inner}
        <!-- footer -->
        <tr><td style="padding:26px 28px 30px;">
          <div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;margin-bottom:18px;">&nbsp;</div>
          <div style="font-family:${FONT};font-size:12px;color:${C.faint};line-height:1.7;">
            You're getting this because you just created your ${esc(t.brandLine1)} account. These few welcome notes help you get the most out of your first week — then they stop.<br /><br />
            <strong style="color:${C.soft};">${esc(t.brandLine1)}</strong><br />
            Mailing address on file &middot; <em>[physical address to be added]</em><br /><br />
            <a href="${ctx.unsubUrl}" target="_blank" style="color:${C.faint};text-decoration:underline;">Unsubscribe from welcome emails</a>
          </div>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
        <tr><td align="center" style="padding:18px 8px 0;font-family:${FONT};font-size:11px;color:${C.faint};">
          &copy; ${new Date().getFullYear()} ${esc(t.brandLine1)}. All rights reserved.
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/* ── plaintext fallback ──────────────────────────────────────────────────── */

function plain(subject: string, lines: string[], ctx: DripCtx): string {
  return (
    `${subject}\n\n` +
    lines.join("\n\n") +
    `\n\n—\nCheat Code Club\nUnsubscribe: ${ctx.unsubUrl}\n`
  );
}

/* ── per-step content ────────────────────────────────────────────────────── */

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function homeShot(v: DripVariant): { file: string; alt: string } {
  return v === "parent"
    ? { file: "parent-light-dashboard.png", alt: "Your family dashboard" }
    : { file: "teen-light-dashboard.png", alt: "Your dashboard" };
}

function you(v: DripVariant, family: string, individual: string): string {
  return v === "parent" ? family : individual;
}

function step0(v: DripVariant, ctx: DripCtx): Rendered {
  const t = THEMES[v];
  const url = ctx.appUrl;
  const hs = homeShot(v);
  const subject =
    v === "fta"
      ? "Welcome to Family Trading Academy — start here"
      : v === "parent"
        ? "Welcome to the Family Investing Club — your first 10 minutes"
        : "Welcome in — your first 10 minutes";
  const intro = you(
    v,
    `You're in. Over the next week we'll walk you and your family through the parts of the platform that make investing click. But first — the ten minutes that matter most.`,
    `You're in. Over the next week we'll walk you through the parts of the platform that make investing click. But first — the ten minutes that matter most.`
  );

  const inner =
    sectionHead(`Welcome, ${esc(ctx.firstName)} 👋`) +
    paragraph(intro) +
    ctaRow(t, "Take the 2-minute tour", `${url}/dashboard`) +
    divider() +
    feature(t, url, {
      file: "teen-light-watchlist.png",
      alt: "Community Watchlist",
      imageSide: "left",
      kicker: "Do this first",
      heading: "Add a name to the Watchlist",
      body: you(
        v,
        `The Community Watchlist is where members — and their kids — track the companies they're curious about, together. Pick one you already know.`,
        `The Community Watchlist is where members track the companies they're curious about. Pick one you already know and add it.`
      ),
      link: { label: "Open the Watchlist", href: `${url}/watchlist` },
    }) +
    feature(t, url, {
      file: hs.file,
      alt: hs.alt,
      imageSide: "right",
      kicker: "Say hi to Kai",
      heading: "Ask your first question",
      body: `Kai is your always-on guide. Ask it anything — "what is a stock?", "explain this chart" — in plain language, no jargon.`,
      link: { label: "Ask Kai", href: `${url}/kai` },
    }) +
    ctaRow(t, "Jump into the app", `${url}/dashboard`);

  return {
    subject,
    html: shell(t, "Your first 10 minutes inside the club.", inner, ctx),
    text: plain(
      subject,
      [
        `Welcome, ${ctx.firstName}!`,
        intro.replace(/<[^>]+>/g, ""),
        `Take the tour: ${url}/dashboard`,
        `Add to the Community Watchlist: ${url}/watchlist`,
        `Ask Kai your first question: ${url}/kai`,
      ],
      ctx
    ),
  };
}

function step1(v: DripVariant, ctx: DripCtx): Rendered {
  const t = THEMES[v];
  const url = ctx.appUrl;
  const subject =
    v === "fta"
      ? "Meet Kai — your trading co-pilot"
      : "Meet Kai — the guide who never gets tired of your questions";

  const inner =
    sectionHead(`Get comfortable asking, ${esc(ctx.firstName)}`) +
    paragraph(
      you(
        v,
        `The families who get the most out of the club treat Kai like a patient tutor for the whole household. There are no dumb questions here.`,
        `The members who get the most out of the club treat Kai like a patient tutor. There are no dumb questions here.`
      )
    ) +
    feature(t, url, {
      file: "teen-light-community.png",
      alt: "Ask Kai anything",
      imageSide: "left",
      kicker: "Meet Kai",
      heading: "Your always-on investing tutor",
      body: `Stuck on a term? Curious why a stock moved? Kai explains it at your level and remembers where you left off.`,
      link: { label: "Chat with Kai", href: `${url}/kai` },
    }) +
    feature(t, url, {
      file: "teen-light-chart.png",
      alt: "Research pages",
      imageSide: "right",
      kicker: "Go deeper",
      heading: "Research any company",
      body: `Every ticker has a clean research page — the story, the chart, the numbers that matter — written to be understood, not to show off.`,
      link: { label: "Explore Research", href: `${url}/research` },
    }) +
    ctaRow(t, "Ask Kai something today", `${url}/kai`);

  return {
    subject,
    html: shell(t, "Kai explains anything, at your level.", inner, ctx),
    text: plain(
      subject,
      [
        `Hi ${ctx.firstName},`,
        `Kai is your always-on investing tutor — ask it anything: ${url}/kai`,
        `Research any company in plain language: ${url}/research`,
      ],
      ctx
    ),
  };
}

function step3(v: DripVariant, ctx: DripCtx): Rendered {
  const t = THEMES[v];
  const url = ctx.appUrl;
  const subject =
    v === "fta"
      ? "The community moves fast — here's how to keep up"
      : "You're not doing this alone";

  const inner =
    sectionHead(`Come meet everyone, ${esc(ctx.firstName)}`) +
    paragraph(
      you(
        v,
        `Thousands of families are learning right alongside you — sharing picks, wins, and questions. Jump into the conversation.`,
        `You're joining a room full of people learning right alongside you — sharing picks, wins, and questions. Jump in.`
      )
    ) +
    feature(t, url, {
      file: "teen-light-community.png",
      alt: "Community feed",
      imageSide: "left",
      kicker: "Community",
      heading: "See what members are watching",
      body: you(
        v,
        `The feed is where families post ideas and cheer each other on. Introduce yourself — a first post breaks the ice.`,
        `The feed is where members post ideas and cheer each other on. Introduce yourself — a first post breaks the ice.`
      ),
      link: { label: "Open the Community", href: `${url}/community` },
    }) +
    feature(t, url, {
      file: "teen-light-leaderboard.png",
      alt: "Belts and leaderboard",
      imageSide: "right",
      kicker: "Earn your belts",
      heading: "White belt to black belt",
      body: `Every lesson, quiz, and pick earns XP that moves you up the belt ladder — White, Yellow, Blue, Purple, Black. Watch where you land.`,
      link: { label: "See the leaderboard", href: `${url}/leaderboard` },
    }) +
    ctaRow(t, "Join the conversation", `${url}/community`);

  return {
    subject,
    html: shell(t, "Meet the members and earn your first belt.", inner, ctx),
    text: plain(
      subject,
      [
        `Hi ${ctx.firstName},`,
        `Meet the community and introduce yourself: ${url}/community`,
        `Earn XP and climb the belt ladder: ${url}/leaderboard`,
      ],
      ctx
    ),
  };
}

function step5(v: DripVariant, ctx: DripCtx): Rendered {
  const t = THEMES[v];
  const url = ctx.appUrl;
  const subject =
    v === "fta"
      ? "Screen the market, then practice the trade"
      : "Find ideas, then practice — with zero risk";

  const inner =
    sectionHead(`Time to practice, ${esc(ctx.firstName)}`) +
    paragraph(
      `Reading is one thing. Doing is another. These two tools let you find real ideas and practice acting on them — without a dollar at stake.`
    ) +
    feature(t, url, {
      file: "teen-light-missions.png",
      alt: "The screener",
      imageSide: "left",
      kicker: "The Screener",
      heading: "Find companies that fit",
      body: `Filter the whole market down to names that match what you care about — size, sector, momentum. It's how the pros find candidates.`,
      link: { label: "Open the Screener", href: `${url}/screener` },
    }) +
    feature(t, url, {
      file: "teen-light-games.png",
      alt: "Simbot practice",
      imageSide: "right",
      kicker: "Simbot",
      heading: "Practice trades, risk-free",
      body: you(
        v,
        `Simbot lets everyone in the family rehearse buying and selling in realistic scenarios — build the instinct before any real money is involved.`,
        `Simbot lets you rehearse buying and selling in realistic scenarios — build the instinct before any real money is involved.`
      ),
      link: { label: "Practice with Simbot", href: `${url}/simulator/simbot` },
    }) +
    ctaRow(t, "Run your first screen", `${url}/screener`);

  return {
    subject,
    html: shell(t, "Find ideas with the screener, practice with Simbot.", inner, ctx),
    text: plain(
      subject,
      [
        `Hi ${ctx.firstName},`,
        `Find ideas with the Screener: ${url}/screener`,
        `Practice risk-free with Simbot: ${url}/simulator/simbot`,
      ],
      ctx
    ),
  };
}

function step7(v: DripVariant, ctx: DripCtx): Rendered {
  const t = THEMES[v];
  const url = ctx.appUrl;
  const stats: DripStats = ctx.stats ?? { xp: 0, beltLabel: "White Belt", lessons: 0 };
  const subject =
    v === "fta"
      ? `Week one done — ${stats.xp} XP and counting`
      : `Your first week, ${ctx.firstName} — look how far you've come`;

  const ftaBlock =
    v === "fta"
      ? feature(t, url, {
          file: "teen-light-chart.png",
          alt: "FTA hub",
          imageSide: "left",
          kicker: "Your FTA hub",
          heading: "The trade-ready track is open",
          body: `As an FTA member you've got the full academy — deeper courses, live sessions, and the trade-ready playbook. Pick up where the fundamentals leave off.`,
          link: { label: "Open the FTA hub", href: `${url}/fta` },
        })
      : "";

  const nextBlock = feature(t, url, {
    file: "teen-light-leaderboard.png",
    alt: "What's next",
    imageSide: v === "fta" ? "right" : "left",
    kicker: "What's next",
    heading: "Keep the streak going",
    body: you(
      v,
      `Aim for the next belt this week. A lesson a day with the family, one Watchlist add, one Simbot session — small reps, real progress.`,
      `Aim for the next belt this week. A lesson a day, one Watchlist add, one Simbot session — small reps, real progress.`
    ),
    link: { label: "See your progress", href: `${url}/progress` },
  });

  const inner =
    sectionHead(`One week in, ${esc(ctx.firstName)} 🎉`) +
    paragraph(
      `Here's what you've built so far. Every point of it came from showing up — keep it going.`
    ) +
    statsPanel(t, stats) +
    ftaBlock +
    nextBlock +
    ctaRow(t, "Continue your journey", `${url}/dashboard`);

  return {
    subject,
    html: shell(t, `You've earned ${stats.xp} XP — here's what's next.`, inner, ctx),
    text: plain(
      subject,
      [
        `Hi ${ctx.firstName},`,
        `One week in: ${stats.xp} XP · ${stats.beltLabel} · ${stats.lessons} lesson${stats.lessons === 1 ? "" : "s"} done.`,
        `Keep the streak going — see your progress: ${url}/progress`,
      ],
      ctx
    ),
  };
}

/* ── public API ──────────────────────────────────────────────────────────── */

export function renderDrip(
  step: DripStep,
  variant: DripVariant,
  ctx: DripCtx
): Rendered {
  switch (step) {
    case 0:
      return step0(variant, ctx);
    case 1:
      return step1(variant, ctx);
    case 3:
      return step3(variant, ctx);
    case 5:
      return step5(variant, ctx);
    case 7:
      return step7(variant, ctx);
    default:
      throw new Error(`unknown drip step ${step}`);
  }
}
