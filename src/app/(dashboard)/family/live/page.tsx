export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import { listLiveEvents } from "@/lib/live/queries";
import { getFamilyContext, getGuardrails } from "@/lib/family/queries";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import {
  FamilySurface,
  FamilyMast,
  BackLine,
  FoundingState,
  AbsenceNote,
  XpTag,
} from "@/components/family/canvas";

/**
 * F7 · FAMILY LIVE CLASS.
 *
 * The canvas draws this at "126 families" watching, with a live poll and a
 * raise-hand. Production has a handful of families and a scheduled-class object
 * with an RSVP — so this screen shows what is actually true: the classes, when
 * they run, who is hosting, and whether this household said it is coming.
 *
 * The audience count is deliberately not rendered as a headline. Below the
 * floor a real number ("2 families interested") reads worse than no number, and
 * a fabricated one is not on the table. The room's own attendance shows once
 * there is a room; until then the screen is about the schedule.
 *
 * The listen-only guardrail is surfaced here, honestly labelled: it is recorded
 * and honoured, but live classes are broadcasts today — there is no speak path
 * to block, so it binds the moment room audio ships.
 */
export default async function FamilyLivePage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const [{ live, upcoming, replays }, kidGuardrails] = await Promise.all([
    listLiveEvents(db, ctx.userId),
    ctx.kids[0] ? getGuardrails(db, ctx.kids[0].id, ctx.familyId) : Promise.resolve(null),
  ]);

  const classes = [...live, ...upcoming].filter((e) => e.room_type === "class");
  const pastClasses = replays.filter((e) => e.room_type === "class");
  const now = live.find((e) => e.room_type === "class") ?? null;

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-6">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        eyebrow="Family live"
        title="Class, for the whole"
        mark="household"
        lede="Building a strong financial future together — one room, every age."
      />

      {/* ── On now ───────────────────────────────────────────────────────*/}
      {now && (
        <section className="mt-10">
          <SectionRule>On now</SectionRule>
          <p className="mt-4 font-display text-display-2 font-extrabold text-ink">
            {now.title}
          </p>
          <p className="mt-2 text-[15px] text-soft">
            {now.host.name} on stage
            {now.description ? ` · ${now.description}` : ""}
          </p>
          {now.join_url && (
            <p className="mt-4">
              <a
                href={now.join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-night-950"
              >
                Join the room
              </a>
            </p>
          )}
        </section>
      )}

      {/* ── The schedule ─────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Up next this week</SectionRule>
        {classes.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="No class on the calendar right now"
              body="Live classes are scheduled in blocks. When the next one is set it lands here with its host and its time, and the whole household can say it is coming in one tap."
              action={
                <Link
                  href="/live"
                  className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                >
                  See everything live →
                </Link>
              }
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {classes.map((e) => {
              const when = new Date(e.starts_at);
              return (
                <Link
                  key={e.id}
                  href={`/live/${e.id}`}
                  className="f0-ledger-row f0-focus justify-between"
                >
                  <span className="w-14 shrink-0 self-center font-display text-[12px] font-extrabold uppercase tracking-[0.08em] text-gold-700">
                    {when.toLocaleDateString(undefined, { weekday: "short" })}
                    <br />
                    {when.toLocaleTimeString(undefined, { hour: "numeric" })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-bold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-[13px] text-soft">
                      w/ {e.host.name}
                      {e.duration_min ? ` · ${e.duration_min} min` : ""}
                      {e.interested ? " · you're in" : ""}
                    </p>
                  </div>
                  <XpTag amount={25} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Who's coming ─────────────────────────────────────────────────
          Household scale: show the actual people, not an inflated count. */}
      <section className="mt-12">
        <SectionRule>Your household</SectionRule>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          {ctx.members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2">
              <Avatar
                name={m.display_name}
                avatarUrl={m.avatar_url}
                role={m.role}
                xp={m.xp}
                size="sm"
              />
              <span className="text-[13px] text-soft">{m.display_name || "Member"}</span>
            </span>
          ))}
        </div>
        {kidGuardrails?.live_listen_only && (
          <AbsenceNote>
            Supervised members are set to listen only. Live classes are broadcasts
            today — there is no microphone or raise-hand to switch off — so this
            setting is recorded and takes effect the moment room audio ships.
          </AbsenceNote>
        )}
      </section>

      {/* ── Replays ──────────────────────────────────────────────────────*/}
      {pastClasses.length > 0 && (
        <section className="mt-12">
          <SectionRule>Missed one?</SectionRule>
          <div className="f0-ledger mt-2">
            {pastClasses.slice(0, 6).map((e) => (
              <Link
                key={e.id}
                href={`/live/${e.id}`}
                className="f0-ledger-row f0-focus justify-between"
              >
                <p className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
                  {e.title}
                </p>
                <span className="shrink-0 self-center text-[13px] text-soft">
                  {e.ended_at
                    ? new Date(e.ended_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "Replay"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </FamilySurface>
  );
}
