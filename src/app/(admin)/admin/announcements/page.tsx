"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Send,
  Loader2,
  Users,
  BellRing,
  CheckCircle2,
  Radio,
  Link2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Audience tokens understood by notif_audience_ids (migration 090).
const ANNOUNCE_AUDIENCES = [
  { key: "all", label: "Everyone", hint: "All members" },
  { key: "fic", label: "Club members", hint: "FIC + FTA (paying)" },
  { key: "fta", label: "FTA only", hint: "Academy families" },
  { key: "free", label: "Free members", hint: "Funnel signups" },
] as const;

// The push composer also allows role targeting.
const PUSH_AUDIENCES = [
  ...ANNOUNCE_AUDIENCES,
  { key: "role:parent", label: "Parents", hint: "role = parent" },
  { key: "role:child", label: "Kids", hint: "role = child" },
] as const;

// Deep-link presets for the push composer path picker.
const LINK_PRESETS = [
  { label: "Community feed", path: "/community" },
  { label: "Team Picks", path: "/picks" },
  { label: "Courses", path: "/courses" },
  { label: "Live sessions", path: "/live-sessions" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Missions", path: "/missions" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Custom…", path: "__custom__" },
];

type Tab = "announce" | "push";

interface AudienceCount {
  recipients: number | null;
  push_subs: number | null;
}

interface AnnouncementRow {
  id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  audience: string | null;
  author_name: string | null;
  created_at: string;
  delivered: number;
  read_count: number;
  dispatched: number;
}

interface BroadcastRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  audience: string;
  recipients: number;
  author_name: string | null;
  created_at: string;
  read_count: number;
  dispatched: number;
}

function fmt(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminAnnouncementsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("announce");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2.5">
        <Megaphone className="h-5 w-5 text-amber-400" />
        <h1 className="text-lg font-bold text-zinc-100">Announcements &amp; Push</h1>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 w-fit">
        <button
          onClick={() => setTab("announce")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "announce" ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <Megaphone className="h-3.5 w-3.5" /> Announcement
        </button>
        <button
          onClick={() => setTab("push")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "push" ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <BellRing className="h-3.5 w-3.5" /> Push broadcast
        </button>
      </div>

      {tab === "announce" ? (
        <AnnouncementComposer supabase={supabase} />
      ) : (
        <PushComposer supabase={supabase} />
      )}
    </div>
  );
}

// Live recipient + push-subscription counts for an audience token.
function useAudienceCount(
  supabase: ReturnType<typeof createClient>,
  audience: string
): AudienceCount {
  const [count, setCount] = useState<AudienceCount>({ recipients: null, push_subs: null });
  useEffect(() => {
    let live = true;
    supabase.rpc("notif_audience_count", { p_audience: audience }).then(({ data }) => {
      if (live && data) setCount(data as AudienceCount);
    });
    return () => {
      live = false;
    };
  }, [supabase, audience]);
  return count;
}

// ── Announcement composer ────────────────────────────────────────────────────
function AnnouncementComposer({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>("all");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnnouncementRow[]>([]);
  const count = useAudienceCount(supabase, audience);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.rpc("admin_announcement_history", { p_limit: 50 });
    setHistory((data as AnnouncementRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function post() {
    if (!title.trim()) return setError("Give your announcement a title.");
    setSending(true);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.rpc("admin_post_announcement", {
      p_title: title.trim(),
      p_body: body.trim(),
      p_audience: audience,
      p_link: link.trim() || null,
    });
    setSending(false);
    if (err) {
      setError(err.message || "Something went wrong.");
      return;
    }
    const r = data as { recipients: number };
    setResult(`Posted — notified ${r.recipients} member${r.recipients === 1 ? "" : "s"}.`);
    setTitle("");
    setBody("");
    setLink("");
    loadHistory();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <p className="mb-4 text-xs text-zinc-500">
          Posts a gold AnnouncementCard to the community feed (pinned above the feed for 7 days)
          and pushes a notification to your chosen audience.
        </p>

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Live class moved to Thursday"
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="What do you want everyone to know?"
          className="mb-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-zinc-400">
          Optional link (deep path or URL)
        </label>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
          <Link2 className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/live-sessions or https://…"
            className="w-full bg-transparent py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Audience</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANNOUNCE_AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                audience === a.key
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-[10px] text-zinc-500">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-4 rounded-lg bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            {count.recipients ?? "…"} recipient{count.recipients === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-amber-400" />
            {count.push_subs ?? "…"} with push enabled
          </span>
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        {result && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {result}
          </p>
        )}

        <button
          onClick={post}
          disabled={sending || !title.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post announcement
        </button>
      </div>

      <HistoryList
        title="Recent announcements"
        rows={history.map((h) => ({
          id: h.id,
          title: h.title || "(untitled)",
          audience: h.audience || "all",
          created_at: h.created_at,
          delivered: h.delivered,
          read_count: h.read_count,
        }))}
      />
    </div>
  );
}

// ── Push broadcast composer ──────────────────────────────────────────────────
function PushComposer({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>("all");
  const [preset, setPreset] = useState<string>("/community");
  const [customLink, setCustomLink] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const count = useAudienceCount(supabase, audience);

  const link = preset === "__custom__" ? customLink : preset;

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.rpc("admin_broadcast_history", { p_limit: 50 });
    setHistory((data as BroadcastRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function send(test: boolean) {
    if (!title.trim()) return setError("Give your push a title.");
    test ? setTesting(true) : setSending(true);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.rpc("admin_push_broadcast", {
      p_title: title.trim(),
      p_body: body.trim(),
      p_link: link.trim() || null,
      p_audience: audience,
      p_test: test,
    });
    test ? setTesting(false) : setSending(false);
    if (err) {
      setError(err.message || "Something went wrong.");
      return;
    }
    const r = data as { recipients: number; test?: boolean };
    setResult(
      r.test
        ? "Test push sent to you — check your device / bell."
        : `Sent — pushed to ${r.recipients} member${r.recipients === 1 ? "" : "s"}.`
    );
    if (!test) {
      setTitle("");
      setBody("");
      loadHistory();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <p className="mb-4 text-xs text-zinc-500">
          A pure push notification (no feed card). Deep-links straight to a destination. Great for
          &quot;class starting now&quot; or &quot;new pick is live&quot; nudges.
        </p>

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Live class starts in 10 minutes"
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Short message shown under the title"
          className="mb-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Deep link</label>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
          >
            {LINK_PRESETS.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
          </select>
          {preset === "__custom__" && (
            <input
              value={customLink}
              onChange={(e) => setCustomLink(e.target.value)}
              placeholder="/picks/abc123 or https://…"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
          )}
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Audience</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PUSH_AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                audience === a.key
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-[10px] text-zinc-500">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-4 rounded-lg bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            {count.recipients ?? "…"} recipient{count.recipients === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-amber-400" />
            {count.push_subs ?? "…"} with push enabled
          </span>
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        {result && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {result}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => send(true)}
            disabled={testing || sending || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-400 disabled:opacity-40"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Send test to me
          </button>
          <button
            onClick={() => send(false)}
            disabled={sending || testing || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send push
          </button>
        </div>
      </div>

      <HistoryList
        title="Recent push broadcasts"
        rows={history.map((h) => ({
          id: h.id,
          title: h.title,
          audience: h.audience,
          created_at: h.created_at,
          delivered: h.recipients,
          read_count: h.read_count,
        }))}
      />
    </div>
  );
}

function HistoryList({
  title,
  rows,
}: {
  title: string;
  rows: {
    id: string;
    title: string;
    audience: string;
    created_at: string;
    delivered: number;
    read_count: number;
  }[];
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-xs text-zinc-600">
          Nothing sent yet.
        </p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/40">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{r.title}</p>
                <p className="text-[11px] text-zinc-500">
                  {fmt(r.created_at)} · {r.audience}
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {r.delivered}
                </span>
                <span className="ml-2 text-zinc-500">{r.read_count} read</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
