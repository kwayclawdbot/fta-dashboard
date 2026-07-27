export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import {
  getFamilyContext,
  getCircleMessages,
  getPaperStandings,
} from "@/lib/family/queries";
import CircleThread from "@/components/family/CircleThread";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";
import {
  FamilySurface,
  BackLine,
  Numeral,
  NumeralRow,
  pct,
  priceTone,
} from "@/components/family/canvas";

/**
 * F4 · FAMILY CIRCLE.
 *
 * "Private circle · never expires" — and that claim is structural, not a
 * promise: family_circle_messages is family-scoped by RLS, there is no public
 * read policy, and no retention job touches it.
 *
 * The live challenge scoreboard rides along the bottom of the thread the way
 * the canvas draws it, because the standings are the thing the household is
 * actually arguing about.
 */
export default async function FamilyCirclePage() {
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const [messages, standings] = await Promise.all([
    getCircleMessages(db, ctx.familyId),
    getPaperStandings(db, ctx.familyId),
  ]);

  const inChallenge = standings.filter((s) => s.return_pct != null);

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-6">
        <BackLine href="/family" label="Family" />
      </div>

      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Private circle · never expires
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-none text-ink">
          {ctx.familyName ? `${ctx.familyName} HQ` : "Family HQ"}
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          {ctx.members.length} {ctx.members.length === 1 ? "member" : "members"} · no
          strangers, no DMs, nothing public. This thread is the household&rsquo;s
          and stays that way.
        </p>
      </header>

      <div className="mt-10">
        <CircleThread
          familyId={ctx.familyId}
          viewerId={ctx.userId}
          members={ctx.members}
          seed={messages}
        />
      </div>

      {inChallenge.length > 0 && (
        <section className="mt-14">
          <SectionRule>Challenge scoreboard · live</SectionRule>
          <div className="f0-ledger mt-2">
            {inChallenge.map((s, i) => (
              <div key={s.user_id} className="f0-ledger-row">
                <span className="w-5 shrink-0 self-center font-display text-[13px] font-bold tabular-nums text-soft">
                  {i + 1}
                </span>
                <Avatar
                  name={s.display_name}
                  avatarUrl={s.avatar_url}
                  role={s.role}
                  size="sm"
                />
                <p className="min-w-0 flex-1 self-center truncate font-display text-[15px] font-bold text-ink">
                  {s.display_name || "Member"}
                </p>
                <span
                  className={`shrink-0 self-center font-display text-[15px] font-extrabold tabular-nums ${
                    priceTone(s.return_pct) === "price-down"
                      ? "text-price-down"
                      : "text-price-up"
                  }`}
                >
                  {pct(s.return_pct)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <NumeralRow>
              <Numeral
                value={String(inChallenge.length)}
                label="In the challenge"
                size="sm"
              />
              <Numeral value={String(messages.length)} label="Messages" size="sm" />
            </NumeralRow>
          </div>
        </section>
      )}
    </FamilySurface>
  );
}
