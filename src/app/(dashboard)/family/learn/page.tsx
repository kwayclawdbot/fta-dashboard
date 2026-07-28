export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  FamilyCard,
  SectionLabel,
  Eyebrow,
  Chip,
  Ring,
  Bar,
  StatTiles,
  PillAction,
  XpTag,
  FoundingState,
  AbsenceNote,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F5 · FAMILY LEARN — board tile "F5 Family Learn".
 *
 * Drawn as the board draws it: the "learn together" masthead, the node path
 * with its dashed spine and one card per chapter, the warm "Up next" card
 * carrying a conic ring, the family-quiz card and the stat trio.
 *
 * The path's chapters are the REAL skill domains and each card carries that
 * domain's real mastery reading. The board draws numbered step pips inside each
 * chapter; nothing in this schema groups lessons into per-chapter steps, so a
 * row of pips would be invented geometry. The mastery bar is the same
 * information, measured.
 *
 * "🔥 16 week streak" is drawn twice on the board. There is no streak table
 * behind Family Mode, so both slots carry a number something writes instead —
 * the household's XP this week, and the time it actually spent in lessons.
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

  const together = ctx.members.reduce((s, m) => s + (counts.get(m.id)?.completed ?? 0), 0);
  const learningMinutes = ctx.members.reduce((s, m) => s + (counts.get(m.id)?.minutes ?? 0), 0);

  const mine = counts.get(ctx.userId);
  const minePct = mine && mine.total > 0 ? Math.round((mine.completed / mine.total) * 100) : 0;

  // The first chapter that is neither finished nor untouched is the live one.
  const activeIdx = skills.findIndex((s) => s.mastery > 0 && s.mastery < 100);

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        title="Learn"
        mark="together"
        lede="Build skills. Build confidence. Build wealth."
        aside={<Chip tone="accent">⚡ {weeklyXp.toLocaleString()}</Chip>}
      />

      {/* ── The family learning path ─────────────────────────────────────*/}
      <SectionLabel className="mt-7">Your family learning path</SectionLabel>

      {skills.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="The path has not been published yet"
            body="Chapters appear here as the curriculum is released. Until then the family watchlist is the better place to spend a night together."
          />
        </div>
      ) : (
        <div className="mt-3">
          {skills.map((s, i) => {
            const started = s.mastery > 0;
            const active = i === activeIdx;
            return (
              <div key={s.id} className="flex gap-3">
                {/* Node column: the mark, then the dashed spine to the next. */}
                <div className="flex w-[34px] shrink-0 flex-col items-center">
                  <span
                    className={`grid h-[34px] w-[34px] place-items-center rounded-full text-[14px] ${
                      started ? "" : "bg-sand"
                    }`}
                    style={started ? { background: "var(--accent-solid)" } : undefined}
                    aria-hidden
                  >
                    {DOMAIN_GLYPHS[s.domain] ?? "📘"}
                  </span>
                  {i < skills.length - 1 && (
                    <span
                      className="my-1 w-[2.5px] flex-1"
                      style={{
                        background:
                          "repeating-linear-gradient(180deg, var(--sand) 0 5px, transparent 5px 10px)",
                      }}
                      aria-hidden
                    />
                  )}
                </div>

                <FamilyCard
                  tone={active ? "lead" : "plain"}
                  className={`mb-2.5 flex-1 ${started ? "" : "opacity-75"}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-[13px] font-extrabold uppercase tracking-[0.02em] text-ink">
                      {s.name}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-gold-700">
                      {started ? `${s.mastery}%` : "Not started"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-soft">
                    {DOMAIN_LEDES[s.domain] ?? "Skills in this chapter"}
                  </p>
                  <Bar pct={s.mastery} height={6} className="mt-2.5" />
                </FamilyCard>
              </div>
            );
          })}
          <AbsenceNote>
            Mastery is earned by answering, not by watching — a chapter reads
            &ldquo;not started&rdquo; until the first quiz or review puts a real number
            on it.
          </AbsenceNote>
        </div>
      )}

      {/* ── Up next ──────────────────────────────────────────────────────*/}
      {!next ? (
        <div className="mt-5">
          <FoundingState
            title="You're clear for now"
            body="Nothing is waiting on you — either the published path is finished or the next chapter has not been released yet. A good week to run a family discussion night instead."
            action={
              <PillAction href="/family/watchlist">Pick tonight&rsquo;s company</PillAction>
            }
          />
        </div>
      ) : (
        <FamilyCard tone="warm" className="mt-5">
          <div className="flex items-center gap-3">
            <Ring
              pct={minePct}
              label={`${minePct}%`}
              ariaLabel={`${minePct} percent of your lessons finished`}
              size={50}
              thickness={5}
            />
            <div className="min-w-0 flex-1">
              <Eyebrow tone="accent">
                Up next{next.minutes ? ` · ${next.minutes} min` : ""}
              </Eyebrow>
              <p className="mt-1 font-display text-[14px] font-extrabold text-ink">
                {next.title}
              </p>
            </div>
            <PillAction href="/courses">Continue</PillAction>
          </div>
        </FamilyCard>
      )}

      {/* ── The household ────────────────────────────────────────────────
          The family read the board's solo path cannot carry: one bar per
          person against the household's own best, so nobody is measured
          against a stranger. */}
      <SectionLabel className="mt-6">Where everyone is</SectionLabel>
      <FamilyCard className="mt-3 flex flex-col gap-3">
        {ctx.members.map((m) => {
          const done = counts.get(m.id)?.completed ?? 0;
          const best = Math.max(1, ...ctx.members.map((x) => counts.get(x.id)?.completed ?? 0));
          return (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                avatarUrl={m.avatar_url}
                role={m.role}
                xp={m.xp}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[12.5px] font-display font-bold text-ink">
                    {m.display_name || "Member"}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-soft">
                    {done} {done === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                <Bar pct={(done / best) * 100} height={6} className="mt-1.5" />
              </div>
            </div>
          );
        })}
      </FamilyCard>

      {/* ── The weekend quiz ─────────────────────────────────────────────*/}
      <FamilyCard className="mt-4 flex items-center gap-3">
        <span className="shrink-0 text-[24px] leading-none" aria-hidden>
          🎲
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow tone="accent">Weekend family quiz</Eyebrow>
          <p className="mt-1 font-display text-[13px] font-bold text-ink">
            Everything you learned this week — head to head
          </p>
        </div>
        <XpTag amount={60} suffix="" className="shrink-0" />
      </FamilyCard>

      {/* ── The measures ─────────────────────────────────────────────────*/}
      <StatTiles
        className="mt-4"
        items={[
          { value: `⚡${weeklyXp.toLocaleString()}`, label: "Family XP this wk", tone: "accent" },
          { value: String(together), label: "Lessons together" },
          {
            value:
              learningMinutes >= 60
                ? `${Math.round(learningMinutes / 60)}h`
                : `${learningMinutes}m`,
            label: "Time in lessons",
          },
        ]}
      />
    </FamilySurface>
  );
}

const DOMAIN_GLYPHS: Record<string, string> = {
  business: "🏦",
  markets: "📈",
  technical: "📊",
  risk: "🛡",
  psychology: "🌱",
};

const DOMAIN_LEDES: Record<string, string> = {
  business: "How companies create value",
  markets: "Own a piece of the future",
  technical: "Read what the chart is saying",
  risk: "Protect what you have first",
  psychology: "Think long term, build freedom",
};
