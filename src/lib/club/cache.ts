import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Read-through freshness for the ClubHome cached aggregates.
 *
 * The heavy per-ticker Club Score is precomputed into club_trending /
 * club_metrics_kv by refresh_club_metrics() (migration 140), driven by a Vercel
 * Cron (POST /api/club/refresh). But the very first request, local dev, and any
 * window where the cron hasn't run yet must not serve an empty page — so read
 * endpoints call ensureClubMetricsFresh() first: if the cache is older than the
 * TTL (or missing), it triggers a refresh. An in-process throttle + the SQL
 * advisory lock inside the function keep concurrent requests from stampeding.
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes
let lastTriggeredAt = 0; // in-process throttle (per lambda instance)

export async function ensureClubMetricsFresh(): Promise<void> {
  const now = Date.now();
  // In-process throttle: never trigger more than once per TTL per instance,
  // regardless of DB state — protects the hot path under burst load.
  if (now - lastTriggeredAt < TTL_MS) return;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("club_trending")
      .select("computed_at")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const computedAt = data?.computed_at ? new Date(data.computed_at).getTime() : 0;
    if (now - computedAt < TTL_MS) {
      // Cache is warm — record so we don't re-check every request this window.
      lastTriggeredAt = now;
      return;
    }

    lastTriggeredAt = now;
    // Fire-and-forget: schedule the (expensive) recompute to run AFTER the
    // response is sent so a cold-cache request never blocks on it. The Vercel
    // Cron (POST /api/club/refresh, every 15 min) is the primary refresh; this
    // read-through is only a cold-start / local safety net. The SQL advisory
    // lock inside refresh_club_metrics makes a concurrent refresh a cheap no-op.
    const runRefresh = async (): Promise<void> => {
      try {
        await admin.rpc("refresh_club_metrics");
      } catch {
        /* stale data is fine — the cron refresh covers correctness */
      }
    };
    try {
      // next/server after(): runs post-response without holding up the request.
      after(runRefresh);
    } catch {
      // Called outside a request scope (not the route path) — detach it; the
      // cron still guarantees correctness.
      void runRefresh();
    }
  } catch {
    // Never let a refresh hiccup break a home-page read; stale data is fine.
  }
}
