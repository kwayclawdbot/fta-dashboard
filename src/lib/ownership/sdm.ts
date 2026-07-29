/**
 * NTAG 424 DNA — SUN / Secure Dynamic Messaging (SDM) verification.
 *
 * "The tap is the truth." On each tap an NTAG 424 DNA chip emits an NDEF URL with
 * two dynamic fields:
 *   • picc_data — AES-128-CBC(IV=0) encrypted PICCData: [tag | UID(7) | SDMReadCtr(3) | rnd]
 *   • cmac      — an 8-byte truncation of an AES-CMAC over the SDM message, keyed by
 *                 a per-tap session key derived from the chip key + UID + counter.
 *
 * This module implements NXP AN12196 verification with ZERO npm dependencies —
 * AES-CMAC (SP 800-38B / RFC 4493) is implemented here over Node's aes-128-ecb
 * primitive; PICC decryption uses aes-128-cbc. It also provides the ENCRYPT side
 * (buildSdmPayload) so we can generate cryptographically valid test/simulation
 * vectors, and AES-256-GCM wrapping (encryptChipKey/decryptChipKey) for storing the
 * per-chip key at rest under NFC_MASTER_KEY.
 *
 * KEY MODEL: a real NTAG 424 DNA has separate SDMMetaReadKey (PICC decryption) and
 * SDMFileReadKey (CMAC). We provision both key slots with the SAME per-chip AES-128
 * value — a valid tag configuration — so the schema needs exactly one key column
 * (sdm_key_enc), matching the Phase 2 spec. The algorithm below is otherwise the
 * canonical "PICCData mirror + CMAC, no SDMENCFileData" case (MAC over empty msg),
 * i.e. the widely-reproduced `?picc_data=&cmac=` SUN reference.
 *
 * SERVER-ONLY. Never import into client bundles: it decrypts chip keys.
 */
import crypto from "node:crypto";

// ── low-level AES / CMAC primitives ─────────────────────────────────────────

const BLOCK = 16;
const ZERO_IV = Buffer.alloc(BLOCK);
/** Rb constant for the 128-bit block CMAC subkey generation. */
const RB = Buffer.from("00000000000000000000000000000087", "hex");

/** Single-block AES-128 ECB encrypt (the CMAC/CBC building block). */
function aesEncryptBlock(key: Buffer, block: Buffer): Buffer {
  const c = crypto.createCipheriv("aes-128-ecb", key, null);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(block), c.final()]) as Buffer;
}

function xor(a: Buffer, b: Buffer): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/** Left-shift a big-endian buffer by one bit (for CMAC subkey derivation). */
function shiftLeft1(buf: Buffer): Buffer {
  const out = Buffer.alloc(buf.length);
  let carry = 0;
  for (let i = buf.length - 1; i >= 0; i--) {
    const b = buf[i];
    out[i] = ((b << 1) | carry) & 0xff;
    carry = b & 0x80 ? 1 : 0;
  }
  return out;
}

function cmacSubkeys(key: Buffer): [Buffer, Buffer] {
  const l = aesEncryptBlock(key, ZERO_IV);
  let k1 = shiftLeft1(l);
  if (l[0] & 0x80) k1 = xor(k1, RB);
  let k2 = shiftLeft1(k1);
  if (k1[0] & 0x80) k2 = xor(k2, RB);
  return [k1, k2];
}

/** AES-128-CMAC (RFC 4493 / SP 800-38B). Returns the full 16-byte tag. */
export function aesCmac(key: Buffer, message: Buffer): Buffer {
  const [k1, k2] = cmacSubkeys(key);
  const complete = message.length > 0 && message.length % BLOCK === 0;
  const nBlocks = Math.max(1, Math.ceil(message.length / BLOCK));
  const lastStart = (nBlocks - 1) * BLOCK;

  let mLast: Buffer;
  if (complete) {
    mLast = xor(message.subarray(lastStart, lastStart + BLOCK), k1);
  } else {
    const rem = message.subarray(lastStart);
    const padded = Buffer.alloc(BLOCK);
    rem.copy(padded, 0);
    padded[rem.length] = 0x80; // 10* padding (rem.length is 0..15)
    mLast = xor(padded, k2);
  }

  let x: Buffer = ZERO_IV;
  for (let i = 0; i < nBlocks - 1; i++) {
    x = aesEncryptBlock(key, xor(x, message.subarray(i * BLOCK, i * BLOCK + BLOCK)));
  }
  return aesEncryptBlock(key, xor(x, mLast));
}

function aesCbcDecryptNoPad(key: Buffer, iv: Buffer, ct: Buffer): Buffer {
  const d = crypto.createDecipheriv("aes-128-cbc", key, iv);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(ct), d.final()]) as Buffer;
}

function aesCbcEncryptNoPad(key: Buffer, iv: Buffer, pt: Buffer): Buffer {
  const c = crypto.createCipheriv("aes-128-cbc", key, iv);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(pt), c.final()]) as Buffer;
}

// ── SDM message math (AN12196) ───────────────────────────────────────────────

/** PICCDataTag: UID mirror present (0x80) | SDMReadCtr present (0x40) | UID len 7. */
const PICC_TAG = 0xc7;
/** Session-key derivation vector prefix for the SDM file-read (MAC) key (AN12196). */
const SV2_PREFIX = Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);

/** 3-byte little-endian SDMReadCtr encode. */
function counterToBytes(counter: number): Buffer {
  return Buffer.from([counter & 0xff, (counter >> 8) & 0xff, (counter >> 16) & 0xff]);
}
function bytesToCounter(b: Buffer): number {
  return b[0] | (b[1] << 8) | (b[2] << 16);
}

/** Derive the per-tap session MAC key + truncated 8-byte SDMMAC for a UID+counter. */
function sdmMac(key: Buffer, uid: Buffer, ctr: Buffer): Buffer {
  const sv2 = Buffer.concat([SV2_PREFIX, uid, ctr]); // 6 + 7 + 3 = 16 bytes (one block)
  const sessionKey = aesCmac(key, sv2);
  const full = aesCmac(sessionKey, Buffer.alloc(0)); // MAC over empty SDM message
  // NXP truncation: take the odd-indexed bytes (1,3,5,…,15) → 8 bytes.
  return Buffer.from([1, 3, 5, 7, 9, 11, 13, 15].map((i) => full[i]));
}

function parseHex(s: string, expectedBytes: number): Buffer | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!/^[0-9a-fA-F]+$/.test(t) || t.length !== expectedBytes * 2) return null;
  return Buffer.from(t, "hex");
}

export type VerifyReason =
  | "bad_picc"
  | "bad_cmac_format"
  | "decrypt_failed"
  | "bad_format"
  | "cmac_mismatch"
  | "replay";

export interface VerifyTapResult {
  valid: boolean;
  uid: string | null; // uppercase hex
  counter: number | null;
  reason?: VerifyReason;
}

/**
 * Verify one tap. `chip.key` is the DECRYPTED per-chip AES-128 key (the caller
 * decrypts sdm_key_enc first); `chip.counter` is the stored replay floor.
 *
 * Steps: decrypt PICCData → parse UID+counter → recompute the truncated SDMMAC →
 * constant-time compare → enforce counter strictly greater than the floor.
 * Returns the UID/counter even on cmac_mismatch/replay so callers can log, but
 * `valid` is the only field a public route should trust.
 */
export function verifyTap({
  piccData,
  cmac,
  chip,
}: {
  piccData: string;
  cmac: string;
  chip: { key: Buffer; counter: number };
}): VerifyTapResult {
  const picc = parseHex(piccData, BLOCK);
  if (!picc) return { valid: false, uid: null, counter: null, reason: "bad_picc" };

  const providedMac = parseHex(cmac, 8);
  if (!providedMac)
    return { valid: false, uid: null, counter: null, reason: "bad_cmac_format" };

  let plain: Buffer;
  try {
    plain = aesCbcDecryptNoPad(chip.key, ZERO_IV, picc);
  } catch {
    return { valid: false, uid: null, counter: null, reason: "decrypt_failed" };
  }

  const tag = plain[0];
  const uidLen = tag & 0x0f;
  if (uidLen !== 7 || !(tag & 0x80)) {
    return { valid: false, uid: null, counter: null, reason: "bad_format" };
  }
  const uid = plain.subarray(1, 8);
  const ctrPresent = !!(tag & 0x40);
  const ctr = ctrPresent ? plain.subarray(8, 11) : counterToBytes(0);
  const counter = bytesToCounter(ctr);
  const uidHex = uid.toString("hex").toUpperCase();

  const expected = sdmMac(chip.key, uid, ctr);
  if (
    expected.length !== providedMac.length ||
    !crypto.timingSafeEqual(expected, providedMac)
  ) {
    return { valid: false, uid: uidHex, counter, reason: "cmac_mismatch" };
  }

  if (counter <= chip.counter) {
    return { valid: false, uid: uidHex, counter, reason: "replay" };
  }

  return { valid: true, uid: uidHex, counter };
}

/**
 * ENCRYPT side — build a cryptographically valid SUN payload for a chip. Used by
 * the provisioning/simulation scripts and the unit tests (never by production).
 * Mirrors what a real chip would emit for the given UID + counter.
 */
export function buildSdmPayload({
  key,
  uid,
  counter,
}: {
  key: Buffer; // 16-byte AES-128 chip key
  uid: Buffer; // 7-byte UID
  counter: number; // 0 .. 2^24-1
}): { piccData: string; cmac: string } {
  if (key.length !== 16) throw new Error("chip key must be 16 bytes");
  if (uid.length !== 7) throw new Error("uid must be 7 bytes");
  const ctr = counterToBytes(counter);
  const plain = Buffer.concat([
    Buffer.from([PICC_TAG]),
    uid,
    ctr,
    crypto.randomBytes(5), // padding to a full 16-byte block
  ]);
  const picc = aesCbcEncryptNoPad(key, ZERO_IV, plain);
  const mac = sdmMac(key, uid, ctr);
  return {
    piccData: picc.toString("hex").toUpperCase(),
    cmac: mac.toString("hex").toUpperCase(),
  };
}

// ── per-chip key generation + at-rest wrapping (AES-256-GCM) ─────────────────

/** Fresh random 16-byte AES-128 chip key. */
export function generateChipKey(): Buffer {
  return crypto.randomBytes(16);
}

/** Fresh random 7-byte NXP-style UID (hex, uppercase). */
export function generateChipUid(): string {
  return crypto.randomBytes(7).toString("hex").toUpperCase();
}

function masterKey(): Buffer {
  const hex = process.env.NFC_MASTER_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("NFC_MASTER_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return Buffer.from(hex, "hex");
}

/** Wrap a plaintext chip key for storage: base64(iv12 || tag16 || ciphertext). */
export function encryptChipKey(key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const ct = Buffer.concat([c.update(key), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Unwrap a stored sdm_key_enc back to the plaintext chip key. */
export function decryptChipKey(enc: string): Buffer {
  const buf = Buffer.from(enc, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]) as Buffer;
}
