export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import { getCurrentFicWeek } from "@/lib/fic";
import { getFamilyContext, getFamilyMissions, getChildWeek } from "@/lib/family/queries";
import {
  CONVERSATION_TOPICS,
  ALWAYS_ON_GUIDANCE,
  WEEKLY_PARENT_FIELDS,
} from "@/lib/family/parent-corner";
import AgeBandTips from "@/components/family/AgeBandTips";
import {
  FamilySurface,
  FamilyMast,
  BackLine,
  FamilyCard,
  RowCard,
  FamilyLink,
  SectionLabel,
  Eyebrow,
  Chip,
  Bar,
  XpTag,
  TextAction,
  FoundingState,
} from "@/components/family/canvas";

/**
 * F8 · PARENT CORNER — board tile "F8 Parent Corner".
 *
 * "Tools to guide conversations that build wealth and values."
 *
 * Parents only. Four kinds of material, in the order a guiding parent needs
 * them: their OWN children's week, THIS week's coaching, the standing
 * principles, and the written conversation material — then the missions and the
 * supervised accounts, which are real rows.
 *
 * ── THE MERGE ────────────────────────────────────────────────────────────────
 * There were two Parent Corners. `/parent-corner` was the older, larger one: a
 * client component holding the substantial education-first guidance, the weekly
 * `fic_weeks` parent notes, and a per-child "your family this week" strip.
 * `/family/corner` (this file) was the canvas-designed container but held only
 * the conversation starters, age bands and missions. Two destinations for one
 * idea is incoherent, so the old CONTENT was folded into this CONTAINER and
 * `/parent-corner` is now a redirect here — a redirect and not a deletion,
 * because the nav, `ThisWeekPanel`, the onboarding checklist and any bookmark
 * still point at the old path.
 *
 * Nothing of substance was dropped. The five standing principles and the six
 * weekly field labels live in `lib/family/parent-corner.ts`; the per-child
 * roll-up is `getChildWeek`. Every read here is server-side, so a household
 * with three children never renders as a household with none.
 *
 * The board draws the conversation starters as three chevron rows leading to a
 * detail screen. There is no detail screen — the prompts ARE the content — so
 * each starter is a card with its three prompts in view rather than a chevron
 * pointing at nothing.
 *
 * "Missions completed together pay XP to every member" is the board's line and
 * it is already true of the model: each member's own completion writes its own
 * xp_event, so the payout is per person rather than pooled.
 *
 * GATING: parents only — `ctx.isParent`, else back to /family.
 */
export default async function ParentCornerPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isParent) redirect("/family");

  const [missions, week, childWeek] = await Promise.all([
    getFamilyMissions(db, ctx.familyId, ctx.members.map((m) => m.id)),
    getCurrentFicWeek(db),
    getChildWeek(db, ctx.familyId, ctx.kids.map((k) => k.id)),
  ]);

  const earned = missions.reduce((sum, m) => sum + m.xp_reward * m.completed_by.length, 0);

  // Only the fields the editor actually filled in. An empty note is an absence,
  // not a heading with nothing under it.
  const weeklyNotes = week
    ? WEEKLY_PARENT_FIELDS.map((f) => ({ title: f.title, body: week[f.key] })).filter(
        (s): s is { title: string; body: string } =>
          typeof s.body === "string" && s.body.trim().length > 0
      )
    : [];

  return (
    <FamilySurface className="pb-16">
      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        title="Parent"
        mark="corner"
        lede="Tools to guide conversations that build wealth and values. You don't need to be a market expert to lead this at home — each week we hand you the conversation."
      />

      {/* ── Your family this week ────────────────────────────────────────
          First, because the guiding parent should see where their OWN kids are
          before reading anything written for parents in general. */}
      {ctx.kids.length > 0 && (
        <>
          <SectionLabel
            tone="accent"
            className="mt-7"
            action={<TextAction href="/family/overview">Full overview →</TextAction>}
          >
            Your family this week
          </SectionLabel>

          <div className="mt-3 flex flex-col gap-2">
            {ctx.kids.map((k) => {
              const w = childWeek.get(k.id);
              const missionsDone = w?.missionsThisWeek ?? 0;
              const picks = w?.watchlistCount ?? 0;
              const researched = w?.researchedCount ?? 0;
              const xp = w?.xpThisWeek ?? 0;
              return (
                <FamilyCard key={k.id} className="flex items-center gap-3">
                  <Avatar
                    name={k.display_name}
                    avatarUrl={k.avatar_url}
                    role="child"
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13.5px] font-bold text-ink">
                      {k.display_name || "Member"}
                      {k.age_group && (
                        <span className="ml-1.5 font-body text-[11px] font-normal capitalize text-soft">
                          {k.age_group}
                        </span>
                      )}
                    </p>
                    {/* A sentence of state, not a row of coloured pills. Green
                        is PRICE by law, and a completed mission is not a gain. */}
                    <p className="mt-0.5 text-[11px] leading-snug text-soft">
                      {missionsDone > 0
                        ? `${missionsDone} mission${missionsDone === 1 ? "" : "s"} this week`
                        : "No mission yet this week"}
                      {" · "}
                      {picks > 0
                        ? `${picks} pick${picks === 1 ? "" : "s"}${
                            researched > 0 ? ` · ${researched} researched` : ""
                          }`
                        : "No picks yet"}
                    </p>
                  </div>
                  <XpTag amount={xp} prefix={xp > 0 ? "+" : ""} className="shrink-0" />
                </FamilyCard>
              );
            })}
          </div>
        </>
      )}

      {/* ── This week's coaching ─────────────────────────────────────────*/}
      <SectionLabel tone="accent" className="mt-7">
        This week
      </SectionLabel>
      {week ? (
        <FamilyCard className="mt-3">
          <h2 className="font-display text-[16px] font-extrabold text-ink">
            {week.class_title}
          </h2>
          {week.company_name && (
            <p className="mt-0.5 text-[11.5px] text-soft">
              {week.company_name}
              {week.company_ticker ? ` (${week.company_ticker})` : ""}
            </p>
          )}

          {weeklyNotes.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-soft">
              This week&apos;s parent notes are being prepared. The always-on guidance
              below applies every week.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {weeklyNotes.map((s) => (
                <div key={s.title}>
                  <Eyebrow>{s.title}</Eyebrow>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {week.parent_prompt && (
            <div
              className="mt-5 rounded-r-lg border-l-[3px] p-3 text-[12.5px] italic leading-relaxed text-ink"
              style={{
                borderLeftColor: "var(--accent-solid)",
                background: "color-mix(in srgb, var(--accent-solid) 12%, var(--card))",
              }}
            >
              💡 {week.parent_prompt}
            </div>
          )}
        </FamilyCard>
      ) : (
        <div className="mt-3">
          <FoundingState
            title="No week published yet"
            body="Each published week hands you what your kids learned, how to open the conversation, how to explain it simply, and what to avoid. Until the first one lands, the always-on guidance below is the whole job."
          />
        </div>
      )}

      {/* ── Always-on guidance ───────────────────────────────────────────
          The five standing principles, carried verbatim. */}
      <SectionLabel tone="accent" className="mt-7">
        Always-on guidance
      </SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {ALWAYS_ON_GUIDANCE.map((g) => (
          <FamilyCard key={g.id}>
            <h3 className="font-display text-[13.5px] font-extrabold text-ink">{g.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-soft">{g.body}</p>
          </FamilyCard>
        ))}
        <FamilyCard>
          <h3 className="font-display text-[13.5px] font-extrabold text-ink">
            Talk it out with other parents
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-soft">
            Other families are learning alongside you. Swap questions and wins in the
            community.
          </p>
          <div className="mt-2.5">
            <TextAction href="/community">Open community →</TextAction>
          </div>
        </FamilyCard>
      </div>

      {/* ── Conversation starters ────────────────────────────────────────*/}
      <SectionLabel tone="accent" className="mt-7">
        Start a great conversation
      </SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {CONVERSATION_TOPICS.map((t) => (
          <FamilyCard key={t.id}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[16px] leading-none" aria-hidden>
                {TOPIC_GLYPHS[t.id] ?? "💬"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[13.5px] font-bold text-ink">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-soft">{t.sub}</p>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {t.prompts.map((p) => (
                <li
                  key={p}
                  className="rounded-lg bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-ink"
                >
                  {p}
                </li>
              ))}
            </ul>
          </FamilyCard>
        ))}
      </div>

      {/* ── Age-based tips ───────────────────────────────────────────────*/}
      <SectionLabel tone="accent" className="mt-7">
        Age-based tips
      </SectionLabel>
      <div className="mt-3">
        <AgeBandTips />
      </div>

      {/* ── Family missions ──────────────────────────────────────────────*/}
      <SectionLabel
        className="mt-7"
        action={
          earned > 0 ? (
            <span className="font-mono text-[10.5px] font-bold text-gold-700">
              🪙 {earned.toLocaleString()} earned
            </span>
          ) : undefined
        }
      >
        Family missions
      </SectionLabel>

      {missions.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="No missions published yet"
            body="Missions are the assignments the whole household runs together — find a business model, add a company somebody loves, have the ten-minute conversation. They appear here as they are released."
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {missions.map((m, i) => {
            const done = m.completed_by.length;
            const all = ctx.members.length;
            return (
              <FamilyCard key={m.id}>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-[15px] leading-none" aria-hidden>
                    {MISSION_GLYPHS[i % MISSION_GLYPHS.length]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[13.5px] font-bold text-ink">
                      {i + 1}. {m.title}
                    </p>
                    {(m.description || m.kid_prompt) && (
                      <p className="mt-0.5 text-[11px] leading-snug text-soft">
                        {m.description || m.kid_prompt}
                      </p>
                    )}
                  </div>
                  <XpTag amount={m.xp_reward} prefix="" suffix="" className="shrink-0" />
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <Bar pct={all ? (done / all) * 100 : 0} height={5} className="flex-1" />
                  <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-soft">
                    {done} / {all}
                  </span>
                </div>
                {done > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {m.completed_by.map((id) => {
                      const p = ctx.members.find((x) => x.id === id);
                      return (
                        <Avatar
                          key={id}
                          name={p?.display_name ?? null}
                          avatarUrl={p?.avatar_url ?? null}
                          role={p?.role ?? null}
                          size="xs"
                        />
                      );
                    })}
                  </div>
                )}
              </FamilyCard>
            );
          })}
        </div>
      )}

      <FamilyCard className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-[15px] leading-none" aria-hidden>
          ✅
        </span>
        <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-soft">
          Missions completed together pay XP to every member who finishes them.
        </p>
        {earned > 0 && <Chip tone="accent">⚡ {earned.toLocaleString()} paid</Chip>}
      </FamilyCard>

      {/* ── Supervised accounts ──────────────────────────────────────────*/}
      <SectionLabel tone="accent" className="mt-7">
        Supervised accounts
      </SectionLabel>
      {ctx.kids.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="No supervised members yet"
            body="Once a young member joins the household, their guardrails, digest and paper account appear here — and every change you make is logged and sent to the other parent."
          />
        </div>
      ) : (
        <RowCard className="mt-3">
          {ctx.kids.map((k) => (
            <FamilyLink
              key={k.id}
              href={`/family/teen/${k.id}/guardrails`}
              icon="🛡"
              label={`${k.display_name || "Member"}'s guardrails`}
              sub="Controls, weekly digest and the change log"
            />
          ))}
        </RowCard>
      )}
    </FamilySurface>
  );
}

const TOPIC_GLYPHS: Record<string, string> = {
  mindset: "🧠",
  "needs-wants": "❤️",
  earning: "🐷",
};

const MISSION_GLYPHS = ["🔍", "📈", "💬", "🧭", "🎯"];
