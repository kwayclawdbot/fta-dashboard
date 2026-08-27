import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ── env from the main repo .env.local ────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const BASE = "http://localhost:3111";
const SHOTS = "/private/tmp/claude-501/-Users-kwaysclawd/4fee2b40-5044-4249-b735-c75d10907d7a/scratchpad/shots";
const stamp = Date.now();
const EMAIL = `s1shell+${stamp}@example.com`;
const PASSWORD = `S1shell!${stamp}`;

let familyId, userId;
const consoleErrors = [];

async function setPersona(role, age_group, household) {
  await admin.from("profiles").update({ role, age_group }).eq("id", userId);
  await admin
    .from("family_profiles")
    .update({ household, completed_at: new Date().toISOString() })
    .eq("family_id", familyId);
}

async function capture(page, name, { width, height }, theme) {
  await page.addInitScript((t) => {
    try { localStorage.setItem("fta-theme", t); } catch {}
  }, theme);
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  // Overflow check
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  console.log(`  shot ${name}  overflowX=${overflow}px`);
  return overflow;
}

async function main() {
  // ── setup ──────────────────────────────────────────────────────────────
  const { data: fam, error: fe } = await admin
    .from("families")
    .insert({ name: "S1 Shell Test" })
    .select("id")
    .single();
  if (fe) throw new Error("family insert: " + fe.message);
  familyId = fam.id;

  const { data: created, error: ue } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (ue) throw new Error("createUser: " + ue.message);
  userId = created.user.id;

  await admin.from("profiles").upsert(
    {
      id: userId,
      family_id: familyId,
      role: "parent",
      age_group: "adults",
      display_name: "Alex Rivera",
      onboarding_complete: true,
    },
    { onConflict: "id" }
  );
  await admin.from("family_profiles").upsert(
    {
      family_id: familyId,
      household: { adults: 1, kids: 0, kid_age_ranges: [] },
      completed_at: new Date().toISOString(),
    },
    { onConflict: "family_id" }
  );

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

  // ── login ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log("logged in, url=", page.url());

  const overflows = [];

  // ── ADULT / CLUB (solo) ─────────────────────────────────────────────────
  await setPersona("parent", "adults", { adults: 1, kids: 0, kid_age_ranges: [] });
  console.log("PERSONA adult/club");
  overflows.push(await capture(page, "s1-adult-desktop-light", { width: 1440, height: 900 }, "light"));
  overflows.push(await capture(page, "s1-adult-desktop-dark", { width: 1440, height: 900 }, "dark"));
  overflows.push(await capture(page, "s1-adult-mobile-light", { width: 390, height: 844 }, "light"));
  overflows.push(await capture(page, "s1-adult-mobile-dark", { width: 390, height: 844 }, "dark"));

  // Universal search (desktop) — open ⌘K, type, capture grouped results.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(500);
  await page.keyboard.type("app", { delay: 40 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/s1-adult-search.png` });
  console.log("  shot s1-adult-search");

  // Kai sheet WITH context — click the "Ask Kai about" row.
  const askKai = page.locator('text=/Ask Kai about/i').first();
  if (await askKai.count()) {
    await askKai.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/s1-adult-kai-sheet.png` });
    console.log("  shot s1-adult-kai-sheet (context chip)");
  } else {
    console.log("  (Ask Kai row not found)");
    await page.keyboard.press("Escape");
  }

  // ── PARENT (family) ──────────────────────────────────────────────────────
  await setPersona("parent", "adults", { adults: 2, kids: 2, kid_age_ranges: ["9-12"] });
  console.log("PERSONA parent/family");
  overflows.push(await capture(page, "s1-parent-desktop-light", { width: 1440, height: 900 }, "light"));
  overflows.push(await capture(page, "s1-parent-mobile-light", { width: 390, height: 844 }, "light"));

  // ── TEEN ─────────────────────────────────────────────────────────────────
  await setPersona("child", "teens", { adults: 2, kids: 2, kid_age_ranges: ["13-17"] });
  console.log("PERSONA teen");
  overflows.push(await capture(page, "s1-teen-desktop-light", { width: 1440, height: 900 }, "light"));
  overflows.push(await capture(page, "s1-teen-mobile-light", { width: 390, height: 844 }, "light"));

  // ── KID ──────────────────────────────────────────────────────────────────
  await setPersona("child", "kids", { adults: 2, kids: 2, kid_age_ranges: ["5-8"] });
  console.log("PERSONA kid");
  overflows.push(await capture(page, "s1-kid-desktop-light", { width: 1440, height: 900 }, "light"));
  overflows.push(await capture(page, "s1-kid-mobile-light", { width: 390, height: 844 }, "light"));

  await browser.close();

  console.log("\nMAX overflowX =", Math.max(...overflows.filter((n) => typeof n === "number")), "px");
  console.log("CONSOLE ERRORS (", consoleErrors.length, "):");
  consoleErrors.slice(0, 20).forEach((e) => console.log("  -", e.slice(0, 160)));
}

async function teardown() {
  try {
    if (familyId) await admin.from("family_profiles").delete().eq("family_id", familyId);
    if (userId) await admin.from("profiles").delete().eq("id", userId);
    if (familyId) await admin.from("families").delete().eq("id", familyId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    console.log("TEARDOWN complete (zero-residue)");
  } catch (e) {
    console.log("TEARDOWN error:", e.message, "\n!! MANUAL CLEANUP:", { familyId, userId, EMAIL });
  }
}

main()
  .catch((e) => console.error("DRIVER ERROR:", e))
  .finally(teardown);
