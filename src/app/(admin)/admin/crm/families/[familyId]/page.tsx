"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  CreditCard,
  ListChecks,
  Eye,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchFamilyDetail,
  relativeTime,
  shortDate,
  type FamilyDetail,
} from "@/lib/crm";
import {
  AdminAvatar,
  TierChip,
  RoleChip,
  LastSeenDot,
  StatTile,
} from "@/components/admin/crm/ui";

export default function FamilyDetailPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const supabase = createClient();
  const [data, setData] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchFamilyDetail(supabase, familyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load family");
    } finally {
      setLoading(false);
    }
  }, [supabase, familyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data || !data.family) {
    return (
      <div className="max-w-3xl mx-auto">
        <BackLink />
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400 mt-4">
          {error || "Family not found"}
        </div>
      </div>
    );
  }

  const { family, enrollments, members, orientation, watchlist, combined } =
    data;

  return (
    <div className="max-w-6xl mx-auto">
      <BackLink />

      {/* Family header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mt-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
            <Home className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-100">
                {family.name || "Unnamed family"}
              </h1>
              <TierChip tier={family.tier} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {members.length} member
                {members.length !== 1 ? "s" : ""}
              </span>
              <span>Created {shortDate(family.created_at)}</span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                {family.has_stripe ? "Stripe linked" : "No Stripe"}
              </span>
              {family.expires_at ? (
                <span>Expires {shortDate(family.expires_at)}</span>
              ) : null}
            </div>
            {enrollments.length > 0 ? (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {enrollments.map((e, i) => (
                  <span
                    key={i}
                    className={`text-[11px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${
                      e.status === "active"
                        ? "text-emerald-400 bg-emerald-400/10"
                        : "text-zinc-500 bg-zinc-800"
                    }`}
                    title={e.cohort ? `Cohort: ${e.cohort}` : undefined}
                  >
                    {e.program} · {e.status}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Combined stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
        <StatTile label="Family XP" value={combined.xp_total.toLocaleString()} accent="text-amber-400" />
        <StatTile label="Lessons" value={combined.lessons} />
        <StatTile label="Quizzes" value={combined.quizzes} />
        <StatTile label="Posts" value={combined.posts} />
        <StatTile label="Missions" value={combined.missions} />
        <StatTile label="RSVPs" value={combined.rsvps} />
        <StatTile label="Watchlist" value={combined.watchlist_size} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Members */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">Members</span>
          </div>
          <div className="space-y-1">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/admin/crm/members/${m.id}`}
                className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-zinc-800/40 transition-colors"
              >
                <AdminAvatar
                  name={m.display_name}
                  avatarUrl={m.avatar_url}
                  tier={family.tier}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-100 font-medium truncate">
                      {m.display_name || "—"}
                    </p>
                    <RoleChip role={m.role} />
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {m.email || m.age_group || "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-amber-400/80">
                    {m.xp_total.toLocaleString()} XP
                  </p>
                  <p className="text-[11px] text-zinc-600 flex items-center gap-1 justify-end">
                    <LastSeenDot iso={m.last_seen} />
                    {relativeTime(m.last_seen)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right column: orientation + watchlist */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-zinc-300">
                Orientation
              </span>
              <span className="text-xs text-zinc-500">
                {orientation.length} step{orientation.length !== 1 ? "s" : ""} done
              </span>
            </div>
            {orientation.length === 0 ? (
              <p className="text-xs text-zinc-600">Not started</p>
            ) : (
              <div className="space-y-1.5">
                {orientation.map((o) => (
                  <div
                    key={o.step_key}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-300 capitalize">
                      {o.step_key.replace(/[_-]/g, " ")}
                    </span>
                    <span className="text-zinc-600">
                      {shortDate(o.completed_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-zinc-300">
                Watchlist
              </span>
              <span className="text-xs text-zinc-500">
                {watchlist.length} ticker{watchlist.length !== 1 ? "s" : ""}
              </span>
            </div>
            {watchlist.length === 0 ? (
              <p className="text-xs text-zinc-600">Empty</p>
            ) : (
              <div className="space-y-1.5">
                {watchlist.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <span className="text-zinc-100 font-semibold">
                        {w.ticker}
                      </span>
                      {w.company_name ? (
                        <span className="text-zinc-500 ml-1.5 truncate">
                          {w.company_name}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-zinc-600 shrink-0 ml-2">
                      {w.champion || w.status || ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/crm/members"
      className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back to members
    </Link>
  );
}
