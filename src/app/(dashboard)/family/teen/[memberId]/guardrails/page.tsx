export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
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
  FamilyCard,
  RowCard,
  Row,
  SectionLabel,
  Eyebrow,
  StatTiles,
  FoundingState,
  AbsenceNote,
  pct,
} from "@/components/family/canvas";

/**
 * F3 · PARENTAL CONTROLS — board tile "F3 Parental Controls".
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
  const belt = beltForXp(member.xp);

  return (
    <FamilySurface className="pb-16">
      <div className="mb-5">
        <BackLine href={`/family/teen/${memberId}`} label={name} />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────*/}
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow tone="accent">Parental controls</Eyebrow>
          <h1 className="mt-1.5 font-display text-display-2 font-extrabold text-ink">
            {name}&rsquo;s guardrails
          </h1>
          <p className="mt-1.5 text-[12px] text-soft">
            Only parents in this household can change these · every change is logged
          </p>
        </div>
        <span
          className="grid shrink-0 place-items-center rounded-full p-[2.5px]"
          style={{ background: belt.belt.hex }}
        >
          <span className="grid place-items-center rounded-full bg-paper p-[1.5px]">
            <Avatar
              name={member.display_name}
              avatarUrl={member.avatar_url}
              role={member.role}
              size="lg"
            />
          </span>
        </span>
      </header>

      <div className="mt-7">
        {/* THE WRITE GATE IS THE SERVER'S, not this page's. `isParent` admits
            `parent || admin` so an admin-parent reaches this screen at all;
            whether the RPC accepts the write is decided by
            set_family_guardrail. The controls therefore start live for anyone
            who got here, and drop to a stated read-only posture the moment the
            server refuses — which is the correct behaviour both before and
            after migration 200 widens the RPC to `role in ('parent','admin')`.
            A viewer with no parent role at all is handed the read-only surface
            up front rather than switches that will bounce. */}
        <GuardrailControls
          initial={guardrails}
          childName={name}
          canWrite={ctx.isParent}
          readOnlyReason={
            "This account can see these guardrails but not change them — a guardrail write is accepted only from a parent in this household."
          }
        />
      </div>

      {/* ── The weekly digest ────────────────────────────────────────────*/}
      <FamilyCard tone="warm" className="mt-2">
        <Eyebrow tone="accent">This week&rsquo;s digest</Eyebrow>
        {!digest ? (
          <div className="mt-3">
            <FoundingState
              title="Nothing to report yet"
              body="The digest fills in once there is a week to summarise — time in the app, lessons finished, how the paper account moved, and the XP earned along the way."
            />
          </div>
        ) : (
          <>
            <StatTiles
              inset
              className="mt-3"
              items={[
                { value: minutesLabel(digest.app_minutes), label: "Time in app" },
                { value: String(digest.lessons), label: "Lessons" },
                {
                  value: pct(digest.paper_pct, 1),
                  label: "Paper P&L",
                  tone:
                    digest.paper_pct == null
                      ? "ink"
                      : digest.paper_pct >= 0
                        ? "price-up"
                        : "price-down",
                },
                { value: `⚡${digest.xp.toLocaleString()}`, label: "XP earned", tone: "accent" },
                { value: "—", label: "Flags" },
              ]}
            />

            {digest.learn_seconds > 0 && (
              <p className="mt-3 text-[11.5px] text-soft">
                {minutesLabel(Math.round(digest.learn_seconds / 60))} of that was inside
                lessons.
              </p>
            )}

            <AbsenceNote>
              Time in app counts the minutes a Family Mode screen was open — it is
              measured, not estimated, and it does not yet include the rest of the
              app. Flags shows an em-dash because this product has no
              moderation-flag store; a zero there would be a claim we cannot make.
            </AbsenceNote>
          </>
        )}
      </FamilyCard>

      {/* ── Recent changes ───────────────────────────────────────────────*/}
      <SectionLabel tone="accent" className="mt-6">
        Recent changes
      </SectionLabel>
      {events.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="No changes yet"
            body="Every guardrail change lands here with the parent who made it and when. Nothing has been altered since this account was set up."
          />
        </div>
      ) : (
        <RowCard className="mt-3">
          {events.map((e) => (
            <Row
              key={e.id}
              icon={GLYPHS[e.setting] ?? "🛡"}
              label={
                <span className="font-normal">
                  {describeChange(e.setting, e.new_value)}{" "}
                  <span className="text-soft">· by {e.actor_name || "a parent"}</span>
                </span>
              }
              right={
                <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-soft">
                  {new Date(e.created_at).toLocaleDateString(undefined, { weekday: "short" })}
                </span>
              }
            />
          ))}
        </RowCard>
      )}

      <p className="mt-6 border-t border-sand pt-4 text-center text-[11px] text-soft">
        Guardrail changes notify both parents.
      </p>
    </FamilySurface>
  );
}

const GLYPHS: Record<string, string> = {
  chat_family_only: "👥",
  downtime_enabled: "🌙",
  downtime_start_hour: "🌙",
  downtime_end_hour: "🌙",
  daily_limit_min: "🕐",
  live_listen_only: "((·))",
  tz: "🌍",
};

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
