#!/usr/bin/env node
/**
 * seed-ownership-demo.ts
 * ------------------------------------------------------------------
 * Mints 4 demo Ownership Cards for a given user id, with BACKDATED acquisition
 * dates so hold-age tiers AND value clubs actually trigger on the first cron run
 * (for the UI lane + screenshots). Idempotent-ish: it skips symbols the user
 * already has a card for.
 *
 *   NVDA  10   @ $142.00   acquired 2024-03-01   (deep gain + 1000d+ hold)
 *   AAPL  5    @ $170.00   acquired 2024-06-15
 *   VOO   10   @ $480.00   acquired 2023-09-01   (ETF, long hold)
 *   BTC   0.01 @ $52000    acquired 2024-02-01   (crypto)
 *
 * Uses the SERVICE-ROLE client and replicates mint_card exactly (card +
 * 'activated' event + 'issue' snapshot) so no auth session is needed. It does NOT
 * compute milestones — run the cron once afterwards to light up tiers/clubs.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-ownership-demo.ts <USER_ID>
 *   (or set DEMO_USER_ID; .env.local is also read directly as a fallback)
 * ------------------------------------------------------------------
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

interface DemoCard {
  symbol: string;
  assetName: string;
  assetType: "stock" | "etf" | "crypto";
  quantity: number;
  averagePrice: number;
  acquiredAt: string;
}

const DEMO: DemoCard[] = [
  { symbol: "NVDA", assetName: "NVIDIA Corp", assetType: "stock", quantity: 10, averagePrice: 142, acquiredAt: "2024-03-01T00:00:00Z" },
  { symbol: "AAPL", assetName: "Apple Inc", assetType: "stock", quantity: 5, averagePrice: 170, acquiredAt: "2024-06-15T00:00:00Z" },
  { symbol: "VOO", assetName: "Vanguard S&P 500 ETF", assetType: "etf", quantity: 10, averagePrice: 480, acquiredAt: "2023-09-01T00:00:00Z" },
  { symbol: "BTC", assetName: "Bitcoin / USD", assetType: "crypto", quantity: 0.01, averagePrice: 52000, acquiredAt: "2024-02-01T00:00:00Z" },
];

const ISSUE_DESIGN = {
  holdTier: "issued",
  valueClubs: [] as string[],
  series: "digital",
  rarity: null,
  designRev: 1,
};

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const userId = process.argv[2] || env.DEMO_USER_ID;
  if (!userId) {
    throw new Error(
      "Provide a user id: node --env-file=.env.local scripts/seed-ownership-demo.ts <USER_ID>"
    );
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Skip symbols this user already has a card for.
  const { data: existing } = await db
    .from("ownership_cards")
    .select("asset_symbol")
    .eq("owner_id", userId);
  const have = new Set(
    ((existing || []) as { asset_symbol: string }[]).map((r) => r.asset_symbol.toUpperCase())
  );

  let minted = 0;
  for (const d of DEMO) {
    if (have.has(d.symbol)) {
      console.log(`skip ${d.symbol} (already owned)`);
      continue;
    }
    const originalValue = Math.round(d.quantity * d.averagePrice * 100) / 100;

    const { data: card, error } = await db
      .from("ownership_cards")
      .insert({
        owner_id: userId,
        asset_symbol: d.symbol,
        asset_name: d.assetName,
        asset_type: d.assetType,
        denomination: d.quantity,
        acq_quantity: d.quantity,
        acq_avg_price: d.averagePrice,
        acq_original_value: originalValue,
        acq_at: d.acquiredAt,
        activated_at: d.acquiredAt,
        provider: "manual",
        design_state: ISSUE_DESIGN,
      })
      .select("id, serial")
      .single();

    if (error || !card) {
      console.error(`FAILED ${d.symbol}:`, error?.message);
      continue;
    }

    await db.from("card_events").insert({
      card_id: card.id,
      kind: "activated",
      payload: {
        symbol: d.symbol,
        quantity: d.quantity,
        averagePrice: d.averagePrice,
        originalValue,
        provider: "manual",
        acquiredAt: d.acquiredAt,
      },
      occurred_at: d.acquiredAt,
    });

    await db.from("card_snapshots").insert({
      card_id: card.id,
      label: "issue",
      value: originalValue,
      design_state: ISSUE_DESIGN,
      taken_at: d.acquiredAt,
    });

    console.log(`minted ${d.symbol} → ${card.serial}`);
    minted++;
  }

  console.log(`\nDone. Minted ${minted} card(s) for ${userId}.`);
  console.log("Next: hit GET /api/ownership/cron (Bearer CRON_SECRET) to light up tiers/clubs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
