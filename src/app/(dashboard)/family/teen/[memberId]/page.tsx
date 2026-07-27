export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionRule } from "@/components/f0/parts";
import Avatar from "@/components/Avatar";
import { beltForXp, beltProgress } from "@/lib/belts";
import {
  getFamilyContext,
  getGuardrails,
  getPaperAccount,
  getLessonCounts,
  getRecentBadges,
} from "@/lib/family/queries";
import { GUARDRAIL_SPECS, downtimeLabel } from "@/lib/family/guardrails";
import {
  FamilySurface,
  BackLine,
  FoundingState,
  AbsenceNote,
  Numeral,
  NumeralRow,
  Bar,
  XpTag,
  pct,
  money,
  priceTone,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F2 · TEEN PAPER ACCOUNT.
 *
 * Readable by the teen themselves and by a parent in the same household — the
 * paper account goes through family_paper_account() because sim_portfolios RLS
 * is strictly own-row (migration 003) and a parent genuinely cannot read it any
 * other way.
 *
 * WHAT THE CANVAS DRAWS THAT THIS DELIBERATELY DOES NOT: "Call accuracy 67%".
 * Publishing a member's hit rate is a performance claim (adoption plan §0.1),
 * and a teen's practice account is the last place to start making one. The slot
 * carries participation instead — trades placed, positions held, lessons done —
 * which is the thing a parent actually wants to see and the thing we can stand
 * behind.
 *
 * The guardrails are shown to the teen, not hidden from them. A restriction a
 * kid cannot see is a trap; one they can read is a rule.
 */
export default async function TeenAccountPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const db = await createClient();
  const ctx = await getFamilyContext(db);
  if (!ctx) redirect("/dashboard");

  const member = ctx.members.find((m) => m.id === memberId);
  // Only the teen themselves or a parent in the same household.
  if (!member || (!ctx.isParent && ctx.userId !== memberId)) redirect("/family");

  const [account, guardrails, lessons, badges] = await Promise.all([
    getPaperAccount(db, memberId),
    getGuardrails(db, memberId, ctx.familyId),
    getLessonCounts(db, [memberId]),
    getRecentBadges(db, memberId, 6),
  ]);

  const belt = beltForXp(member.xp);
  const beltStep = beltProgress(member.xp);
  const lessonCount = lessons.get(memberId)?.completed ?? 0;

  const pf = account.portfolio;
  const returnPct =
    pf && Number(pf.starting_balance) > 0
      ? Math.round(
          ((Number(pf.balance) - Number(pf.starting_balance)) / Number(pf.starting_balance)) *
            10000
        ) / 100
      : null;

  const isSelf = ctx.userId === memberId;

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={isSelf && member.role === "child"} />

      <div className="mb-6">
        <BackLine href="/family" label="Family" />
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
          <h1 className="font-display text-display-1 font-extrabold uppercase leading-none text-ink">
            {member.display_name || "Member"}
          </h1>
          <p className="mt-2 text-[15px] text-soft">
            {belt.label} ·{" "}
            <span className="font-display font-bold uppercase tracking-[0.1em] text-gold-700">
              Paper
            </span>{" "}
            · {member.xp.toLocaleString()} XP
          </p>
        </div>
      </header>

      {/* ── The paper portfolio ──────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Paper portfolio</SectionRule>

        {!pf ? (
          <div className="mt-5">
            <FoundingState
              title="No paper account yet"
              body="A paper account is practice money — a full portfolio, real tickers, and not one cent of real money involved. It is the only kind of account this platform has."
              action={
                isSelf ? (
                  <Link
                    href="/simulator"
                    className="f0-focus f0-press inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700"
                  >
                    Open the simulator →
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <p className="mt-4 text-[13px] text-soft">
              Started with {money(Number(pf.starting_balance))}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-display text-display-1 font-extrabold tabular-nums text-ink">
                {money(Number(pf.balance))}
              </p>
              <p
                className={`font-display text-display-3 font-extrabold tabular-nums ${
                  priceTone(returnPct) === "price-down" ? "text-price-down" : "text-price-up"
                }`}
              >
                {pct(returnPct, 2)} all time
              </p>
            </div>

            <div className="mt-8">
              <NumeralRow>
                <Numeral
                  value={String(account.positions.length)}
                  label="Open positions"
                  size="sm"
                />
                <Numeral value={String(pf.total_trades)} label="Trades placed" size="sm" />
                <Numeral value={String(lessonCount)} label="Lessons done" size="sm" />
              </NumeralRow>
            </div>

            <AbsenceNote>
              Participation, not a scorecard. This account does not publish a win
              rate or a call accuracy — a practice record is for learning from,
              not for claiming with.
            </AbsenceNote>
          </>
        )}
      </section>

      {/* ── Open positions ───────────────────────────────────────────────*/}
      {account.positions.length > 0 && (
        <section className="mt-12">
          <SectionRule>Holding right now</SectionRule>
          <div className="f0-ledger mt-2">
            {account.positions.map((p) => (
              <div key={`${p.symbol}-${p.opened_at}`} className="f0-ledger-row">
                <p className="min-w-0 flex-1 self-center font-display text-[15px] font-bold text-ink">
                  {p.symbol}
                  <span className="ml-2 text-[13px] font-normal text-soft">
                    {p.quantity} {p.quantity === 1 ? "share" : "shares"}
                  </span>
                </p>
                <span className="shrink-0 self-center font-mono text-[13px] tabular-nums text-soft">
                  {money(Number(p.entry_price))} entry
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Next belt ────────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule
          action={
            <Link
              href={`/family/teen/${memberId}/progress`}
              className="f0-focus f0-press font-display text-[13px] font-bold text-gold-700"
            >
              Progress →
            </Link>
          }
        >
          Next belt
        </SectionRule>
        <div className="mt-4">
          <Bar
            pct={beltStep.pct}
            label={
              beltStep.next ? `Next: ${beltStep.next.belt.name} Belt` : "Top of the ladder"
            }
            value={`${member.xp.toLocaleString()} XP`}
          />
        </div>
        <p className="mt-3 text-[13px] text-soft">
          Lessons, missions and streaks all pay XP.
        </p>
      </section>

      {/* ── Guardrails on this account ───────────────────────────────────
          Shown to the teen too. Structural entries are stated as facts about
          the product; only the real, server-enforced ones read as settings. */}
      <section className="mt-12">
        <SectionRule
          action={
            ctx.isParent ? (
              <Link
                href={`/family/teen/${memberId}/guardrails`}
                className="f0-focus f0-press font-display text-[13px] font-bold text-gold-700"
              >
                Change →
              </Link>
            ) : undefined
          }
        >
          Guardrails on this account
        </SectionRule>

        <div className="f0-ledger mt-2">
          {GUARDRAIL_SPECS.filter((s) => s.enforcement !== "absent").map((s) => {
            let state = "On";
            if (s.key === "chat_family_only") state = guardrails.chat_family_only ? "On" : "Off";
            if (s.key === "live_listen_only") state = guardrails.live_listen_only ? "On" : "Off";
            if (s.key === "downtime_enabled")
              state = guardrails.downtime_enabled ? downtimeLabel(guardrails) : "Off";
            if (s.key === "daily_limit_min")
              state =
                guardrails.daily_limit_min == null ? "No limit" : `${guardrails.daily_limit_min} min`;

            return (
              <div key={s.label} className="f0-ledger-row justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-ink">{s.label}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-soft">{s.sub}</p>
                </div>
                <span className="shrink-0 self-center font-display text-[13px] font-bold uppercase tracking-[0.06em] text-gold-700">
                  {state}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Trophies ─────────────────────────────────────────────────────*/}
      <section className="mt-12">
        <SectionRule>Trophies</SectionRule>
        {badges.length === 0 ? (
          <div className="mt-5">
            <FoundingState
              title="The case is empty — for now"
              body="Badges land for the things that compound: a first finished unit, a week of showing up, a mission the whole family completed together."
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
        <p className="mt-4">
          <XpTag amount={member.xp} prefix="" /> earned all time
        </p>
      </section>
    </FamilySurface>
  );
}
