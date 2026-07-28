export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  FamilyCard,
  SectionLabel,
  Eyebrow,
  Chip,
  Ring,
  Bar,
  StatTiles,
  XpTag,
  TextAction,
  FoundingState,
  AbsenceNote,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F9 · TEEN PROGRESS — board tile "F9 Teen Progress".
 *
 * Drawn as the board draws it: the ringed avatar header with the level chip and
 * the trophy tile, the stat trio, the skill-mastery card, the warm family-bonus
 * card, the family-XP card with its dark level tile, and the badge row.
 *
 * The board's proudest screen and the one most at risk of overclaiming. Every
 * number below is read from a table something else writes — XP from xp_events,
 * lessons from lesson_progress, mastery from skill_mastery, badges from
 * user_badges, missions from mission_completions. Where a reading does not
 * exist yet it says so; nothing is back-filled with a flattering zero.
 *
 * "16 day streak" is drawn in the first stat slot. Family Mode has no streak
 * table, so the slot carries missions finished instead — the same shape of
 * encouragement, measured.
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
    getRecentBadges(db, memberId, 4),
    getFamilyMissions(db, ctx.familyId, ctx.members.map((m) => m.id)),
  ]);

  const level = levelForXp(member.xp);
  const lp = levelProgress(member.xp);
  const belt = beltForXp(member.xp);
  const bp = beltProgress(member.xp);
  const lessons = counts.get(memberId)?.completed ?? 0;

  const missionsDone = missions.filter((m) => m.completed_by.includes(memberId)).length;
  // "Together" = every member of the household has finished it.
  const allIds = ctx.members.map((m) => m.id);
  const together = missions.filter((m) =>
    allIds.every((id) => m.completed_by.includes(id))
  ).length;

  const familyLevel = levelForXp(ctx.familyXp);
  const familyProgress = levelProgress(ctx.familyXp);
  const name = member.display_name || "Member";

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={ctx.userId === memberId && member.role === "child"} />

      <div className="mb-5">
        <BackLine href={`/family/teen/${memberId}`} label={name} />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────*/}
      <header className="flex items-center gap-3">
        <Ring
          pct={lp.pct}
          ariaLabel={`${lp.pct} percent to the next level`}
          size={66}
          thickness={5}
        >
          <Avatar
            name={member.display_name}
            avatarUrl={member.avatar_url}
            role={member.role}
            size="xl"
          />
        </Ring>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] font-extrabold text-ink">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Chip tone="accent">Level {level.level}</Chip>
            <span className="text-[11px] text-soft">{level.name}</span>
          </div>
          <p className="mt-1 font-mono text-[10.5px] font-semibold tabular-nums text-ink">
            ⚡ {member.xp.toLocaleString()}{" "}
            <span className="text-soft">
              {lp.next ? `/ ${lp.next.min.toLocaleString()} XP to Level ${lp.next.level}` : "XP"}
            </span>
          </p>
        </div>
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[17px]"
          style={{ background: "var(--grad-metal)" }}
          aria-hidden
        >
          🏅
        </span>
      </header>

      {/* ── The measures ─────────────────────────────────────────────────*/}
      <StatTiles
        className="mt-4"
        items={[
          { value: String(missionsDone), label: "Missions done", tone: "accent" },
          { value: String(lessons), label: "Lessons done" },
          { value: String(badges.length), label: "Badges earned" },
        ]}
      />
      <AbsenceNote>
        Participation and progress only. This screen does not publish a win rate
        or a call accuracy — a practice record is something to learn from, not
        something to claim with. There is no day-streak counter because nothing
        in Family Mode records one.
      </AbsenceNote>

      {/* ── Belt ─────────────────────────────────────────────────────────*/}
      <FamilyCard className="mt-5 flex items-center gap-3">
        <span
          className="h-[6px] w-[18px] shrink-0 rounded-full"
          style={{ background: belt.belt.hex }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <Bar
            pct={bp.pct}
            label={belt.label}
            valueLabel={bp.next ? `${bp.toNext.toLocaleString()} XP to ${bp.next.label}` : "Top of the ladder"}
            height={6}
          />
        </div>
      </FamilyCard>

      {/* ── Skill mastery ────────────────────────────────────────────────*/}
      <SectionLabel className="mt-6" action={<TextAction href="/courses">See all</TextAction>}>
        Skill mastery
      </SectionLabel>
      {skills.length === 0 || skills.every((s) => s.mastery === 0) ? (
        <div className="mt-3">
          <FoundingState
            title="No readings yet"
            body="Mastery is measured by answering, not by watching. The first quiz or review puts a real number here — and until there is one, an empty bar is the honest picture."
            action={<TextAction href="/courses">Start a lesson →</TextAction>}
          />
        </div>
      ) : (
        <FamilyCard className="mt-3 flex flex-col gap-3">
          {skills.map((s) => (
            <Bar
              key={s.id}
              pct={s.mastery}
              label={s.name}
              valueLabel={`${s.mastery}%`}
              height={6}
            />
          ))}
        </FamilyCard>
      )}

      {/* ── The household bonus ──────────────────────────────────────────*/}
      {missions.length > 0 && (
        <FamilyCard tone="warm" className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-[26px] leading-none" aria-hidden>
            🧰
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow tone="accent">Family bonus</Eyebrow>
            <p className="mt-1 font-display text-[13px] font-bold text-ink">
              Missions the whole household has finished
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Bar pct={(together / missions.length) * 100} height={6} className="flex-1" />
              <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-soft">
                {together} / {missions.length}
              </span>
            </div>
          </div>
          <XpTag
            amount={missions.reduce((s, m) => s + m.xp_reward, 0)}
            prefix=""
            suffix=""
            className="shrink-0"
          />
        </FamilyCard>
      )}

      {/* ── The household total ──────────────────────────────────────────*/}
      <FamilyCard className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-extrabold text-ink">
            {ctx.familyName ?? "Your household"}
          </p>
          <Eyebrow>Family XP</Eyebrow>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[16px] font-semibold tabular-nums text-ink">
              {ctx.familyXp.toLocaleString()} XP
            </p>
            <Bar pct={familyProgress.pct} height={7} className="mt-2" />
            <p className="mt-1.5 text-[10px] text-soft">
              {familyProgress.next
                ? `Next level: ${familyProgress.next.min.toLocaleString()} XP`
                : "Top of the ladder"}
            </p>
          </div>
          {/* A deliberate dark island. `bg-ink` would invert in dark (ink is
              the page's off-white there), so this pins the constant night
              ground the level tile is drawn on. */}
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-night-950 font-mono text-[13px] font-semibold text-ftagold-300">
            {familyLevel.level}
          </span>
        </div>
        <p className="mt-3 text-[11.5px] text-soft">
          {name} has put <XpTag amount={member.xp} prefix="" suffix="" /> into it.
        </p>
      </FamilyCard>

      {/* ── Recent badges ────────────────────────────────────────────────*/}
      <SectionLabel className="mt-6">Recent badges</SectionLabel>
      {badges.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="None yet"
            body="Badges mark the things that compound — a first finished unit, a week of showing up, a mission the whole household ran together."
          />
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className="min-w-0 flex-1 rounded-lg border border-sand bg-card px-2 py-3 text-center shadow-soft"
            >
              <div className="text-[17px] leading-none" aria-hidden>
                🏅
              </div>
              <p className="mt-1.5 truncate text-[9.5px] text-soft">{b.title}</p>
              <p className="mt-0.5 font-mono text-[8.5px] font-bold text-gold-700">
                {new Date(b.earned_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </FamilySurface>
  );
}
