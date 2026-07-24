/**
 * Challenge cohort email machine (Lane C8 part 3) — the DEDICATED sequence for
 * 5-Day Investing Challenge members (enrollments.program='challenge_pass').
 *
 * Framework-free, email-client-safe HTML in the same visual system as the 13B
 * welcome drips (warm-paper palette, 600px table shell, bulletproof CTAs, inline
 * styles only) — extended with the Cheat Code Club orange→teal energy (the top
 * strip and section rails run a warm-to-teal gradient) where it stays tasteful.
 *
 * PURE renderers (no imports) so the register route, the daily cron, and a test
 * batch script can all call them. Brand voice: "we're smarter together"; Kai is
 * "not to replace human judgment — to multiply it"; education-first; NO income
 * or return promises anywhere.
 *
 * Steps (see CHALLENGE_STEPS / the schedule in challenge-sequence.ts):
 *   welcome        instant, on challenge registration
 *   aug_watchlist  Aug activation — community watchlist
 *   aug_kai        Aug activation — Ask Kai + research pages
 *   aug_screener   Aug activation — screener + alerts
 *   aug_belts      Aug activation — belts + leaderboard
 *   show_d3        show-up — 3 days out
 *   show_d1        show-up — 1 day out
 *   show_dayof     show-up — day-of orientation
 *   day1..day5     daily mission emails (Sept 1-5)
 *   close_stats    close — "what you built this week" (live stats merge)
 *   close_offer    close — $99 continue + $1,500 FTA offer
 *   close_lastcall close — warm last call after expiry
 */

export type ChallengeStep =
  | "welcome"
  | "aug_watchlist"
  | "aug_kai"
  | "aug_screener"
  | "aug_belts"
  | "show_d3"
  | "show_d1"
  | "show_dayof"
  | "day1"
  | "day2"
  | "day3"
  | "day4"
  | "day5"
  | "close_stats"
  | "close_offer"
  | "close_lastcall";

/** Live member stats, merged at send time (close_stats only needs them). */
export interface ChallengeStats {
  xp: number;
  beltLabel: string; // e.g. "Yellow Belt"
  rules: number; // alert rules created
  posts: number; // community posts
}

export interface ChallengeSeqCtx {
  firstName: string;
  appUrl: string; // https://app.familyinvestingclub.com
  unsubUrl: string;
  continueUrl: string; // $99/mo Club checkout (close_offer)
  ftaUrl: string; // $1,500 FTA Challenge Offer checkout (close_offer)
  stats?: ChallengeStats; // required for close_stats
}

/* ── palette (mirrors drip-templates, + teal energy accent) ───────────────── */

const C = {
  paper: "#FBF7EF",
  card: "#FFFFFF",
  ink: "#101828",
  soft: "#5B6472",
  faint: "#98A2B3",
  sand: "#EAE2D0",
  sandSoft: "#F3EDE1",
  accent: "#B45309", // club orange
  accentDark: "#92400E",
  accentSoft: "#FEF3C7",
  accentInk: "#7A3E06",
  teal: "#0D9488", // club teal
  tealSoft: "#CCFBF1",
  tealInk: "#0F766E",
  green: "#047857",
  greenSoft: "#D1FAE5",
};
const CTA_GRADIENT = "linear-gradient(180deg,#C2610B 0%,#B45309 100%)";
const TEAL_CTA_GRADIENT = "linear-gradient(180deg,#14B8A6 0%,#0D9488 100%)";
/** The signature club energy: warm orange → teal, used on the top strip. */
const ENERGY_BAR = "linear-gradient(90deg,#C2610B 0%,#B45309 45%,#0D9488 100%)";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── low-level builders ──────────────────────────────────────────────────── */

function cta(label: string, href: string, variant: "orange" | "teal" = "orange"): string {
  const fill = variant === "teal" ? C.teal : C.accent;
  const grad = variant === "teal" ? TEAL_CTA_GRADIENT : CTA_GRADIENT;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 0;">
    <tr>
      <td align="center" bgcolor="${fill}" style="border-radius:12px;background-color:${fill};background-image:${grad};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:12px;">
          ${esc(label)} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

/** Ghost (outline) CTA — used for the secondary offer link. */
function ctaGhost(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 0;">
    <tr>
      <td align="center" style="border-radius:12px;border:1.5px solid ${C.accent};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:${C.accent};text-decoration:none;">
          ${esc(label)} &nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function sectionHead(text: string): string {
  return `<tr><td style="padding:20px 28px 0;font-family:${FONT};font-size:22px;font-weight:800;color:${C.ink};line-height:1.3;">${text}</td></tr>`;
}
function paragraph(html: string): string {
  return `<tr><td style="padding:10px 28px 0;font-family:${FONT};font-size:16px;color:${C.soft};line-height:1.65;">${html}</td></tr>`;
}
function ctaRow(inner: string): string {
  return `<tr><td align="center" style="padding:22px 28px 4px;">${inner}</td></tr>`;
}
function divider(): string {
  return `<tr><td style="padding:20px 28px 0;"><div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`;
}

/** A labelled callout rail — the surface spotlight card (orange or teal tint). */
function rail(kicker: string, heading: string, body: string, tint: "orange" | "teal" = "orange"): string {
  const bg = tint === "teal" ? C.tealSoft : C.accentSoft;
  const ink = tint === "teal" ? C.tealInk : C.accentInk;
  return `
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${bg};border:1px solid ${C.sand};border-radius:16px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${ink};margin-bottom:6px;">${esc(kicker)}</div>
        <div style="font-family:${FONT};font-size:18px;font-weight:800;color:${C.ink};line-height:1.3;margin-bottom:6px;">${esc(heading)}</div>
        <div style="font-family:${FONT};font-size:15px;color:${C.soft};line-height:1.6;">${body}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

/** A compact "day N of 5" progress strip for the daily mission emails. */
function dayStrip(active: number): string {
  const cells = [1, 2, 3, 4, 5]
    .map((n) => {
      const on = n <= active;
      const bg = n === active ? C.accent : on ? C.accentSoft : C.sandSoft;
      const col = n === active ? "#FFFFFF" : on ? C.accentInk : C.faint;
      return `<td width="20%" align="center" style="padding:0 3px;">
        <div style="font-family:${FONT};font-size:13px;font-weight:800;color:${col};background-color:${bg};border:1px solid ${C.sand};border-radius:10px;padding:9px 0;">Day ${n}</div>
      </td>`;
    })
    .join("");
  return `<tr><td style="padding:18px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells}</tr></table>
  </td></tr>`;
}

/** Live-stats panel for the close recap (XP / belt / rules / posts). */
function statsPanel(stats: ChallengeStats): string {
  const cell = (value: string, label: string) => `
    <td width="25%" align="center" valign="top" style="padding:14px 4px;">
      <div style="font-family:${FONT};font-size:24px;font-weight:800;color:${C.accent};line-height:1;">${esc(value)}</div>
      <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${C.faint};margin-top:6px;">${esc(label)}</div>
    </td>`;
  return `
  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.accentSoft};border:1px solid ${C.sand};border-radius:16px;">
      <tr>
        ${cell(String(stats.xp), "XP earned")}
        ${cell(stats.beltLabel, "Your belt")}
        ${cell(String(stats.rules), stats.rules === 1 ? "alert" : "alerts")}
        ${cell(String(stats.posts), stats.posts === 1 ? "post" : "posts")}
      </tr>
    </table>
  </td></tr>`;
}

/* ── page shell ──────────────────────────────────────────────────────────── */

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
        <tr><td style="height:6px;line-height:6px;font-size:6px;background-color:${C.accent};background-image:${ENERGY_BAR};">&nbsp;</td></tr>
        ${inner}
        <tr><td style="padding:26px 28px 30px;">
          <div style="height:1px;background-color:${C.sand};line-height:1px;font-size:1px;margin-bottom:18px;">&nbsp;</div>
          <div style="font-family:${FONT};font-size:12px;color:${C.faint};line-height:1.7;">
            You're getting this because you joined the 5-Day Investing Challenge. This is education, not financial advice — no income or return is promised. We only send these around your challenge window.<br /><br />
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
  return `${subject}\n\n${lines.join("\n\n")}\n\n—\nCheat Code Club\nThis is education, not financial advice — no income or return is promised.\nUnsubscribe: ${unsubUrl}\n`;
}

export interface RenderedChallengeSeq {
  subject: string;
  html: string;
  text: string;
}

/* ── the sequence ────────────────────────────────────────────────────────── */

export function renderChallengeSequenceEmail(
  step: ChallengeStep,
  ctx: ChallengeSeqCtx
): RenderedChallengeSeq {
  const { appUrl: u, unsubUrl, continueUrl, ftaUrl } = ctx;
  const name = ctx.firstName || "there";

  switch (step) {
    /* ── 1. REGISTRATION WELCOME (instant) ──────────────────────────────── */
    case "welcome": {
      const subject = "You're in — your Club access starts NOW";
      const inner =
        sectionHead(`Welcome in, ${esc(name)} 🎉`) +
        paragraph(
          `You just claimed your seat in the <strong>5-Day Investing Challenge</strong>. The live challenge kicks off <strong>September 1</strong> — but here's the part most people miss: <strong>your full Cheat Code Club access is on right now.</strong> No card, no waiting.`
        ) +
        paragraph(
          `We're smarter together, and the members who show up early walk into Day 1 already comfortable. So let's spend your first ten minutes well:`
        ) +
        rail(
          "Do this first",
          "Take the 2-minute tour",
          `See where everything lives — the watchlist, Kai, the screener, the community. <a href="${u}/dashboard" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">Open your dashboard &rsaquo;</a>`,
          "orange"
        ) +
        rail(
          "Then",
          "Add one name to the Community Watchlist",
          `Pick a company you already know and add it to the shared watchlist. <a href="${u}/watchlist" target="_blank" style="color:${C.teal};font-weight:700;text-decoration:none;">Open the watchlist &rsaquo;</a>`,
          "teal"
        ) +
        rail(
          "And say hi to Kai",
          "Ask Kai one question",
          `Kai is our AI analyst — there not to replace your judgment, but to multiply it. Ask it anything about a company you're curious about. <a href="${u}/kai" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">Ask Kai &rsaquo;</a>`,
          "orange"
        ) +
        ctaRow(cta("Start exploring the Club", `${u}/dashboard`)) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">We'll send you a short note each week in August to help you get the most out of it, then a mission each morning of the challenge. See you in there.</span>`
        );
      return {
        subject,
        html: shell("Your Club access is already on — here's your first 10 minutes.", "YOU'RE IN", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "You're in the 5-Day Investing Challenge. The live challenge starts September 1 — but your full Cheat Code Club access is ON right now. No card, no waiting.",
            `First 10 minutes:\n• Take the 2-min tour: ${u}/dashboard\n• Add a name to the Community Watchlist: ${u}/watchlist\n• Ask Kai a question (our AI analyst — multiplies your judgment, never replaces it): ${u}/kai`,
            "We're smarter together. See you in there.",
          ],
          unsubUrl
        ),
      };
    }

    /* ── 2. AUGUST ACTIVATION (weekly) ──────────────────────────────────── */
    case "aug_watchlist": {
      const subject = "The Community Watchlist is where it starts";
      const inner =
        sectionHead(`${esc(name)}, meet the room 👋`) +
        paragraph(
          `The heart of the Club is the <strong>Community Watchlist</strong> — a shared, living board of the companies members are watching, why they're watching them, and how they're doing. It's the "we're smarter together" idea made real.`
        ) +
        rail(
          "This week's move",
          "Add a company and a one-line reason",
          `You don't need a thesis — just a reason you're curious. Seeing why other members added theirs is where the learning compounds.`,
          "teal"
        ) +
        paragraph(
          `Every name on the board carries a live performance tracker, so you learn to read how an idea actually plays out over time — not just the moment someone got excited about it.`
        ) +
        ctaRow(cta("Open the Community Watchlist", `${u}/watchlist`, "teal")) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Adding names and reactions earns XP toward your belt, too — more on that in a couple of weeks.</span>`
        );
      return {
        subject,
        html: shell("A shared, living board of what members are watching — add one name.", "AUGUST · WEEK 1", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "The heart of the Club is the Community Watchlist — a shared board of what members are watching and why. We're smarter together.",
            `Add a company and a one-line reason (no thesis needed): ${u}/watchlist`,
            "Every name carries a live performance tracker, so you learn how ideas actually play out.",
          ],
          unsubUrl
        ),
      };
    }

    case "aug_kai": {
      const subject = "Meet Kai — your research partner";
      const inner =
        sectionHead(`${esc(name)}, this changes how you research`) +
        paragraph(
          `<strong>Kai</strong> is the Club's AI analyst. The whole point of Kai is <em>not</em> to replace your judgment — it's to multiply it. You bring the questions and the common sense; Kai brings the speed and the reach.`
        ) +
        rail(
          "Try this",
          "Ask Kai about a company you already know",
          `"What does this company actually do, and what should a beginner watch?" Then read the research page for the same ticker and compare notes.`,
          "orange"
        ) +
        paragraph(
          `Each company has a full <strong>research page</strong> — plain-English breakdowns, the numbers that matter, and recent news — built so a first-timer and a veteran can both get value from the same screen.`
        ) +
        ctaRow(cta("Ask Kai a question", `${u}/kai`)) +
        paragraph(
          `Prefer to browse first? <a href="${u}/research" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">Open the research pages &rsaquo;</a>`
        );
      return {
        subject,
        html: shell("Kai multiplies your judgment — it never replaces it. Ask it something.", "AUGUST · WEEK 2", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Kai is the Club's AI analyst — there not to replace your judgment but to multiply it.",
            `Ask Kai about a company you already know: ${u}/kai`,
            `Then compare with its research page: ${u}/research`,
          ],
          unsubUrl
        ),
      };
    }

    case "aug_screener": {
      const subject = "Find your next idea with the Screener";
      const inner =
        sectionHead(`${esc(name)}, go from "what do I look at?" to a shortlist`) +
        paragraph(
          `The <strong>Screener</strong> is how you stop staring at a blank page. Filter the market down to companies that fit what you care about — size, sector, momentum — and turn a universe of thousands into a handful worth a closer look.`
        ) +
        rail(
          "This week's move",
          "Run one screen, save one name",
          `Start with a preset, tweak a single filter, and send anything interesting to your watchlist. That's the whole loop: screen → research → watch.`,
          "orange"
        ) +
        paragraph(
          `See something you'd want to know about later? Set an <strong>alert</strong> right from the screener or a research page — a price level, a preset match — and the Club watches it for you.`
        ) +
        ctaRow(cta("Open the Screener", `${u}/screener`)) +
        paragraph(
          `Manage everything you're tracking in the <a href="${u}/alerts" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">Alerts hub &rsaquo;</a>`
        );
      return {
        subject,
        html: shell("Turn a universe of thousands into a shortlist worth your time.", "AUGUST · WEEK 3", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "The Screener turns thousands of companies into a shortlist that fits what you care about.",
            `Run one screen and save one name to your watchlist: ${u}/screener`,
            `Set an alert so the Club watches a level for you: ${u}/alerts`,
          ],
          unsubUrl
        ),
      };
    }

    case "aug_belts": {
      const subject = "Your belt is a map of what you've learned";
      const inner =
        sectionHead(`${esc(name)}, level up before Day 1`) +
        paragraph(
          `Everything you do in the Club earns <strong>XP</strong> — lessons, watchlist activity, asking Kai, showing up. XP moves you up the <strong>belt system</strong>, a simple map of how far you've come from White Belt onward.`
        ) +
        rail(
          "Friendly nudge",
          "Check where you rank",
          `The leaderboard isn't about beating anyone — it's a picture of an active, learning community. Seeing it is a great reason to do one more thing today.`,
          "teal"
        ) +
        paragraph(
          `Members who arrive at the challenge already carrying a belt or two find Day 1 feels like a warm-up instead of a cold start. There's still plenty of August left to earn one.`
        ) +
        ctaRow(cta("See the leaderboard", `${u}/leaderboard`, "teal")) +
        paragraph(
          `Track your own XP and belt anytime on your <a href="${u}/progress" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">progress page &rsaquo;</a>`
        );
      return {
        subject,
        html: shell("XP, belts, and a leaderboard that celebrates an active community.", "AUGUST · WEEK 4", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Everything you do in the Club earns XP, which moves you up the belt system — a simple map of how far you've come.",
            `See the leaderboard: ${u}/leaderboard`,
            `Track your own XP and belt: ${u}/progress`,
            "Arrive at the challenge already carrying a belt and Day 1 feels like a warm-up.",
          ],
          unsubUrl
        ),
      };
    }

    /* ── 3. SHOW-UP SEQUENCE ────────────────────────────────────────────── */
    case "show_d3": {
      const subject = "3 days out — let's get you ready";
      const inner =
        sectionHead(`${esc(name)}, the challenge starts Monday, Sept 1`) +
        paragraph(
          `Three days to go. Here's the shape of the week — five mornings, one clear mission each, all inside the product you already have access to:`
        ) +
        rail(
          "The week ahead",
          "Foundations → Research → Community → Practice → Putting it together",
          `Day 1 lays the groundwork. Day 2 you research with Kai. Day 3 you work the community watchlist. Day 4 you screen and practice. Day 5 you pull it all together.`,
          "orange"
        ) +
        paragraph(
          `Nothing to buy, nothing to install. Just show up each morning, do the day's mission, and lean on the community when you're stuck — that's the whole method.`
        ) +
        ctaRow(cta("Warm up in the Club", `${u}/dashboard`)) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Tip: add Sept 1–5 mornings to your calendar now. Showing up is 80% of it.</span>`
        );
      return {
        subject,
        html: shell("Five mornings, one mission each — here's the week ahead.", "3 DAYS TO GO", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Three days until the 5-Day Investing Challenge (starts Mon, Sept 1).",
            "The arc: Day 1 foundations, Day 2 research with Kai, Day 3 community watchlist, Day 4 screener + practice, Day 5 putting it all together.",
            `Warm up now: ${u}/dashboard`,
            "Add Sept 1–5 mornings to your calendar — showing up is 80% of it.",
          ],
          unsubUrl
        ),
      };
    }

    case "show_d1": {
      const subject = "Tomorrow: Day 1 of the challenge";
      const inner =
        sectionHead(`It's almost here, ${esc(name)}`) +
        paragraph(
          `Tomorrow morning the <strong>5-Day Investing Challenge</strong> begins. You'll get one short email each day with that day's mission and a direct link to do it.`
        ) +
        rail(
          "Day 1 preview",
          "Foundations — the vocabulary that unlocks everything else",
          `We start with the handful of ideas that make every other day make sense. Fifteen focused minutes, no prior experience needed.`,
          "orange"
        ) +
        paragraph(
          `Two things tonight: make sure you can log in, and decide <em>when</em> tomorrow you'll do your mission. A specific time beats "sometime today" every time.`
        ) +
        ctaRow(cta("Make sure you can log in", `${u}/dashboard`)) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">See you in the morning. We're smarter together.</span>`
        );
      return {
        subject,
        html: shell("Day 1 starts tomorrow — here's what it covers.", "1 DAY TO GO", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Tomorrow the 5-Day Investing Challenge begins. Each day you'll get one short email with that day's mission and a direct link.",
            "Day 1 is Foundations — the vocabulary that unlocks everything else. ~15 focused minutes.",
            `Tonight: confirm you can log in (${u}/dashboard) and decide WHEN tomorrow you'll do your mission.`,
            "See you in the morning.",
          ],
          unsubUrl
        ),
      };
    }

    case "show_dayof": {
      const subject = "It's here — the challenge starts today";
      const inner =
        sectionHead(`Day 1 is live, ${esc(name)} 🚀`) +
        paragraph(
          `The <strong>5-Day Investing Challenge</strong> officially starts today. Over the next five mornings you'll build a real, repeatable way to look at the market — one mission at a time.`
        ) +
        dayStrip(1) +
        paragraph(
          `Your Day 1 mission email is landing shortly with the exact link. Between now and then, pop into the community and say you're starting — the room is more fun when you're in it.`
        ) +
        ctaRow(cta("Say hi in the community", `${u}/community`, "teal")) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Remember: this is education, not advice. We're building judgment, not chasing tips.</span>`
        );
      return {
        subject,
        html: shell("Day 1 is live — your mission link is on its way.", "DAY 1 · IT'S HERE", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "The 5-Day Investing Challenge starts today. Five mornings, one mission each — you'll build a real, repeatable way to look at the market.",
            `Your Day 1 mission email is landing shortly. Meanwhile, say you're starting in the community: ${u}/community`,
            "This is education, not advice — we're building judgment, not chasing tips.",
          ],
          unsubUrl
        ),
      };
    }

    /* ── 4. DAILY CHALLENGE MISSIONS (Sept 1-5) ─────────────────────────── */
    case "day1": {
      const subject = "Day 1 mission: Foundations";
      const inner =
        sectionHead(`Day 1 — Foundations`) +
        dayStrip(1) +
        paragraph(
          `Welcome to Day 1, ${esc(name)}. Today is about the ground floor: the handful of ideas that make everything else this week click. Skip these and later days feel like guesswork; nail them and the rest falls into place.`
        ) +
        rail(
          "Today's mission (~15 min)",
          "Complete the Foundations lesson in Start Here",
          `Work through the first lesson track, then write one sentence in the community: the single idea that finally clicked for you.`,
          "orange"
        ) +
        ctaRow(cta("Start Day 1", `${u}/start-here`)) +
        paragraph(
          `Stuck on a term? <a href="${u}/kai" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">Ask Kai to explain it like you're new &rsaquo;</a> — that's exactly what it's for.`
        );
      return {
        subject,
        html: shell("The ground-floor ideas that make the whole week click.", "DAY 1 OF 5", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Day 1 — Foundations. Hi ${name},`,
            "Today is the ground floor: the handful of ideas that make everything else this week click.",
            `Mission (~15 min): complete the Foundations lesson in Start Here, then post the one idea that clicked. ${u}/start-here`,
            `Stuck on a term? Ask Kai to explain it like you're new: ${u}/kai`,
          ],
          unsubUrl
        ),
      };
    }

    case "day2": {
      const subject = "Day 2 mission: Research with Kai";
      const inner =
        sectionHead(`Day 2 — Research with Kai`) +
        dayStrip(2) +
        paragraph(
          `Nice work yesterday, ${esc(name)}. Today you turn curiosity into understanding. You'll pick one company and actually get to know it — with Kai speeding up the boring parts so you can focus on the thinking.`
        ) +
        rail(
          "Today's mission (~15 min)",
          "Research one company with Kai + its research page",
          `Pick a company you use in real life. Ask Kai three questions about it, then open its research page and see what you'd add or push back on. Kai multiplies your judgment — you're still the one deciding.`,
          "orange"
        ) +
        ctaRow(cta("Research with Kai", `${u}/kai`)) +
        paragraph(
          `Then open the numbers side by side: <a href="${u}/research" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">the research pages &rsaquo;</a>`
        );
      return {
        subject,
        html: shell("Pick one company and actually get to know it — with Kai on your team.", "DAY 2 OF 5", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Day 2 — Research with Kai. Hi ${name},`,
            "Today you turn curiosity into understanding: pick one company you use in real life.",
            `Mission (~15 min): ask Kai three questions about it (${u}/kai), then compare with its research page (${u}/research).`,
            "Kai multiplies your judgment — you're still the one deciding.",
          ],
          unsubUrl
        ),
      };
    }

    case "day3": {
      const subject = "Day 3 mission: The Community Watchlist";
      const inner =
        sectionHead(`Day 3 — The Community Watchlist`) +
        dayStrip(3) +
        paragraph(
          `Halfway, ${esc(name)}. Today is the "we're smarter together" day. Yesterday you learned to research one company alone — today you plug into what the whole room is watching, and add your own.`
        ) +
        rail(
          "Today's mission (~15 min)",
          "Add your company to the Community Watchlist — with your reason",
          `Post the company you researched yesterday, with a one-line reason. Then read three other members' picks and react to the one that taught you something.`,
          "teal"
        ) +
        ctaRow(cta("Open the Community Watchlist", `${u}/watchlist`, "teal")) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Watch how the performance tracker updates over the coming days — that feedback loop is the whole point.</span>`
        );
      return {
        subject,
        html: shell("Plug into what the room is watching — and add your own.", "DAY 3 OF 5", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Day 3 — The Community Watchlist. Hi ${name},`,
            "Today is the 'we're smarter together' day.",
            `Mission (~15 min): add the company you researched to the watchlist with a one-line reason, then react to three other members' picks. ${u}/watchlist`,
            "Watch the performance tracker update over the coming days — that feedback loop is the point.",
          ],
          unsubUrl
        ),
      };
    }

    case "day4": {
      const subject = "Day 4 mission: Screen & practice";
      const inner =
        sectionHead(`Day 4 — Screener & practice`) +
        dayStrip(4) +
        paragraph(
          `Day 4, ${esc(name)}. So far you've researched names you already knew. Today you learn to <em>find</em> new ones — and practice acting on an idea with zero real money at risk.`
        ) +
        rail(
          "Today's mission (~15 min)",
          "Run a screen, then practice in the simulator",
          `Use the Screener to surface a company you'd never have thought of. Add it to your watchlist, then open the simulator and place a practice trade to feel the mechanics — no real money, all learning.`,
          "orange"
        ) +
        ctaRow(cta("Open the Screener", `${u}/screener`)) +
        paragraph(
          `Then practice risk-free in the <a href="${u}/simulator" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">simulator &rsaquo;</a>`
        );
      return {
        subject,
        html: shell("Find a name you'd never have thought of — then practice, risk-free.", "DAY 4 OF 5", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Day 4 — Screener & practice. Hi ${name},`,
            "Today you learn to FIND new ideas and practice acting on one with zero real money at risk.",
            `Mission (~15 min): run a screen (${u}/screener), add a surprising name to your watchlist, then place a practice trade in the simulator (${u}/simulator).`,
          ],
          unsubUrl
        ),
      };
    }

    case "day5": {
      const subject = "Day 5 mission: Putting it all together";
      const inner =
        sectionHead(`Day 5 — Putting it all together`) +
        dayStrip(5) +
        paragraph(
          `Final day, ${esc(name)} 👏. This week you learned the foundations, researched with Kai, joined the community watchlist, and practiced in the screener and simulator. Today you connect the dots into a routine you can actually repeat.`
        ) +
        rail(
          "Today's mission (~15 min)",
          "Run your own end-to-end loop",
          `Screen → research with Kai → add to the watchlist with a reason → set one alert. That five-step loop is the whole method, and now it's yours. Post in the community what you'll keep doing after this week.`,
          "teal"
        ) +
        ctaRow(cta("Run your loop", `${u}/screener`, "teal")) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Tonight we'll send you a recap of everything you built this week — keep an eye out.</span>`
        );
      return {
        subject,
        html: shell("Connect the dots into a routine you can repeat for good.", "DAY 5 OF 5", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Day 5 — Putting it all together. Hi ${name},`,
            "Today you connect the dots into a repeatable routine.",
            `Mission (~15 min): run your own loop — screen (${u}/screener) → research with Kai → add to watchlist with a reason → set one alert. Then post what you'll keep doing.`,
            "Tonight we'll send a recap of everything you built this week.",
          ],
          unsubUrl
        ),
      };
    }

    /* ── 5. CLOSE SEQUENCE ──────────────────────────────────────────────── */
    case "close_stats": {
      const stats = ctx.stats ?? { xp: 0, beltLabel: "White Belt", rules: 0, posts: 0 };
      const subject = "Look what you built this week";
      const inner =
        sectionHead(`That's a wrap, ${esc(name)} 🎉`) +
        paragraph(
          `Five days ago you started the challenge. Look at what you actually did — not a promise, not a projection, just your real activity this week:`
        ) +
        statsPanel(stats) +
        paragraph(
          `Every one of those came from showing up. You learned to research a company, read the community, screen for new ideas, and practice without risk — a real, repeatable way to think about the market.`
        ) +
        rail(
          "The honest part",
          "This is a skill, and skills compound",
          `Nobody becomes a confident investor in five days. What you built is the habit and the toolkit. Whether you continue with us or not, keep the loop going.`,
          "teal"
        ) +
        ctaRow(cta("See your full progress", `${u}/progress`, "teal")) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Tomorrow we'll share how to keep your Club access if you'd like to — no pressure, no card was ever on file.</span>`
        );
      return {
        subject,
        html: shell("Your real stats from the week — XP, belt, alerts, posts.", "CHALLENGE RECAP", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            `Five days ago you started. Your real activity this week: ${stats.xp} XP · ${stats.beltLabel} · ${stats.rules} alert(s) · ${stats.posts} post(s).`,
            "You learned to research, read the community, screen for ideas, and practice risk-free — a real, repeatable method.",
            `See your full progress: ${u}/progress`,
            "Nobody becomes a confident investor in five days — what you built is the habit and the toolkit. Tomorrow: how to keep your access if you'd like.",
          ],
          unsubUrl
        ),
      };
    }

    case "close_offer": {
      const subject = "Keep going? Here are your two paths";
      const inner =
        sectionHead(`${esc(name)}, your challenge access ends today`) +
        paragraph(
          `Your free challenge pass wraps up today. Because we never put a card on file, nothing charges and nothing renews — your account simply drops to the free tier unless you choose to continue. And whatever you choose, your XP, belts, watchlists, and posts all stay.`
        ) +
        divider() +
        rail(
          "Path 1 — Keep the Club",
          "Everything you used this week, for $99/mo",
          `Kai, the community watchlist, the screener, alerts, live classes, belts — the whole room, month to month. Cancel anytime; no surprises, ever.`,
          "orange"
        ) +
        ctaRow(cta("Continue the Club — $99/mo", continueUrl)) +
        divider() +
        rail(
          "Path 2 — Go all the way",
          "The FTA Challenge Offer — $1,500 once",
          `Family Trading Academy for life, plus a full year of the Club bundled in. It's the trade-ready track built on top of everything you just learned. (Club renews at $99/mo after the bundled year.)`,
          "teal"
        ) +
        ctaRow(ctaGhost("See the FTA offer — $1,500", ftaUrl)) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">No pressure either way. The free tier keeps everything you built for whenever you're ready. This is education, not financial advice.</span>`
        );
      return {
        subject,
        html: shell("Two ways to keep going — or stay free and keep everything you built.", "KEEP GOING", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Your free challenge pass ends today. No card was on file, so nothing charges — your account just drops to free unless you continue. Either way, your XP, belts, watchlists, and posts all stay.",
            `Path 1 — Keep the full Club for $99/mo (cancel anytime): ${continueUrl}`,
            `Path 2 — The FTA Challenge Offer, $1,500 once: Family Trading Academy for life + a year of Club bundled (Club renews $99/mo after): ${ftaUrl}`,
            "No pressure — the free tier keeps everything you built. This is education, not financial advice.",
          ],
          unsubUrl
        ),
      };
    }

    case "close_lastcall": {
      const subject = "One last note — and a door that stays open";
      const inner =
        sectionHead(`No hard sell, ${esc(name)}`) +
        paragraph(
          `Your challenge access ended a couple of days ago and your account is on the free tier now — exactly as promised, with nothing charged. This is just a warm last note, not a countdown.`
        ) +
        paragraph(
          `If the week stuck with you and you've been meaning to keep going, both doors are still open whenever you're ready:`
        ) +
        rail(
          "Whenever you're ready",
          "Continue the Club or step up to FTA",
          `The Club is $99/mo, cancel anytime. The FTA Challenge Offer is $1,500 once (FTA for life + a year of Club). No rush — they'll be here.`,
          "orange"
        ) +
        ctaRow(cta("Continue the Club — $99/mo", continueUrl)) +
        paragraph(
          `Curious about the trade-ready track instead? <a href="${ftaUrl}" target="_blank" style="color:${C.accent};font-weight:700;text-decoration:none;">See the FTA offer &rsaquo;</a>`
        ) +
        paragraph(
          `<span style="font-size:13px;color:${C.faint};">Either way, thank you for spending your week with us. Everything you built stays on your free account. We're smarter together — hope to see you around.</span>`
        );
      return {
        subject,
        html: shell("Your pass has ended — no charge, and the door stays open.", "LAST CALL", inner, unsubUrl),
        text: plain(
          subject,
          [
            `Hi ${name},`,
            "Your challenge access ended a couple of days ago and your account is on the free tier now — nothing was charged. This is a warm last note, not a countdown.",
            `If you'd like to keep going: Club is $99/mo, cancel anytime (${continueUrl}). Or the FTA Challenge Offer, $1,500 once — FTA for life + a year of Club (${ftaUrl}).`,
            "Everything you built stays on your free account. Thank you for spending your week with us.",
          ],
          unsubUrl
        ),
      };
    }
  }
}

/* ── shared checkout links (env-overridable; mirror challenge-emails.ts) ──── */

/** $99/mo Cheat Code Club (reuses the existing FIC product buy link). */
export const CLUB_CONTINUE_URL =
  process.env.CLUB_CONTINUE_URL?.trim() ||
  "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";

/** $1,500 FTA — Challenge Offer (FTA lifetime + 12mo Club). */
export const FTA_CHALLENGE_URL =
  process.env.FTA_CHALLENGE_URL?.trim() ||
  "https://buy.stripe.com/cNi28r0oHbxPdxacxBbEA0c";

/** Every step, in send order — for the test batch + admin display. */
export const CHALLENGE_STEPS: readonly ChallengeStep[] = [
  "welcome",
  "aug_watchlist",
  "aug_kai",
  "aug_screener",
  "aug_belts",
  "show_d3",
  "show_d1",
  "show_dayof",
  "day1",
  "day2",
  "day3",
  "day4",
  "day5",
  "close_stats",
  "close_offer",
  "close_lastcall",
] as const;

/** Steps whose copy merges live member stats at send time. */
export const CHALLENGE_STEPS_NEEDING_STATS: ReadonlySet<ChallengeStep> = new Set([
  "close_stats",
]);
