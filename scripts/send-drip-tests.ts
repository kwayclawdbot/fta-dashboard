/**
 * Owner-approval test send (Lane 13B): render ALL 5 welcome-drip steps × 3
 * variants (15 emails) with realistic merge data and send them to the owner
 * inbox, each subject-prefixed "[TEST <variant> D<n>] …".
 *
 * Reuses the SAME renderers + send path (List-Unsubscribe headers, reply-to)
 * the production cron uses, so what the owner approves is exactly what ships.
 * Does NOT touch the drip_enabled flag or any member data.
 *
 * Run:  npx tsx scripts/send-drip-tests.ts
 * Env:  loaded from .env.local (RESEND_API_KEY required).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderDrip, DRIP_STEPS } from "../src/lib/server/drip-templates";
import { sendDripEmail, dripUnsubUrl, APP_ORIGIN } from "../src/lib/server/drips";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── load .env.local into process.env (before the send path reads the key) ────
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
const FAKE_USER = "00000000-0000-4000-8000-000000000001"; // signs a real (test) unsub token

const VARIANTS = ["parent", "solo", "fta"] as const;

// Realistic per-variant D7 merge data.
const STATS: Record<(typeof VARIANTS)[number], { xp: number; beltLabel: string; lessons: number }> = {
  parent: { xp: 340, beltLabel: "Yellow Belt", lessons: 6 },
  solo: { xp: 180, beltLabel: "Yellow Belt", lessons: 4 },
  fta: { xp: 920, beltLabel: "Blue Belt II", lessons: 14 },
};

const FIRST_NAME = "Kway";

async function main() {
  loadEnv();
  console.log(`Sending 15 test drips to ${TO} (app origin: ${APP_ORIGIN})\n`);
  const results: { key: string; ok: boolean; id?: string; error?: string }[] = [];

  for (const variant of VARIANTS) {
    for (const step of DRIP_STEPS) {
      const unsubUrl = dripUnsubUrl(FAKE_USER);
      const { subject, html, text } = renderDrip(step, variant, {
        firstName: FIRST_NAME,
        appUrl: APP_ORIGIN,
        unsubUrl,
        stats: step === 7 ? STATS[variant] : undefined,
      });
      const prefixed = `[TEST ${variant} D${step}] ${subject}`;
      const res = await sendDripEmail({ to: TO, subject: prefixed, html, text, unsubUrl });
      const key = `${variant} D${step}`;
      results.push({ key, ok: res.ok, id: res.id, error: res.error });
      console.log(
        res.ok ? `  ✓ ${key.padEnd(11)} ${res.id}` : `  ✗ ${key.padEnd(11)} ${res.error}`
      );
      // Gentle spacing to stay well under Resend rate limits.
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone: ${ok}/${results.length} sent.`);
  if (ok < results.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
