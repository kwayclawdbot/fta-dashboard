export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import { listLiveEvents } from "@/lib/live/queries";
import { getFamilyContext, getGuardrails } from "@/lib/family/queries";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import {
  FamilySurface,
  BackLine,
  FamilyCard,
  RowCard,
  Row,
  SectionLabel,
  Chip,
  XpTag,
  PillAction,
  TextAction,
  FoundingState,
  AbsenceNote,
} from "@/components/family/canvas";

/**
 * F7 · FAMILY LIVE CLASS — board tile "F7 Live Class".
 *
 * Drawn as the board draws it: the LIVE strip with its attendance reward, the
 * class title, the stage, the participants row, and the week's schedule.
 *
 * THREE THINGS ON THE BOARD THAT ARE NOT BUILT, AND WHY:
 *
 *  · "Raise hand ✋". There is no speak or raise-hand write path anywhere in
 *    this product — live classes are scheduled broadcasts, and the only room
 *    action that exists is following the join link. Per the build rule, a drawn
 *    control with nothing behind it is not drawn: the footer bar keeps the
 *    board's two-action shape but both actions are real — join the room, and
 *    ask the household in the Family Circle.
 *  · The live poll. No poll or response store exists, so four tappable options
 *    with vote counts would be four fabrications.
 *  · "👥 126 families". That is an illustration; production has a handful. The
 *    real viewer count renders when the room reports one, and nothing renders
 *    when it does not.
 *
 * The listen-only guardrail is surfaced here, honestly labelled: it is recorded
 * and honoured, but with no speak path there is nothing yet for it to block.
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
  const scheduled = classes.filter((e) => e.id !== now?.id);

  const headline = now ?? classes[0] ?? null;

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      {/* ── The strip ────────────────────────────────────────────────────*/}
      <div className="flex flex-wrap items-center gap-2">
        {now ? (
          <Chip tone="solid">
            <span
              className="inline-block h-[5px] w-[5px] rounded-full bg-night-950 motion-safe:animate-pulse"
              aria-hidden
            />
            Live
          </Chip>
        ) : (
          <Chip tone="muted">Scheduled</Chip>
        )}
        {now != null && now.viewer_count > 0 && (
          <span className="font-mono text-[10px] text-soft">
            👥 {now.viewer_count.toLocaleString()} watching
          </span>
        )}
        <Chip tone="accent" className="ml-auto">
          Attend = ⚡ +25
        </Chip>
      </div>

      <h1 className="mt-3 font-display text-display-2 font-extrabold text-ink">
        {headline?.title ?? "Family live class"}
      </h1>
      <p className="mt-1.5 text-[12.5px] text-soft">
        Building a strong financial future together — one room, every age.
      </p>

      {/* ── The stage ────────────────────────────────────────────────────
          A real stage only when a room is actually open. There is no embedded
          player in this lane, so the stage is the host, the room and the way
          in — never a decorative video rectangle standing in for one. */}
      {now && (
        <div className="relative mt-4 overflow-hidden rounded-xl">
          <div className="f0-tile-field p-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] opacity-70">
              On stage now
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span
                className="grid shrink-0 place-items-center rounded-full p-[2px]"
                style={{ background: "var(--accent-solid)" }}
              >
                <Avatar name={now.host.name} avatarUrl={now.host.avatarUrl} size="lg" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[13px] font-extrabold">
                  {now.host.name}
                </p>
                {now.description && (
                  <p className="mt-0.5 truncate text-[11px] opacity-75">{now.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Class participants ───────────────────────────────────────────
          Household scale: show the actual people, not an inflated count. */}
      <SectionLabel className="mt-6">Class participants</SectionLabel>
      <FamilyCard className="mt-3 flex items-center gap-3">
        <span className="f0-stack">
          {ctx.members.slice(0, 5).map((m) => (
            <Avatar
              key={m.id}
              name={m.display_name}
              avatarUrl={m.avatar_url}
              role={m.role}
              size="sm"
            />
          ))}
        </span>
        <p className="min-w-0 flex-1 text-[11.5px] text-soft">
          Your household
          {headline?.interested ? " · you said you're coming" : ""}
        </p>
        {headline != null && headline.interested_count > 0 && (
          <Chip tone="muted">{headline.interested_count} interested</Chip>
        )}
      </FamilyCard>

      {kidGuardrails?.live_listen_only && (
        <AbsenceNote>
          Supervised members are set to listen only. Live classes are broadcasts
          today — there is no microphone and no raise-hand to switch off — so this
          setting is recorded and takes effect the moment room audio ships.
        </AbsenceNote>
      )}

      {/* ── The schedule ─────────────────────────────────────────────────*/}
      <SectionLabel className="mt-6">Up next this week</SectionLabel>
      {scheduled.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="No class on the calendar right now"
            body="Live classes are scheduled in blocks. When the next one is set it lands here with its host and its time, and the whole household can say it is coming in one tap."
            action={<TextAction href="/live-sessions">See everything live →</TextAction>}
          />
        </div>
      ) : (
        <RowCard className="mt-3">
          {scheduled.map((e) => {
            const when = new Date(e.starts_at);
            return (
              <Link
                key={e.id}
                href="/live-sessions"
                className="f0-focus flex items-center gap-3 border-b border-sand/70 py-3 last:border-b-0"
              >
                <span className="w-10 shrink-0 text-center">
                  <span className="block font-mono text-[9px] uppercase text-soft">
                    {when.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="block font-mono text-[12px] font-semibold text-ink">
                    {when.toLocaleTimeString(undefined, { hour: "numeric" })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[13px] font-bold text-ink">
                    {e.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-soft">
                    w/ {e.host.name}
                    {e.duration_min ? ` · ${e.duration_min} min` : ""}
                    {e.interested ? " · you're in" : ""}
                  </span>
                </span>
                <XpTag amount={25} suffix="" className="shrink-0" />
              </Link>
            );
          })}
        </RowCard>
      )}

      {/* ── Replays ──────────────────────────────────────────────────────*/}
      {pastClasses.length > 0 && (
        <>
          <SectionLabel className="mt-6">Missed one?</SectionLabel>
          <RowCard className="mt-3">
            {pastClasses.slice(0, 6).map((e) => (
              <Row
                key={e.id}
                label={e.title}
                sub={`w/ ${e.host.name}`}
                right={
                  <span className="font-mono text-[10.5px] text-soft">
                    {e.ended_at
                      ? new Date(e.ended_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "Replay"}
                  </span>
                }
              />
            ))}
          </RowCard>
          <div className="mt-3">
            <TextAction href="/live-sessions">All recordings →</TextAction>
          </div>
        </>
      )}

      {/* ── The action bar ───────────────────────────────────────────────
          The board's two-button footer, with both buttons wired to something
          real. "Raise hand" is deliberately absent — see the file header. */}
      <div className="mt-8 flex gap-3 border-t border-sand pt-5">
        {now?.join_url ? (
          <div className="flex-[1.4]">
            <PillAction href={now.join_url} external className="w-full justify-center py-3">
              Join the room
            </PillAction>
          </div>
        ) : (
          <Link
            href="/live-sessions"
            className="f0-focus f0-press flex-[1.4] rounded-full border border-sand bg-card py-3 text-center font-display text-[12.5px] font-bold text-ink shadow-soft"
          >
            All live classes
          </Link>
        )}
        <Link
          href="/family/circle"
          className="f0-focus f0-press flex-1 rounded-full border border-sand bg-card py-3 text-center font-display text-[12.5px] font-bold text-ink shadow-soft"
        >
          Ask the family
        </Link>
      </div>
      <AbsenceNote>
        There is no raise-hand here yet: classes are one-way broadcasts today and
        nothing in the product records a request to speak. Questions go to the
        Family Circle, which is a real thread your household actually reads.
      </AbsenceNote>
    </FamilySurface>
  );
}
