#!/usr/bin/env node
/**
 * seed-v2-demo.ts
 * ------------------------------------------------------------------
 * Seeds CLEARLY-MARKED DEMO DATA for the FTA / Cheat Code Club v2 UI review.
 *
 * Populates every social/community surface the v2 boards render:
 *   • 6 named demo members (+ reuses cardtest/cardtest2 QA accounts if present)
 *     in one demo family, each landed in a DISTINCT belt (White→Black) via xp_events.
 *   • 3 club_circles (NVDA Earnings / Fed Decision / AI Capex Cycle) + members + notes.
 *   • ticker_stances + stance_events (with authored flips) so divisiveness renders.
 *   • ~12 feed_posts with ticker_tags + position + content_type.
 *   • object_reactions (likes/respect) cross-wired across the demo cohort.
 *   • session_rsvps for the next upcoming live_session (skips gracefully if none).
 *
 * SERVICE-ROLE client (bypasses RLS — every one of these tables restricts writes).
 * Idempotent: re-running upserts on natural keys or delete-then-inserts SCOPED to
 * the demo user ids / seed markers. It NEVER touches a real member row.
 *
 * Seed markers (for later find/clean):
 *   • club_circles.slug           →  *-v2demo   (nvda-earnings-v2demo, …)
 *   • feed_posts.body substring   →  " [seed:v2demo]"
 *   • xp_events.ref_id prefix     →  "seed:v2demo:"
 *   • demo emails                 →  *@cheatcode-qa.dev
 *   • demo family id              →  d0000000-0000-4000-8000-00000000d200
 *
 * Usage:
 *   cd /Users/kwaysclawd/projects/fta-dashboard && \
 *   node --env-file=.env.local scripts/seed-v2-demo.ts
 *   (DEMO_PASSWORD env optional; falls back to a constant.)
 * ------------------------------------------------------------------
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // rely on process.env (e.g. --env-file)
  }
  return env;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

const DAY = 86400000;
const DEMO_FAMILY = "d0000000-0000-4000-8000-00000000d200";
const MARKER = " [seed:v2demo]";

interface DemoUser {
  email: string;
  display_name: string;
  username: string;
  targetXp: number; // lands them in a distinct belt
  belt: string; // documentation only
  primary: boolean; // primary cohort → we create/upsert their profile
}

// 6 named members spread across DISTINCT belts, plus the two QA accounts reused.
const NAMED: DemoUser[] = [
  { email: "optionsog@cheatcode-qa.dev", display_name: "OptionsOG", username: "optionsog", targetXp: 3400, belt: "Black", primary: true },
  { email: "tiffanyr@cheatcode-qa.dev", display_name: "Tiffany R.", username: "tiffanyr", targetXp: 2400, belt: "Purple II", primary: true },
  { email: "datadive@cheatcode-qa.dev", display_name: "DataDive", username: "datadive", targetXp: 1600, belt: "Purple I", primary: true },
  { email: "deshawnk@cheatcode-qa.dev", display_name: "DeShawn K.", username: "deshawnk", targetXp: 1000, belt: "Blue II", primary: true },
  { email: "mayainvests@cheatcode-qa.dev", display_name: "Maya", username: "mayainvests", targetXp: 500, belt: "Blue I", primary: true },
  { email: "jcharts@cheatcode-qa.dev", display_name: "JCharts", username: "jcharts", targetXp: 250, belt: "Yellow", primary: true },
];
// QA accounts (already exist) — reuse id only, DON'T overwrite their profile.
const REUSE: { email: string; targetXp: number; belt: string }[] = [
  { email: "cardtest@cheatcode-qa.dev", targetXp: 60, belt: "White" },
  { email: "cardtest2@cheatcode-qa.dev", targetXp: 180, belt: "Yellow" },
];

/** Create-or-fetch an auth user with a known password. Returns the user id, or null if not found and notCreate. */
async function ensureUser(db: DB, email: string, password: string, create: boolean): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users as Array<{ id: string; email?: string | null }>;
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) {
      if (create) await db.auth.admin.updateUserById(hit.id, { password, email_confirm: true });
      return hit.id;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  if (!create) return null;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const password = env.DEMO_PASSWORD || "V2Demo!seed2026";

  const db = createClient(url, key, { auth: { persistSession: false } });

  const summary: Record<string, number> = {};

  // ── 0. demo family ──────────────────────────────────────────────────────────
  {
    const { error } = await db
      .from("families")
      .upsert({ id: DEMO_FAMILY, name: "V2 Demo Club", plan_tier: "academy" }, { onConflict: "id" });
    if (error) throw error;
  }

  // ── 1. users + profiles ─────────────────────────────────────────────────────
  // uid map keyed by a short handle we use throughout the script.
  const uid: Record<string, string> = {};
  const xpTargets: { id: string; target: number }[] = [];

  for (const u of NAMED) {
    const id = (await ensureUser(db, u.email, password, true))!;
    uid[u.username] = id;
    xpTargets.push({ id, target: u.targetXp });
    const { error } = await db.from("profiles").upsert(
      {
        id,
        family_id: DEMO_FAMILY,
        role: "parent",
        display_name: u.display_name,
        username: u.username,
        email: u.email,
        age_group: "adults",
        track: "adults",
        onboarding_complete: true,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
  }
  summary.users = NAMED.length;

  for (const r of REUSE) {
    const id = await ensureUser(db, r.email, password, false);
    if (id) {
      uid[r.email.split("@")[0]] = id; // "cardtest" / "cardtest2"
      xpTargets.push({ id, target: r.targetXp });
      summary.users += 1;
    }
  }

  // Ordered list of demo ids we are allowed to delete-scope against.
  const demoIds = Object.values(uid);
  // A stable pool of the primary 6 for content authoring.
  const pool = NAMED.map((u) => uid[u.username]);
  const [OG, TIFF, DIVE, DESH, MAYA, JC] = pool;

  // ── 2. club_circles + members + notes ───────────────────────────────────────
  const now = Date.now();
  interface CircleSpec {
    slug: string;
    title: string;
    topic: string;
    premise: string;
    ticker: string | null;
    createdDaysAgo: number;
    expiresDaysOut: number;
    creator: string;
    members: string[];
    notes: { author: string; stance: "bear" | "neutral" | "bull"; body: string }[];
  }
  const circles: CircleSpec[] = [
    {
      slug: "nvda-earnings-v2demo",
      title: "NVDA Earnings",
      topic: "Semis",
      premise: "Does the print beat the whisper, or does guidance finally cool the AI-capex trade? Positioning into the number.",
      ticker: "NVDA",
      createdDaysAgo: 3,
      expiresDaysOut: 6,
      creator: OG,
      members: [OG, TIFF, DIVE, DESH, MAYA],
      notes: [
        { author: OG, stance: "bull", body: "Data-center run-rate is still accelerating and channel checks read strong. I want to be long into the print with defined risk under the pre-earnings pivot." },
        { author: DIVE, stance: "neutral", body: "Beat is priced. The whole trade is the guide and the gross-margin commentary. I'd rather react than predict here." },
        { author: TIFF, stance: "bear", body: "Every hyperscaler already pre-announced capex. That's the setup for a sell-the-news even on a beat. Watching the first red 15-min candle." },
      ],
    },
    {
      slug: "fed-decision-v2demo",
      title: "Fed Decision",
      topic: "Macro",
      premise: "Hold vs. a dovish pivot. What the dot plot does to duration, and how fast the small-cap risk-on trade unwinds if they stay hawkish.",
      ticker: null,
      createdDaysAgo: 2,
      expiresDaysOut: 2,
      creator: TIFF,
      members: [TIFF, OG, DESH, JC],
      notes: [
        { author: TIFF, stance: "neutral", body: "Hold is the base case. The tell is the presser, not the statement. Fade the first move — it's usually the wrong one." },
        { author: DESH, stance: "bull", body: "If they even hint at cuts, rate-sensitive names and small caps rip. I have a basket ready to buy the confirmation, not the headline." },
      ],
    },
    {
      slug: "ai-capex-cycle-v2demo",
      title: "AI Capex Cycle",
      topic: "AI",
      premise: "How long does the buildout run before ROI questions bite? Tracking the second-order plays — power, cooling, networking — not just the GPUs.",
      ticker: null,
      createdDaysAgo: 5,
      expiresDaysOut: 20,
      creator: DIVE,
      members: [DIVE, OG, MAYA, TIFF, JC],
      notes: [
        { author: DIVE, stance: "bull", body: "The derivative trades are where the edge is now. Power and networking suppliers are still early in their own re-rating while everyone crowds the GPU names." },
        { author: MAYA, stance: "neutral", body: "Still learning this space. The capex numbers are staggering, but I want to understand who actually earns a return before I size anything up." },
      ],
    },
  ];

  // upsert circles on slug, then read back ids
  const circleRows = circles.map((c) => ({
    slug: c.slug,
    title: c.title,
    topic: c.topic,
    premise: c.premise,
    ticker: c.ticker,
    created_by: c.creator,
    created_at: new Date(now - c.createdDaysAgo * DAY).toISOString(),
    expires_at: new Date(now + c.expiresDaysOut * DAY).toISOString(),
  }));
  {
    const { error } = await db.from("club_circles").upsert(circleRows, { onConflict: "slug" });
    if (error) throw error;
  }
  const { data: circleIdRows, error: cErr } = await db
    .from("club_circles")
    .select("id, slug")
    .in(
      "slug",
      circles.map((c) => c.slug)
    );
  if (cErr) throw cErr;
  const circleIdBySlug: Record<string, string> = {};
  for (const r of (circleIdRows || []) as { id: string; slug: string }[]) circleIdBySlug[r.slug] = r.id;
  summary.circles = Object.keys(circleIdBySlug).length;

  // members (upsert on pk) + notes (delete demo-circle notes, reinsert)
  const memberRows: { circle_id: string; member_id: string; joined_at: string }[] = [];
  const noteRows: { circle_id: string; author_id: string; body: string; stance: string; created_at: string }[] = [];
  for (const c of circles) {
    const cid = circleIdBySlug[c.slug];
    if (!cid) continue;
    c.members.forEach((m, i) => {
      memberRows.push({ circle_id: cid, member_id: m, joined_at: new Date(now - (c.createdDaysAgo - 0.1 * i) * DAY).toISOString() });
    });
    c.notes.forEach((n, i) => {
      noteRows.push({
        circle_id: cid,
        author_id: n.author,
        body: n.body,
        stance: n.stance,
        created_at: new Date(now - (c.createdDaysAgo - 0.3 * (i + 1)) * DAY).toISOString(),
      });
    });
  }
  {
    const { error } = await db.from("club_circle_members").upsert(memberRows, { onConflict: "circle_id,member_id" });
    if (error) throw error;
  }
  summary.circle_members = memberRows.length;
  // notes: delete only within the demo circles, then reinsert
  {
    const demoCircleIds = Object.values(circleIdBySlug);
    if (demoCircleIds.length) {
      const { error: dErr } = await db.from("club_circle_notes").delete().in("circle_id", demoCircleIds);
      if (dErr) throw dErr;
    }
    const { error } = await db.from("club_circle_notes").insert(noteRows);
    if (error) throw error;
  }
  summary.circle_notes = noteRows.length;

  // ── 3. ticker_stances (current state) ───────────────────────────────────────
  // Mixed stances across tickers so divisiveness renders.
  interface StanceSpec {
    user: string;
    ticker: string;
    stance: "bull" | "bear" | "neutral";
    note: string;
  }
  const stances: StanceSpec[] = [
    { user: OG, ticker: "NVDA", stance: "bull", note: "Still the cleanest way to own the buildout. Trimming into strength, not selling." },
    { user: TIFF, ticker: "NVDA", stance: "bear", note: "Great company, crowded trade. Risk/reward is skewed short into the print." },
    { user: DIVE, ticker: "NVDA", stance: "neutral", note: "Waiting on the guide. No edge in guessing the number." },
    { user: OG, ticker: "TSLA", stance: "bear", note: "Margins compressing and the growth story keeps getting pushed out a year." },
    { user: DESH, ticker: "TSLA", stance: "bull", note: "Energy + FSD optionality is underpriced. Long-term hold." },
    { user: MAYA, ticker: "TSLA", stance: "neutral", note: "Too volatile for me to have conviction either way yet." },
    { user: DIVE, ticker: "NFLX", stance: "bull", note: "Ad tier is compounding faster than the street models. Pricing power intact." },
    { user: JC, ticker: "NFLX", stance: "bear", note: "Chart is extended into resistance. Fading the gap." },
    { user: TIFF, ticker: "SMCI", stance: "bull", note: "AI server demand is real; the accounting overhang is mostly cleared." },
    { user: DESH, ticker: "SMCI", stance: "bear", note: "Margin story is deteriorating and competition is catching up fast." },
    { user: OG, ticker: "PLTR", stance: "bull", note: "Commercial bookings inflecting. Valuation rich but growth justifies a look." },
    { user: JC, ticker: "PLTR", stance: "neutral", note: "Love the product, hate the multiple. On the sidelines." },
    { user: MAYA, ticker: "PLTR", stance: "bull", note: "First real position I understand end to end. Small and long." },
  ];
  {
    const rows = stances.map((s) => ({
      user_id: s.user,
      ticker: s.ticker,
      stance: s.stance,
      note: s.note,
    }));
    const { error } = await db.from("ticker_stances").upsert(rows, { onConflict: "user_id,ticker" });
    if (error) throw error;
  }
  summary.ticker_stances = stances.length;

  // ── 4. stance_events (authored flips) ───────────────────────────────────────
  // Delete demo users' prior stance_events (all QA/demo ids), then insert flips.
  {
    const { error: dErr } = await db.from("stance_events").delete().in("user_id", demoIds);
    if (dErr) throw dErr;
  }
  interface FlipSpec {
    user: string;
    ticker: string;
    from: "bull" | "bear" | "neutral";
    to: "bull" | "bear" | "neutral";
    reason: "valuation" | "thesis_broken" | "new_evidence" | "risk_increased" | "better_opportunity";
    note: string;
    daysAgo: number;
  }
  const flips: FlipSpec[] = [
    { user: TIFF, ticker: "NVDA", from: "bull", to: "bear", reason: "valuation", note: "Changed my mind. The multiple finally ran past where I can defend it into a print this crowded.", daysAgo: 4 },
    { user: OG, ticker: "TSLA", from: "bull", to: "bear", reason: "thesis_broken", note: "My delivery-growth thesis broke this quarter. Owning that I was wrong and flipping short-term bearish.", daysAgo: 6 },
    { user: DESH, ticker: "SMCI", from: "bull", to: "bear", reason: "risk_increased", note: "Margin compression + rising competition raised the risk past my comfort. Stepping to the other side.", daysAgo: 2 },
    { user: DIVE, ticker: "NFLX", from: "neutral", to: "bull", reason: "new_evidence", note: "The ad-tier engagement data changed my read. New evidence, new position.", daysAgo: 8 },
  ];
  // ensure the current ticker_stances reflect each flip's to_stance
  {
    const rows = flips.map((f) => ({ user_id: f.user, ticker: f.ticker, stance: f.to, note: f.note }));
    const { error } = await db.from("ticker_stances").upsert(rows, { onConflict: "user_id,ticker" });
    if (error) throw error;
  }
  const flipInsert = flips.map((f) => ({
    user_id: f.user,
    ticker: f.ticker,
    from_stance: f.from,
    to_stance: f.to,
    reason: f.reason,
    note: f.note,
    is_flip: true,
    created_at: new Date(now - f.daysAgo * DAY).toISOString(),
  }));
  const { data: flipRows, error: fErr } = await db
    .from("stance_events")
    .insert(flipInsert)
    .select("id, user_id, ticker");
  if (fErr) throw fErr;
  summary.stance_events = (flipRows || []).length;

  // ── 5. feed_posts (delete by marker+author, reinsert) ───────────────────────
  {
    const { error: dErr } = await db
      .from("feed_posts")
      .delete()
      .in("author_id", demoIds)
      .like("body", "%[seed:v2demo]%");
    if (dErr) throw dErr;
  }
  interface PostSpec {
    author: string;
    body: string;
    ticker_tags: string[];
    position: "bull" | "neutral" | "bear" | null;
    content_type: "thesis" | "question" | "risk" | "chart" | "changed_mind" | null;
    daysAgo: number;
  }
  const posts: PostSpec[] = [
    { author: OG, body: "Thesis: the AI-compute cycle isn't a bubble yet, it's a capacity shortage. Until lead times normalize, the picks-and-shovels names keep working.", ticker_tags: ["NVDA", "SMCI"], position: "bull", content_type: "thesis", daysAgo: 1 },
    { author: DIVE, body: "The trade nobody's talking about is power. Data centers can't run without it and the utilities feeding them are still priced like bond proxies.", ticker_tags: ["NVDA"], position: "bull", content_type: "thesis", daysAgo: 2 },
    { author: TIFF, body: "Risk flag: hyperscaler capex is a coincident indicator, not a leading one. When it rolls over, it rolls over fast. Sizing accordingly.", ticker_tags: ["NVDA", "SMCI"], position: "bear", content_type: "risk", daysAgo: 2 },
    { author: TIFF, body: "Changed my mind on Nvidia into the print. I was long the thesis for a year — the valuation finally outran what I can defend. Flipping short-term bearish.", ticker_tags: ["NVDA"], position: "bear", content_type: "changed_mind", daysAgo: 4 },
    { author: DESH, body: "Question for the room: is anyone actually modeling SMCI's gross margin bottoming, or are we all just eyeballing the chart?", ticker_tags: ["SMCI"], position: "neutral", content_type: "question", daysAgo: 3 },
    { author: JC, body: "NFLX is pinned right under the March highs. Clean level. I'm fading the first rejection and covering on a daily close above.", ticker_tags: ["NFLX"], position: "bear", content_type: "chart", daysAgo: 1 },
    { author: DIVE, body: "Palantir commercial bookings inflected again. The government story got it here, the commercial story is what re-rates it. Long and patient.", ticker_tags: ["PLTR"], position: "bull", content_type: "thesis", daysAgo: 3 },
    { author: MAYA, body: "First real thesis I've written: I own PLTR because I actually use software like it at work and I understand why it's sticky. Small position, long horizon.", ticker_tags: ["PLTR"], position: "bull", content_type: "thesis", daysAgo: 2 },
    { author: OG, body: "TSLA thesis broke for me this quarter. Delivery growth was the whole bull case and it stalled. Not a short forever — just not a long right now.", ticker_tags: ["TSLA"], position: "bear", content_type: "changed_mind", daysAgo: 6 },
    { author: DESH, body: "Counterpoint on TSLA: energy storage is compounding triple digits and nobody's paying for it. The car business is the free option now.", ticker_tags: ["TSLA"], position: "bull", content_type: "thesis", daysAgo: 5 },
    { author: JC, body: "Question: how are people playing the Fed this week — buying the confirmation or trying to front-run the pivot? I've been burned front-running.", ticker_tags: [], position: "neutral", content_type: "question", daysAgo: 2 },
    { author: TIFF, body: "Reminder that a beat with weak guidance is still a sell. Watching the first 15-minute candle after the NVDA print for the real signal, not the headline number.", ticker_tags: ["NVDA"], position: "neutral", content_type: "risk", daysAgo: 1 },
  ];
  const postInsert = posts.map((p) => ({
    author_id: p.author,
    family_id: DEMO_FAMILY,
    kind: "post" as const,
    body: p.body + MARKER,
    ticker_tags: p.ticker_tags,
    position: p.position,
    content_type: p.content_type,
    created_at: new Date(now - p.daysAgo * DAY).toISOString(),
  }));
  const { data: postRows, error: pErr } = await db.from("feed_posts").insert(postInsert).select("id");
  if (pErr) throw pErr;
  const postIds = ((postRows || []) as { id: string }[]).map((r) => r.id);
  summary.feed_posts = postIds.length;

  // ── 6. object_reactions (delete demo-user reactions, reinsert) ──────────────
  {
    const { error: dErr } = await db.from("object_reactions").delete().in("user_id", demoIds);
    if (dErr) throw dErr;
  }
  const reactionRows: { target_type: string; target_id: string; user_id: string; reaction: string }[] = [];
  const FEED_REACTIONS = ["strong_point", "agree", "needs_evidence", "missing_risk", "saved"];
  // spread reactions across posts from members OTHER than the author
  postIds.forEach((pid, i) => {
    // pick 2-3 reactors deterministically
    const reactors = [pool[(i + 1) % pool.length], pool[(i + 3) % pool.length], pool[(i + 5) % pool.length]];
    reactors.forEach((rId, j) => {
      reactionRows.push({
        target_type: "feed_post",
        target_id: pid,
        user_id: rId,
        reaction: FEED_REACTIONS[(i + j) % FEED_REACTIONS.length],
      });
    });
  });
  // respect on the authored flips (the "reward the update" mechanic)
  ((flipRows || []) as { id: string; user_id: string }[]).forEach((f, i) => {
    const reactors = [pool[(i + 2) % pool.length], pool[(i + 4) % pool.length]];
    reactors.forEach((rId) => {
      if (rId === f.user_id) return; // don't respect your own flip
      reactionRows.push({ target_type: "stance_event", target_id: f.id, user_id: rId, reaction: "respect" });
    });
  });
  // de-dup within this batch on the pk tuple (multiple posts can pick same reactor+reaction)
  const seen = new Set<string>();
  const dedupReactions = reactionRows.filter((r) => {
    const k = `${r.target_type}|${r.target_id}|${r.user_id}|${r.reaction}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  {
    const { error } = await db
      .from("object_reactions")
      .upsert(dedupReactions, { onConflict: "target_type,target_id,user_id,reaction" });
    if (error) throw error;
  }
  summary.object_reactions = dedupReactions.length;

  // ── 7. xp_events (delete by marker+demo ids, reinsert to hit belt targets) ──
  {
    const { error: dErr } = await db
      .from("xp_events")
      .delete()
      .in("user_id", demoIds)
      .like("ref_id", "seed:v2demo%");
    if (dErr) throw dErr;
  }
  const xpRows: { user_id: string; amount: number; kind: string; ref_id: string; created_at: string }[] = [];
  for (const { id, target } of xpTargets) {
    // split the target across 3 trailing weeks so weeks_active + windows look lived-in
    const chunks = [Math.round(target * 0.5), Math.round(target * 0.3), target - Math.round(target * 0.5) - Math.round(target * 0.3)];
    chunks.forEach((amt, i) => {
      if (amt <= 0) return;
      xpRows.push({
        user_id: id,
        amount: amt,
        kind: "bonus",
        ref_id: `seed:v2demo:${i}`,
        created_at: new Date(now - (i * 7 + 1) * DAY).toISOString(),
      });
    });
  }
  {
    const { error } = await db.from("xp_events").insert(xpRows);
    if (error) throw error;
  }
  summary.xp_events = xpRows.length;

  // ── 8. session_rsvps for the next upcoming live_session (skip if none) ───────
  {
    const { data: sessions, error: sErr } = await db
      .from("live_sessions")
      .select("id, title, scheduled_at")
      .gt("scheduled_at", new Date(now).toISOString())
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (sErr) throw sErr;
    if (sessions && sessions.length) {
      const sid = (sessions[0] as { id: string }).id;
      const rsvpRows = demoIds.map((u) => ({ session_id: sid, user_id: u, family_id: DEMO_FAMILY }));
      const { error } = await db.from("session_rsvps").upsert(rsvpRows, { onConflict: "session_id,user_id" });
      if (error) throw error;
      summary.session_rsvps = rsvpRows.length;
    } else {
      summary.session_rsvps = 0;
      console.log("no upcoming live_sessions, skipped rsvps");
    }
  }

  console.log(JSON.stringify({ ok: true, demoFamily: DEMO_FAMILY, ...summary }, null, 2));
}

main().catch((e) => {
  console.error("SEED FAILED:", e?.message || e);
  process.exit(1);
});
