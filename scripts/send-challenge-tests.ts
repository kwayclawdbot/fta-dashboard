/**
 * Owner-approval test send: the 2 new/changed challenge-sequence templates from
 * the challenge-conversion pass — day1 (rewritten: "build your first practice
 * watchlist") and day3_offer (new mid-week "keep going together" $99 pitch).
 *
 * Reuses the SAME renderer + send path the production cron uses, so what the
 * owner approves is exactly what ships. Subjects are prefixed "[TEST <step>] …".
 * Touches no flags and no member data.
 *
 * Run:  npx tsx scripts/send-challenge-tests.ts
 * Env:  loaded from .env.local (RESEND_API_KEY required).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  renderChallengeSequenceEmail,
  CLUB_CONTINUE_URL,
  FTA_CHALLENGE_URL,
  type ChallengeStep,
} from "../src/lib/server/challenge-sequence-emails";
import { sendDripEmail, dripUnsubUrl, APP_ORIGIN } from "../src/lib/server/drips";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    /* env already provided */
  }
}

const TO = process.env.DRIP_TEST_TO || "kwayclawdbot@gmail.com";
const FAKE_USER = "00000000-0000-4000-8000-000000000001";
const FIRST_NAME = "Kway";
const STEPS: ChallengeStep[] = ["day1", "day3_offer"];

async function main() {
  loadEnv();
  console.log(`Sending ${STEPS.length} challenge test emails to ${TO} (origin: ${APP_ORIGIN})\n`);
  const results: { step: string; ok: boolean; id?: string; error?: string }[] = [];

  for (const step of STEPS) {
    const unsubUrl = dripUnsubUrl(FAKE_USER);
    const { subject, html, text } = renderChallengeSequenceEmail(step, {
      firstName: FIRST_NAME,
      appUrl: APP_ORIGIN,
      unsubUrl,
      continueUrl: CLUB_CONTINUE_URL,
      ftaUrl: FTA_CHALLENGE_URL,
    });
    const prefixed = `[TEST ${step}] ${subject}`;
    const res = await sendDripEmail({ to: TO, subject: prefixed, html, text, unsubUrl });
    results.push({ step, ok: res.ok, id: res.id, error: res.error });
    console.log(res.ok ? `  ✓ ${step.padEnd(11)} ${res.id}` : `  ✗ ${step.padEnd(11)} ${res.error}`);
    await new Promise((r) => setTimeout(r, 600));
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone: ${ok}/${results.length} sent.`);
  if (ok < results.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
