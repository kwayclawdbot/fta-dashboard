export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Settings, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, mergeBadgeRows } from "@/lib/public-profile";
import { levelProgress } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import BadgeCaseView from "@/components/BadgeCaseView";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import {
  DisplayHead,
  SectionRule,
  Ledger,
  LedgerRow,
  MeasureStrip,
  TextAction,
  dash,
} from "@/components/f0/parts";

/**
 * /u/[username] — the public member profile (canvas v2: Club Screens board 09
 * "Member profile", App Light board 07). Authenticated-only: the whole app is
 * auth-gated by the dashboard layout, so an unauthenticated visitor is
 * redirected to /login before this renders.
 *
 * MINIMIZATION IS UNCHANGED. Identity still comes exclusively through the
 * kid-minimized `public_profile` RPC, so a minor's page can never leak a family
 * name, role, or a join date finer than the month; the family line and the
 * parent/member distinction still render only when `!profile.is_minor`. The two
 * reads added here — `member_participation` and `member_flips` (migration 196) —
 * return integers and already-public stance rows, so they carry nothing a
 * minor's page did not already withhold.
 *
 * ── THE COMPLIANCE LINE ON THIS SURFACE ───────────────────────────────────
 * Club Screens 09 draws `Accuracy 74%` in the member's stat block; App 07 draws
 * `Accuracy 71%`, an `87 OPINION SCORE` dial, `Influence 1.8x` and
 * `People Influenced 382`. None of them ship. A member profile is the most
 * shareable surface in the app, and a published hit rate — or any score derived
 * from one — is a performance/testimonial claim. What ships instead is
 * CONVICTION and PARTICIPATION: positions taken, share of them bullish, minds
 * changed in public, respect received for those updates, notes and posts
 * written, weeks active.
 *
 * The previously-shipped `pct_since` column on Community picks was removed for
 * the same reason: "AAPL +14.2% since added", listed under a member's name, is a
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
        <DisplayHead
          eyebrow="No such handle"
          title="Member not found"
          lede={`We couldn't find a member with the handle @${username}. They may have changed it.`}
          aside={<Users2 className="h-6 w-6 text-soft" />}
        />
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
      .limit(8),
  ]);

  const badgeRows = mergeBadgeRows(
    (defs.data ?? []) as { slug: string; title: string; subtitle: string | null; sort: number }[],
    profile.badges
  );

  // A failed read leaves the measure null and the strip prints "—". It never
  // prints a zero it did not count.
  const part = partRes.error ? null : (partRes.data as Participation | null);
  const flips = flipRes.error ? [] : ((flipRes.data ?? []) as FlipRow[]);
  const stances = stanceRes.error
    ? []
    : ((stanceRes.data ?? []) as { ticker: string; stance: string }[]);

  const conviction =
    part && part.stances > 0
      ? Math.round((part.bull_stances / part.stances) * 100)
      : null;

  const lp = levelProgress(profile.xp);
  const belt = beltForXp(profile.xp);
  const nextBelt = lp.next ? beltForXp(lp.next.min) : null;
  const who = profile.display_name || "this member";

  return (
    <div className="mx-auto max-w-2xl pb-14">
      {/* ── IDENTITY ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar
          name={profile.display_name}
          avatarUrl={profile.avatar_url}
          role={profile.is_minor ? "child" : "parent"}
          tier={profile.tier}
          xp={profile.xp}
          size="hero"
        />

        <div className="min-w-0">
          <p className="font-mono text-[13px] text-soft">@{profile.username}</p>
          <h1 className="mt-1 font-display text-display-1 font-extrabold leading-none text-ink">
            {profile.display_name || "Member"}
          </h1>

          {/* Identity chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AgeBadge ageGroup={profile.age_group} showLabel />
            <TierBadge tier={profile.tier} size="md" />
            <BeltBadge rank={belt} size="md" />
            {/* Adults only: parent / member distinction */}
            {!profile.is_minor && profile.role_kind && (
              <span className="rounded-md bg-chip-sky px-2 py-0.5 text-eyebrow font-display font-bold uppercase text-sky-800">
                {profile.role_kind === "parent" ? "Parent" : "Member"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Standing line — family (adults only), join month, own-profile edit. */}
      <div className="f0-rule-top mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 text-[13px] text-soft">
        {!profile.is_minor && profile.family_name && (
          <span className="inline-flex items-center gap-1.5">
            <Users2 className="h-4 w-4 text-gold-600" />
            <span className="font-semibold text-ink">{profile.family_name}</span>
          </span>
        )}
        <span>Member since {profile.member_since}</span>
        {isOwn && (
          <TextAction href="/settings">
            <Settings className="h-3.5 w-3.5" /> Edit in Settings
          </TextAction>
        )}
      </div>

      {/* ── STANDING: belt + XP ───────────────────────────────────────────── */}
      <section className="mt-9">
        <SectionRule
          action={
            <span className="font-mono text-[13px] font-bold tabular-nums text-soft">
              {profile.xp.toLocaleString()} XP
            </span>
          }
        >
          Standing
        </SectionRule>
        <div className="mt-4">
          <p className="flex items-center gap-2.5">
            {/* Belt colour is intrinsic — a blue belt is blue in every theme —
                so the swatch is an inline style, not a token. Purple is a legal
                BELT colour and appears nowhere else in the chrome. */}
            <span
              aria-hidden
              className="h-5 w-5 shrink-0 rounded-[5px]"
              style={{
                backgroundColor: belt.belt.hex,
                boxShadow: `inset 0 0 0 1px ${belt.belt.borderHex}`,
              }}
            />
            <span className="font-display text-display-3 font-extrabold text-ink">
              {belt.label}
            </span>
            <span className="font-body text-sm font-normal text-soft">
              Level {lp.current.level} · {lp.current.name}
            </span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full"
              style={{ width: `${lp.pct}%`, backgroundColor: belt.belt.hex }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[12px] text-soft">
              {lp.next && nextBelt
                ? `${lp.toNext.toLocaleString()} XP to ${nextBelt.label}`
                : "Black Belt earned — top of the ladder"}
            </p>
            <TextAction href="/belts">
              The ladder <ArrowRight className="h-3.5 w-3.5" />
            </TextAction>
          </div>
        </div>
      </section>

      {/* ── PARTICIPATION ─────────────────────────────────────────────────────
          Conviction and reps. Explicitly NOT accuracy — see the file header. */}
      <section className="mt-11">
        <SectionRule>Participation</SectionRule>
        <div className="mt-5">
          <MeasureStrip
            items={[
              { label: "Positions", value: dash(part?.stances) },
              {
                label: "Conviction",
                value: conviction == null ? "—" : `${conviction}%`,
                tone: "sentiment",
              },
              { label: "Changed minds", value: dash(part?.flips) },
            ]}
          />
        </div>
        <Ledger className="mt-6">
          <LedgerRow label="Research notes" value={dash(part?.research)} />
          <LedgerRow label="Club posts" value={dash(part?.posts)} />
          <LedgerRow
            label="Respect received"
            sub="Members acknowledging an update this member made in public"
            value={dash(part?.respect)}
          />
          <LedgerRow label="Weeks active" value={dash(part?.weeks_active)} />
        </Ledger>
        <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-soft">
          Conviction is the share of {who}&apos;s positions called bullish — the
          Club&apos;s own sentiment measure, not a market number, and not a score
          of whether they were right. A measure reads &ldquo;—&rdquo; until
          there&apos;s something real behind it.
        </p>
      </section>

      {/* ── WHERE THEY STAND ──────────────────────────────────────────────────
          Direction is carried by the WORD and by reading order, never by hue:
          bull/bear painted green/red would put the price ramp on a community
          object, and there is no price on this row to justify it. */}
      {stances.length > 0 && (
        <section className="mt-11">
          <SectionRule>Where they stand</SectionRule>
          <Ledger className="mt-2">
            {stances.map((s) => (
              <Link
                key={s.ticker}
                href={`/research/${encodeURIComponent(s.ticker)}`}
                className="f0-ledger-row f0-focus group"
              >
                <TickerTile
                  ticker={s.ticker}
                  size="sm"
                  showDelta={false}
                  className="self-center"
                />
                <span className="min-w-0 flex-1 self-center">
                  <span className="block truncate font-display text-[15px] font-bold text-ink">
                    {s.ticker.toUpperCase()}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-soft">
                    {STANCE_WORD[s.stance] ?? s.stance}
                  </span>
                </span>
              </Link>
            ))}
          </Ledger>
        </section>
      )}

      {/* ── CHANGED THEIR MIND ────────────────────────────────────────────────
          The strongest idea in the canvas archive, rendered as a behaviour: what
          changed, which way, when. Nothing here claims the change paid off. */}
      {flips.length > 0 && (
        <section className="mt-11">
          <SectionRule
            action={<TextAction href="/community/changed-my-mind">All flips</TextAction>}
          >
            Changed their mind
          </SectionRule>
          <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-soft">
            The Club rewards the update, not the ego.
          </p>
          <Ledger className="mt-2">
            {flips.map((f) => (
              <LedgerRow
                key={f.id}
                label={
                  <span className="font-mono text-[13px] font-semibold">
                    {f.ticker.toUpperCase()}
                  </span>
                }
                sub={`${
                  f.from_stance ? STANCE_WORD[f.from_stance] ?? f.from_stance : "No position"
                } → ${STANCE_WORD[f.to_stance] ?? f.to_stance}`}
                value={monthDay(f.created_at)}
              />
            ))}
          </Ledger>
        </section>
      )}

      {/* ── FAVOURITE STOCKS — the canvas's watchlist tile strip ───────────── */}
      {/* Likes and picks are already-public community actions — nothing here is
          newly exposed, including for minors. */}
      {profile.liked_tickers.length > 0 && (
        <section className="mt-11">
          <SectionRule>Favorite stocks</SectionRule>
          <div className="mt-4">
            <TickerTileStrip minSlots={5}>
              {profile.liked_tickers.map((t) => (
                <TickerTile
                  key={t.ticker}
                  ticker={t.ticker}
                  showDelta={false}
                  href={`/research/${encodeURIComponent(t.ticker)}`}
                />
              ))}
            </TickerTileStrip>
          </div>
        </section>
      )}

      {profile.community_picks.length > 0 && (
        <section className="mt-11">
          <SectionRule>Community picks</SectionRule>
          <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-soft">
            Companies {who} championed to the club&apos;s shared board.
          </p>
          <Ledger className="mt-2">
            {profile.community_picks.map((p) => (
              <Link
                key={p.ticker}
                href={`/research/${encodeURIComponent(p.ticker)}`}
                className="f0-ledger-row f0-focus group"
              >
                <TickerTile
                  ticker={p.ticker}
                  size="sm"
                  showDelta={false}
                  className="self-center"
                />
                <span className="min-w-0 flex-1 self-center">
                  <span className="block truncate font-display text-[15px] font-bold text-ink">
                    {p.company_name ?? p.ticker}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-soft">
                    {p.ticker.toUpperCase()}
                  </span>
                </span>
                <span className="shrink-0 self-center font-mono text-[12px] tabular-nums text-soft">
                  {monthDay(p.created_at)}
                </span>
              </Link>
            ))}
          </Ledger>
        </section>
      )}

      {profile.contributions > 0 && (
        <p className="f0-rule-top mt-8 pt-4 text-sm text-soft">
          <span className="font-display font-extrabold text-ink">
            {profile.contributions}
          </span>{" "}
          research {profile.contributions === 1 ? "note" : "notes"} shared with the club
        </p>
      )}

      {/* ── CREDENTIALS — the centerpiece ─────────────────────────────────── */}
      <section className="mt-11">
        <SectionRule>Credentials</SectionRule>
        <div className="mt-4">
          <BadgeCaseView
            rows={badgeRows}
            title=""
            emptyLine="Badges are earned, not given — this shelf fills as they learn."
          />
        </div>
      </section>
    </div>
  );
}
