"use client";

import { useCallback, useEffect, useState } from "react";
import { Gem, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import PickCard from "@/components/picks/PickCard";
import {
  normArticleLinks,
  PICKS_DISCLAIMER,
  PICKS_EDUCATION_LINE,
  type Pick,
  type PickStatus,
} from "@/lib/picks";

const PICK_SELECT =
  "id, ticker, company_name, status, headline, thesis_short, thesis_long, picked_at, picked_price, video_path, video_kind, article_links, tags, created_by, closed_note, created_at, updated_at";

type StatusFilter = "all" | Exclude<PickStatus, "draft">;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "watching", label: "Watching" },
  { id: "closed", label: "Closed" },
];

export default function PicksPage() {
  const supabase = createClient();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [likeCount, setLikeCount] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [commentCount, setCommentCount] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("fic_picks")
      .select(PICK_SELECT)
      .neq("status", "draft")
      .order("picked_at", { ascending: false })
      .order("created_at", { ascending: false });

    const rows: Pick[] = (data ?? []).map((r) => ({
      ...(r as Pick),
      article_links: normArticleLinks((r as { article_links: unknown }).article_links),
      tags: (r as { tags: string[] | null }).tags ?? [],
    }));
    setPicks(rows);
    setLoading(false);

    // Live quotes (batched) for every ticker on the board.
    const tickers = Array.from(new Set(rows.map((p) => p.ticker)));
    if (tickers.length) {
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));
    }

    // Like + comment counts.
    const ids = rows.map((p) => p.id);
    if (ids.length) {
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("pick_likes").select("pick_id, user_id").in("pick_id", ids),
        supabase.from("pick_comments").select("pick_id").in("pick_id", ids),
      ]);
      const lc: Record<string, number> = {};
      const mine = new Set<string>();
      for (const l of likes ?? []) {
        const pid = l.pick_id as string;
        lc[pid] = (lc[pid] || 0) + 1;
        if (user && l.user_id === user.id) mine.add(pid);
      }
      const cc: Record<string, number> = {};
      for (const c of comments ?? []) {
        const pid = c.pick_id as string;
        cc[pid] = (cc[pid] || 0) + 1;
      }
      setLikeCount(lc);
      setLikedByMe(mine);
      setCommentCount(cc);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = filter === "all" ? picks : picks.filter((p) => p.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* Hero */}
      <header className="pt-6 sm:pt-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
            <Gem className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Team Picks
            </h1>
            <p className="text-xs text-soft">The companies the FIC team is studying</p>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-300/40 bg-chip-amber/40 px-3.5 py-2.5 font-body text-[13px] leading-snug text-midnight-100">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          {PICKS_EDUCATION_LINE}
        </p>
      </header>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-gold-500 text-white"
                : "bg-paper text-soft ring-1 ring-sand hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-soft">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-gold-500" />
          Loading picks…
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-sand bg-paper/60 py-20 text-center">
          <Gem className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
          <h3 className="font-display text-lg font-bold text-ink">No picks yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
            The team hasn&apos;t shared a study pick in this view yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((pick) => (
            <PickCard
              key={pick.id}
              pick={pick}
              quote={quotes[pick.ticker]}
              likeCount={likeCount[pick.id] || 0}
              commentCount={commentCount[pick.id] || 0}
              liked={likedByMe.has(pick.id)}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <footer className="mt-12 border-t border-sand pt-5">
        <p className="text-[11px] leading-relaxed text-soft">{PICKS_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
