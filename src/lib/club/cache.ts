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
    // The SQL function holds an advisory lock, so a concurrent refresh is a
    // cheap no-op. Bounded — never block the response for long.
    await admin.rpc("refresh_club_metrics");
  } catch {
    // Never let a refresh hiccup break a home-page read; stale data is fine.
  }
}
