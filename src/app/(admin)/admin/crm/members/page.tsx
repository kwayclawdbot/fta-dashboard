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
import { StageBadge } from "@/components/admin/crm/marketing-ui";
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
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Contacts</h1>
          <p className="text-soft text-sm mt-1">
            Every member and lead in one directory
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink hover:border-accent/50 hover:text-accent-strong transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <InviteMemberButton />
        </div>
      </div>


      {/* Kind chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {KIND_CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setKind(c.id)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              kind === c.id
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-sand text-soft hover:text-ink hover:border-accent/50"
            }`}
          >
            {c.label}
            <span className="text-[10px] text-soft">
              {counts[c.id] ?? 0}
            </span>
          </button>
        ))}
        <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full bg-paper border border-sand rounded-lg pl-9 pr-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50 placeholder:text-soft/70"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-10 h-10 text-soft/70 mx-auto mb-3" />
          <h3 className="font-display text-[17px] font-extrabold text-ink mb-1">
            No contacts found
          </h3>
          <p className="text-sm text-soft">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-soft mb-2">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="club-b-card overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-sand bg-paper font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
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
                    className="border-b border-sand hover:bg-paper transition-colors cursor-pointer"
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
                          <p className="text-sm text-ink font-medium truncate max-w-[200px]">
                            {r.name || "—"}
                          </p>
                          <p className="text-[11px] text-soft truncate max-w-[200px]">
                            {r.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <ContactKindChip kind={r.contact_kind} />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-soft">
                      {r.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.record === "lead" && r.stage ? (
                        <StageBadge stage={r.stage as Stage} />
                      ) : r.role ? (
                        <RoleChip role={r.role} />
                      ) : (
                        <span className="text-soft/70 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <LastSeenDot iso={r.last_activity} />
                        <span className="text-xs text-soft">
                          {relativeTime(r.last_activity)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-soft">
                      {shortDate(r.created)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => quickSend(e, r, "email")}
                          disabled={!r.email}
                          title={r.email ? "Email" : "No email"}
                          className="p-1.5 rounded-lg text-soft hover:text-accent hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => quickSend(e, r, "sms")}
                          disabled={!r.phone}
                          title={r.phone ? "SMS" : "No phone"}
                          className="p-1.5 rounded-lg text-soft hover:text-accent hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent"
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

/**
 * Invite a member — ported verbatim from the retired /admin/users directory
 * (its critical membership-flow path). Bypasses Stripe: records the invite via
 * /api/admin/invite and either activates an existing member's program
 * immediately or emails them a link to create their account.
 */
function InviteMemberButton() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState<"fic" | "fta">("fic");
  const [door, setDoor] = useState<"family" | "club">("family");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ email, program, door }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error || "Failed");
      return;
    }
    setMsg(
      j.mode === "activated"
        ? "Existing member — program activated immediately."
        : j.mode === "invite_email_failed"
          ? "Recorded — but the invite email could not be sent right now (mailer limit). Try again later or share the login link manually."
          : "Invite sent. They'll get an email to create their account."
    );
    setEmail("");
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className="f0-press f0-focus px-3.5 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] text-sm font-semibold hover:bg-accent-strong"
      >
        + Invite member
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-sm club-b-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-[17px] font-extrabold text-ink mb-1">
              Invite a member
            </h2>
            <p className="text-xs text-soft mb-4">
              Bypasses Stripe — they get an email link to create their account,
              and their program activates automatically.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full rounded-lg bg-paper border border-sand px-3 py-2 text-sm text-ink mb-3 focus:outline-none focus:border-accent"
            />
            <div className="flex gap-2 mb-4">
              {(["fic", "fta"] as const).map((pr) => (
                <button
                  key={pr}
                  onClick={() => setProgram(pr)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    program === pr
                      ? "bg-accent/15 border-accent text-accent"
                      : "border-sand text-soft"
                  }`}
                >
                  {pr === "fic" ? "FIC — Investing Club" : "FTA — Trading Academy"}
                </button>
              ))}
            </div>
            {/* THE DOOR (E1) — which experience this member is provisioned
                into. Not a plan and not a tier: the same membership, entered
                through Cheat Code Club (individual) or Family Investing Club.
                Stamped once at provisioning; changed afterwards only by the
                explicit conversion flow, never by a domain visit. */}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
              Door
            </p>
            <div className="flex gap-2 mb-4">
              {(["family", "club"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDoor(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    door === d
                      ? "bg-accent/15 border-accent text-accent"
                      : "border-sand text-soft"
                  }`}
                >
                  {d === "family" ? "Family Investing Club" : "Cheat Code Club"}
                </button>
              ))}
            </div>
            {msg && <p className="text-xs mb-3 text-accent">{msg}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-sand text-sm text-ink"
              >
                Close
              </button>
              <button
                onClick={send}
                disabled={busy || !email}
                className="f0-press f0-focus flex-1 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
