/**
 * Seed the three PERMANENT preview-demo accounts on the (shared prod) Supabase.
 *
 * These are sanctioned permanent fixtures — the ONE exception to zero-residue.
 * Idempotent: re-running updates in place, never duplicates. Run once:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   DEMO_PASSWORD=... node scripts/seed-preview-demo.mjs
 *
 * Accounts (all normal member rights, clearly named + @cheatcode.internal):
 *   - demo-club@cheatcode.internal   → "Demo Club Member"  (solo club household;
 *       watchlist tickers + closed sim trades so the Kai week-note renders;
 *       onboarding_complete=true so ?onboarding=replay is required to re-see it)
 *   - demo-family@cheatcode.internal → "Demo Family Parent" (shared household)
 *   - demo-kid@cheatcode.internal    → "Demo Kid"           (child in that household)
 */
import { createClient } from "@supabase/supabase-js";

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL).trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const PASSWORD = process.env.DEMO_PASSWORD.trim();
if (!URL || !KEY || !PASSWORD) throw new Error("Need SUPABASE URL, SERVICE_ROLE_KEY, DEMO_PASSWORD");

const db = createClient(URL, KEY, { auth: { persistSession: false } });

/** Create-or-fetch an auth user with a known password. Returns the user id. */
async function ensureUser(email) {
  // Try to find existing (paginate a little; the project is small enough).
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) {
      await db.auth.admin.updateUserById(hit.id, { password: PASSWORD, email_confirm: true });
      return hit.id;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureFamily(id, name, tier) {
  const { error } = await db.from("families").upsert(
    { id, name, plan_tier: tier },
    { onConflict: "id" }
  );
  if (error) throw error;
  return id;
}

async function ensureProfile(row) {
  const { error } = await db.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

async function main() {
  // ── deterministic ids so re-runs are stable ────────────────────────────────
  const CLUB_FAMILY = "d0000000-0000-4000-8000-0000000c1000";
  const HOUSE_FAMILY = "d0000000-0000-4000-8000-0000000fa770";

  const clubUser = await ensureUser("demo-club@cheatcode.internal");
  const familyUser = await ensureUser("demo-family@cheatcode.internal");
  const kidUser = await ensureUser("demo-kid@cheatcode.internal");

  await ensureFamily(CLUB_FAMILY, "Demo Club (Solo)", "academy");
  await ensureFamily(HOUSE_FAMILY, "Demo Family Household", "academy");

  await ensureProfile({
    id: clubUser, family_id: CLUB_FAMILY, role: "parent",
    display_name: "Demo Club Member", email: "demo-club@cheatcode.internal",
    age_group: "adults", track: "adults", onboarding_complete: true,
  });
  await ensureProfile({
    id: familyUser, family_id: HOUSE_FAMILY, role: "parent",
    display_name: "Demo Family Parent", email: "demo-family@cheatcode.internal",
    age_group: "adults", track: "adults", onboarding_complete: true,
  });
  await ensureProfile({
    id: kidUser, family_id: HOUSE_FAMILY, role: "child",
    display_name: "Demo Kid", email: "demo-kid@cheatcode.internal",
    age_group: "kids", track: "kids", onboarding_complete: true,
  });

  // ── club watchlist (a few tickers) ─────────────────────────────────────────
  const watch = [
    { ticker: "NVDA", company_name: "Nvidia", status: "favorite", trend: "up",
      what_they_sell: "AI accelerator GPUs", how_they_make_money: "Sells data-center GPUs to cloud providers",
      strength: "Dominant AI compute moat", risk: "Cyclical demand + China export limits",
      why_we_picked: "Backbone of the AI buildout" },
    { ticker: "COST", company_name: "Costco", status: "study", trend: "up",
      what_they_sell: "Bulk groceries + membership", how_they_make_money: "Membership fees + thin retail margin",
      strength: "Sticky membership renewals", risk: "Low margin, rate-sensitive consumer",
      why_we_picked: "Recession-resilient compounder" },
    { ticker: "AAPL", company_name: "Apple", status: "watch" },
    { ticker: "SHOP", company_name: "Shopify", status: "watch" },
  ];
  // clear prior demo rows for this family, then insert fresh
  await db.from("family_watchlist").delete().eq("family_id", CLUB_FAMILY);
  const { error: wErr } = await db.from("family_watchlist").insert(
    watch.map((w) => ({ ...w, family_id: CLUB_FAMILY, champion_id: clubUser }))
  );
  if (wErr) throw wErr;

  // ── club sim portfolio + closed trades (so Kai week-note has material) ──────
  await db.from("sim_portfolios").upsert(
    { user_id: clubUser, balance: 104250.0, starting_balance: 100000.0,
      total_trades: 3, winning_trades: 2, total_pnl: 4250.0 },
    { onConflict: "user_id" }
  );
  const { data: pf } = await db.from("sim_portfolios").select("id").eq("user_id", clubUser).single();
  if (pf) {
    await db.from("sim_trades").delete().eq("portfolio_id", pf.id);
    const now = Date.now();
    const day = 86400000;
    await db.from("sim_trades").insert([
      { portfolio_id: pf.id, symbol: "NVDA", side: "long", quantity: 20, entry_price: 118.4, exit_price: 131.2, pnl: 256.0,
        opened_at: new Date(now - 6 * day).toISOString(), closed_at: new Date(now - 2 * day).toISOString() },
      { portfolio_id: pf.id, symbol: "COST", side: "long", quantity: 5, entry_price: 892.0, exit_price: 915.5, pnl: 117.5,
        opened_at: new Date(now - 5 * day).toISOString(), closed_at: new Date(now - 1 * day).toISOString() },
      { portfolio_id: pf.id, symbol: "TSLA", side: "short", quantity: 10, entry_price: 245.0, exit_price: 251.3, pnl: -63.0,
        opened_at: new Date(now - 4 * day).toISOString(), closed_at: new Date(now - 1 * day).toISOString() },
    ]);
  }

  // ── lesson progress for family parent + kid ────────────────────────────────
  const { data: lessons } = await db
    .from("lessons").select("id").order("sort_order").limit(4);
  const lessonIds = (lessons || []).map((l) => l.id);
  const progressRows = [];
  lessonIds.forEach((lid, i) => {
    const done = i < 2;
    for (const uid of [familyUser, kidUser]) {
      progressRows.push({
        user_id: uid, lesson_id: lid,
        status: done ? "completed" : i === 2 ? "in_progress" : "not_started",
        progress_pct: done ? 100 : i === 2 ? 40 : 0,
        completed_at: done ? new Date().toISOString() : null,
        time_spent_sec: done ? 600 : i === 2 ? 240 : 0,
      });
    }
  });
  if (progressRows.length) {
    const { error: pErr } = await db
      .from("lesson_progress").upsert(progressRows, { onConflict: "user_id,lesson_id" });
    if (pErr) throw pErr;
  }

  console.log(JSON.stringify({
    club: clubUser, family: familyUser, kid: kidUser,
    clubFamily: CLUB_FAMILY, household: HOUSE_FAMILY,
    watchlistRows: watch.length, simTrades: 3, lessonsProgressed: lessonIds.length,
  }, null, 2));
}

main().catch((e) => { console.error("SEED FAILED:", e.message || e); process.exit(1); });
