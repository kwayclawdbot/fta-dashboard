import { test } from "node:test";
import assert from "node:assert/strict";
import { LIVE_STATUS_ORDER, type LiveEventStatus } from "./types.ts";
import { liveStartingBody } from "./notify.ts";

/**
 * Unit coverage for the live_event slice pure logic. The authoritative state
 * machine + counters live in SQL (migration 170 advance_live_event); this mirror
 * documents + guards the transition rules and the notification copy, and pins the
 * Sept seed times. The SQL RPC is verified separately against prod.
 */

// TS mirror of the SQL forward-only rule (same array, same semantics).
function isAllowed(from: LiveEventStatus, to: LiveEventStatus): "ok" | "noop" | "illegal" {
  const f = LIVE_STATUS_ORDER.indexOf(from);
  const t = LIVE_STATUS_ORDER.indexOf(to);
  if (t < f) return "illegal";
  if (t === f) return "noop";
  return "ok";
}

test("lifecycle is forward-only along scheduled→…→replay_ready", () => {
  assert.equal(isAllowed("scheduled", "starting_soon"), "ok");
  assert.equal(isAllowed("scheduled", "live"), "ok"); // may skip starting_soon
  assert.equal(isAllowed("starting_soon", "live"), "ok");
  assert.equal(isAllowed("live", "ended"), "ok");
  assert.equal(isAllowed("ended", "replay_ready"), "ok");
});

test("backward transitions are rejected", () => {
  assert.equal(isAllowed("live", "scheduled"), "illegal");
  assert.equal(isAllowed("ended", "live"), "illegal");
  assert.equal(isAllowed("replay_ready", "ended"), "illegal");
  assert.equal(isAllowed("starting_soon", "scheduled"), "illegal");
});

test("re-issuing the current status is a no-op, not an error", () => {
  assert.equal(isAllowed("live", "live"), "noop");
  assert.equal(isAllowed("scheduled", "scheduled"), "noop");
});

test("go-live copy is contextual per room type and sells the reason to enter", () => {
  assert.equal(
    liveStartingBody("class", "Day 1 — Your first practice watchlist", 0),
    "🎓 Live class starting now · Day 1 — Your first practice watchlist"
  );
  assert.ok(liveStartingBody("audio", "Morning check-in", 0).startsWith("🎙 Live room"));
  assert.ok(liveStartingBody("market", "NVDA teardown", 0).startsWith("📈 Live room"));
});

test("crowd count is scale-floored (never fabricated below 5)", () => {
  assert.ok(!liveStartingBody("class", "X", 3).includes("watching"));
  assert.ok(liveStartingBody("class", "X", 74).includes("74 watching now"));
});

test("body never exceeds the 160-char push limit", () => {
  const long = "Y".repeat(300);
  assert.ok(liveStartingBody("class", long, 99).length <= 160);
});

test("Sept webinar seed: 23:00 UTC renders as 7:00 PM ET (EDT, UTC-4)", () => {
  const seeds = [
    "2026-09-02T23:00:00Z",
    "2026-09-03T23:00:00Z",
    "2026-09-04T23:00:00Z",
    "2026-09-05T23:00:00Z",
    "2026-09-06T23:00:00Z",
  ];
  const expectDay = ["Wed", "Thu", "Fri", "Sat", "Sun"];
  seeds.forEach((iso, i) => {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(d);
    const day = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "America/New_York",
    }).format(d);
    assert.equal(time, "7:00 PM");
    assert.equal(day, expectDay[i]);
  });
});
