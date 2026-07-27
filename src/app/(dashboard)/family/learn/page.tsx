export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import {
  getFamilyContext,
  getLessonCounts,
  getNextLesson,
  getSkillMastery,
  getWeeklyXp,
} from "@/lib/family/queries";
import {
  FamilySurface,
  FamilyMast,
  BackLine,
  FoundingState,
  Bar,
  Numeral,
  NumeralRow,
  XpTag,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F5 · FAMILY LEARN — "Build skills. Build confidence. Build wealth."
 *
 * The canvas draws a winding node path with locked chapters. The path visual is
 * lane L5's; what belongs here is the FAMILY read of the same real progress —
 * who in the household is where, what is up next, and the one number that
 * matters to a family, which is whether they are learning together.
 *
 * Skill mastery renders as bars, not rings. The canvas leans on donuts and skill
 * arcs throughout; the adoption plan keeps our restraint (§1.5) — a single
 * percentage reads more legibly on a bar, and stacked beside price data the
 * rings compete. This lane adds no gauge primitive.
 */
export default async function FamilyLearnPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const memberIds = ctx.members.map((m) => m.id);
  const [counts, next, skills, weeklyXp] = await Promise.all([
    getLessonCounts(db, memberIds),
    getNextLesson(db, ctx.userId),
    getSkillMastery(db, ctx.userId),
    getWeeklyXp(db, memberIds),
  ]);

  const together = ctx.members.reduce(
    (sum, m) => sum + (counts.get(m.id)?.completed ?? 0),
    0
  );
  const learningMinutes = ctx.members.reduce(
    (sum, m) => sum + (counts.get(m.id)?.minutes ?? 0),
    0
  );

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-6">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        eyebrow="Family Learn"
        title="Learn"
        mark="together"
        lede="Build skills. Build confidence. Build wealth."
      />

      <section className="mt-10">
        <NumeralRow>
          <Numeral value={weeklyXp.toLocaleString()} label="Family XP this week" size="sm" />
          <Numeral value={String(together)} label="Lessons together" size="sm" />
          <Numeral
            value={learningMinutes >= 60 ? `${Math.round(learningMinutes / 60)}h` : `${learningMinutes}m`}
            label="Time in lessons"
            size="sm"
          />
        </NumeralRow>
      </section>

      {/* ── Up next ──────────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Up next</SectionRule>
        {!next ? (
          <div className="mt-5">
            <FoundingState
              title="You&rsquo;re clear for now"
              body="Nothing is waiting on you — either the published path is finished or the next chapter has not been released yet. A good week to run a family discussion night instead."
              action={
                <Link
                  href="/family/watchlist"
                  className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                >
                  Pick tonight&rsquo;s company →
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4">
            <p className="font-display text-display-3 font-extrabold text-ink">{next.title}</p>
            <p className="mt-1.5 text-[13px] text-soft">
              {next.minutes ? `${next.minutes} min` : "Short lesson"}
            </p>
            <p className="mt-4">
              <Link
                href="/learn"
                className="f0-focus f0-press inline-flex items-center gap-2 font-display text-[14px] font-bold text-gold-700"
              >
                Continue <XpTag amount={50} />
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* ── Who's where ──────────────────────────────────────────────────
          The family read: one bar per person against the household's own best,
          so nobody is measured against a stranger. */}
      <section className="mt-12">
        <SectionRule>Where everyone is</SectionRule>
        <div className="f0-ledger mt-2">
          {ctx.members.map((m) => {
            const done = counts.get(m.id)?.completed ?? 0;
            const best = Math.max(1, ...ctx.members.map((x) => counts.get(x.id)?.completed ?? 0));
            return (
              <div key={m.id} className="f0-ledger-row">
                <Avatar
                  name={m.display_name}
                  avatarUrl={m.avatar_url}
                  role={m.role}
                  xp={m.xp}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-display text-[15px] font-bold text-ink">
                      {m.display_name || "Member"}
                    </p>
                    <span className="shrink-0 text-[13px] tabular-nums text-soft">
                      {done} {done === 1 ? "lesson" : "lessons"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar pct={(done / best) * 100} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Skill mastery ────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Your skills</SectionRule>
        {skills.length === 0 || skills.every((s) => s.mastery === 0) ? (
          <div className="mt-5">
            <FoundingState
              title="No skill readings yet"
              body="Mastery is earned by answering, not by watching — the first quiz or review you finish puts a real number here. Until then there is nothing to show, and we would rather show nothing than a flat zero dressed up as progress."
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

      {/* ── Learning together ────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Learn together</SectionRule>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-soft">
          The weekend quiz is the household head to head — everything learned
          this week, everyone at the same table. Missions completed together pay
          XP to every member.
        </p>
        <div className="f0-ledger mt-5">
          <Link href="/games" className="f0-ledger-row f0-focus justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-ink">Family quiz</p>
              <p className="mt-0.5 text-[13px] text-soft">Head to head on this week&rsquo;s lessons</p>
            </div>
            <XpTag amount={60} />
          </Link>
          <Link href="/family/corner" className="f0-ledger-row f0-focus justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-ink">Family missions</p>
              <p className="mt-0.5 text-[13px] text-soft">
                Completed together, they pay XP to every member
              </p>
            </div>
            <span className="shrink-0 self-center text-[13px] text-soft">Parent Corner</span>
          </Link>
        </div>
      </section>
    </FamilySurface>
  );
}
