/**
 * Referral system (v1) — shared constants + client-safe share helpers.
 * No next/headers here so this is safe to import from client components.
 *
 * Long-term vision + phasing lives in .planning/AFFILIATE-PLAN.md. This v1 ships
 * the "S" core: shareable links, click/signup attribution, and XP credit.
 * Percent revenue-share / commissions / payouts are deferred (Phase 2+).
 */

/** First-touch attribution cookie. 90-day window, never overwritten. */
export const REF_COOKIE = "fta_ref";
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days (seconds)

/** XP awarded to the referring parent per verified referred family (once). */
export const REFERRAL_SIGNUP_XP = 100;

/** Public share link — routes through /r/[code] so clicks are tracked. */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/r/${encodeURIComponent(code)}`;
}

const SHARE_MESSAGE =
  "I'm learning to invest with the Cheat Code Club — real companies, kid-friendly, no jargon. Come join us:";

/** Challenge-framed share copy for the thank-you loop. Capability-only, no
 *  income/return language (compliance floor). */
export const CHALLENGE_SHARE_MESSAGE =
  "I just joined the free 5-Day Investing Challenge — one clear step a day to actually understand the market. It's better with a friend. Come do it with me:";

export interface ShareTargets {
  message: string;
  whatsapp: string;
  x: string;
  facebook: string;
  mailto: string;
  sms: string;
}

/** Build one-tap share URLs (plain share links, no SDKs). An optional custom
 *  message overrides the default family copy (e.g. the challenge share loop). */
export function shareTargets(link: string, message?: string): ShareTargets {
  const text = message || SHARE_MESSAGE;
  const textAndLink = `${text} ${link}`;
  const subject = "Join me in the Cheat Code Club";
  return {
    message: text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(textAndLink)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textAndLink)}`,
    sms: `sms:?&body=${encodeURIComponent(textAndLink)}`,
  };
}
