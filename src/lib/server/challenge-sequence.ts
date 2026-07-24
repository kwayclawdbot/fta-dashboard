/**
 * Challenge cohort sequence scheduling + enrollment (Lane C8 part 3).
 *
 * The 5-Day Investing Challenge is a SINGLE fixed-date cohort (starts Sept 1,
 * ends Sept 6, 2026). Every non-welcome step is pinned to a fixed calendar slot;
 * the daily cron only sends rows whose scheduled_at has passed. A late signup
 * (e.g. someone joining Aug 20) is scheduled ONLY for the still-future steps, so
 * past August emails never back-fire in a blast.
 *
 * enrollChallengeSequence() is called from the challenge register route with the
 * service-role admin client. It (1) inserts the future scheduled rows, then
 * (2) sends the REGISTRATION WELCOME immediately via Resend and logs it as a
 * 'sent' row — both gated by app_settings.challenge_emails_enabled (default true)
 * and by drip_optouts (shared opt-out with the welcome drips). Idempotent via the
 * (user_id, step) unique constraint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renderChallengeSequenceEmail,
  CLUB_CONTINUE_URL,
  FTA_CHALLENGE_URL,
  CHALLENGE_STEPS,
  type ChallengeStep,
} from "./challenge-sequence-emails";
import { APP_ORIGIN, dripUnsubUrl, sendDripEmail } from "./drips";

/**
 * Fixed cohort calendar (UTC ISO). `welcome` is intentionally absent — it is
 * sent immediately at registration, not scheduled. A future cohort just needs
 * these dates bumped.
 *
 * Note: show_dayof (12:00) and day1 (15:00) both land Sept 1 by design —
 * show_dayof is the morning orientation ("it's here, week overview"), day1 is
 * the actual mission, deliberately spaced ~3h apart.
 */
export const CHALLENGE_SCHEDULE: Record<Exclude<ChallengeStep, "welcome">, string> = {
  aug_watchlist: "2026-08-04T15:00:00Z",
  aug_kai: "2026-08-11T15:00:00Z",
  aug_screener: "2026-08-18T15:00:00Z",
  aug_belts: "2026-08-25T15:00:00Z",
  show_d3: "2026-08-29T15:00:00Z",
  show_d1: "2026-08-31T15:00:00Z",
  show_dayof: "2026-09-01T12:00:00Z",
  day1: "2026-09-01T15:00:00Z",
  day2: "2026-09-02T13:00:00Z",
  day3: "2026-09-03T13:00:00Z",
  day4: "2026-09-04T13:00:00Z",
  day5: "2026-09-05T13:00:00Z",
  close_stats: "2026-09-05T23:00:00Z",
  close_offer: "2026-09-06T15:00:00Z",
  close_lastcall: "2026-09-08T15:00:00Z",
};

/** Scheduled (non-welcome) rows whose slot is still in the future at `now`. */
export function futureScheduledRows(
  now: Date = new Date()
): { step: ChallengeStep; scheduled_at: string }[] {
  const nowMs = now.getTime();
  return (Object.keys(CHALLENGE_SCHEDULE) as Exclude<ChallengeStep, "welcome">[])
    .map((step) => ({ step, scheduled_at: CHALLENGE_SCHEDULE[step] }))
    .filter((r) => new Date(r.scheduled_at).getTime() > nowMs);
}

/** Sanity guard: the schedule must cover every non-welcome step exactly once. */
export function scheduleCoversAllSteps(): boolean {
  const scheduled = new Set(Object.keys(CHALLENGE_SCHEDULE));
  return CHALLENGE_STEPS.filter((s) => s !== "welcome").every((s) => scheduled.has(s));
}

export interface EnrollResult {
  ok: boolean;
  scheduled: number;
  welcome: { sent: boolean; resendId?: string; error?: string; skipped?: string };
  error?: string;
}

/**
 * Enroll a fresh challenge member: schedule the future steps and fire the
 * registration welcome immediately. Best-effort — the caller must never let a
 * failure here block the signup response.
 */
export async function enrollChallengeSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  opts: { userId: string; familyId: string; email: string; firstName: string }
): Promise<EnrollResult> {
  const { userId, familyId, email, firstName } = opts;
  const now = new Date();

  // Hard gate: the whole challenge machine is off if this flag is false.
  const { data: flag } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_emails_enabled")
    .maybeSingle();
  const enabled = flag?.value !== false; // default true

  // Shared opt-out with the welcome drips.
  const { data: optedOut } = await db
    .from("drip_optouts")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  // 1. Schedule the future steps (idempotent via unique(user_id, step)).
  const rows = futureScheduledRows(now).map((r) => ({
    user_id: userId,
    family_id: familyId,
    step: r.step,
    scheduled_at: r.scheduled_at,
    // If the machine is disabled or they've opted out, park the rows as
    // 'suppressed' so the cron never sends them (but the enrollment is recorded).
    status: enabled && !optedOut ? "pending" : "suppressed",
  }));
  let scheduled = 0;
  if (rows.length) {
    const { error: insErr, count } = await db
      .from("challenge_sequences")
      .upsert(rows, { onConflict: "user_id,step", ignoreDuplicates: true, count: "exact" });
    if (insErr) return { ok: false, scheduled: 0, welcome: { sent: false, error: insErr.message }, error: insErr.message };
    scheduled = count ?? rows.length;
  }

  // 2. Registration welcome — send now, log the row.
  if (!enabled) {
    await logWelcomeRow(db, userId, familyId, "suppressed", null, "challenge_emails_enabled=false");
    return { ok: true, scheduled, welcome: { sent: false, skipped: "challenge_emails_enabled=false" } };
  }
  if (optedOut) {
    await logWelcomeRow(db, userId, familyId, "suppressed", null, "opted out");
    return { ok: true, scheduled, welcome: { sent: false, skipped: "opted out" } };
  }
  if (!email || email.indexOf("@") < 0) {
    await logWelcomeRow(db, userId, familyId, "skipped", null, "no email");
    return { ok: true, scheduled, welcome: { sent: false, skipped: "no email" } };
  }

  const unsubUrl = dripUnsubUrl(userId);
  const { subject, html, text } = renderChallengeSequenceEmail("welcome", {
    firstName,
    appUrl: APP_ORIGIN,
    unsubUrl,
    continueUrl: CLUB_CONTINUE_URL,
    ftaUrl: FTA_CHALLENGE_URL,
  });
  const result = await sendDripEmail({ to: email, subject, html, text, unsubUrl });
  if (result.ok) {
    await logWelcomeRow(db, userId, familyId, "sent", result.id ?? null, null);
    return { ok: true, scheduled, welcome: { sent: true, resendId: result.id } };
  }
  await logWelcomeRow(db, userId, familyId, "failed", null, result.error ?? "send failed");
  return { ok: true, scheduled, welcome: { sent: false, error: result.error } };
}

async function logWelcomeRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  userId: string,
  familyId: string,
  status: "sent" | "failed" | "skipped" | "suppressed",
  resendId: string | null,
  error: string | null
): Promise<void> {
  await db
    .from("challenge_sequences")
    .upsert(
      {
        user_id: userId,
        family_id: familyId,
        step: "welcome",
        scheduled_at: new Date().toISOString(),
        sent_at: status === "sent" ? new Date().toISOString() : null,
        resend_id: resendId,
        status,
        error,
      },
      { onConflict: "user_id,step", ignoreDuplicates: true }
    )
    .then(undefined, () => {});
}
