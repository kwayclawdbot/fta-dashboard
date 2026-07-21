"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Users,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { levelForXp } from "@/lib/xp";
import {
  fetchMembers,
  buildMemberCsv,
  downloadCsv,
  relativeTime,
  shortDate,
  recencyBucket,
  type MemberRow,
  type RecencyBucket,
} from "@/lib/crm";
import {
  CrmNav,
  AdminAvatar,
  TierChip,
  RoleChip,
  LastSeenDot,
} from "@/components/admin/crm/ui";

type SortKey =
  | "display_name"
  | "family_name"
  | "role"
  | "tier"
  | "xp_total"
  | "lessons_completed"
  | "quizzes_taken"
  | "posts"
  | "missions"
  | "last_seen"
  | "joined_at";

const ROLE_OPTIONS = ["parent", "child", "coach", "admin"];
const RECENCY_OPTIONS: { id: RecencyBucket | "all"; label: string }[] = [
  { id: "all", label: "Any activity" },
  { id: "today", label: "Active today" },
  { id: "week", label: "Active this week" },
  { id: "month", label: "Active this month" },
  { id: "dormant", label: "Dormant 30d+" },
  { id: "never", label: "Never active" },
];

export default function CrmMembersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyBucket | "all">(
    "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    try {
      setMembers(await fetchMembers(supabase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "display_name" || key === "family_name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.display_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.family_name || "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || m.role === roleFilter;
      const matchesTier = tierFilter === "all" || m.tier === tierFilter;
      const matchesRecency =
        recencyFilter === "all" || recencyBucket(m.last_seen) === recencyFilter;
      return matchesSearch && matchesRole && matchesTier && matchesRecency;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // nulls always sort last
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [members, search, roleFilter, tierFilter, recencyFilter, sortKey, sortDir]);

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`fta-members-${stamp}.csv`, buildMemberCsv(filtered));
  }

  const SortHead = ({
    label,
    k,
    align = "left",
  }: {
    label: string;
    k: SortKey;
    align?: "left" | "center";
  }) => (
    <th
      className={`px-3 py-3 text-${align} text-xs font-medium text-zinc-400 uppercase tracking-wider select-none`}
    >
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 hover:text-zinc-200 transition-colors ${
          align === "center" ? "justify-center" : ""
        }`}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">CRM</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Member directory and activity
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:border-amber-400/50 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-200"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <CrmNav active="members" />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, family…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 placeholder:text-zinc-600"
          />
        </div>
        <FilterSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[{ value: "all", label: "All roles" }].concat(
            ROLE_OPTIONS.map((r) => ({ value: r, label: r }))
          )}
        />
        <FilterSelect
          value={tierFilter}
          onChange={setTierFilter}
          options={[
            { value: "all", label: "All tiers" },
            { value: "fta", label: "FTA" },
            { value: "fic", label: "FIC" },
          ]}
        />
        <FilterSelect
          value={recencyFilter}
          onChange={(v) => setRecencyFilter(v as RecencyBucket | "all")}
          options={RECENCY_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        />
        <p className="text-xs text-zinc-500 ml-auto">
          {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">
            No members found
          </h3>
          <p className="text-sm text-zinc-500">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <SortHead label="Member" k="display_name" />
                <SortHead label="Family" k="family_name" />
                <SortHead label="Role" k="role" />
                <SortHead label="Tier" k="tier" />
                <SortHead label="Level / XP" k="xp_total" />
                <SortHead label="Lessons" k="lessons_completed" align="center" />
                <SortHead label="Quizzes" k="quizzes_taken" align="center" />
                <SortHead label="Posts" k="posts" align="center" />
                <SortHead label="Missions" k="missions" align="center" />
                <SortHead label="Last seen" k="last_seen" />
                <SortHead label="Joined" k="joined_at" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const lvl = levelForXp(m.xp_total);
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/admin/crm/members/${m.id}`)}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <AdminAvatar
                          name={m.display_name}
                          avatarUrl={m.avatar_url}
                          tier={m.tier}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-100 font-medium truncate max-w-[180px]">
                            {m.display_name || "—"}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                            {m.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-zinc-400 max-w-[140px] truncate">
                      {m.family_name || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <RoleChip role={m.role} />
                        {m.age_group ? (
                          <span className="text-[10px] text-zinc-600">
                            {m.age_group}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TierChip tier={m.tier} />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-zinc-200">
                        L{lvl.level}{" "}
                        <span className="text-zinc-500 text-xs">{lvl.name}</span>
                      </p>
                      <p className="text-[11px] text-amber-400/80">
                        {m.xp_total.toLocaleString()} XP
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-zinc-300">
                      {m.lessons_completed}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-zinc-300">
                      {m.quizzes_taken}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-zinc-300">
                      {m.posts}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-zinc-300">
                      {m.missions}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <LastSeenDot iso={m.last_seen} />
                        <span className="text-xs text-zinc-400">
                          {relativeTime(m.last_seen)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">
                      {shortDate(m.joined_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 appearance-none pr-8 capitalize"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
    </div>
  );
}
