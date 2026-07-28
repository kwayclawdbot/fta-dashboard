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
        <Megaphone className="h-5 w-5 text-accent" />
        <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Announcements &amp; Push</h1>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-sand bg-card p-1 w-fit">
        <button
          onClick={() => setTab("announce")}
          className={`f0-press f0-focus flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "announce" ? "bg-accent text-[color:var(--accent-on)]" : "text-soft hover:text-ink"
          }`}
        >
          <Megaphone className="h-3.5 w-3.5" /> Announcement
        </button>
        <button
          onClick={() => setTab("push")}
          className={`f0-press f0-focus flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "push" ? "bg-accent text-[color:var(--accent-on)]" : "text-soft hover:text-ink"
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
      <div className="club-b-card p-5">
        <p className="mb-4 text-xs text-soft">
          Posts a gold AnnouncementCard to the community feed (pinned above the feed for 7 days)
          and pushes a notification to your chosen audience.
        </p>

        <label className="mb-1 block text-xs font-semibold text-soft">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Live class moved to Thursday"
          className="mb-4 w-full rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/70 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-soft">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="What do you want everyone to know?"
          className="mb-4 w-full resize-none rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/70 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-soft">
          Optional link (deep path or URL)
        </label>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-sand bg-card px-3">
          <Link2 className="h-3.5 w-3.5 text-soft" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/live-sessions or https://…"
            className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-soft/70 focus:outline-none"
          />
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-soft">Audience</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANNOUNCE_AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                audience === a.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-sand bg-card text-soft hover:border-accent/50"
              }`}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-[10px] text-soft">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-4 rounded-lg border border-sand bg-card px-3 py-2 text-xs text-soft">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            {count.recipients ?? "…"} recipient{count.recipients === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-accent" />
            {count.push_subs ?? "…"} with push enabled
          </span>
        </div>

        {error && <p className="mb-3 text-xs text-accent">{error}</p>}
        {result && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-soft">
            <CheckCircle2 className="h-3.5 w-3.5" /> {result}
          </p>
        )}

        <button
          onClick={post}
          disabled={sending || !title.trim()}
          className="f0-press f0-focus flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--accent-on)] transition-colors hover:bg-accent-strong disabled:opacity-40"
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
      <div className="club-b-card p-5">
        <p className="mb-4 text-xs text-soft">
          A pure push notification (no feed card). Deep-links straight to a destination. Great for
          &quot;class starting now&quot; or &quot;new pick is live&quot; nudges.
        </p>

        <label className="mb-1 block text-xs font-semibold text-soft">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Live class starts in 10 minutes"
          className="mb-4 w-full rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/70 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-soft">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Short message shown under the title"
          className="mb-4 w-full resize-none rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/70 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-xs font-semibold text-soft">Deep link</label>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
              className="flex-1 rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/70 focus:border-accent focus:outline-none"
            />
          )}
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-soft">Audience</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PUSH_AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                audience === a.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-sand bg-card text-soft hover:border-accent/50"
              }`}
            >
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-[10px] text-soft">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-4 rounded-lg border border-sand bg-card px-3 py-2 text-xs text-soft">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            {count.recipients ?? "…"} recipient{count.recipients === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-accent" />
            {count.push_subs ?? "…"} with push enabled
          </span>
        </div>

        {error && <p className="mb-3 text-xs text-accent">{error}</p>}
        {result && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-soft">
            <CheckCircle2 className="h-3.5 w-3.5" /> {result}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => send(true)}
            disabled={testing || sending || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-sand px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/50 disabled:opacity-40"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Send test to me
          </button>
          <button
            onClick={() => send(false)}
            disabled={sending || testing || !title.trim()}
            className="f0-press f0-focus flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--accent-on)] transition-colors hover:bg-accent-strong disabled:opacity-40"
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
      <h2 className="mb-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sand py-8 text-center text-xs text-soft/70">
          Nothing sent yet.
        </p>
      ) : (
        <div className="divide-y divide-sand rounded-lg border border-sand bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{r.title}</p>
                <p className="text-[11px] text-soft">
                  {fmt(r.created_at)} · {r.audience}
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-soft">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {r.delivered}
                </span>
                <span className="ml-2 text-soft">{r.read_count} read</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
