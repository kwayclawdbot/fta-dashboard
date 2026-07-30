import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureKaiIdentity } from "@/lib/kai/system-author";
import {
  circlesNotedToday,
  deriveKaiCircleNotes,
  deriveKaiPosts,
  existingPostKeys,
  polishKaiPosts,
  DEFAULT_LOOKBACK_DAYS,
} from "@/lib/kai/seed-content";

/**
 * KAI FEED SEED (LANE J) — weekday, 13:20 UTC (9:20am ET, ten minutes before
 * the US open and twenty minutes after the pre-open market wrap lands).
 *
 * Publishes up to three short Kai posts into `feed_posts` and at most one note
 * per open Circle into `club_circle_notes`, all derived from tables the other
 * crons already fill. See src/lib/kai/seed-content.ts for the derivation rules
 * and the compliance gate, and src/lib/kai/system-author.ts for the identity.
 *
 * IDEMPOTENT. Feed posts carry a deterministic key in
 * `activity_payload.kai_seed.key`; Circle notes are one-per-Circle-per-day by
 * their own timestamp. A retry, a double cron delivery or a manual re-hit all
 * publish nothing the second time.
 *
 * Auth mirrors the other crons exactly (news-ticker-events, alerts-digest):
 * `Authorization: Bearer $CRON_SECRET`, or `?secret=` for a manual run.
 *
 * OPERATIONAL PARAMS — none of them are used by the vercel.json entry:
 *   ?dry=1        derive and report, write nothing.
 *   ?force=1      ignore the published markers (backfill / re-run a bad day).
 *   ?lookback=N   widen the news freshness window from 1 day to N.
 *   ?joinwindow=N widen the Circle "recently joined" window from 1 day to N.
 * The two windows are TIME only. The magnitude thresholds that decide whether
 * something is worth saying are not reachable from the query string, so no
 * override can talk Kai into posting about a move that did not happen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const qs = req.nextUrl.searchParams;
  const dry = qs.get("dry") === "1";
  const force = qs.get("force") === "1";
  const lookbackDays = clampDays(qs.get("lookback"), DEFAULT_LOOKBACK_DAYS);
  const joinWindowDays = clampDays(qs.get("joinwindow"), 1);

  try {
    const db = createAdminClient();
    const now = new Date();
    const kaiId = await ensureKaiIdentity(db);

    // ── feed posts ──────────────────────────────────────────────────────────
    const derived = await deriveKaiPosts(db, { lookbackDays, now });
    const published = force ? new Set<string>() : await existingPostKeys(db, kaiId, now);
    const fresh = derived.filter((p) => !published.has(p.key));

    // The model only ever sees posts that are actually going to be written, so a
    // no-op run costs nothing and never touches the API.
    const posts = fresh.length > 0 ? await polishKaiPosts(fresh) : [];

    const wrotePosts: { key: string; id: string | null; body: string }[] = [];
    for (const p of posts) {
      if (dry) {
        wrotePosts.push({ key: p.key, id: null, body: p.body });
        continue;
      }
      const { data, error } = await db
        .from("feed_posts")
        .insert({
          author_id: kaiId,
          kind: "post",
          body: p.body,
          ticker_tags: p.tickers,
          // The marker + full provenance for the figures in the body. Invisible
          // to every reader; `kind` stays 'post' so no CHECK constraint moves.
          activity_payload: {
            kai_seed: { key: p.key, type: p.type, source: p.source, derived_at: now.toISOString() },
          },
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`feed_posts insert failed (${p.key}): ${error.message}`);
      wrotePosts.push({ key: p.key, id: (data as { id: string } | null)?.id ?? null, body: p.body });
    }

    // ── circle notes ────────────────────────────────────────────────────────
    const notesDerived = await deriveKaiCircleNotes(db, { joinWindowDays, now });
    const alreadyNoted = force ? new Set<string>() : await circlesNotedToday(db, kaiId, now);
    const notesFresh = notesDerived.filter((n) => !alreadyNoted.has(n.circleId));

    const wroteNotes: { circle: string; id: string | null; body: string }[] = [];
    for (const n of notesFresh) {
      if (dry) {
        wroteNotes.push({ circle: n.circleSlug, id: null, body: n.body });
        continue;
      }
      const { data, error } = await db
        .from("club_circle_notes")
        .insert({
          circle_id: n.circleId,
          author_id: kaiId,
          body: n.body,
          // Kai observes; it never stakes a position in a member's room.
          stance: null,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`club_circle_notes insert failed (${n.circleSlug}): ${error.message}`);
      wroteNotes.push({
        circle: n.circleSlug,
        id: (data as { id: string } | null)?.id ?? null,
        body: n.body,
      });
    }

    return NextResponse.json({
      ok: true,
      dry,
      force,
      kai_id: kaiId,
      lookback_days: lookbackDays,
      join_window_days: joinWindowDays,
      posts: { derived: derived.length, skipped: derived.length - fresh.length, written: wrotePosts },
      notes: {
        derived: notesDerived.length,
        skipped: notesDerived.length - notesFresh.length,
        written: wroteNotes,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "kai feed seed failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

/** 1-30 days, falling back to the default on anything unparseable. */
function clampDays(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(30, Math.floor(n));
}
