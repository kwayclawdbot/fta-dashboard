"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Users, Search, ChevronDown, Shield, User, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierMap, TIER_CONFIG, type FamilyTier } from "@/lib/tier";

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
const TIER_OPTIONS: FamilyTier[] = ["fic", "fta"];

export default function AdminUsersPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<ProfileRow[]>([]);
  const [tiers, setTiers] = useState<Record<string, FamilyTier>>({});
  const [savingTier, setSavingTier] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("display_name");
    setProfiles(data || []);
    // One query for every family's membership tier (family_tiers view).
    setTiers(
      await getFamilyTierMap(
        supabase,
        (data || []).map((p: ProfileRow) => p.family_id)
      )
    );
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

  // Manual enrollment: after a Stripe payment-link checkout, the admin flips
  // the family's tier here. Writes go through the admin_set_family_tier RPC
  // (migration 029), which upserts/cancels `enrollments` rows — the single
  // source of truth every access gate reads.
  async function handleTierChange(familyId: string, newTier: FamilyTier) {
    setSavingTier(familyId);
    const { error } = await supabase.rpc("admin_set_family_tier", {
      p_family_id: familyId,
      p_tier: newTier,
    });
    if (!error) {
      setTiers((prev) => ({ ...prev, [familyId]: newTier }));
    }
    setSavingTier(null);
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
          <InviteMemberButton />
        </div>
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
                  Tier
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
                <Fragment key={profile.id}>
                  <tr
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
                          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          {expandedFamilyId === profile.family_id
                            ? "Hide"
                            : "View"}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {profile.family_id ? (
                        <select
                          value={tiers[profile.family_id] || "fic"}
                          disabled={savingTier === profile.family_id}
                          onChange={(e) =>
                            handleTierChange(
                              profile.family_id!,
                              e.target.value as FamilyTier
                            )
                          }
                          title={`Membership tier — sets the whole family (${
                            TIER_CONFIG[tiers[profile.family_id] || "fic"].name
                          })`}
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/50 disabled:opacity-50 ${
                            (tiers[profile.family_id] || "fic") === "fta"
                              ? "text-amber-400 bg-amber-400/10"
                              : "text-zinc-400 bg-zinc-800"
                          }`}
                        >
                          {TIER_OPTIONS.map((t) => (
                            <option
                              key={t}
                              value={t}
                              className="bg-zinc-900 text-zinc-100"
                            >
                              {TIER_CONFIG[t].label}
                            </option>
                          ))}
                        </select>
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
                        <td colSpan={7} className="px-4 py-2 bg-zinc-900/60">
                          <div className="ml-4 border-l-2 border-amber-400/20 pl-4">
                            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-bold">
                              Family Members
                            </p>
                            {familyMembers.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-3 py-1.5"
                              >
                                <div
                                  className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${roleColor(
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
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InviteMemberButton() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState<"fic" | "fta">("fic");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ email, program }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error || "Failed"); return; }
    setMsg(
      j.mode === "activated"
        ? "Existing member — program activated immediately."
        : "Invite sent. They'll get an email to create their account."
    );
    setEmail("");
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="px-3.5 py-2 rounded-lg bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400"
      >
        + Invite member
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-700 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">Invite a member</h2>
            <p className="text-xs text-zinc-400 mb-4">Bypasses Stripe — they get an email link to create their account, and their program activates automatically.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 mb-3 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2 mb-4">
              {(["fic", "fta"] as const).map((pr) => (
                <button
                  key={pr}
                  onClick={() => setProgram(pr)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${program === pr ? "bg-amber-500/15 border-amber-500 text-amber-400" : "border-zinc-700 text-zinc-400"}`}
                >
                  {pr === "fic" ? "FIC — Investing Club" : "FTA — Trading Academy"}
                </button>
              ))}
            </div>
            {msg && <p className="text-xs mb-3 text-amber-300">{msg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300">Close</button>
              <button onClick={send} disabled={busy || !email} className="flex-1 py-2 rounded-lg bg-amber-500 text-zinc-950 text-sm font-semibold disabled:opacity-50">
                {busy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
