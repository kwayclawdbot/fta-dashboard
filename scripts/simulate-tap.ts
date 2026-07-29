/**
 * Simulate an NTAG 424 DNA tap for a provisioned/claimed chip. Builds a
 * cryptographically valid SDM payload (or a rejected variant) for the chip's real
 * key + counter from the dev DB, prints the tap URL for the running dev server, and
 * runs the verifier in-process against the DB replay floor to show the outcome.
 *
 * Run:
 *   node --env-file=.env.local scripts/simulate-tap.ts <CC-P01-XXXXXX> [--replay|--tamper] [--host=…]
 *
 *   (default)  valid tap at counter = floor+1  → verifies
 *   --replay   reuses the last seen counter     → rejected (replay)
 *   --tamper   valid payload, one CMAC bit flip → rejected (cmac_mismatch)
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildSdmPayload,
  verifyTap,
  decryptChipKey,
} from "../src/lib/ownership/sdm.ts";

const args = process.argv.slice(2);
const serial = args.find((a) => /^CC-P\d{2}-\d{6}$/i.test(a))?.toUpperCase();
const mode = args.includes("--replay")
  ? "replay"
  : args.includes("--tamper")
  ? "tamper"
  : "valid";
const host =
  args.find((a) => a.startsWith("--host="))?.split("=")[1] ||
  "http://localhost:3000";

if (!serial) {
  console.error("usage: simulate-tap.ts <CC-P01-XXXXXX> [--replay|--tamper]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key || !process.env.NFC_MASTER_KEY?.trim()) {
  console.error("missing env (run with --env-file=.env.local)");
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data, error } = await db
    .from("nfc_chips")
    .select("chip_uid, sdm_key_enc, sdm_counter, status, card_id, serial")
    .eq("serial", serial)
    .maybeSingle();
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`chip ${serial} not found`);
    process.exit(1);
  }

  const floor = Number(data.sdm_counter) || 0;
  const chipKey = decryptChipKey(data.sdm_key_enc);
  const uid = Buffer.from(data.chip_uid, "hex");

  // counter for this tap
  const counter = mode === "replay" ? floor : floor + 1;
  let { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter });

  if (mode === "tamper") {
    const flipped = (parseInt(cmac[1], 16) ^ 0x1).toString(16).toUpperCase();
    cmac = cmac[0] + flipped + cmac.slice(2);
  }

  // in-process verification against the DB replay floor (what the route will do)
  const result = verifyTap({ piccData, cmac, chip: { key: chipKey, counter: floor } });

  console.log(`Chip ${serial}  status=${data.status}  bound=${data.card_id ? "yes" : "no"}`);
  console.log(`  mode              ${mode}`);
  console.log(`  stored floor      ${floor}`);
  console.log(`  tap counter       ${counter}`);
  console.log(`  picc              ${piccData}`);
  console.log(`  cmac              ${cmac}`);
  console.log(`  verify.valid      ${result.valid}${result.reason ? `  (reason=${result.reason})` : ""}`);
  console.log(`  verify.uid        ${result.uid}`);
  console.log(`\n  scan page  ${host}/c/${serial}?picc=${piccData}&cmac=${cmac}`);
  console.log(`  api        ${host}/api/ownership/tap/${serial}?picc=${piccData}&cmac=${cmac}`);

  const expectRejected = mode !== "valid";
  const ok = expectRejected ? !result.valid : result.valid;
  console.log(`\n  RESULT: ${ok ? "OK" : "UNEXPECTED"} — ${mode} tap ${result.valid ? "VERIFIED" : "REJECTED"}`);
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
