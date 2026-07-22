"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gem,
  Plus,
  Loader2,
  Trash2,
  Search,
  X,
  Film,
  Link2,
  Upload,
  Youtube,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchTickers, fetchQuote, type TickerHit } from "@/lib/market/client";
import {
  normArticleLinks,
  detectVideoUrlKind,
  formatPickedDate,
  statusMeta,
  PICKS_MEDIA_BUCKET,
  type Pick,
  type PickStatus,
  type PickVideoKind,
  type ArticleLink,
} from "@/lib/picks";

const PICK_SELECT =
  "id, ticker, company_name, status, headline, thesis_short, thesis_long, picked_at, picked_price, video_path, video_kind, article_links, tags, created_by, closed_note, created_at, updated_at";

const STATUSES: PickStatus[] = ["draft", "watching", "active", "closed"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

interface Draft {
  id: string | null;
  ticker: string;
  company_name: string;
  status: PickStatus;
  headline: string;
  thesis_short: string;
  thesis_long: string;
  picked_at: string;
  picked_price: string;
  video_kind: PickVideoKind | "";
  video_path: string;
  video_url_input: string;
  article_links: ArticleLink[];
  tags: string;
  closed_note: string;
}

function emptyDraft(): Draft {
  return {
    id: null,
    ticker: "",
    company_name: "",
    status: "draft",
    headline: "",
    thesis_short: "",
    thesis_long: "",
    picked_at: new Date().toISOString().slice(0, 10),
    picked_price: "",
    video_kind: "",
    video_path: "",
    video_url_input: "",
    article_links: [],
    tags: "",
    closed_note: "",
  };
}

function draftFromPick(p: Pick): Draft {
  const isUrlKind = p.video_kind === "youtube" || p.video_kind === "external";
  return {
    id: p.id,
    ticker: p.ticker,
    company_name: p.company_name,
    status: p.status,
    headline: p.headline ?? "",
    thesis_short: p.thesis_short ?? "",
    thesis_long: p.thesis_long ?? "",
    picked_at: p.picked_at,
    picked_price: p.picked_price != null ? String(p.picked_price) : "",
    video_kind: p.video_kind ?? "",
    video_path: p.video_path ?? "",
    video_url_input: isUrlKind ? p.video_path ?? "" : "",
    article_links: p.article_links,
    tags: (p.tags ?? []).join(", "),
    closed_note: p.closed_note ?? "",
  };
}

/** Object path inside community-media for a public URL (best-effort cleanup). */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${PICKS_MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const raw = url.slice(i + marker.length).split("?")[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function AdminPicksPage() {
  const supabase = createClient();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fic_picks")
      .select(PICK_SELECT)
      .order("updated_at", { ascending: false });
    const rows: Pick[] = (data ?? []).map((r) => ({
      ...(r as Pick),
      article_links: normArticleLinks((r as { article_links: unknown }).article_links),
      tags: (r as { tags: string[] | null }).tags ?? [],
    }));
    setPicks(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(p: Pick) {
    if (!window.confirm(`Delete the ${p.ticker} pick for everyone? This cannot be undone.`))
      return;
    // Remove uploaded video object first so storage doesn't orphan.
    if (p.video_kind === "upload" && p.video_path) {
      const { error: rmErr } = await supabase.storage
        .from(PICKS_MEDIA_BUCKET)
        .remove([p.video_path]);
      if (rmErr) console.warn("pick video cleanup failed:", rmErr.message);
    }
    const { error } = await supabase.from("fic_picks").delete().eq("id", p.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    setPicks((prev) => prev.filter((x) => x.id !== p.id));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
            <Gem className="w-6 h-6 text-amber-400" /> Team Picks
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            The FIC team&apos;s education-first pick board. Members see everything except drafts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setEditing(emptyDraft())}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-400"
          >
            <Plus className="w-3.5 h-3.5" /> New pick
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading picks…
        </div>
      ) : picks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-20 text-center">
          <Gem className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
          <h3 className="mb-2 text-lg font-semibold text-zinc-300">No picks yet</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-500">
            Create the first team pick — pick a ticker, write the thesis, add a video.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {picks.map((p) => {
            const meta = statusMeta(p.status);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/market/logo?symbol=${encodeURIComponent(p.ticker)}`}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-100">{p.company_name}</span>
                    <span className="font-mono text-xs text-zinc-500">{p.ticker}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        p.status === "active"
                          ? "bg-amber-500/15 text-amber-300"
                          : p.status === "draft"
                            ? "border border-zinc-700 text-zinc-500"
                            : p.status === "closed"
                              ? "bg-zinc-700/40 text-zinc-400"
                              : "bg-zinc-600/30 text-zinc-300"
                      }`}
                    >
                      {p.status === "draft" ? "Draft" : meta.label}
                    </span>
                    {p.video_kind && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/80">
                        <Film className="h-3 w-3" /> {p.video_kind}
                      </span>
                    )}
                    {p.article_links.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                        <Link2 className="h-3 w-3" /> {p.article_links.length}
                      </span>
                    )}
                  </div>
                  {p.headline && (
                    <p className="mt-0.5 truncate text-xs text-zinc-400">{p.headline}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    Picked {formatPickedDate(p.picked_at)}
                    {p.picked_price != null && ` at $${Number(p.picked_price).toFixed(2)}`}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(draftFromPick(p))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-amber-600 hover:text-amber-400"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-red-800 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PickEditor
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

function PickEditor({
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ticker search
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
    // Autofill picked_price with the current live price (editable).
    const q = await fetchQuote(hit.ticker);
    if (q?.price != null) {
      setD((prev) => ({ ...prev, picked_price: q.price!.toFixed(2) }));
    }
  }

  async function handleVideoFile(file: File) {
    setError(null);
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video is over the 50 MB limit. Please upload a smaller file or paste a link.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `picks/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(PICKS_MEDIA_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "video/mp4" });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    // Remove a previously-uploaded object we're replacing.
    if (d.video_kind === "upload" && d.video_path && d.video_path !== path) {
      await supabase.storage.from(PICKS_MEDIA_BUCKET).remove([d.video_path]);
    }
    setD((prev) => ({ ...prev, video_kind: "upload", video_path: path, video_url_input: "" }));
    setUploading(false);
  }

  async function clearVideo() {
    if (d.video_kind === "upload" && d.video_path) {
      await supabase.storage.from(PICKS_MEDIA_BUCKET).remove([d.video_path]);
    }
    setD((prev) => ({ ...prev, video_kind: "", video_path: "", video_url_input: "" }));
  }

  function setArticle(i: number, patch: Partial<ArticleLink>) {
    setD((prev) => {
      const next = [...prev.article_links];
      next[i] = { ...next[i], ...patch };
      return { ...prev, article_links: next };
    });
  }
  function addArticle() {
    setD((prev) => ({ ...prev, article_links: [...prev.article_links, { title: "", url: "" }] }));
  }
  function removeArticle(i: number) {
    setD((prev) => ({ ...prev, article_links: prev.article_links.filter((_, j) => j !== i) }));
  }

  async function save() {
    setError(null);
    if (!d.ticker.trim() || !d.company_name.trim()) {
      setError("A ticker and company name are required.");
      return;
    }
    setSaving(true);

    // Resolve URL-paste video kind on save.
    let video_kind: PickVideoKind | null = null;
    let video_path: string | null = null;
    if (d.video_kind === "upload" && d.video_path) {
      video_kind = "upload";
      video_path = d.video_path;
    } else if (d.video_url_input.trim()) {
      const url = d.video_url_input.trim();
      video_kind = detectVideoUrlKind(url);
      video_path = url;
    }

    const links = d.article_links
      .map((a) => ({ title: a.title.trim(), url: a.url.trim() }))
      .filter((a) => a.url);

    const tags = d.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      ticker: d.ticker.trim().toUpperCase(),
      company_name: d.company_name.trim(),
      status: d.status,
      headline: d.headline.trim() || null,
      thesis_short: d.thesis_short.trim() || null,
      thesis_long: d.thesis_long.trim() || null,
      picked_at: d.picked_at,
      picked_price: d.picked_price.trim() ? Number(d.picked_price) : null,
      video_kind,
      video_path,
      article_links: links,
      tags,
      closed_note: d.status === "closed" ? d.closed_note.trim() || null : null,
    };

    let err;
    if (d.id) {
      ({ error: err } = await supabase.from("fic_picks").update(payload).eq("id", d.id));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      ({ error: err } = await supabase
        .from("fic_picks")
        .insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (err) {
      setError(`Save failed: ${err.message}`);
      return;
    }
    onSaved();
  }

  const videoPublicUrl = useMemo(() => {
    if (d.video_kind === "upload" && d.video_path) {
      return supabase.storage.from(PICKS_MEDIA_BUCKET).getPublicUrl(d.video_path).data
        .publicUrl;
    }
    return null;
  }, [d.video_kind, d.video_path, supabase]);

  const field =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
  const label = "block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0d0d14] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {d.id ? "Edit pick" : "New pick"}
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
                    onChange={(e) => setD({ ...d, company_name: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-zinc-100 focus:outline-none"
                  />
                  <span className="font-mono text-xs text-zinc-500">{d.ticker}</span>
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
                  {searching && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
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
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                          {h.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">{h.ticker}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status + picked date + price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Status</label>
              <select
                value={d.status}
                onChange={(e) => setD({ ...d, status: e.target.value as PickStatus })}
                className={field}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "draft" ? "Draft (hidden)" : statusMeta(s).label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Picked date</label>
              <input
                type="date"
                value={d.picked_at}
                onChange={(e) => setD({ ...d, picked_at: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Picked price</label>
              <input
                type="number"
                step="0.01"
                value={d.picked_price}
                onChange={(e) => setD({ ...d, picked_price: e.target.value })}
                placeholder="auto"
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

          {/* Thesis short */}
          <div>
            <label className={label}>Thesis — the lede</label>
            <textarea
              value={d.thesis_short}
              onChange={(e) => setD({ ...d, thesis_short: e.target.value })}
              rows={2}
              placeholder="A short summary that opens the detail page."
              className={field}
            />
          </div>

          {/* Thesis long */}
          <div>
            <label className={label}>Why we study this company (full)</label>
            <textarea
              value={d.thesis_long}
              onChange={(e) => setD({ ...d, thesis_long: e.target.value })}
              rows={7}
              placeholder="The full write-up. Separate paragraphs with a blank line. Keep it educational — no advice language."
              className={field}
            />
          </div>

          {/* Video */}
          <div>
            <label className={label}>Video</label>
            {d.video_kind === "upload" && d.video_path ? (
              <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                {videoPublicUrl && (
                  <video
                    src={videoPublicUrl}
                    controls
                    preload="metadata"
                    className="mb-2 max-h-48 w-full rounded"
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                    <Upload className="h-3.5 w-3.5" /> Uploaded video
                  </span>
                  <button
                    onClick={clearVideo}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
                  <Youtube className="h-4 w-4 text-zinc-500" />
                  <input
                    value={d.video_url_input}
                    onChange={(e) => setD({ ...d, video_url_input: e.target.value })}
                    placeholder="Paste a YouTube or external video URL"
                    className="flex-1 bg-transparent py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                  {d.video_url_input.trim() && (
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {detectVideoUrlKind(d.video_url_input.trim())}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">or</span>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload a file (≤ 50 MB)
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleVideoFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Article links */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Article links
              </label>
              <button
                onClick={addArticle}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
              >
                <Plus className="h-3 w-3" /> Add link
              </button>
            </div>
            <div className="space-y-2">
              {d.article_links.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={a.title}
                    onChange={(e) => setArticle(i, { title: e.target.value })}
                    placeholder="Title"
                    className={`${field} flex-1`}
                  />
                  <input
                    value={a.url}
                    onChange={(e) => setArticle(i, { url: e.target.value })}
                    placeholder="https://…"
                    className={`${field} flex-[2]`}
                  />
                  <button
                    onClick={() => removeArticle(i)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {d.article_links.length === 0 && (
                <p className="text-xs text-zinc-600">No links yet.</p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={label}>Tags (comma-separated)</label>
            <input
              value={d.tags}
              onChange={(e) => setD({ ...d, tags: e.target.value })}
              placeholder="dividends, moat, consumer"
              className={field}
            />
          </div>

          {/* Closed note */}
          {d.status === "closed" && (
            <div>
              <label className={label}>Closing note</label>
              <textarea
                value={d.closed_note}
                onChange={(e) => setD({ ...d, closed_note: e.target.value })}
                rows={2}
                placeholder="What we learned wrapping up this pick."
                className={field}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {d.id ? "Save changes" : "Create pick"}
          </button>
        </div>
      </div>
    </div>
  );
}
