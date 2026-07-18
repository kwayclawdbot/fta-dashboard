/* Live verification — drives the deployed site with Playwright. */
const fs = require("fs");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const SCRATCH =
  "/private/tmp/claude-501/-Users-kwaysclawd/be0d6c7d-5fc7-4bfd-bb65-2f3aaba03af9/scratchpad";
const SHOTS = `${SCRATCH}/shots`;
const SITE = "https://fta-dashboard-ruddy.vercel.app";

function env() {
  const raw = fs.readFileSync(
    "/Users/kwaysclawd/projects/fta-dashboard/.env.local",
    "utf8"
  );
  const e = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return e;
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const creds = JSON.parse(fs.readFileSync(`${SCRATCH}/creds.json`, "utf8"));
  const e = env();
  const supabase = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // answer maps
  const { data: items } = await supabase
    .from("game_items")
    .select("game, prompt, answer");
  const ans = {};
  for (const it of items) ans[`${it.game}::${it.prompt.trim()}`] = it.answer;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1240, height: 1500 },
    deviceScaleFactor: 1.5,
  });
  const log = (m) => console.log(`  ${m}`);

  // ---- login ----
  await page.goto(`${SITE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  log(`logged in -> ${page.url()}`);

  const shot = async (name) => {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    log(`shot ${name}.png`);
  };

  // ---- generic game runner ----
  async function playGame(game, labels, prefix, revealBtnText) {
    await page.goto(`${SITE}/games/${game}`, { waitUntil: "networkidle" });
    // frame A: mid formation / pop-in
    await page.waitForTimeout(900);
    await shot(`${prefix}-a-forming`);

    for (let round = 1; round <= 10; round++) {
      // wait for a decision button
      const decideBtn = page.getByRole("button", { name: labels[0], exact: true });
      await decideBtn.waitFor({ state: "visible", timeout: 20000 });

      // read the round prompt caption
      const prompt = (await page.locator("p.leading-relaxed").first().innerText())
        .trim();
      const answer = ans[`${game}::${prompt}`];

      if (round === 1) await shot(`${prefix}-b-decision`);

      // choose the correct label
      let choose = answer && labels.includes(answer) ? answer : labels[0];
      await page.getByRole("button", { name: choose, exact: true }).click();

      // wait for reveal (Next / See results button)
      const nextBtn = page.getByRole("button", { name: new RegExp(revealBtnText + "|See results") });
      await nextBtn.waitFor({ state: "visible", timeout: 20000 });
      if (round === 1) {
        await page.waitForTimeout(300);
        await shot(`${prefix}-c-reveal`);
      }
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // end screen
    await page.getByText("Play again", { exact: false }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    await shot(`${prefix}-d-end`);
  }

  log("== Candle Battle ==");
  await playGame("candle-battle", ["GREEN TEAM", "RED TEAM"], "candle-battle", "Next battle");

  log("== Trend or Trap ==");
  await playGame("trend-or-trap", ["CLIMBING", "FALLING"], "trend-or-trap", "Next chart");

  // ---- flashcards ----
  log("== Flashcards ==");
  await page.goto(`${SITE}/flashcards`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("flashcards-a-front");

  for (let i = 0; i < 5; i++) {
    const reveal = page.getByRole("button", { name: /Reveal answer|Flip the card/ });
    await reveal.waitFor({ state: "visible", timeout: 20000 });
    await reveal.click();
    if (i === 0) {
      await page.waitForTimeout(130);
      await shot("flashcards-b-midflip");
      await page.waitForTimeout(500);
      await shot("flashcards-c-back");
    }
    const got = page.getByRole("button", { name: /Got it|Nailed it/ });
    await got.waitFor({ state: "visible", timeout: 20000 });
    await got.click();
    await page.waitForTimeout(600);
  }
  await page.getByText(/Daily 5 complete|You did it/).waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  await shot("flashcards-d-complete");

  await browser.close();

  // ---- verify persistence ----
  const { data: scores } = await supabase
    .from("game_scores")
    .select("game, score, rounds, created_at")
    .eq("user_id", creds.userId)
    .order("created_at");
  const { data: xp } = await supabase
    .from("xp_events")
    .select("kind, amount, ref_id")
    .eq("user_id", creds.userId)
    .order("created_at");

  console.log("\nGAME_SCORES:", JSON.stringify(scores));
  console.log("XP_EVENTS:", JSON.stringify(xp));
  const totalXp = (xp || []).reduce((s, r) => s + r.amount, 0);
  console.log("TOTAL_XP:", totalXp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
