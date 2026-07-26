/**
 * Unit tests for the Kai Watch setup lifecycle (LANE A). Runner:
 *   node --test src/lib/alerts/setup-lifecycle.test.ts   (npm run test:setups)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveSetupState,
  setupUpdateCopy,
  isSetupPushWorthy,
  type SetupObject,
} from "./setup-lifecycle.ts";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const longSetup = (state: SetupObject["state"], expiresAt = future): SetupObject => ({
  direction: "long",
  entry: 100,
  levels: { stop: 90, resistance: 100 },
  state,
  expiresAt,
});

test("long setup: waiting → confirmed → triggered", () => {
  assert.equal(deriveSetupState(longSetup("waiting"), { price: 95 }), "waiting");
  assert.equal(deriveSetupState(longSetup("waiting"), { price: 99 }), "confirmed"); // pressing the level
  assert.equal(deriveSetupState(longSetup("waiting"), { price: 101 }), "triggered");
});

test("long setup: volume confirms even below the level", () => {
  assert.equal(deriveSetupState(longSetup("waiting"), { price: 95, volRatio: 1.6 }), "confirmed");
});

test("long setup: stop breach invalidates", () => {
  assert.equal(deriveSetupState(longSetup("confirmed"), { price: 89 }), "invalidated");
});

test("setup expires when its window closes without triggering", () => {
  assert.equal(deriveSetupState(longSetup("waiting", past), { price: 95 }), "expired");
});

test("short setup mirrors: triggers on the downside, invalidates on the upside", () => {
  const shortSetup = (state: SetupObject["state"]): SetupObject => ({
    direction: "short",
    entry: 100,
    levels: { stop: 110, support: 100 },
    state,
    expiresAt: future,
  });
  assert.equal(deriveSetupState(shortSetup("waiting"), { price: 99 }), "triggered");
  assert.equal(deriveSetupState(shortSetup("confirmed"), { price: 111 }), "invalidated");
});

test("terminal setups are left untouched (cron won't re-evaluate them)", () => {
  assert.equal(deriveSetupState(longSetup("triggered"), { price: 80 }), "triggered");
  assert.equal(deriveSetupState(longSetup("invalidated"), { price: 200 }), "invalidated");
  assert.equal(deriveSetupState(longSetup("expired"), { price: 101 }), "expired");
});

test("no live price → state held (nothing to judge)", () => {
  assert.equal(deriveSetupState(longSetup("waiting"), { price: null }), "waiting");
});

test("push-worthiness + plain-language copy", () => {
  assert.equal(isSetupPushWorthy("triggered"), true);
  assert.equal(isSetupPushWorthy("invalidated"), true);
  assert.equal(isSetupPushWorthy("confirmed"), true);
  assert.equal(isSetupPushWorthy("expired"), false);
  assert.match(setupUpdateCopy("triggered", "nvda"), /NVDA/);
  assert.doesNotMatch(setupUpdateCopy("confirmed", "AAPL").toLowerCase(), /predicate|rpc|rule_id/);
});
