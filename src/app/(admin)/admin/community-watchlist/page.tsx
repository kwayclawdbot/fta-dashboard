"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users2,
  Plus,
  Loader2,
  Trash2,
  Search,
  X,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchTickers, fetchQuote, type TickerHit } from "@/lib/market/client";
import type { CommunityEntry, CommunityStatus } from "@/lib/community-watchlist";

const ENTRY_SELECT =
  "id, ticker, company_name, kind, status, headline, thesis, blurb, family_id, family_name, promoted_by, promoter_name, promoter_age_group, source_watchlist_id, snapshot_price, snapshot_at, created_at, latest_close, comment_count";

const ADMIN_STATUSES: CommunityStatus[] = [
  "active",
  "watching",
  "closed",
  "archived",
];

interface Draft {
  id: string | null;
  ticker: string;
  company_name: string;
  status: CommunityStatus;
  headline: string;
  thesis: string;
  snapshot_price: string;
}

function emptyDraft(): Draft {
  return {
    id: null,
    ticker: "",
    company_name: "",
    status: "active",
    headline: "",
    thesis: "",
    snapshot_price: "",
  };
}

type AdminEntry = Pick<
  CommunityEntry,
  | "id"
  | "ticker"
  | "company_name"
  | "kind"
  | "status"
  | "headline"
  | "thesis"
  | "snapshot_price"
  | "created_at"
>;

function draftFromEntry(e: AdminEntry): Draft {
  return {
    id: e.id,
    ticker: e.ticker,
    company_name: e.company_name,
    status: e.status,
    headline: e.headline ?? "",
    thesis: e.thesis ?? "",
    snapshot_price: e.snapshot_price != null ? String(e.snapshot_price) : "",
  };
}

export default function AdminCommunityWatchlistPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [genState, setGenState] = useState<Record<string, "loading" | "done" | "error">>({});
  const [genMsg, setGenMsg] = useState<Record<string, string>>({});

  async function generateReport(ticker: string) {
    setGenState((s) => ({ ...s, [ticker]: "loading" }));
    setGenMsg((m) => ({ ...m, [ticker]: "" }));
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setGenState((s) => ({ ...s, [ticker]: "error" }));
      setGenMsg((m) => ({ ...m, [ticker]: "Not signed in." }));
      return;
    }
    try {
      const res = await fetch("/api/admin/kai-report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenState((s) => ({ ...s, [ticker]: "error" }));
        setGenMsg((m) => ({ ...m, [ticker]: data?.error || "Failed." }));
        return;
      }
      setGenState((s) => ({ ...s, [ticker]: "done" }));
      setGenMsg((m) => ({ ...m, [ticker]: `Published v${data.version}` }));
    } catch {
      setGenState((s) => ({ ...s, [ticker]: "error" }));
      setGenMsg((m) => ({ ...m, [ticker]: "Network error." }));
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_watchlist")
      .select(ENTRY_SELECT)
      .eq("kind", "admin")
      .order("updated_at", { ascending: false });
    setRows((data ?? []) as AdminEntry[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(e: AdminEntry) {
    if (
      !window.confirm(
        `Remove the ${e.ticker} research pick from the community board?`
      )
    )
      return;
    const { error } = await supabase
      .from("community_watchlist")
      .delete()
      .eq("id", e.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== e.id));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
            <Users2 className="w-6 h-6 text-amber-400" /> Community Watchlist —
            Our Research
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Admin-curated picks on the club&apos;s communal board. Members
            research + comment per ticker. Publishing notifies members.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => setEditing(emptyDraft())}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            <Plus className="w-3.5 h-3.5" /> New research pick
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-20 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
          <h3 className="mb-2 text-lg font-semibold text-zinc-300">
            No research picks yet
          </h3>
          <p className="mx-auto max-w-md text-sm text-zinc-500">
            Add the first admin pick — a ticker, a headline, and the full
            &ldquo;why we study this&rdquo; thesis.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/market/logo?symbol=${encodeURIComponent(e.ticker)}`}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
                onError={(ev) => (ev.currentTarget.style.visibility = "hidden")}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-100">
                    {e.company_name}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">
                    {e.ticker}
                  </span>
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    {e.status}
                  </span>
                </div>
                {e.headline && (
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {e.headline}
                  </p>
                )}
                {e.snapshot_price != null && (
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    Snapshot ${Number(e.snapshot_price).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <button
                  onClick={() => generateReport(e.ticker)}
                  disabled={genState[e.ticker] === "loading"}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-700/60 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:border-violet-500 disabled:opacity-50"
                  title="Generate a Kai research report for this ticker"
                >
                  {genState[e.ticker] === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Kai report
                </button>
                {genMsg[e.ticker] && (
                  <span
                    className={`mt-0.5 text-[10px] ${
                      genState[e.ticker] === "error"
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {genMsg[e.ticker]}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditing(draftFromEntry(e))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-amber-600 hover:text-amber-400"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(e)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-red-800 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Editor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════ Editor ══════════════════════════ */

function Editor({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tickerQuery, setTickerQuery] = useState("");
  const [hits, setHits] = useState<TickerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const q = tickerQuery.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchTickers(q, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setHits(r);
        setSearching(false);
        setShowResults(true);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [tickerQuery]);

  async function pickTicker(hit: TickerHit) {
    setD((prev) => ({ ...prev, ticker: hit.ticker, company_name: hit.name }));
    setTickerQuery("");
    setShowResults(false);
    const q = await fetchQuote(hit.ticker);
    if (q?.price != null) {
      setD((prev) => ({ ...prev, snapshot_price: q.price!.toFixed(2) }));
    }
  }

  async function save() {
    setError(null);
    if (!d.ticker.trim() || !d.company_name.trim()) {
      setError("A ticker and company name are required.");
      return;
    }
    setSaving(true);

    const payload = {
      ticker: d.ticker.trim().toUpperCase(),
      company_name: d.company_name.trim(),
      status: d.status,
      headline: d.headline.trim() || null,
      thesis: d.thesis.trim() || null,
      snapshot_price: d.snapshot_price.trim() ? Number(d.snapshot_price) : null,
    };

    let err;
    if (d.id) {
      ({ error: err } = await supabase
        .from("community_watchlist")
        .update(payload)
        .eq("id", d.id));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      ({ error: err } = await supabase.from("community_watchlist").insert({
        ...payload,
        kind: "admin",
        promoted_by: user?.id ?? null,
      }));
    }
    setSaving(false);
    if (err) {
      setError(`Save failed: ${err.message}`);
      return;
    }
    onSaved();
  }

  const field =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
  const label =
    "block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0d0d14] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {d.id ? "Edit research pick" : "New research pick"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Ticker search */}
          <div>
            <label className={label}>Company</label>
            {d.ticker ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/market/logo?symbol=${encodeURIComponent(d.ticker)}`}
                  alt=""
                  className="h-7 w-7 rounded bg-white object-contain p-0.5"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                <div className="min-w-0 flex-1">
                  <input
                    value={d.company_name}
                    onChange={(e) =>
                      setD({ ...d, company_name: e.target.value })
                    }
                    className="w-full bg-transparent text-sm font-semibold text-zinc-100 focus:outline-none"
                  />
                  <span className="font-mono text-xs text-zinc-500">
                    {d.ticker}
                  </span>
                </div>
                <button
                  onClick={() => setD({ ...d, ticker: "", company_name: "" })}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    value={tickerQuery}
                    onChange={(e) => setTickerQuery(e.target.value)}
                    onFocus={() => hits.length && setShowResults(true)}
                    placeholder="Search a ticker or company (e.g. AAPL, Apple)"
                    className="flex-1 bg-transparent py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                  {searching && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  )}
                </div>
                {showResults && hits.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-[#12121a] shadow-xl">
                    {hits.map((h) => (
                      <button
                        key={h.ticker}
                        onClick={() => pickTicker(h)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/market/logo?symbol=${encodeURIComponent(h.ticker)}`}
                          alt=""
                          className="h-6 w-6 rounded bg-white object-contain p-0.5"
                          onError={(e) =>
                            (e.currentTarget.style.visibility = "hidden")
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                          {h.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          {h.ticker}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status + snapshot price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Status</label>
              <select
                value={d.status}
                onChange={(e) =>
                  setD({ ...d, status: e.target.value as CommunityStatus })
                }
                className={field}
              >
                {ADMIN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Snapshot price</label>
              <input
                type="number"
                step="0.01"
                value={d.snapshot_price}
                onChange={(e) => setD({ ...d, snapshot_price: e.target.value })}
                placeholder="auto from live quote"
                className={field}
              />
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className={label}>Headline</label>
            <input
              value={d.headline}
              onChange={(e) => setD({ ...d, headline: e.target.value })}
              placeholder="One line — what makes this company worth studying"
              className={field}
            />
          </div>

          {/* Thesis */}
          <div>
            <label className={label}>Why we study this company (full)</label>
            <textarea
              value={d.thesis}
              onChange={(e) => setD({ ...d, thesis: e.target.value })}
              rows={8}
              placeholder="The full write-up. Separate paragraphs with a blank line. Keep it educational — no advice language."
              className={field}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {d.id ? "Save changes" : "Publish pick"}
          </button>
        </div>
      </div>
    </div>
  );
}
