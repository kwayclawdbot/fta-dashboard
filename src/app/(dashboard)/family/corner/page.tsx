export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import { getCurrentFicWeek } from "@/lib/fic";
import {
  getFamilyContext,
  getFamilyMissions,
  getChildWeek,
} from "@/lib/family/queries";
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
  FamilyLink,
  FoundingState,
  Bar,
  XpTag,
} from "@/components/family/canvas";

/**
 * F8 · PARENT CORNER — "Tools to guide conversations that build wealth and
 * values."
 *
 * Parents only. Four kinds of material, in the order a guiding parent needs
 * them: their OWN children's week, THIS week's coaching, the standing
 * principles, and the written conversation material — then the missions and the
 * supervised accounts, which are real rows.
 *
 * ── THE MERGE (canvas v2, cohesion lane) ─────────────────────────────────────
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
 * weekly field labels moved verbatim into `lib/family/parent-corner.ts`; the
 * per-child roll-up moved into `getChildWeek`. What did NOT come across is
 * chrome: the gold icon discs, the `paper-card` lock panel, and the pattern of
 * fetching all of it in a `useEffect` after mount — which meant a household
 * with three children rendered as a household with none until the fetch landed
 * (loading read as empty, adoption plan §0.4). Every read here is server-side.
 *
 * "Missions completed together pay XP to every member" is the canvas's line and
 * it is already true of the underlying model: each member's own completion
 * writes its own xp_event, so the payout is per person rather than pooled.
 *
 * GATING: parents only, unchanged — `ctx.isParent`, else back to /family. The
 * old route also admitted `role === "admin"`; that is a widening this file does
 * not adopt, and it is a shared `getFamilyContext` decision rather than a
 * per-screen one.
 */
export default async function ParentCornerPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isParent) redirect("/family");

  const [missions, week, childWeek] = await Promise.all([
    getFamilyMissions(
      db,
      ctx.familyId,
      ctx.members.map((m) => m.id)
    ),
    getCurrentFicWeek(db),
    getChildWeek(
      db,
      ctx.familyId,
      ctx.kids.map((k) => k.id)
    ),
  ]);

  const earned = missions.reduce(
    (sum, m) => sum + m.xp_reward * m.completed_by.length,
    0
  );

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
      <div className="mb-6">
        <BackLine href="/family" label="Family" />
      </div>

      <FamilyMast
        eyebrow="Parent Corner"
        title="Conversations that build"
        mark="wealth"
        lede="And values. The part of this that does not happen on a screen."
      />

      {/* The retired route's opening paragraph, kept whole — it is the promise
          the whole surface makes to a parent who does not follow markets. */}
      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-soft">
        You don&apos;t need to be a market expert to lead this at home. Each week we
        hand you the conversation — what your kids learned, how to talk about it,
        and what to avoid.
      </p>

      {/* ── Your family this week ────────────────────────────────────────*/}
      {/* First, because the guiding parent should see where their OWN kids are
          before reading anything written for parents in general. */}
      {ctx.kids.length > 0 && (
        <section className="mt-12">
          <SectionRule
            action={
              <Link
                href="/family/overview"
                className="f0-focus font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
              >
                Full overview →
              </Link>
            }
          >
            Your family this week
          </SectionRule>

          <div className="f0-ledger mt-2">
            {ctx.kids.map((k) => {
              const w = childWeek.get(k.id);
              const missionsDone = w?.missionsThisWeek ?? 0;
              const picks = w?.watchlistCount ?? 0;
              const researched = w?.researchedCount ?? 0;
              const xp = w?.xpThisWeek ?? 0;
              return (
                <div key={k.id} className="f0-ledger-row">
                  <Avatar
                    name={k.display_name}
                    avatarUrl={k.avatar_url}
                    role="child"
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-bold text-ink">
                      {k.display_name || "Member"}
                      {k.age_group && (
                        <span className="ml-1.5 font-body text-[12px] font-normal capitalize text-soft">
                          {k.age_group}
                        </span>
                      )}
                    </p>
                    {/* A sentence of state, not a row of coloured pills. The
                        old strip used a green tick for "mission done" — green
                        is PRICE by law, and a completed mission is not a gain. */}
                    <p className="mt-1 text-[13px] leading-snug text-soft">
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
                  <XpTag
                    amount={xp}
                    prefix={xp > 0 ? "+" : ""}
                    className="shrink-0 self-center"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── This week's coaching ─────────────────────────────────────────*/}
      {/* A DOCUMENT, not a panel: the class title carries the weight and each
          note is a ruled passage. The retired route wrapped the same six notes
          in a card holding six more sub-blocks — a box of boxes, which is what
          flattened it. */}
      <section className="mt-14">
        <SectionRule>This week</SectionRule>
        {week ? (
          <>
            <h3 className="mt-5 font-display text-display-3 font-extrabold text-ink">
              {week.class_title}
            </h3>
            {week.company_name && (
              <p className="mt-1 text-[13px] text-soft">
                {week.company_name}
                {week.company_ticker ? ` (${week.company_ticker})` : ""}
              </p>
            )}

            {weeklyNotes.length === 0 ? (
              <p className="mt-4 text-[15px] leading-relaxed text-soft">
                This week&apos;s parent notes are being prepared. The always-on
                guidance below applies every week.
              </p>
            ) : (
              <div className="mt-6 space-y-7">
                {weeklyNotes.map((s) => (
                  <div key={s.title}>
                    <p className="text-eyebrow font-display font-bold uppercase text-soft">
                      {s.title}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink">
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {week.parent_prompt && (
              <div className="f0-rule-left mt-8 py-1 pl-4">
                <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
                  This week&apos;s prompt
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                  {week.parent_prompt}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5">
            <FoundingState
              title="No week published yet"
              body="Each published week hands you what your kids learned, how to open the conversation, how to explain it simply, and what to avoid. Until the first one lands, the always-on guidance below is the whole job."
            />
          </div>
        )}
      </section>

      {/* ── Always-on guidance ───────────────────────────────────────────*/}
      {/* The five standing principles, carried verbatim from the retired route.
          A list of principles that reads top to bottom — not a 2-up card grid,
          and no gold icon discs. */}
      <section className="mt-14">
        <SectionRule>Always-on guidance</SectionRule>
        <div className="mt-5 space-y-8">
          {ALWAYS_ON_GUIDANCE.map((g) => (
            <div key={g.id}>
              <h3 className="font-display text-display-3 font-extrabold text-ink">
                {g.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-soft">{g.body}</p>
            </div>
          ))}
          <div>
            <h3 className="font-display text-display-3 font-extrabold text-ink">
              Talk it out with other parents
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
              Other families are learning alongside you. Swap questions and wins in
              the community.
            </p>
            <Link
              href="/community"
              className="f0-focus mt-3 inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
            >
              Open community →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Conversation starters ────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule>Start a great conversation</SectionRule>
        <div className="mt-5 space-y-8">
          {CONVERSATION_TOPICS.map((t) => (
            <div key={t.id}>
              <p className="font-display text-display-3 font-extrabold text-ink">{t.title}</p>
              <p className="mt-1 text-[13px] text-soft">{t.sub}</p>
              <ul className="mt-3 space-y-2">
                {t.prompts.map((p) => (
                  <li
                    key={p}
                    className="f0-rule-left py-0.5 pl-4 text-[15px] leading-relaxed text-ink"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Age-based tips ───────────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule>Age-based tips</SectionRule>
        <div className="mt-5">
          <AgeBandTips />
        </div>
      </section>

      {/* ── Family missions ──────────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule
          action={
            earned > 0 ? (
              <span className="font-display text-[13px] font-bold text-gold-700">
                {earned.toLocaleString()} XP earned
              </span>
            ) : undefined
          }
        >
          Family missions
        </SectionRule>

        {missions.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="No missions published yet"
              body="Missions are the assignments the whole household runs together — find a business model, add a company somebody loves, have the ten-minute conversation. They appear here as they are released."
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {missions.map((m) => {
              const done = m.completed_by.length;
              const all = ctx.members.length;
              return (
                <div key={m.id} className="f0-ledger-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-display text-[15px] font-bold text-ink">{m.title}</p>
                      <XpTag amount={m.xp_reward} prefix="" />
                    </div>
                    {(m.description || m.kid_prompt) && (
                      <p className="mt-0.5 text-[13px] leading-snug text-soft">
                        {m.description || m.kid_prompt}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Bar pct={all ? (done / all) * 100 : 0} />
                      </div>
                      <span className="shrink-0 text-[13px] tabular-nums text-soft">
                        {done} / {all}
                      </span>
                    </div>
                    {done > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {m.completed_by.map((id) => {
                          const p = ctx.members.find((x) => x.id === id);
                          return (
                            <Avatar
                              key={id}
                              name={p?.display_name ?? null}
                              avatarUrl={p?.avatar_url ?? null}
                              role={p?.role ?? null}
                              xp={p?.xp}
                              size="xs"
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-5 text-[13px] leading-relaxed text-soft">
          Missions completed together pay XP to every member who finishes them.
        </p>
      </section>

      {/* ── Supervised accounts ──────────────────────────────────────────*/}
      <section className="mt-14">
        <SectionRule>Supervised accounts</SectionRule>
        {ctx.kids.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="No supervised members yet"
              body="Once a young member joins the household, their guardrails, digest and paper account appear here — and every change you make is logged and sent to the other parent."
            />
          </div>
        ) : (
          <div className="f0-ledger mt-2">
            {ctx.kids.map((k) => (
              <FamilyLink
                key={k.id}
                href={`/family/teen/${k.id}/guardrails`}
                label={`${k.display_name || "Member"}'s guardrails`}
                sub="Controls, weekly digest and the change log"
              />
            ))}
          </div>
        )}
      </section>
    </FamilySurface>
  );
}
