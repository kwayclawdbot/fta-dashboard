export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import { beltForXp, beltProgress } from "@/lib/belts";
import { levelForXp, levelProgress } from "@/lib/xp";
import {
  getFamilyContext,
  getLessonCounts,
  getSkillMastery,
  getRecentBadges,
  getFamilyMissions,
} from "@/lib/family/queries";
import {
  FamilySurface,
  BackLine,
  FoundingState,
  AbsenceNote,
  Bar,
  Numeral,
  NumeralRow,
  XpTag,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F9 · TEEN PROGRESS.
 *
 * The canvas's proudest screen and the one most at risk of overclaiming. Every
 * number below is read from a table something else writes — XP from xp_events,
 * lessons from lesson_progress, mastery from skill_mastery, badges from
 * user_badges. Where a reading does not exist yet it says so; nothing is
 * back-filled with a flattering zero.
 *
 * Skill mastery is bars, not rings (adoption plan §1.5). The household total is
 * the same shared ladder Family Home uses, so a teen's contribution and the
 * family's level can never drift apart.
 */
export default async function TeenProgressPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const member = ctx.members.find((m) => m.id === memberId);
  if (!member || (!ctx.isParent && ctx.userId !== memberId)) redirect("/family");

  const [counts, skills, badges, missions] = await Promise.all([
    getLessonCounts(db, [memberId]),
    getSkillMastery(db, memberId),
    getRecentBadges(db, memberId, 6),
    getFamilyMissions(db, ctx.familyId, ctx.members.map((m) => m.id)),
  ]);

  const level = levelForXp(member.xp);
  const lp = levelProgress(member.xp);
  const belt = beltForXp(member.xp);
  const bp = beltProgress(member.xp);
  const lessons = counts.get(memberId)?.completed ?? 0;
  const learnMinutes = counts.get(memberId)?.minutes ?? 0;

  const missionsDone = missions.filter((m) => m.completed_by.includes(memberId)).length;
  const familyLevel = levelForXp(ctx.familyXp);
  const familyProgress = levelProgress(ctx.familyXp);

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={ctx.userId === memberId && member.role === "child"} />

      <div className="mb-6">
        <BackLine href={`/family/teen/${memberId}`} label={member.display_name || "Member"} />
      </div>

      <header className="flex items-start gap-4">
        <Avatar
          name={member.display_name}
          avatarUrl={member.avatar_url}
          role={member.role}
          xp={member.xp}
          size="xl"
        />
        <div className="min-w-0">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            Level {level.level} · {level.name}
          </p>
          <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-none text-ink">
            {member.display_name || "Member"}
          </h1>
          <p className="mt-2 text-[15px] text-soft">
            {member.xp.toLocaleString()} XP
            {lp.next && <> · {lp.toNext.toLocaleString()} to Level {lp.next.level}</>}
          </p>
        </div>
      </header>

      <div className="mt-6">
        <Bar pct={lp.pct} />
      </div>

      {/* ── The measures ─────────────────────────────────────────────────*/}
      <section className="mt-12">
        <NumeralRow>
          <Numeral value={String(lessons)} label="Lessons done" size="sm" />
          <Numeral value={String(badges.length)} label="Badges earned" size="sm" />
          <Numeral value={String(missionsDone)} label="Missions finished" size="sm" />
          <Numeral
            value={learnMinutes >= 60 ? `${Math.round(learnMinutes / 60)}h` : `${learnMinutes}m`}
            label="Time in lessons"
            size="sm"
          />
        </NumeralRow>
        <AbsenceNote>
          Participation and progress only. This screen does not publish a win
          rate or a call accuracy — a practice record is something to learn
          from, not something to claim with.
        </AbsenceNote>
      </section>

      {/* ── Belt ─────────────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Belt</SectionRule>
        <p className="mt-4 font-display text-display-2 font-extrabold text-ink">
          {belt.label}
        </p>
        <div className="mt-4">
          <Bar
            pct={bp.pct}
            label={bp.next ? `Next: ${bp.next.label}` : "Top of the ladder"}
            value={bp.next ? `${bp.toNext.toLocaleString()} XP to go` : undefined}
          />
        </div>
      </section>

      {/* ── Skill mastery ────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Skill mastery</SectionRule>
        {skills.length === 0 || skills.every((s) => s.mastery === 0) ? (
          <div className="mt-5">
            <FoundingState
              title="No readings yet"
              body="Mastery is measured by answering, not by watching. The first quiz or review puts a real number here — and until there is one, an empty bar is the honest picture."
              action={
                <Link
                  href="/learn"
                  className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                >
                  Start a lesson →
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {skills.map((s) => (
              <Bar key={s.id} pct={s.mastery} label={s.name} value={`${s.mastery}%`} />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent badges ────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Recent badges</SectionRule>
        {badges.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="None yet"
              body="Badges mark the things that compound — a first finished unit, a week of showing up, a mission the whole household ran together."
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {badges.map((b) => (
              <div key={b.id} className="f0-ledger-row justify-between">
                <p className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
                  {b.title}
                </p>
                <span className="shrink-0 self-center text-[13px] text-soft">
                  {new Date(b.earned_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── The household total ──────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>
          {ctx.familyName ? `${ctx.familyName} total` : "Household total"}
        </SectionRule>
        <p className="mt-4 font-display text-display-2 font-extrabold tabular-nums text-ink">
          {ctx.familyXp.toLocaleString()} XP
        </p>
        <p className="mt-1 text-[13px] text-soft">
          Level {familyLevel.level}
          {familyProgress.next && (
            <> · {familyProgress.toNext.toLocaleString()} XP to Level {familyProgress.next.level}</>
          )}
        </p>
        <div className="mt-4">
          <Bar pct={familyProgress.pct} />
        </div>
        <p className="mt-4 text-[15px] text-soft">
          {member.display_name || "This member"} has put{" "}
          <XpTag amount={member.xp} prefix="" /> into it.
        </p>
      </section>
    </FamilySurface>
  );
}
