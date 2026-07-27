export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import {
  getFamilyContext,
  getGuardrails,
  getGuardrailEvents,
  getDigest,
} from "@/lib/family/queries";
import { minutesLabel } from "@/lib/family/guardrails";
import GuardrailControls from "@/components/family/GuardrailControls";
import {
  FamilySurface,
  BackLine,
  FoundingState,
  AbsenceNote,
  Numeral,
  NumeralRow,
  pct,
} from "@/components/family/canvas";

/**
 * F3 · PARENTAL CONTROLS.
 *
 * "Only admins can change these · changes are logged" — both halves are real.
 * The write path is a definer RPC that checks the caller is a parent in this
 * household before it touches a row, and every accepted change appends to
 * family_guardrail_events and notifies the other parent.
 *
 * The digest below reads only numbers something actually writes:
 *   time in app  ← family_activity_days, credited a minute at a time
 *   lessons      ← lesson_progress completions in the last 7 days
 *   paper P&L    ← the child's sim_portfolio, via the definer read
 *   XP earned    ← xp_events in the last 7 days
 *   flags        ← nothing. There is no moderation-flag store in this product,
 *                  so the slot says so rather than printing a reassuring 0.
 */
export default async function GuardrailsPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isParent) redirect(`/family/teen/${memberId}`);

  const member = ctx.members.find((m) => m.id === memberId);
  if (!member || member.role !== "child") redirect("/family");

  const [guardrails, events, digest] = await Promise.all([
    getGuardrails(db, memberId, ctx.familyId),
    getGuardrailEvents(db, memberId),
    getDigest(db, memberId),
  ]);

  const name = member.display_name || "your teen";

  return (
    <FamilySurface className="pb-16">
      <div className="mb-6">
        <BackLine href={`/family/teen/${memberId}`} label={name} />
      </div>

      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Parental controls
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-none text-ink">
          {name}&rsquo;s guardrails
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          Only parents in this household can change these, and changes are
          logged.
        </p>
      </header>

      <div className="mt-12">
        <GuardrailControls initial={guardrails} childName={name} />
      </div>

      {/* ── The weekly digest ────────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule>This week&rsquo;s digest</SectionRule>
        {!digest ? (
          <div className="mt-5">
            <FoundingState
              title="Nothing to report yet"
              body="The digest fills in once there is a week to summarise — time in the app, lessons finished, how the paper account moved, and the XP earned along the way."
            />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <NumeralRow>
                <Numeral
                  value={minutesLabel(digest.app_minutes)}
                  label="Time in app"
                  size="sm"
                />
                <Numeral value={String(digest.lessons)} label="Lessons" size="sm" />
                <Numeral
                  value={pct(digest.paper_pct, 1)}
                  label="Paper P&L"
                  size="sm"
                  tone={
                    digest.paper_pct == null
                      ? "ink"
                      : digest.paper_pct >= 0
                        ? "price-up"
                        : "price-down"
                  }
                />
                <Numeral value={digest.xp.toLocaleString()} label="XP earned" size="sm" />
                <Numeral value="—" label="Flags" size="sm" />
              </NumeralRow>
            </div>

            <AbsenceNote>
              Time in app counts the minutes a Family Mode screen was open —
              it is measured, not estimated, and it does not yet include the
              rest of the app. Flags shows an em-dash because this product has
              no moderation-flag store; a zero there would be a claim we cannot
              make.
            </AbsenceNote>

            {digest.learn_seconds > 0 && (
              <p className="mt-3 text-[13px] text-soft">
                {minutesLabel(Math.round(digest.learn_seconds / 60))} of that was
                inside lessons.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Recent changes ───────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Recent changes</SectionRule>
        {events.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="No changes yet"
              body="Every guardrail change lands here with the parent who made it and when. Nothing has been altered since this account was set up."
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {events.map((e) => (
              <div key={e.id} className="f0-ledger-row justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-ink">
                    {describeChange(e.setting, e.new_value)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-soft">
                    by {e.actor_name || "a parent"}
                  </p>
                </div>
                <span className="shrink-0 self-center text-[13px] uppercase tracking-[0.06em] text-soft">
                  {new Date(e.created_at).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </FamilySurface>
  );
}

/** Turns an audit row into the sentence a parent would have said. */
function describeChange(setting: string, value: unknown): string {
  switch (setting) {
    case "chat_family_only":
      return value ? "Chat limited to the Family Circle" : "Chat opened beyond the Family Circle";
    case "downtime_enabled":
      return value ? "Downtime turned on" : "Downtime turned off";
    case "downtime_start_hour":
      return "Downtime start moved";
    case "downtime_end_hour":
      return "Downtime end moved";
    case "daily_limit_min":
      return value == null ? "Daily limit removed" : `Daily limit set to ${String(value)} min`;
    case "live_listen_only":
      return value ? "Live rooms set to listen only" : "Live rooms opened";
    case "tz":
      return "Household time zone changed";
    default:
      return "Guardrail changed";
  }
}
