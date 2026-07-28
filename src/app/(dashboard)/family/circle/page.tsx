export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  FamilyCard,
  Eyebrow,
  Chip,
  pct,
} from "@/components/family/canvas";

/**
 * F4 · FAMILY CIRCLE — board tile "F4 Family Circle".
 *
 * "Private circle · never expires" — and that claim is structural, not a
 * promise: family_circle_messages is family-scoped by RLS, there is no public
 * read policy, and no retention job touches it.
 *
 * Drawn as the board draws it: the household header bar with the house mark and
 * the safety chip, the thread, and the live challenge scoreboard riding along
 * the bottom — because the standings are the thing the household is actually
 * arguing about.
 *
 * The board's 🛡 SAFE chip is green; green is reserved for PRICE in this system,
 * so the chip renders in the accent register instead. Same object, legal colour.
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
  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <FamilySurface className="pb-16">
      <FamilyActivityPing active={!ctx.isParent} />

      <div className="mb-5">
        <BackLine href="/family" label="Family" />
      </div>

      {/* ── Household header bar ─────────────────────────────────────────*/}
      <header className="flex items-center gap-3 rounded-xl border border-sand bg-card p-3 shadow-soft">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-[17px]"
          aria-hidden
        >
          🏠
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[16px] font-extrabold text-ink">
            {ctx.familyName ? `${ctx.familyName} HQ` : "Family HQ"}
          </h1>
          <p className="mt-0.5 text-[10.5px] text-soft">
            Private circle · never expires · {ctx.members.length}{" "}
            {ctx.members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <Chip tone="accent">🛡 Safe</Chip>
      </header>

      <p className="mt-3 max-w-md text-[12px] leading-relaxed text-soft">
        No strangers, no DMs, nothing public. This thread is the household&rsquo;s and
        stays that way.
      </p>

      <div className="mt-6">
        <CircleThread
          familyId={ctx.familyId}
          viewerId={ctx.userId}
          members={ctx.members}
          seed={messages}
        />
      </div>

      {/* ── Challenge scoreboard ─────────────────────────────────────────*/}
      {inChallenge.length > 0 && (
        <FamilyCard className="mt-8">
          <Eyebrow tone="accent">Challenge scoreboard · live</Eyebrow>
          <div className="mt-3 flex gap-2">
            {inChallenge.slice(0, 3).map((s, i) => (
              <div
                key={s.user_id}
                className={`min-w-0 flex-1 rounded-lg px-2 py-3 text-center ${
                  i === 0 ? "" : "bg-paper"
                }`}
                style={
                  i === 0
                    ? {
                        background:
                          "color-mix(in srgb, var(--accent-solid) 15%, var(--card))",
                      }
                    : undefined
                }
              >
                <div className="text-[14px] leading-none" aria-hidden>
                  {MEDALS[i]}
                </div>
                <div className="mt-1.5 flex justify-center">
                  <Avatar
                    name={s.display_name}
                    avatarUrl={s.avatar_url}
                    role={s.role}
                    size="xs"
                  />
                </div>
                <p className="mt-1.5 truncate text-[10.5px] font-display font-bold text-ink">
                  {s.display_name || "Member"}
                </p>
                <p
                  className={`font-mono text-[11px] font-semibold tabular-nums ${
                    (s.return_pct ?? 0) >= 0 ? "text-price-up" : "text-price-down"
                  }`}
                >
                  {pct(s.return_pct)}
                </p>
              </div>
            ))}
          </div>
        </FamilyCard>
      )}
    </FamilySurface>
  );
}
