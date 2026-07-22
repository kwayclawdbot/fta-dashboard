export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users2, Sparkles, ArrowLeft, Settings, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, mergeBadgeRows } from "@/lib/public-profile";
import { levelProgress } from "@/lib/xp";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import TierBadge from "@/components/TierBadge";
import BadgeCaseView from "@/components/BadgeCaseView";

/**
 * /u/[username] — the public member profile. Authenticated-only (the whole app
 * is auth-gated by the dashboard layout; unauthenticated visitors are redirected
 * to /login before this renders). Reads exclusively through the kid-minimized
 * public_profile RPC, so a minor's page can never leak a family name, role, or
 * join date beyond the month.
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
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sand flex items-center justify-center mx-auto mb-4">
          <Users2 className="w-7 h-7 text-midnight-400" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink mb-1">Member not found</h1>
        <p className="text-sm text-soft font-body mb-6">
          We couldn&apos;t find a member with the handle{" "}
          <span className="font-semibold text-ink">@{username}</span>. They may have changed it.
        </p>
        <Link
          href="/community"
          className="cta-button inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to the community
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

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Hero credential card */}
      <div className="paper-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={profile.display_name}
            avatarUrl={profile.avatar_url}
            role={profile.is_minor ? "child" : "parent"}
            tier={profile.tier}
            size="hero"
          />

          <h1 className="mt-4 font-display text-2xl font-bold text-ink leading-tight">
            {profile.display_name || "Member"}
          </h1>
          <p className="text-sm text-soft font-body">@{profile.username}</p>

          {/* Identity chips */}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <AgeBadge ageGroup={profile.age_group} showLabel />
            <TierBadge tier={profile.tier} size="md" />
            {/* Adults only: parent / member distinction */}
            {!profile.is_minor && profile.role_kind && (
              <span className="text-[11px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-chip-sky text-sky-800">
                {profile.role_kind === "parent" ? "Parent" : "Member"}
              </span>
            )}
          </div>

          {/* Adults only: family line */}
          {!profile.is_minor && profile.family_name && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-midnight-200 font-body">
              <Users2 className="w-4 h-4 text-gold-600" />
              <span className="font-semibold text-ink">{profile.family_name}</span>
            </p>
          )}

          <p className="mt-2 text-xs text-soft font-body">Member since {profile.member_since}</p>

          {isOwn && (
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-700 hover:text-gold-600"
            >
              <Settings className="w-3.5 h-3.5" /> Edit in Settings
            </Link>
          )}
        </div>

        {/* Level + XP progress */}
        <div className="mt-6 pt-6 border-t border-sand">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <Star className="w-4 h-4 text-gold-600" />
              Level {lp.current.level} · {lp.current.name}
            </span>
            <span className="text-xs text-soft font-body">
              {profile.xp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-sand overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
              style={{ width: `${lp.pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-soft font-body">
            {lp.next
              ? `${lp.toNext.toLocaleString()} XP to ${lp.next.name}`
              : "Top level reached — Playbook Pro"}
          </p>
        </div>
      </div>

      {/* Badge case — the centerpiece */}
      <div className="paper-card p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-gold-600" />
          <h2 className="font-display text-base font-bold text-ink">Credentials</h2>
        </div>
        <BadgeCaseView
          rows={badgeRows}
          title=""
          emptyLine="Badges are earned, not given — this shelf fills as they learn."
        />
      </div>
    </div>
  );
}
