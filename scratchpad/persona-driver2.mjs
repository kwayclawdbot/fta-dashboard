import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, appendFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = "http://localhost:3111";
const SHOTS = "/private/tmp/claude-501/-Users-kwaysclawd/4fee2b40-5044-4249-b735-c75d10907d7a/scratchpad/shots";
const LOG = SHOTS + "/../driver2.log";
const log = (m) => { console.log(m); try { appendFileSync(LOG, m + "\n"); } catch {} };
const stamp = Date.now();
const EMAIL = `s1shell+${stamp}@example.com`;
const PASSWORD = `S1shell!${stamp}`;
let familyId, userId;
const errs = [];

async function setPersona(role, age_group, household) {
  await admin.from("profiles").update({ role, age_group, tour_completed_at: new Date().toISOString(), tour_version: 3 }).eq("id", userId);
  await admin.from("family_profiles").update({ household, completed_at: new Date().toISOString() }).eq("family_id", familyId);
}
async function grab(page, name, w, h, theme = "light") {
  await page.addInitScript((t) => { try { localStorage.setItem("fta-theme", t); localStorage.setItem("cc:first-run-done", "1"); } catch {} }, theme);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.keyboard.press("Escape").catch(() => {});
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  log(`  ${name}  overflowX=${ov}`);
  return ov;
}

async function main() {
  const { data: fam } = await admin.from("families").insert({ name: "S1 Shell Test 2" }).select("id").single();
  familyId = fam.id;
  const { data: created, error: ue } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (ue) throw new Error(ue.message);
  userId = created.user.id;
  await admin.from("profiles").upsert({ id: userId, family_id: familyId, role: "parent", age_group: "adults", display_name: "Alex Rivera", onboarding_complete: true, tour_completed_at: new Date().toISOString(), tour_version: 3 }, { onConflict: "id" });
  await admin.from("family_profiles").upsert({ family_id: familyId, household: { adults: 1, kids: 0, kid_age_ranges: [] }, completed_at: new Date().toISOString() }, { onConflict: "family_id" });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message.slice(0, 200)));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log("logged in " + page.url());
  const ov = [];

  // ADULT clean search + kai sheet (context chip) via keyboard
  await setPersona("parent", "adults", { adults: 1, kids: 0, kid_age_ranges: [] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(500);
  await page.keyboard.type("nvda", { delay: 50 });
  await page.waitForTimeout(2500); // let real results + logos load
  await page.screenshot({ path: `${SHOTS}/s1-adult-search-results.png` });
  log("  s1-adult-search-results");
  await page.keyboard.press("Enter"); // Ask Kai is item 0 → opens sheet w/ chip
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/s1-adult-kai-sheet.png` });
  log("  s1-adult-kai-sheet");

  // PARENT
  await setPersona("parent", "adults", { adults: 2, kids: 2, kid_age_ranges: ["9-12"] });
  log("PERSONA parent");
  ov.push(await grab(page, "s1-parent-desktop-light", 1440, 900));
  ov.push(await grab(page, "s1-parent-mobile-light", 390, 844));

  // TEEN
  await setPersona("child", "teens", { adults: 2, kids: 2, kid_age_ranges: ["13-17"] });
  log("PERSONA teen");
  ov.push(await grab(page, "s1-teen-desktop-light", 1440, 900));
  ov.push(await grab(page, "s1-teen-mobile-light", 390, 844));

  // KID
  await setPersona("child", "kids", { adults: 2, kids: 2, kid_age_ranges: ["5-8"] });
  log("PERSONA kid");
  ov.push(await grab(page, "s1-kid-desktop-light", 1440, 900));
  ov.push(await grab(page, "s1-kid-mobile-light", 390, 844));

  await browser.close();
  log("MAX overflowX = " + Math.max(...ov.filter((n) => typeof n === "number")));
  log("CONSOLE ERRORS (" + errs.length + "):");
  [...new Set(errs)].slice(0, 15).forEach((e) => log("  - " + e));
}
async function teardown() {
  try {
    if (familyId) await admin.from("family_profiles").delete().eq("family_id", familyId);
    if (userId) await admin.from("profiles").delete().eq("id", userId);
    if (familyId) await admin.from("families").delete().eq("id", familyId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    log("TEARDOWN complete");
  } catch (e) { log("TEARDOWN err " + e.message + " MANUAL: " + JSON.stringify({ familyId, userId })); }
}
main().catch((e) => log("DRIVER ERR: " + e.message + "\n" + e.stack)).finally(teardown);
