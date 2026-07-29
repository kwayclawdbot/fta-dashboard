/**
 * Provision NTAG 424 DNA chips (dev). Mints N chip rows — P-series serial, random
 * 7-byte UID, fresh AES-128 SDM key (stored ENCRYPTED under NFC_MASTER_KEY), status
 * 'provisioned' — and prints the provisioning manifest that a personalization bureau
 * would later burn into the physical chips (URL template + key slots).
 *
 * Run:
 *   node --env-file=.env.local scripts/provision-chips.ts [count] [--form=card|pendant|watch] [--host=https://…]
 *
 * NOTE: writes with the service-role client (bypasses RLS). Plaintext keys are
 * printed ONCE here for the burn step and never persisted in the clear.
 */
process.env.NFC_MASTER_KEY;
import { createClient } from "@supabase/supabase-js";
import {
  generateChipKey,
  generateChipUid,
  encryptChipKey,
} from "../src/lib/ownership/sdm.ts";
import type { FormFactor } from "../src/lib/ownership/types.ts";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) || 5);
const form = (args.find((a) => a.startsWith("--form="))?.split("=")[1] ||
  "card") as FormFactor;
const host =
  args.find((a) => a.startsWith("--host="))?.split("=")[1] ||
  "http://localhost:3000";

if (!["card", "pendant", "watch"].includes(form)) {
  console.error(`invalid --form=${form}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.NFC_MASTER_KEY?.trim()) {
  console.error("missing NFC_MASTER_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Provisioning ${count} chip(s), form_factor=${form}\n`);
  const minted: { serial: string; chipUid: string; plainKey: string }[] = [];

  for (let i = 0; i < count; i++) {
    const chipKey = generateChipKey();
    const chipUid = generateChipUid();
    const { data, error } = await db
      .from("nfc_chips")
      .insert({
        chip_uid: chipUid,
        sdm_key_enc: encryptChipKey(chipKey),
        form_factor: form,
      })
      .select("serial, chip_uid")
      .single();
    if (error || !data) {
      console.error(`  insert failed: ${error?.message}`);
      process.exit(1);
    }
    minted.push({
      serial: data.serial,
      chipUid: data.chip_uid,
      plainKey: chipKey.toString("hex").toUpperCase(),
    });
  }

  console.log("── PROVISIONING MANIFEST (chip burn spec) ──────────────────────");
  console.log("URL template (SDM mirrors picc_data + cmac):");
  console.log(`  ${host}/c/{SERIAL}?picc={PICC}&cmac={CMAC}\n`);
  console.log("Key slots per chip (NTAG 424 DNA):");
  console.log("  App Key 1 (SDMMetaReadKey) = App Key 2 (SDMFileReadKey) = per-chip key below");
  console.log("  (same value in both slots — one column sdm_key_enc; stored AES-256-GCM encrypted)\n");

  for (const m of minted) {
    console.log(`  ${m.serial}`);
    console.log(`     UID      ${m.chipUid}`);
    console.log(`     SDM key  ${m.plainKey}   (burn only; DB holds ciphertext)`);
    console.log(`     tap URL  ${host}/c/${m.serial}?picc={PICC}&cmac={CMAC}`);
  }
  console.log(`\nProvisioned ${minted.length} chip(s): ${minted.map((m) => m.serial).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
