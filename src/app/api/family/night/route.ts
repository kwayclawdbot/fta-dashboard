import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardXp, hasXpForRef } from "@/lib/xp";
import { isParentRole } from "@/lib/family/roles";
import { FAMILY_NIGHT_XP, familyNightRef } from "@/lib/family/night";

export const dynamic = "force-dynamic";

const NIGHT_RE = /^\d{4}-\d{2}-\d{2}$/;

interface NightBody {
  night?: string;
  attendeeIds?: string[];
  ticker?: string;
  companyName?: string;
}

interface AttendeeResult {
  id: string;
  awarded: boolean;
  alreadyAwarded: boolean;
  xp: number;
}

/**
 * FAMILY NIGHT — attendance + XP.
 *
 * WHY THIS IS A ROUTE AND NOT A BROWSER WRITE. Every other XP payout in Family
 * Mode is the member paying themselves: the watchlist vote inserts its own
 * xp_events row from the client, and the INSERT policy on xp_events is own-row
 * only (`user_id = auth.uid()`, migration 020). Family night is the one action
 * where ONE person (the parent running the evening) records XP for OTHER people
 * (everybody who showed up). That write is impossible from the browser by
 * design, and loosening the policy to allow it would let any member mint XP for
 * any other. So the payout happens here, behind the service role, with the two
 * checks the policy would otherwise have made:
 *
 *   1. the caller is a parent (or admin) — read from the DATABASE, never body;
 *   2. every attendee shares the caller's family_id — also read from the
 *      database. A client-supplied family_id or role is ignored entirely.
 *
 * De-dupe is the same mechanism the rest of the app uses: ref_id
 * `family_night:<YYYY-MM-DD>`, checked with hasXpForRef before the insert, so
 * re-opening tonight's flow (or two parents logging the same night) pays once.
 *
 * awardXp() swallows its own errors by design, so "awarded" is confirmed by
 * re-reading the ref rather than assumed. The UI reports what actually landed.
 */
export async function POST(req: Request) {
  let body: NightBody;
  try {
    body = (await req.json()) as NightBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const night = (body.night || "").trim();
  if (!NIGHT_RE.test(night)) {
    return NextResponse.json({ error: "A night date is required." }, { status: 400 });
  }

  const attendeeIds = [
    ...new Set((body.attendeeIds ?? []).filter((id) => typeof id === "string" && id)),
  ];
  if (!attendeeIds.length) {
    return NextResponse.json(
      { error: "Nobody was marked as present, so there is nothing to record." },
      { status: 400 }
    );
  }

  // ── who is asking ────────────────────────────────────────────────────────
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: me } = await db
    .from("profiles")
    .select("role, family_id")
    .eq("id", user.id)
    .maybeSingle();

  const caller = me as { role: string | null; family_id: string | null } | null;
  if (!caller?.family_id) {
    return NextResponse.json({ error: "No family on this account." }, { status: 403 });
  }
  if (!isParentRole(caller.role)) {
    return NextResponse.json(
      { error: "Only a parent can record family night." },
      { status: 403 }
    );
  }

  const familyId = caller.family_id;
  const admin = createAdminClient();

  // ── every attendee must be in THIS household ─────────────────────────────
  const { data: roster } = await admin
    .from("profiles")
    .select("id, family_id")
    .in("id", attendeeIds);

  const inFamily = new Set(
    ((roster ?? []) as { id: string; family_id: string | null }[])
      .filter((p) => p.family_id === familyId)
      .map((p) => p.id)
  );
  if (inFamily.size !== attendeeIds.length) {
    return NextResponse.json(
      { error: "Somebody on that list is not in this family." },
      { status: 403 }
    );
  }

  // ── the payout ───────────────────────────────────────────────────────────
  const ref = familyNightRef(night);
  const results: AttendeeResult[] = [];

  for (const id of attendeeIds) {
    const already = await hasXpForRef(admin, id, "community", ref);
    if (already) {
      results.push({ id, awarded: false, alreadyAwarded: true, xp: 0 });
      continue;
    }
    await awardXp(admin, id, "community", FAMILY_NIGHT_XP, ref);
    // awardXp is non-fatal by contract — confirm rather than claim.
    const landed = await hasXpForRef(admin, id, "community", ref);
    results.push({
      id,
      awarded: landed,
      alreadyAwarded: false,
      xp: landed ? FAMILY_NIGHT_XP : 0,
    });
  }

  // ── the transcript (best effort) ─────────────────────────────────────────
  // THE LEDGER OF RECORD IS xp_events. The rows above are what makes tonight
  // real and readable back — family_night_sessions is a transcript that adds
  // the ticker and who hosted, and it only exists once migration 203 has been
  // applied. Until then this throws "relation does not exist" and is swallowed;
  // nothing in the UI reads it, so the flow works today either way.
  try {
    await admin.from("family_night_sessions").upsert(
      {
        family_id: familyId,
        night,
        ticker: (body.ticker || "").trim() || null,
        company_name: (body.companyName || "").trim() || null,
        host_id: user.id,
        attendee_ids: attendeeIds,
      },
      { onConflict: "family_id,night" }
    );
  } catch {
    /* transcript table not applied yet — see above */
  }

  return NextResponse.json({
    night,
    xpPerAttendee: FAMILY_NIGHT_XP,
    results,
  });
}
