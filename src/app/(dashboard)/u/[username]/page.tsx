export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Users2,
  ArrowLeft,
  Settings,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, mergeBadgeRows } from "@/lib/public-profile";
import { levelProgress } from "@/lib/xp";
import { beltForXp } from "@/lib/belts";
import Avatar from "@/components/Avatar";
import BeltBadge from "@/components/BeltBadge";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import CompanyLogo from "@/components/fic/CompanyLogo";
import BadgeCaseView from "@/components/BadgeCaseView";
import { DisplayHead, SectionRule, TextAction } from "@/components/f0/parts";

/**
 * /u/[username] — the public member profile. Authenticated-only (the whole app
 * is auth-gated by the dashboard layout; unauthenticated visitors are redirected
 * to /login before this renders). Reads exclusively through the kid-minimized
 * public_profile RPC, so a minor's page can never leak a family name, role, or
 * join date beyond the month.
 *
 * REBUILD NOTE (canvas): the consent/minimization gates are untouched — the
 * family line and the parent/member distinction still render only when
 * `!profile.is_minor`, and nothing new is read or shown. The page was recomposed
 * so IDENTITY leads (avatar, name, standing) and everything below it reads as
 * one contribution ledger instead of four stacked cards.
 */

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
          className="cta-button mt-6 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the community
        </Link>
      </div>
    );
  }

  const isOwn = auth?.user?.id === profile.id;
  const defs = await supabase
    .from("badges")
    .select("slug, title, subtitle, sort")
    .not("criteria_key", "is", null)
    .order("sort", { ascending: true });
  const badgeRows = mergeBadgeRows(
    (defs.data ?? []) as { slug: string; title: string; subtitle: string | null; sort: number }[],
    profile.badges
  );

  const lp = levelProgress(profile.xp);
  const belt = beltForXp(profile.xp);
  const nextBelt = lp.next ? beltForXp(lp.next.min) : null;

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
          <p className="font-display text-display-3 font-extrabold text-ink">
            {belt.label}
            <span className="ml-2 font-body text-sm font-normal text-soft">
              Level {lp.current.level} · {lp.current.name}
            </span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full"
              style={{ width: `${lp.pct}%`, backgroundColor: belt.belt.hex }}
            />
          </div>
          <p className="mt-2 text-[12px] text-soft">
            {lp.next && nextBelt
              ? `${lp.toNext.toLocaleString()} XP to ${nextBelt.label}`
              : "Black Belt earned — top of the ladder"}
          </p>
        </div>
      </section>

      {/* ── CONTRIBUTION LEDGER ───────────────────────────────────────────── */}
      {/* Likes, picks and notes are already-public community actions — nothing
          here is newly exposed, including for minors. */}
      {profile.liked_tickers.length > 0 && (
        <section className="mt-11">
          <SectionRule>Favorite stocks</SectionRule>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.liked_tickers.map((t) => (
              <Link
                key={t.ticker}
                href={`/research/${encodeURIComponent(t.ticker)}`}
                className="inline-flex items-center gap-2 rounded-full border border-sand px-3 py-1.5 text-sm transition-colors hover:border-gold-500"
              >
                <CompanyLogo symbol={t.ticker} name={t.company_name ?? t.ticker} size={20} />
                <span className="font-semibold text-ink">{t.ticker}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {profile.community_picks.length > 0 && (
        <section className="mt-11">
          <SectionRule>Community picks</SectionRule>
          <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-soft">
            Companies {profile.display_name || "this member"} championed to the
            club&apos;s shared board — and how they&apos;ve done since.
          </p>
          <div className="f0-ledger mt-2">
            {profile.community_picks.map((p) => {
              const up = p.pct_since != null && p.pct_since > 0;
              const down = p.pct_since != null && p.pct_since < 0;
              return (
                <Link
                  key={p.ticker}
                  href={`/research/${encodeURIComponent(p.ticker)}`}
                  className="f0-ledger-row"
                >
                  <CompanyLogo symbol={p.ticker} name={p.company_name ?? p.ticker} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-bold text-ink">
                      {p.company_name ?? p.ticker}
                    </p>
                    <p className="font-mono text-[11px] text-soft">{p.ticker}</p>
                  </div>
                  {p.pct_since != null ? (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 font-mono text-[13px] font-bold tabular-nums ${
                        up ? "text-price-up" : down ? "text-price-down" : "text-soft"
                      }`}
                      title="Change since it was added to the board"
                    >
                      {up ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : down ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : null}
                      {up ? "+" : ""}
                      {p.pct_since.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-soft">since added</span>
                  )}
                </Link>
              );
            })}
          </div>
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
