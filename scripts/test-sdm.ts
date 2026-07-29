/**
 * NTAG 424 DNA SDM — focused unit checks. Run:
 *   node scripts/test-sdm.ts
 * (No DB, no network. Sets a fixed NFC_MASTER_KEY so it is self-contained.)
 *
 * Covers: AES-CMAC against NIST SP 800-38B vectors (empty / full-block / partial
 * paths), a full encrypt→verify roundtrip, replay rejection, tamper rejection,
 * and the at-rest key-wrap roundtrip.
 */
process.env.NFC_MASTER_KEY ??=
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  aesCmac,
  buildSdmPayload,
  verifyTap,
  generateChipKey,
  encryptChipKey,
  decryptChipKey,
} from "../src/lib/ownership/sdm.ts";

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

const hex = (b: Buffer) => b.toString("hex");

console.log("── AES-CMAC (NIST SP 800-38B, AES-128) ──");
const NIST_KEY = Buffer.from("2b7e151628aed2a6abf7158809cf4f3c", "hex");
const MSG =
  "6bc1bee22e409f96e93d7e117393172a" +
  "ae2d8a571e03ac9c9eb76fac45af8e51" +
  "30c81c46a35ce411e5fbc1191a0a52ef" +
  "f69f2445df4f9b17ad2b417be66c3710";
const msgBuf = Buffer.from(MSG, "hex");

check("CMAC(empty) = bb1d6929…756746", () => {
  assert.equal(hex(aesCmac(NIST_KEY, Buffer.alloc(0))), "bb1d6929e95937287fa37d129b756746");
});
check("CMAC(16 bytes) = 070a16b4…4a287c", () => {
  assert.equal(hex(aesCmac(NIST_KEY, msgBuf.subarray(0, 16))), "070a16b46b4d4144f79bdd9dd04a287c");
});
check("CMAC(40 bytes, partial last block) = dfa66747…97c827", () => {
  assert.equal(hex(aesCmac(NIST_KEY, msgBuf.subarray(0, 40))), "dfa66747de9ae63030ca32611497c827");
});
check("CMAC(64 bytes) = 51f0bebf…363cfe", () => {
  assert.equal(hex(aesCmac(NIST_KEY, msgBuf)), "51f0bebf7e3b9d92fc49741779363cfe");
});

console.log("── SDM encrypt → verify roundtrip ──");
const chipKey = generateChipKey();
const uid = crypto.randomBytes(7);
const uidHex = uid.toString("hex").toUpperCase();

check("valid tap at counter 1 verifies (floor 0)", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 1 });
  const r = verifyTap({ piccData, cmac, chip: { key: chipKey, counter: 0 } });
  assert.equal(r.valid, true, `reason=${r.reason}`);
  assert.equal(r.uid, uidHex);
  assert.equal(r.counter, 1);
});

check("counter + UID decrypt correctly at counter 42", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 42 });
  const r = verifyTap({ piccData, cmac, chip: { key: chipKey, counter: 7 } });
  assert.equal(r.valid, true, `reason=${r.reason}`);
  assert.equal(r.counter, 42);
});

console.log("── replay rejection ──");
check("replay: counter == floor is rejected", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 5 });
  const r = verifyTap({ piccData, cmac, chip: { key: chipKey, counter: 5 } });
  assert.equal(r.valid, false);
  assert.equal(r.reason, "replay");
});
check("replay: counter < floor is rejected", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 3 });
  const r = verifyTap({ piccData, cmac, chip: { key: chipKey, counter: 9 } });
  assert.equal(r.valid, false);
  assert.equal(r.reason, "replay");
});

console.log("── tamper rejection ──");
check("tamper: flipped CMAC bit is rejected", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 2 });
  const bad = (parseInt(cmac[1], 16) ^ 0x1).toString(16).toUpperCase();
  const tampered = cmac[0] + bad + cmac.slice(2);
  const r = verifyTap({ piccData, cmac: tampered, chip: { key: chipKey, counter: 0 } });
  assert.equal(r.valid, false);
  assert.equal(r.reason, "cmac_mismatch");
});
check("tamper: mutated PICCData is rejected", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 2 });
  const b = Buffer.from(piccData, "hex");
  b[3] ^= 0x80;
  const r = verifyTap({ piccData: b.toString("hex"), cmac, chip: { key: chipKey, counter: 0 } });
  assert.equal(r.valid, false);
});
check("wrong key is rejected (cmac_mismatch or bad_format)", () => {
  const { piccData, cmac } = buildSdmPayload({ key: chipKey, uid, counter: 2 });
  const r = verifyTap({ piccData, cmac, chip: { key: generateChipKey(), counter: 0 } });
  assert.equal(r.valid, false);
});
check("malformed hex params are rejected", () => {
  const r = verifyTap({ piccData: "zz", cmac: "nothex", chip: { key: chipKey, counter: 0 } });
  assert.equal(r.valid, false);
  assert.equal(r.reason, "bad_picc");
});

console.log("── at-rest key wrap (AES-256-GCM) ──");
check("encrypt→decrypt chip key roundtrips", () => {
  const k = generateChipKey();
  const enc = encryptChipKey(k);
  assert.notEqual(enc, k.toString("base64"));
  assert.deepEqual(decryptChipKey(enc), k);
});
check("tampered ciphertext fails auth tag", () => {
  const k = generateChipKey();
  const enc = encryptChipKey(k);
  const b = Buffer.from(enc, "base64");
  b[b.length - 1] ^= 0xff;
  assert.throws(() => decryptChipKey(b.toString("base64")));
});

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
