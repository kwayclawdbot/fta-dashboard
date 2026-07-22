"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, Users, Mail, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { relativeTime, shortDate, downloadCsv } from "@/lib/crm";
import {
  fetchContacts,
  buildContactCsv,
  type ContactRow,
  type ContactKind,
} from "@/lib/contacts";
import {
  AdminAvatar,
  ContactKindChip,
  RoleChip,
  LastSeenDot,
} from "@/components/admin/crm/ui";
import { MarketingNav, StageBadge } from "@/components/admin/crm/marketing-ui";
import {
  ContactCommsModal,
  type CommsTarget,
} from "@/components/admin/crm/ContactCommsModal";
import type { Stage } from "@/lib/marketing";

const KIND_CHIPS: { id: ContactKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lead", label: "Leads" },
  { id: "free", label: "Free" },
  { id: "fic", label: "FIC" },
  { id: "fta", label: "FTA" },
];

export default function CrmContactsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ContactKind | "all">("all");

  const [modal, setModal] = useState<{
    target: CommsTarget;
    channel: "email" | "sms";
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setContacts(await fetchContacts(supabase, { kind: "all" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contacts.length };
    for (const r of contacts) c[r.contact_kind] = (c[r.contact_kind] || 0) + 1;
    return c;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((r) => {
      if (kind !== "all" && r.contact_kind !== kind) return false;
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, kind]);

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`fta-contacts-${stamp}.csv`, buildContactCsv(filtered));
  }

  function openContact(r: ContactRow) {
    router.push(
      r.record === "lead"
        ? `/admin/crm/members/lead-${r.contact_id}`
        : `/admin/crm/members/${r.contact_id}`
    );
  }

  function quickSend(
    e: React.MouseEvent,
    r: ContactRow,
    channel: "email" | "sms"
  ) {
    e.stopPropagation();
    const first = (r.name || "").trim().split(/\s+/)[0] || null;
    setModal({
      channel,
      target: {
        record: r.record,
        contact_id: r.contact_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        first_name: first,
        stage: r.stage,
      },
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Contacts</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Every member and lead in one directory
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:border-amber-400/50 hover:text-amber-400 transition-colors disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <MarketingNav active="members" />

      {/* Kind chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {KIND_CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setKind(c.id)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              kind === c.id
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {c.label}
            <span className="text-[10px] text-zinc-500">
              {counts[c.id] ?? 0}
            </span>
          </button>
        ))}
        <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 placeholder:text-zinc-600"
          />
        </div>
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
            No contacts found
          </h3>
          <p className="text-sm text-zinc-500">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-2">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="rounded-xl border border-zinc-800 overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400 uppercase tracking-wider">
                  <th className="px-3 py-3 text-left font-medium">Contact</th>
                  <th className="px-3 py-3 text-left font-medium">Type</th>
                  <th className="px-3 py-3 text-left font-medium">Phone</th>
                  <th className="px-3 py-3 text-left font-medium">Stage / Role</th>
                  <th className="px-3 py-3 text-left font-medium">Last activity</th>
                  <th className="px-3 py-3 text-left font-medium">Added</th>
                  <th className="px-3 py-3 text-right font-medium">Reach out</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={`${r.record}-${r.contact_id}`}
                    onClick={() => openContact(r)}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <AdminAvatar
                          name={r.name}
                          tier={
                            r.contact_kind === "fta"
                              ? "fta"
                              : r.contact_kind === "fic"
                                ? "fic"
                                : "free"
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-100 font-medium truncate max-w-[200px]">
                            {r.name || "—"}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                            {r.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <ContactKindChip kind={r.contact_kind} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-zinc-400">
                      {r.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.record === "lead" && r.stage ? (
                        <StageBadge stage={r.stage as Stage} />
                      ) : r.role ? (
                        <RoleChip role={r.role} />
                      ) : (
                        <span className="text-zinc-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <LastSeenDot iso={r.last_activity} />
                        <span className="text-xs text-zinc-400">
                          {relativeTime(r.last_activity)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">
                      {shortDate(r.created)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => quickSend(e, r, "email")}
                          disabled={!r.email}
                          title={r.email ? "Email" : "No email"}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => quickSend(e, r, "sms")}
                          disabled={!r.phone}
                          title={r.phone ? "SMS" : "No phone"}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <ContactCommsModal
          target={modal.target}
          channel={modal.channel}
          onClose={() => setModal(null)}
          onSent={load}
        />
      )}
    </div>
  );
}
