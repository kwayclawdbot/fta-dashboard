export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  FamilyCard,
  RowCard,
  Row,
  SectionLabel,
  Eyebrow,
  Chip,
  Ring,
  Bar,
  StatTiles,
  TextAction,
  FoundingState,
  AbsenceNote,
  pct,
  money,
} from "@/components/family/canvas";
import FamilyActivityPing from "@/components/family/FamilyActivityPing";

/**
 * F2 · TEEN PAPER ACCOUNT — board tile "F2 Teen · Paper Account".
 *
 * Drawn as the board draws it: the ringed avatar header with the PAPER tag, the
 * portfolio card with its balance and its inset stat trio, the warm next-belt
 * card carrying the conic ring, the guardrail list, and the trophy row.
 *
 * Readable by the teen themselves and by a parent in the same household — the
 * paper account goes through family_paper_account() because sim_portfolios RLS
 * is strictly own-row (migration 003) and a parent genuinely cannot read it any
 * other way.
 *
 * TWO THINGS THE BOARD DRAWS THAT THIS DELIBERATELY DOES NOT:
 *   · "Call accuracy 67%". Publishing a member's hit rate is a performance
 *     claim, and a teen's practice account is the last place to start making
 *     one. The slot carries participation instead — positions held, trades
 *     placed, lessons done.
 *   · The equity sparkline. Nothing stores a per-day balance history for a sim
 *     portfolio, so a drawn line would be an invented shape.
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
    getRecentBadges(db, memberId, 4),
  ]);

  const belt = beltForXp(member.xp);
  const step = beltProgress(member.xp);
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
  const name = member.display_name || "Member";

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={isSelf && member.role === "child"} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────*/}
      <header className="flex items-center gap-3">
        <span
          className="grid shrink-0 place-items-center rounded-full p-[3px]"
          style={{ background: belt.belt.hex }}
        >
          <span className="grid place-items-center rounded-full bg-paper p-[1.5px]">
            <Avatar
              name={member.display_name}
              avatarUrl={member.avatar_url}
              role={member.role}
              size="hero"
            />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-display-2 font-extrabold text-ink">
              {name}
            </h1>
            {member.role === "child" && <Chip tone="ink">Paper</Chip>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-[5px] w-[14px] rounded-full"
              style={{ background: belt.belt.hex }}
              aria-hidden
            />
            <span className="text-[12.5px] font-display font-bold text-ink">
              {belt.label}
            </span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-gold-700">
              ⚡ {member.xp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </header>

      {/* ── The paper portfolio ──────────────────────────────────────────*/}
      {!pf ? (
        <div className="mt-5">
          <FoundingState
            title="No paper account yet"
            body="A paper account is practice money — a full portfolio, real tickers, and not one cent of real money involved. It is the only kind of account this platform has."
            action={
              isSelf ? <TextAction href="/simulator">Open the simulator →</TextAction> : undefined
            }
          />
        </div>
      ) : (
        <FamilyCard className="mt-5">
          <Eyebrow>
            Paper portfolio · started with {money(Number(pf.starting_balance))}
          </Eyebrow>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[28px] font-semibold tabular-nums text-ink">
              {money(Number(pf.balance))}
            </span>
            <span
              className={`font-mono text-[13px] font-semibold tabular-nums ${
                (returnPct ?? 0) >= 0 ? "text-price-up" : "text-price-down"
              }`}
            >
              {(returnPct ?? 0) >= 0 ? "▲" : "▼"} {pct(returnPct, 2)} all time
            </span>
          </div>

          <StatTiles
            inset
            className="mt-4"
            items={[
              { value: String(account.positions.length), label: "Holdings" },
              { value: String(pf.total_trades), label: "Trades placed" },
              { value: String(lessonCount), label: "Lessons done" },
            ]}
          />

          <AbsenceNote>
            Participation, not a scorecard. This account does not publish a win
            rate or a call accuracy — a practice record is for learning from, not
            for claiming with. There is no balance chart because nothing stores a
            day-by-day history to draw one from.
          </AbsenceNote>
        </FamilyCard>
      )}

      {/* ── Open positions ───────────────────────────────────────────────*/}
      {account.positions.length > 0 && (
        <>
          <SectionLabel className="mt-6">Holding right now</SectionLabel>
          <RowCard className="mt-3">
            {account.positions.map((p) => (
              <Row
                key={`${p.symbol}-${p.opened_at}`}
                label={p.symbol}
                sub={`${p.quantity} ${p.quantity === 1 ? "share" : "shares"} · ${p.side}`}
                right={
                  <span className="font-mono text-[11.5px] tabular-nums text-soft">
                    {money(Number(p.entry_price))} entry
                  </span>
                }
              />
            ))}
          </RowCard>
        </>
      )}

      {/* ── Next belt ────────────────────────────────────────────────────*/}
      <FamilyCard tone="warm" className="mt-5">
        <div className="flex items-center gap-3">
          <Ring
            pct={step.pct}
            label={`${Math.round(step.pct)}%`}
            ariaLabel={`${Math.round(step.pct)} percent to the next belt`}
            size={48}
            thickness={5}
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[13px] font-bold text-ink">
              {step.next ? `Next belt: ${step.next.label}` : "Top of the ladder"}
            </p>
            <p className="mt-0.5 text-[11px] text-soft">
              <span className="font-mono font-semibold tabular-nums text-ink">
                {member.xp.toLocaleString()} XP
              </span>{" "}
              · lessons, missions and streaks all pay XP
            </p>
            <Bar pct={step.pct} height={5} className="mt-2" />
          </div>
          <TextAction href={`/family/teen/${memberId}/progress`}>Path ›</TextAction>
        </div>
      </FamilyCard>

      {/* ── Guardrails on this account ───────────────────────────────────
          Shown to the teen too. Structural entries are stated as facts about
          the product; only the real, server-enforced ones read as settings. */}
      <SectionLabel
        className="mt-6"
        action={
          ctx.isParent ? (
            <TextAction href={`/family/teen/${memberId}/guardrails`}>Change →</TextAction>
          ) : undefined
        }
      >
        Guardrails on this account
      </SectionLabel>

      <RowCard className="mt-3">
        {GUARDRAIL_SPECS.filter((s) => s.enforcement !== "absent").map((s) => {
          let state = "On";
          if (s.key === "chat_family_only") state = guardrails.chat_family_only ? "On" : "Off";
          if (s.key === "live_listen_only") state = guardrails.live_listen_only ? "On" : "Off";
          if (s.key === "downtime_enabled")
            state = guardrails.downtime_enabled ? downtimeLabel(guardrails) : "Off";
          if (s.key === "daily_limit_min")
            state =
              guardrails.daily_limit_min == null
                ? "No limit"
                : `${guardrails.daily_limit_min} min`;

          return (
            <Row
              key={s.label}
              icon={GUARDRAIL_GLYPHS[s.label] ?? "🛡"}
              label={s.label}
              sub={s.sub}
              right={
                <Chip tone={state === "Off" || state === "No limit" ? "muted" : "accent"}>
                  {state}
                </Chip>
              }
            />
          );
        })}
      </RowCard>

      {/* ── Trophies ─────────────────────────────────────────────────────*/}
      <SectionLabel className="mt-6">Trophies</SectionLabel>
      {badges.length === 0 ? (
        <div className="mt-3">
          <FoundingState
            title="The case is empty — for now"
            body="Badges land for the things that compound: a first finished unit, a week of showing up, a mission the whole family completed together."
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
              <p className="mt-1.5 truncate text-[10px] text-soft">{b.title}</p>
              <p className="mt-0.5 font-mono text-[9px] font-bold text-gold-700">
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

/** The board hangs a glyph off every guardrail row. Decoration only. */
const GUARDRAIL_GLYPHS: Record<string, string> = {
  "Paper trading only": "🛡",
  "Hide options & leverage content": "🚫",
  "Chat: Family Circle only": "👥",
  "Live rooms (listen only)": "((·))",
  Downtime: "🌙",
  "Daily limit": "⏱",
};
