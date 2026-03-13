"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, ChevronDown, Shield, User, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProfileRow {
  id: string;
  family_id: string | null;
  role: string;
  display_name: string | null;
  email: string | null;
  track: string | null;
  onboarding_complete: boolean;
}

const ROLE_OPTIONS = ["parent", "child", "coach", "admin"];

export default function AdminUsersPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<ProfileRow[]>([]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("display_name");
    setProfiles(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  async function handleRoleChange(userId: string, newRole: string) {
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    setProfiles((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
    );
  }

  async function viewFamily(familyId: string) {
    if (expandedFamilyId === familyId) {
      setExpandedFamilyId(null);
      setFamilyMembers([]);
      return;
    }
    setExpandedFamilyId(familyId);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("family_id", familyId)
      .order("role");
    setFamilyMembers(data || []);
  }

  const filtered = profiles.filter((p) => {
    const matchesSearch =
      !search ||
      (p.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-3 h-3" />;
      case "coach":
        return <Crown className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "text-red-400 bg-red-400/10";
      case "coach":
        return "text-purple-400 bg-purple-400/10";
      case "parent":
        return "text-blue-400 bg-blue-400/10";
      case "child":
        return "text-emerald-400 bg-emerald-400/10";
      default:
        return "text-zinc-400 bg-zinc-800";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage user accounts and roles
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 placeholder:text-zinc-600"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 appearance-none pr-8"
          >
            <option value="all">All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
        <p className="text-xs text-zinc-500">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">
            No users found
          </h3>
          <p className="text-sm text-zinc-500">
            {search || roleFilter !== "all"
              ? "Try adjusting your filters"
              : "No users in the system yet"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Family
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Track
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Onboarding
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <>
                  <tr
                    key={profile.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm text-zinc-100 font-medium">
                        {profile.display_name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {profile.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={profile.role}
                        onChange={(e) =>
                          handleRoleChange(profile.id, e.target.value)
                        }
                        className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/50 ${roleColor(
                          profile.role
                        )}`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r} className="bg-zinc-900 text-zinc-100">
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {profile.family_id ? (
                        <button
                          onClick={() => viewFamily(profile.family_id!)}
                          className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-mono"
                        >
                          {expandedFamilyId === profile.family_id
                            ? "Hide"
                            : "View"}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {profile.track || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          profile.onboarding_complete
                            ? "bg-green-400"
                            : "bg-zinc-600"
                        }`}
                        title={
                          profile.onboarding_complete
                            ? "Complete"
                            : "Incomplete"
                        }
                      />
                    </td>
                  </tr>

                  {/* Expanded family members */}
                  {expandedFamilyId === profile.family_id &&
                    profile.family_id &&
                    familyMembers.length > 0 && (
                      <tr key={`family-${profile.family_id}`}>
                        <td colSpan={6} className="px-4 py-2 bg-zinc-900/60">
                          <div className="ml-4 border-l-2 border-amber-400/20 pl-4">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold">
                              Family Members
                            </p>
                            {familyMembers.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-3 py-1.5"
                              >
                                <div
                                  className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${roleColor(
                                    m.role
                                  )}`}
                                >
                                  {roleIcon(m.role)}
                                  {m.role}
                                </div>
                                <span className="text-sm text-zinc-300">
                                  {m.display_name || m.email || "—"}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {m.email}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
