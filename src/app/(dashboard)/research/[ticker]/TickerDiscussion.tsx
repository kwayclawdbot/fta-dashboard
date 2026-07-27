"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Send, Trash2, StickyNote, Lightbulb, TriangleAlert, Newspaper, LineChart, HelpCircle } from "lucide-react";
import AgeBadge from "@/components/community/AgeBadge";
import { CONTRIBUTION_TYPES, contributionMeta, type ContributionType } from "@/lib/research/social";

/**
 * THE DISCUSSION — the persistent community thread on a ticker.
 *
 * OWNER DIRECTIVE: the comment feed was buried at the bottom of a long vertical
 * stack. It is now (a) PERSISTENT — it lives OUTSIDE the tab system, so it is
 * on screen no matter which analysis tab is open — and (b) placed ABOVE the tab
 * strip, which is the only placement that satisfies "reachable at 390px without
 * scrolling past an entire tab panel". A lower region or a right rail both fail
 * that test on a phone; a sticky dock would collide with the app's bottom nav.
 *
 * The ordering is also the honest one for a community product: identity → the
 * market → what the club thinks → WHAT THE CLUB IS SAYING → the analysis. The
 * discussion outranks the analyst tabs because that is what this product is.
 *
 * BOUNDED so it can hold that position: composer first (participation is the
 * point), then the most recent notes, then "See all N" expands in place. An
 * unbounded thread here would push the tabs off the first screen, which would
 * trade one burial for another.
 *
 * NOT A CARD: a section rule, display type, and a hairline ledger of notes. The
 * author strip carries the hierarchy; no note sits in a bubble.
 *
 * Behaviour, gates and copy are lifted VERBATIM from the previous inline
 * implementation — same RLS-backed insert/delete, same free-tier read-only
 * wall, same profanity check surface, same typed contributions.
 */

const CONTRIB_ICON: Record<string, React.ElementType> = {
  StickyNote,
  Lightbulb,
  TriangleAlert,
  Newspaper,
  LineChart,
  HelpCircle,
};

/** How many notes show before the thread asks to be expanded. */
const PREVIEW = 3;

export interface DiscussionComment {
  id: string;
  ticker: string;
  user_id: string | null;
  body: string;
  contribution_type: string;
  created_at: string;
  author: {
    display_name: string | null;
    avatar_url: string | null;
    age_group: string | null;
    username?: string | null;
  } | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function Avatar({ name, url, size = 30 }: { name?: string | null; url?: string | null; size?: number }) {
  const dim = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name || "Member"} style={dim} className="shrink-0 rounded-full object-cover" />;
  }
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-bold text-paper"
    >
      {initials}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  chip,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  chip?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? chip || "bg-gold-500 text-night-950" : "border border-sand text-soft hover:bg-paper"
      }`}
    >
      {label}
    </button>
  );
}

export default function TickerDiscussion({
  ticker,
  companyName,
  comments,
  commentsResolved = true,
  userId,
  role,
  canPost,
  draft,
  draftType,
  posting,
  err,
  onDraft,
  onDraftType,
  onPost,
  onRemove,
}: {
  ticker: string;
  companyName: string;
  comments: DiscussionComment[];
  /** LOADING IS NOT EMPTY. False while the parent's comment read is still in
   *  flight, so "No research notes yet" can't flash before the thread lands.
   *  Defaults true so any other caller keeps its current behaviour. */
  commentsResolved?: boolean;
  userId: string;
  role: string;
  /** free tier reads only — same wall as before */
  canPost: boolean;
  draft: string;
  draftType: ContributionType;
  posting: boolean;
  err: string;
  onDraft: (v: string) => void;
  onDraftType: (t: ContributionType) => void;
  onPost: () => void;
  onRemove: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = filter === "all" ? comments : comments.filter((c) => c.contribution_type === filter);
  const presentTypes = useMemo(() => {
    const set = new Set(comments.map((c) => c.contribution_type));
    return CONTRIBUTION_TYPES.filter((t) => set.has(t.key));
  }, [comments]);

  // Newest first here: a persistent thread is a "what's being said now" surface.
  const ordered = useMemo(() => [...filtered].reverse(), [filtered]);
  const shown = expanded ? ordered : ordered.slice(0, PREVIEW);
  const hidden = ordered.length - shown.length;

  return (
    <section id="research-notes" className="scroll-mt-20">
      <h2 className="f0-section-rule">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">The discussion</span>
      </h2>

      <p className="mt-3.5 font-display text-display-3 font-extrabold text-ink">
        {comments.length > 0 ? (
          <>
            <span className="font-mono tabular-nums">{comments.length}</span>{" "}
            {comments.length === 1 ? "note" : "notes"} on ${ticker}
          </>
        ) : (
          <>Nobody has written up ${ticker} yet</>
        )}
      </p>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-soft">
        Study {companyName} together — what it makes, how it earns, what could go right or wrong. Tag
        your note so the club can find theses, risks, and questions at a glance.
      </p>

      {/* ── COMPOSER FIRST — participation is the point of this region ────── */}
      {!canPost ? (
        <p className="f0-rule-top mt-4 pt-4 text-[13px] text-soft">
          Join the Club to add your own research notes.
        </p>
      ) : (
        <div className="f0-rule-top mt-4 pt-4">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {CONTRIBUTION_TYPES.map((t) => {
              const Icon = CONTRIB_ICON[t.icon] ?? StickyNote;
              return (
                <button
                  key={t.key}
                  onClick={() => onDraftType(t.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
                    draftType === t.key ? t.chip : "border border-sand text-soft hover:bg-paper"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            rows={2}
            placeholder={`Add a ${contributionMeta(draftType).label.toLowerCase()} about ${companyName}…`}
            className="w-full resize-none border-b border-sand bg-transparent py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-gold-500"
          />
          {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
          <div className="mt-2.5 flex justify-end">
            <button
              onClick={onPost}
              disabled={posting || !draft.trim()}
              className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {posting ? "Posting…" : "Post note"}
            </button>
          </div>
        </div>
      )}

      {/* type filter chips */}
      {presentTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {presentTypes.map((t) => (
            <FilterChip
              key={t.key}
              label={t.label}
              active={filter === t.key}
              onClick={() => setFilter(t.key)}
              chip={t.chip}
            />
          ))}
        </div>
      )}

      {/* ── THE THREAD — a hairline ledger, no bubbles ────────────────────── */}
      {shown.length > 0 ? (
        <div className="f0-ledger mt-3">
          {shown.map((c) => {
            const meta = contributionMeta(c.contribution_type);
            const Icon = CONTRIB_ICON[meta.icon] ?? StickyNote;
            return (
              <div key={c.id} className="f0-ledger-row">
                {/* .f0-ledger-row sets align-items:center and globals.css has no
                    @layer, so a Tailwind `items-start` on the row would lose to
                    it — the child aligns itself instead. */}
                <span className="self-start pt-0.5">
                  <Avatar name={c.author?.display_name} url={c.author?.avatar_url} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.author?.username ? (
                      <Link
                        href={`/u/${c.author.username}`}
                        className="text-[13px] font-semibold text-ink hover:text-gold-700"
                      >
                        {c.author?.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold text-ink">
                        {c.author?.display_name || "Member"}
                      </span>
                    )}
                    <AgeBadge ageGroup={c.author?.age_group} />
                    {c.contribution_type !== "note" && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.chip}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
                      {timeAgo(c.created_at)}
                    </span>
                    {(c.user_id === userId || role === "admin") && (
                      <button
                        onClick={() => onRemove(c.id)}
                        className="ml-auto text-soft transition-colors hover:text-red-600"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-midnight-200">
                    {c.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : !commentsResolved && comments.length === 0 ? (
        /* Still arriving — a measure-shaped shimmer, never the founding line. */
        <div className="f0-rule-top mt-4 pt-4" aria-busy="true">
          <div className="h-3.5 w-64 max-w-full rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <span className="sr-only">Loading research notes</span>
        </div>
      ) : (
        <p className="f0-rule-top mt-4 pt-4 text-[13px] text-soft">
          {comments.length === 0
            ? "No research notes yet — be the first to share what you found."
            : "No notes of this type yet."}
        </p>
      )}

      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="f0-rule-top mt-0 w-full pt-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700 transition-colors hover:text-ink"
        >
          {expanded ? "Show fewer notes" : `See all ${ordered.length} notes`}
        </button>
      )}
    </section>
  );
}
