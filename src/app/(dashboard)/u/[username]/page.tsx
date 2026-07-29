export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Settings, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, mergeBadgeRows } from "@/lib/public-profile";
import { levelProgress } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";
import BeltBadge from "@/components/BeltBadge";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import { TickerTile } from "@/components/canvas2";
import {
  Card,
  ListHead,
  RingAvatar,
  RowCard,
  EmptyCard,
  TextAction,
  dash,
} from "@/components/you/parts";

/**
 * /u/[username] — the public member profile, built to Club Screens board 09
 * "Member profile": the heavy PROFILE display head, the ringed avatar beside
 * the name / level / XP bar, the BADGES card shelf, the YOUR STATS two-column
 * card, and the WATCHLIST tile row. Authenticated-only: the whole app is
 * auth-gated by the dashboard layout, so an unauthenticated visitor is
 * redirected to /login before this renders.
 *
 * MINIMIZATION IS UNCHANGED. Identity still comes exclusively through the
 * kid-minimized `public_profile` RPC, so a minor's page can never leak a family
 * name, role, or a join date finer than the month; the family line and the
 * parent/member distinction still render only when `!profile.is_minor`. The two
 * extra reads — `member_participation` and `member_flips` (migration 196) —
 * return integers and already-public stance rows, so they carry nothing a
 * minor's page did not already withhold.
 *
 * ── WHAT EACH DRAWN FIGURE ACTUALLY SHOWS ─────────────────────────────────
 *   drawn                          ships
 *   ─────────────────────────────  ────────────────────────────────────────
 *   "Level 9 · Signal Sharer"      the member's real level and level name
 *   XP bar + "1,240 / 2,000 XP"    the real band progress and the real
 *                                  lifetime XP against the next threshold
 *   green ✓ verified tick          the earned BELT chip. Nothing in the app
 *                                  verifies a member, and green is price by
 *                                  colour law, so neither the claim nor the
 *                                  hue ships.
 *   YOUR STATS · Signals Shared    Positions taken
 *   YOUR STATS · Upvotes           Respect received
 *   YOUR STATS · Comments          Club posts
 *   YOUR STATS · Accuracy 74%      CONVICTION — the share of this member's
 *                                  positions called bullish. A sentiment
 *                                  measure (lime by law), not a hit rate.
 *   BADGES shelf                   the real badge case
 *   WATCHLIST tiles                the member's real liked tickers
 *
 * A member profile is the most shareable surface in the app, and a published
 * hit rate — or any score derived from one — is a performance claim. That is
 * also why the previously-shipped `pct_since` column on Community picks stays
 * removed: "AAPL +14.2% since added", listed under a member's name, is a
 * per-pick outcome record — the same object as the canvas's `✓ +6.4%` recent
 * calls, arrived at by a different route. The picks themselves stay (which
 * companies a member championed is participation); how each one has since
 * traded belongs to /watchlist and /research, where it is a fact about the
 * company rather than a scoreboard for the member.
 */

interface Participation {
  stances: number;
  bull_stances: number;
  flips: number;
  respect: number;
  research: number;
  posts: number;
  weeks_active: number;
}

interface FlipRow {
  id: string;
  ticker: string;
  from_stance: string | null;
  to_stance: string;
  created_at: string;
}

const STANCE_WORD: Record<string, string> = {
  bull: "Bullish",
  bear: "Bearish",
  neutral: "Neutral",
};

function monthDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric" });
}

/** One cell of board 09's two-column stats card. */
function StatCell({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  /** Community-sentiment measures may carry LIME. Nothing else may. */
  tone?: "ink" | "sentiment";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-[12.5px] text-soft">{label}</span>
      <span
        className={`font-mono text-[13px] font-semibold tabular-nums ${
          tone === "sentiment" ? "text-sentiment" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const [profile, { data: auth }] = await Promise.all([
    getPublicProfile(supabase, username),
    supabase.auth.getUser(),
  ]);

  // Friendly not-found (never a hard 404 wall).
  if (!profile) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="font-display text-[36px] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] text-ink">
          Member not found
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          We couldn&apos;t find a member with the handle @{username}. They may have changed
          it.
        </p>
        <Link
          href="/community"
          className="cta-button f0-focus f0-press mt-6 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the community
        </Link>
      </div>
    );
  }

  const isOwn = auth?.user?.id === profile.id;

  // Everything below identity, in one round of parallel reads.
  const [defs, partRes, flipRes, stanceRes] = await Promise.all([
    supabase
      .from("badges")
      .select("slug, title, subtitle, sort")
      .not("criteria_key", "is", null)
      .order("sort", { ascending: true }),
    supabase.rpc("member_participation", { p_user_id: profile.id }),
    supabase.rpc("member_flips", { p_user_id: profile.id, p_limit: 4 }),
    supabase
      .from("ticker_stances")
      .select("ticker, stance, updated_at")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const badgeRows = mergeBadgeRows(
    (defs.data ?? []) as { slug: string; title: string; subtitle: string | null; sort: number }[],
    profile.badges
  );
  const earned = badgeRows.filter((b) => b.awarded);

  // A failed read leaves the measure null and the cell prints "—". It never
  // prints a zero it did not count.
  const part = partRes.error ? null : (partRes.data as Participation | null);
  const flips = flipRes.error ? [] : ((flipRes.data ?? []) as FlipRow[]);
  const stances = stanceRes.error
    ? []
    : ((stanceRes.data ?? []) as { ticker: string; stance: string; updated_at: string }[]);

  const conviction =
    part && part.stances > 0 ? Math.round((part.bull_stances / part.stances) * 100) : null;

  const lp = levelProgress(profile.xp);
  const belt = beltForXp(profile.xp);
  const nextBelt = lp.next ? beltForXp(lp.next.min) : null;
  const who = profile.display_name || "this member";

  return (
    <div className="cc-app-screen mx-auto max-w-[760px] space-y-4 px-[18px] pb-20 pt-[18px] sm:rounded-[26px] sm:border sm:border-[#2A2530]">
      {/* ── HEAD ────────────────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4">
        <h1 className="script-mark min-w-0 truncate text-[34px] leading-none text-ink">
          you
        </h1>
        {isOwn && (
          <Link
            href="/settings"
            aria-label="Settings"
            className="f0-focus f0-press shrink-0 rounded text-soft transition-colors hover:text-ink"
          >
            <Settings className="h-5 w-5" />
          </Link>
        )}
      </header>

      {/* ── IDENTITY ─────────────────────────────────────────────────────────
          Avatar, name, the earned belt chip where the board draws a verified
          tick, level, and the XP bar with its real numerator/denominator. */}
      <section className="flex items-center gap-3.5">
        <RingAvatar name={profile.display_name || "?"} avatarUrl={profile.avatar_url} size={78} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate font-display text-[23px] font-extrabold leading-tight tracking-[-0.035em] text-ink">
              {profile.display_name || "Member"}
            </h2>
            <BeltBadge rank={belt} size="sm" />
          </div>
          <p className="mt-1 truncate text-[11.5px] text-soft">
            Level {lp.current.level} · {lp.current.name} · @{profile.username}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuenow={lp.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* Progress toward something you can act on → the ACTION colour by
                law. `--accent-gradient` is the mode-correct ramp (club orange →
                amber, family gold, FTA metallic), which is also what the board
                painted here. */}
            <div
              className="h-full rounded-full"
              style={{ width: `${lp.pct}%`, background: "var(--accent-gradient)" }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] tabular-nums text-soft">
            {lp.next
              ? `${profile.xp.toLocaleString()} / ${lp.next.min.toLocaleString()} XP`
              : `${profile.xp.toLocaleString()} XP · top of the ladder`}
          </p>
        </div>
      </section>

      {/* Standing line — family (adults only), join month, own-profile edit.
          Everything here is already minimized upstream by the public_profile
          RPC; a minor's page renders neither the family nor the role. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-soft">
        <AgeBadge ageGroup={profile.age_group} showLabel />
        <TierBadge tier={profile.tier} size="xs" />
        {!profile.is_minor && profile.role_kind && (
          <span className="rounded-md bg-chip-sky px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-[0.1em] text-sky-800">
            {profile.role_kind === "parent" ? "Parent" : "Member"}
          </span>
        )}
        {!profile.is_minor && profile.family_name && (
          <span className="inline-flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5 text-gold-600" />
            <span className="font-semibold text-ink">{profile.family_name}</span>
          </span>
        )}
        <span>Member since {profile.member_since}</span>
        {isOwn && <TextAction href="/settings">Edit in Settings</TextAction>}
      </div>

      {/* ── BADGES — the board's card shelf ─────────────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead action={<TextAction href="/belts">The ladder</TextAction>}>Badges</ListHead>
        {earned.length === 0 ? (
          <EmptyCard
            title="No badges yet"
            body="Badges are earned, not given — this shelf fills as they learn."
          />
        ) : (
          <div className="club2-track flex gap-2 overflow-x-auto pb-1">
            {badgeRows.map((b) => (
              <div
                key={b.slug}
                title={b.subtitle ?? undefined}
                className={`club-b-card flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-[13px] px-1.5 py-[11px] text-center ${
                  b.awarded ? "" : "opacity-45"
                }`}
              >
                <span
                  className="grid h-[34px] w-[34px] place-items-center rounded-full font-display text-[15px] font-extrabold"
                  style={
                    b.awarded
                      ? { background: "var(--accent-solid)", color: "var(--accent-on)" }
                      : { background: "var(--sand)", color: "var(--soft)" }
                  }
                  aria-hidden
                >
                  {b.title.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-display text-[9.5px] font-bold leading-tight text-ink">
                  {b.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── THEIR STATS — the board's two-column card ─────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead charged={false}>Their stats</ListHead>
        <Card className="rounded-[14px] px-3.5">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div className="f0-ledger">
              <StatCell label="Positions" value={dash(part?.stances)} />
              <StatCell label="Club posts" value={dash(part?.posts)} />
            </div>
            <div className="f0-ledger">
              <StatCell label="Respect" value={dash(part?.respect)} />
              {/* Where the board draws `Accuracy 74%` in green. Conviction is
                  the Club's own sentiment measure — lime by law — and says
                  nothing about whether the member was right. */}
              <StatCell
                label="Conviction"
                value={conviction == null ? "—" : `${conviction}%`}
                tone="sentiment"
              />
            </div>
          </div>
        </Card>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Card className="rounded-[14px] px-3.5">
            <div className="f0-ledger">
              <StatCell label="Research notes" value={dash(part?.research)} />
              <StatCell label="Changed minds" value={dash(part?.flips)} />
            </div>
          </Card>
          <Card className="mt-2 rounded-[14px] px-3.5 sm:mt-0">
            <div className="f0-ledger">
              <StatCell label="Weeks active" value={dash(part?.weeks_active)} />
              <StatCell
                label="Next belt"
                value={
                  lp.next && nextBelt
                    ? `${lp.toNext.toLocaleString()} XP`
                    : "Earned"
                }
              />
            </div>
          </Card>
        </div>
        <p className="text-[11px] leading-relaxed text-soft">
          Conviction is the share of {who}&apos;s positions called bullish — the Club&apos;s own
          sentiment measure, not a market number, and not a score of whether they were right.
          We don&apos;t publish member accuracy or win rates. A measure reads &ldquo;—&rdquo;
          until there&apos;s something real behind it.
        </p>
      </section>

      {/* ── WATCHLIST — the board's labelled tile row ─────────────────────── */}
      {profile.liked_tickers.length > 0 && (
        <section className="space-y-2.5 pt-1">
          <ListHead action={<TextAction href="/watchlist">See all</TextAction>}>
            Watchlist
          </ListHead>
          <div className="club2-track -m-1 flex gap-2.5 overflow-x-auto p-1">
            {profile.liked_tickers.map((t) => (
              <div key={t.ticker} className="shrink-0">
                <TickerTile
                  ticker={t.ticker}
                  showDelta={false}
                  href={`/research/${encodeURIComponent(t.ticker)}`}
                />
                <p className="mt-1.5 text-center font-display text-[9.5px] font-bold text-ink">
                  {t.ticker.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── WHERE THEY STAND ─────────────────────────────────────────────────
          Direction is carried by the WORD and by reading order, never by hue:
          bull/bear painted green/red would put the price ramp on a community
          object, and there is no price on this row to justify it. */}
      {stances.length > 0 && (
        <section className="space-y-2.5 pt-1">
          <ListHead>Where they stand</ListHead>
          <div className="space-y-2">
            {stances.map((s) => (
              <RowCard
                key={s.ticker}
                href={`/research/${encodeURIComponent(s.ticker)}`}
                lead={
                  <span className="font-mono text-[11px] font-semibold text-ink">
                    {s.ticker.toUpperCase()}
                  </span>
                }
                title={
                  <span className="text-[11.5px] font-normal text-soft">
                    {STANCE_WORD[s.stance] ?? s.stance}
                  </span>
                }
                value={
                  <span className="font-mono text-[11px] tabular-nums text-soft">
                    {monthDay(s.updated_at)}
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ── CHANGED THEIR MIND ───────────────────────────────────────────────
          Rendered as a behaviour: what changed, which way, when. Nothing here
          claims the change paid off. */}
      {flips.length > 0 && (
        <section className="space-y-2.5 pt-1">
          <ListHead action={<TextAction href="/community/changed-my-mind">All flips</TextAction>}>
            Changed their mind
          </ListHead>
          <div className="space-y-2">
            {flips.map((f) => (
              <RowCard
                key={f.id}
                lead={
                  <span className="font-mono text-[11px] font-semibold text-ink">
                    {f.ticker.toUpperCase()}
                  </span>
                }
                title={
                  <span className="text-[11.5px] font-normal text-soft">
                    {f.from_stance
                      ? STANCE_WORD[f.from_stance] ?? f.from_stance
                      : "No position"}{" "}
                    → {STANCE_WORD[f.to_stance] ?? f.to_stance}
                  </span>
                }
                value={
                  <span className="font-mono text-[11px] tabular-nums text-soft">
                    {monthDay(f.created_at)}
                  </span>
                }
              />
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-soft">
            The Club rewards the update, not the ego.
          </p>
        </section>
      )}

      {/* ── COMMUNITY PICKS ─────────────────────────────────────────────── */}
      {profile.community_picks.length > 0 && (
        <section className="space-y-2.5 pt-1">
          <ListHead>Community picks</ListHead>
          <div className="space-y-2">
            {profile.community_picks.map((p) => (
              <RowCard
                key={p.ticker}
                href={`/research/${encodeURIComponent(p.ticker)}`}
                lead={
                  <TickerTile ticker={p.ticker} size="sm" showDelta={false} className="self-center" />
                }
                title={p.company_name ?? p.ticker}
                sub={p.ticker.toUpperCase()}
                value={
                  <span className="font-mono text-[11px] tabular-nums text-soft">
                    {monthDay(p.created_at)}
                  </span>
                }
              />
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-soft">
            Companies {who} championed to the club&apos;s shared board.
          </p>
        </section>
      )}
    </div>
  );
}
