export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import { getFamilyContext, getFamilyMissions } from "@/lib/family/queries";
import { CONVERSATION_TOPICS } from "@/lib/family/parent-corner";
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
 * Parents only. Two halves: the written material (conversation starters and
 * age-banded guidance, which is editorial and lives in the codebase) and the
 * family missions, which are real rows — fic_missions with per-member
 * completions from mission_completions.
 *
 * "Missions completed together pay XP to every member" is the canvas's line and
 * it is already true of the underlying model: each member's own completion
 * writes its own xp_event, so the payout is per person rather than pooled.
 */
export default async function ParentCornerPage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isParent) redirect("/family");

  const missions = await getFamilyMissions(
    db,
    ctx.familyId,
    ctx.members.map((m) => m.id)
  );

  const earned = missions.reduce(
    (sum, m) => sum + m.xp_reward * m.completed_by.length,
    0
  );

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

      {/* ── Conversation starters ────────────────────────────────────────*/}
      <section className="mt-12">
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
