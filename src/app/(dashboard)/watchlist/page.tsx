"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Plus,
  Lock,
  Search,
  X,
  LineChart,
  MessageCircle,
  Send,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  FlaskConical,
  Check,
  Sparkles,
  Share2,
  Users2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import UpsellCard from "@/components/dashboard/UpsellCard";
import WatchlistDowngradeScreen from "@/components/entitlements/WatchlistDowngradeScreen";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { awardXp, hasXpForRef, getUserXp } from "@/lib/xp";
import Sparkline from "@/components/fic/Sparkline";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import KaiWatch from "@/components/kai/KaiWatch";
import WatchlistPerformance from "@/components/fic/WatchlistPerformance";
import SentimentDots from "@/components/fic/SentimentDots";
import LivePrice from "@/components/fic/LivePrice";
import ResearchLadder from "@/components/fic/ResearchLadder";
import TrendGlyph from "@/components/fic/glyphs/TrendGlyph";
import { EmptyWatchlist } from "@/components/fic/EmptyState";
import Celebrate, {
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { beltCelebrateFields } from "@/lib/belts";
import {
  fetchQuote,
  fetchQuotes,
  searchTickers as searchPolygonTickers,
  type MarketQuote,
  type TickerHit,
} from "@/lib/market/client";
import {
  STATUS_ORDER,
  STATUS_META,
  TREND_OPTIONS,
  RESEARCH_FIELDS,
  researchComplete,
  researchFilledCount,
  WATCHLIST_XP,
  type WatchStatus,
  type WatchlistItem,
  type WatchlistNote,
} from "@/lib/watchlist";

interface Member {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
}

function initialsOf(name: string | null) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({
  member,
  size = 24,
}: {
  member?: Member | null;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (member?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt={member.display_name || "Member"}
        style={dim}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-chip-amber text-[10px] font-bold text-gold-700"
    >
      {initialsOf(member?.display_name ?? null)}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export default function WatchlistPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [shareItem, setShareItem] = useState<WatchlistItem | null>(null);
  const [shareNote, setShareNote] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState("parent");
  const [isKid, setIsKid] = useState(false);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [tierResolved, setTierResolved] = useState(false);
  // watchlist item id -> already promoted to the community board.
  const [promoted, setPromoted] = useState<Record<string, boolean>>({});
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [notes, setNotes] = useState<Record<string, WatchlistNote[]>>({});
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  // R4 — community sentiment + discussion enrichments, keyed by ticker.
  const [likeCounts, setLikeCounts] = useState<
    Record<string, { net: number; votes: number }>
  >({});
  const [discussCounts, setDiscussCounts] = useState<Record<string, number>>({});
  // R4 — per-row "Watch with Kai" prefilled modal.
  const [kaiTicker, setKaiTicker] = useState<string | null>(null);
  const [register, setRegister] = useState<Register>("parent");
  const [xp, setXp] = useState(0);
  const [queue, setQueue] = useState<CelebrateOptions[]>([]);
  const [unlockedId, setUnlockedId] = useState<string | null>(null);
  const enqueue = useCallback(
    (o: CelebrateOptions) => setQueue((q) => [...q, o]),
    []
  );

  // add-flow ticker lookup (Polygon reference search)
  const [tickerQuery, setTickerQuery] = useState("");
  const [tickerHits, setTickerHits] = useState<TickerHit[]>([]);
  const [searching, setSearching] = useState(false);

  // filters
  const [fTrend, setFTrend] = useState<string | null>(null);
  const [fMember, setFMember] = useState<string | null>(null);

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTicker, setAddTicker] = useState("");
  const [addSell, setAddSell] = useState("");
  const [addWhy, setAddWhy] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // research modal
  const [researchId, setResearchId] = useState<string | null>(null);
  const [rForm, setRForm] = useState<Partial<WatchlistItem>>({});
  const [rBusy, setRBusy] = useState(false);

  // notes + inline
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }
    setUserId(user.id);

    // Lifetime XP is display-only chrome — fetch it off the critical path.
    getUserXp(supabase, user.id).then(setXp);

    // One aggregate round trip: profile + family roster + watchlist items +
    // notes (was profile -> [members, items] -> notes, three sequential hops).
    // Timeout-capped so a slow board RPC degrades to an empty board instead of
    // spinning forever (audit: watchlist stuck >18s on mobile).
    const { data: boardRaw } = await withTimeout(
      supabase.rpc("get_watchlist_board"),
      LOAD_TIMEOUT_MS,
      { data: null } as { data: unknown }
    );
    const board = (boardRaw || {}) as {
      family_id?: string | null;
      role?: string;
      age_group?: string;
      members?: Member[];
      items?: WatchlistItem[];
      notes?: WatchlistNote[];
    };

    setFamilyId(board.family_id ?? null);
    // Members-only gate: resolve the family's tier (free -> UpsellCard).
    getClubTier(supabase, board.family_id ?? null).then((t) => {
      setTier(t);
      setTierResolved(true);
    });
    setRole(board.role ?? "parent");
    const kid = board.age_group === "kids" || board.role === "child";
    setIsKid(kid);
    setRegister(kid ? "kid" : board.age_group === "teens" ? "teen" : "parent");

    const memMap: Record<string, Member> = {};
    for (const m of board.members || []) memMap[m.id] = m;
    setMembers(memMap);

    const list = board.items || [];
    setItems(list);

    // Which of these items are already on the community board.
    if (list.length) {
      supabase
        .from("community_watchlist")
        .select("source_watchlist_id")
        .in(
          "source_watchlist_id",
          list.map((i) => i.id)
        )
        .then(({ data }) => {
          const map: Record<string, boolean> = {};
          for (const r of (data || []) as { source_watchlist_id: string | null }[]) {
            if (r.source_watchlist_id) map[r.source_watchlist_id] = true;
          }
          setPromoted(map);
        });
    }

    const grouped: Record<string, WatchlistNote[]> = {};
    for (const n of board.notes || []) {
      (grouped[n.watchlist_id] ||= []).push(n);
    }
    setNotes(grouped);

    setLoading(false);

    // Batch live quotes for the whole board in ONE Polygon call (via our cached
    // proxy). Fails soft to no-price so cards degrade to static content.
    const tickers = Array.from(new Set(list.map((i) => i.ticker).filter(Boolean)));
    if (tickers.length > 0) {
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));

      // R4 — community sentiment + discussion counts (adult board only; the kid
      // board keeps its pure research flow, no bull/bear framing).
      if (!kid) {
        supabase
          .from("ticker_like_counts")
          .select("ticker, net, likes, unlikes")
          .in("ticker", tickers)
          .then(({ data }) => {
            const m: Record<string, { net: number; votes: number }> = {};
            for (const r of (data || []) as {
              ticker: string;
              net: number | null;
              likes: number | null;
              unlikes: number | null;
            }[]) {
              m[r.ticker] = {
                net: r.net ?? 0,
                votes: (r.likes ?? 0) + (r.unlikes ?? 0),
              };
            }
            setLikeCounts(m);
          });
        supabase
          .from("community_ticker_comments")
          .select("ticker")
          .in("ticker", tickers)
          .then(({ data }) => {
            const m: Record<string, number> = {};
            for (const r of (data || []) as { ticker: string }[]) {
              m[r.ticker] = (m[r.ticker] || 0) + 1;
            }
            setDiscussCounts(m);
          });
      }
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced Polygon ticker lookup for the add-flow (validate > free-text).
  useEffect(() => {
    const q = tickerQuery.trim();
    if (q.length < 2) {
      setTickerHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const hits = await searchPolygonTickers(q, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setTickerHits(hits);
        setSearching(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [tickerQuery]);

  function pickTicker(hit: TickerHit) {
    setAddName(hit.name);
    setAddTicker(hit.ticker);
    setTickerQuery("");
    setTickerHits([]);
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async function submitShare() {
    if (!shareItem || !userId || shareBusy) return;
    setShareBusy(true);
    const champ = shareItem.champion_id ? members[shareItem.champion_id] : null;
    const { error } = await supabase.from("feed_posts").insert({
      author_id: userId,
      family_id: familyId,
      kind: "post",
      body: shareNote.trim(),
      activity_payload: {
        type: "watchlist_share",
        ticker: shareItem.ticker,
        company_name: shareItem.company_name,
        status: shareItem.status,
        why_we_picked: shareItem.why_we_picked || null,
        bull_case: shareItem.bull_case || null,
        bear_case: shareItem.bear_case || null,
        champion_name: champ?.display_name || null,
        family_name: null,
      },
    });
    setShareBusy(false);
    if (!error) setShareDone(true);
  }

  function openAdd() {
    setAddName("");
    setAddTicker("");
    setAddSell("");
    setAddWhy("");
    setTickerQuery("");
    setTickerHits([]);
    setAddOpen(true);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addBusy || !familyId) return;
    const name = addName.trim();
    const ticker = addTicker.trim().toUpperCase();
    if (!name || !ticker) return;
    setAddBusy(true);
    // Snapshot the price at the moment it lands on the watchlist (the cron
    // backfills any NULL from the first daily close).
    const snapQuote = await fetchQuote(ticker);
    const { data, error } = await supabase
      .from("family_watchlist")
      .insert({
        family_id: familyId,
        company_name: name,
        ticker,
        status: "watch",
        champion_id: userId,
        what_they_sell: addSell.trim() || null,
        why_we_picked: addWhy.trim() || null,
        snapshot_price: snapQuote?.price ?? null,
        snapshot_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (!error && data) {
      const item = data as WatchlistItem;
      const already = await hasXpForRef(
        supabase,
        userId,
        "bonus",
        `watchlist:${item.id}`
      );
      if (!already) {
        await awardXp(
          supabase,
          userId,
          "bonus",
          WATCHLIST_XP.ADD,
          `watchlist:${item.id}`
        );
      }
      setItems((prev) => [item, ...prev]);
      setAddOpen(false);
    }
    setAddBusy(false);
  }

  // ── Status ladder ──────────────────────────────────────────────────────────
  async function patchItem(id: string, patch: Partial<WatchlistItem>) {
    const { data, error } = await supabase
      .from("family_watchlist")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (!error && data) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? (data as WatchlistItem) : it))
      );
      return data as WatchlistItem;
    }
    return null;
  }

  async function startStudy(item: WatchlistItem) {
    if (item.status === "watch") await patchItem(item.id, { status: "study" });
    openResearch({ ...item, status: "study" });
  }

  function openResearch(item: WatchlistItem) {
    setResearchId(item.id);
    setRForm({
      how_they_make_money: item.how_they_make_money || "",
      strength: item.strength || "",
      risk: item.risk || "",
      trend: item.trend || "",
      bull_case: item.bull_case || "",
      bear_case: item.bear_case || "",
    });
  }

  async function saveResearch() {
    if (!researchId || rBusy) return;
    setRBusy(true);
    const before = items.find((i) => i.id === researchId);
    const wasComplete = before ? researchComplete(before) : false;
    const patch: Partial<WatchlistItem> = {
      how_they_make_money: (rForm.how_they_make_money || "").trim() || null,
      strength: (rForm.strength || "").trim() || null,
      risk: (rForm.risk || "").trim() || null,
      trend: (rForm.trend || "").trim() || null,
      bull_case: (rForm.bull_case || "").trim() || null,
      bear_case: (rForm.bear_case || "").trim() || null,
    };
    const updated = await patchItem(researchId, patch);
    if (updated && !wasComplete && researchComplete(updated)) {
      const already = await hasXpForRef(
        supabase,
        userId,
        "bonus",
        `research:${updated.id}`
      );
      let newXp = xp;
      if (!already) {
        await awardXp(
          supabase,
          userId,
          "bonus",
          WATCHLIST_XP.RESEARCH,
          `research:${updated.id}`
        );
        newXp = xp + WATCHLIST_XP.RESEARCH;
        setXp(newXp);
      }
      // The unlock is a MOMENT — the reward for doing the homework.
      setUnlockedId(updated.id);
      setTimeout(() => setUnlockedId((v) => (v === updated.id ? null : v)), 1600);
      enqueue({
        variant: "verdict",
        register,
        title: isKid ? "Research done!" : "Research complete",
        subtitle: `${updated.company_name} — Favorite or Avoid is unlocked.`,
        xp: already ? undefined : WATCHLIST_XP.RESEARCH,
      });
      const belt = beltCelebrateFields(xp, newXp, isKid);
      if (belt) {
        enqueue({
          variant: "levelup",
          register,
          ...belt,
        });
      }
    }
    setRBusy(false);
    setResearchId(null);
  }

  async function setVerdict(item: WatchlistItem, verdict: WatchStatus) {
    if (!researchComplete(item)) return; // UI guard (DB also enforces)
    await patchItem(item.id, { status: verdict });
  }

  async function deleteItem(item: WatchlistItem) {
    const canDelete = item.champion_id === userId || role === "parent" || role === "admin";
    if (!canDelete) return;
    if (!confirm(`Remove ${item.company_name} from the watchlist?`)) return;
    const { error } = await supabase
      .from("family_watchlist")
      .delete()
      .eq("id", item.id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  // ── Promote to the community watchlist ──────────────────────────────────────
  async function promoteToCommunity(item: WatchlistItem) {
    if (promotingId || promoted[item.id]) return;
    setPromotingId(item.id);
    const price = quotes[item.ticker]?.price ?? null;
    const { error } = await supabase.rpc("promote_to_community", {
      p_watchlist_id: item.id,
      p_snapshot_price: price,
    });
    setPromotingId(null);
    if (!error) {
      setPromoted((p) => ({ ...p, [item.id]: true }));
      enqueue({
        variant: "verdict",
        register,
        title: isKid ? "On the club board!" : "Added to the community",
        subtitle: `${item.company_name} is now on the Community Watchlist — the whole club can research it with you.`,
      });
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  async function addNote(item: WatchlistItem) {
    const text = (noteDraft[item.id] || "").trim();
    if (!text) return;
    const { data, error } = await supabase
      .from("watchlist_notes")
      .insert({ watchlist_id: item.id, author_id: userId, note: text })
      .select("*")
      .single();
    if (!error && data) {
      setNotes((prev) => ({
        ...prev,
        [item.id]: [...(prev[item.id] || []), data as WatchlistNote],
      }));
      setNoteDraft((prev) => ({ ...prev, [item.id]: "" }));
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const trendsPresent = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.trend).filter((t): t is string => !!t))
      ),
    [items]
  );
  const championIds = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.champion_id).filter((c): c is string => !!c))
      ),
    [items]
  );

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (fTrend && i.trend !== fTrend) return false;
        if (fMember && i.champion_id !== fMember) return false;
        return true;
      }),
    [items, fTrend, fMember]
  );

  const researchItem = researchId
    ? items.find((i) => i.id === researchId) || null
    : null;
  const rComplete = researchComplete({ ...researchItem, ...rForm });
  const rFilled = researchFilledCount({ ...researchItem, ...rForm });

  if (tierResolved && tier === "free") {
    // PRESERVE-DON'T-DELETE (MONETIZATION-GATES.md): a free/lapsed member who
    // already has saved tickers (e.g. a challenge-pass holder past expiry) keeps
    // every one — monitoring is paused above the free active cap, never deleted.
    // The downgrade screen is the Sept 6–8 conversion moment. A free member with
    // nothing saved yet still sees the join-the-Club upsell.
    if (items.length > 0) {
      return (
        <WatchlistDowngradeScreen
          items={items.map((i) => ({
            id: i.id,
            ticker: i.ticker,
            company_name: i.company_name,
            created_at: i.created_at,
          }))}
        />
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UpsellCard context="watchlist" />
      </div>
    );
  }
  if (loading || !tierResolved) {
    return <DashboardSkeleton variant="board" title="Watchlist" />;
  }

  // Solo member = a family of one (no other members on the board). They get a
  // plain "Watchlist" H1 + solo copy instead of the family-framed heading.
  const isSolo = Object.keys(members).length <= 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Celebrate opts={queue[0] ?? null} onDone={() => setQueue((q) => q.slice(1))} />

      {/* Header */}
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {isSolo ? "My Signals" : "Family Watchlist"}
          </h1>
          <p className="mt-1 text-sm text-soft">
            {isSolo
              ? "Your research board. Add companies you know, study them, then decide with conviction."
              : isKid
              ? "Your family's research board. Add companies you know, study them, then decide together."
              : "The family research board — anyone adds, everyone studies, verdicts come only after the homework."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/watchlist/community"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-4 py-2.5 text-sm font-semibold text-soft hover:bg-paper"
          >
            <Users2 className="h-4 w-4" />
            Community board
          </Link>
          <button
            onClick={() => openAdd()}
            className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add a company
          </button>
        </div>
      </m.div>

      {/* R4 — Watchlist Performance + Kai Watch (adult board only; kids keep the
          pure research flow with no alerts/Kai surface). */}
      {!isKid && items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <WatchlistPerformance
            tickers={items.map((i) => i.ticker)}
            familyId={familyId}
          />
          <KaiWatch userId={userId} surface="watchlist" />
        </div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sand bg-midnight-900 p-3 shadow-soft">
          <span className="text-xs font-semibold text-soft">Filter:</span>
          {/* trend */}
          {trendsPresent.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trendsPresent.map((t) => (
                <button
                  key={t}
                  onClick={() => setFTrend(fTrend === t ? null : t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    fTrend === t
                      ? "bg-chip-amber text-gold-700"
                      : "bg-paper text-soft hover:bg-sand"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {/* member */}
          {championIds.length > 0 && (
            <select
              value={fMember || ""}
              onChange={(e) => setFMember(e.target.value || null)}
              className="rounded-lg border border-sand bg-paper px-2 py-1 text-xs text-soft focus:border-gold-400 focus:outline-none"
            >
              <option value="">All champions</option>
              {championIds.map((id) => (
                <option key={id} value={id}>
                  {members[id]?.display_name || "Member"}
                </option>
              ))}
            </select>
          )}
          {(fTrend || fMember) && (
            <button
              onClick={() => {
                setFTrend(null);
                setFMember(null);
              }}
              className="text-xs font-medium text-gold-700 hover:text-gold-800"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="space-y-4">
          <EmptyWatchlist onAdd={() => openAdd()} />
          {/* R4/R5 debt — Kai Watch stays available with an empty board: an adult
              member can ask Kai to watch any ticker before adding one here. */}
          {!isKid && (
            <div className="mx-auto max-w-md">
              <p className="mb-2 text-center text-xs text-soft">
                Or have Kai keep an eye on something while you decide what to add.
              </p>
              <KaiWatch userId={userId} surface="watchlist" />
            </div>
          )}
        </div>
      )}

      {/* Board — columns by status */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const colItems = filtered.filter((i) => i.status === status);
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <h3 className="font-display text-sm font-bold text-ink">
                      {meta.label}
                    </h3>
                    <span className="text-xs text-midnight-500">
                      {colItems.length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {colItems.length === 0 && (
                    <p className="rounded-xl border border-dashed border-sand px-3 py-4 text-center text-xs text-midnight-500">
                      {meta.blurb}
                    </p>
                  )}
                  {colItems.map((item) => {
                    const champ = item.champion_id
                      ? members[item.champion_id]
                      : null;
                    const complete = researchComplete(item);
                    const canVerdict = complete;
                    const itemNotes = notes[item.id] || [];
                    const showNotes = !!openNotes[item.id];
                    const canDelete =
                      item.champion_id === userId ||
                      role === "parent" ||
                      role === "admin";
                    return (
                      <m.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative overflow-hidden rounded-2xl border bg-midnight-900 shadow-soft transition-colors ${
                          unlockedId === item.id
                            ? "border-gold-400"
                            : "border-sand"
                        }`}
                      >
                        {unlockedId === item.id && (
                          <m.span
                            className="pointer-events-none absolute inset-0 z-10"
                            style={{
                              background:
                                "linear-gradient(120deg, transparent 35%, rgba(251,191,36,0.35) 50%, transparent 65%)",
                            }}
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1.1, ease: "easeInOut" }}
                          />
                        )}
                        <div className="p-4">
                          {/* Top row: real logo + name + live price */}
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/research/${encodeURIComponent(item.ticker)}`}
                              className="group flex min-w-0 items-center gap-2.5"
                            >
                              <CompanyLogo
                                symbol={item.ticker}
                                name={item.company_name}
                                size={38}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="truncate font-display text-base font-bold text-ink group-hover:text-gold-700">
                                    {item.company_name}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-midnight-500 group-hover:text-gold-700">
                                    {item.ticker}
                                  </span>
                                  <LivePrice quote={quotes[item.ticker]} />
                                </div>
                              </div>
                            </Link>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                          </div>

                          {/* research ladder — glanceable progression */}
                          <div className="mt-3">
                            <ResearchLadder
                              status={item.status}
                              filled={researchFilledCount(item)}
                              total={RESEARCH_FIELDS.length}
                              researchDone={complete}
                            />
                          </div>

                          {/* trend glyph + champion */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            {item.trend ? (
                              <TrendGlyph trend={item.trend} kid={isKid} />
                            ) : (
                              <span className="text-[11px] text-midnight-500">
                                No trend yet
                              </span>
                            )}
                            {champ && (
                              <div className="flex items-center gap-1.5">
                                <Avatar member={champ} size={20} />
                                <span className="text-[11px] text-soft">
                                  {champ.display_name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* thesis */}
                          {item.why_we_picked && (
                            <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-midnight-200">
                              “{item.why_we_picked}”
                            </p>
                          )}

                          {/* local price sparkline (Polygon daily closes, lazy) */}
                          <div className="mt-3">
                            <Sparkline symbol={item.ticker} height={56} />
                          </div>

                          {/* R4 — community sentiment + discussion (adult board) */}
                          {!isKid && (
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <SentimentDots
                                net={likeCounts[item.ticker]?.net ?? 0}
                                votes={likeCounts[item.ticker]?.votes ?? 0}
                              />
                              {discussCounts[item.ticker] ? (
                                <Link
                                  href={`/research/${encodeURIComponent(item.ticker)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-soft hover:text-ink"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                  {discussCounts[item.ticker]} discussing
                                </Link>
                              ) : null}
                            </div>
                          )}

                          {/* research summary chips when studying/verdict */}
                          {item.status !== "watch" && (
                            <div className="mt-3 space-y-1.5 text-[12px]">
                              {item.how_they_make_money && (
                                <p className="text-midnight-300">
                                  <span className="font-semibold text-ink">
                                    Makes money:
                                  </span>{" "}
                                  {item.how_they_make_money}
                                </p>
                              )}
                              {item.strength && (
                                <p className="text-green-600">
                                  <ThumbsUp className="mr-1 inline h-3 w-3" />
                                  {item.strength}
                                </p>
                              )}
                              {item.risk && (
                                <p className="text-red-600">
                                  <ThumbsDown className="mr-1 inline h-3 w-3" />
                                  {item.risk}
                                </p>
                              )}
                            </div>
                          )}

                          {/* action buttons per status */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.status === "watch" && (
                              <button
                                onClick={() => startStudy(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-chip-amber px-2.5 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-100"
                              >
                                <FlaskConical className="h-3.5 w-3.5" />
                                Start studying
                              </button>
                            )}
                            {(item.status === "study" ||
                              item.status === "favorite" ||
                              item.status === "avoid") && (
                              <button
                                onClick={() => openResearch(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
                              >
                                <FlaskConical className="h-3.5 w-3.5" />
                                {complete ? "Research card" : "Finish research"}
                              </button>
                            )}

                            {item.status === "study" && (
                              <>
                                <button
                                  onClick={() => setVerdict(item, "favorite")}
                                  disabled={!canVerdict}
                                  title={
                                    canVerdict
                                      ? "Mark favorite"
                                      : "Finish the research card first"
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                    canVerdict
                                      ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                      : "cursor-not-allowed bg-paper text-midnight-500"
                                  }`}
                                >
                                  {canVerdict ? (
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <Lock className="h-3.5 w-3.5" />
                                  )}
                                  Favorite
                                </button>
                                <button
                                  onClick={() => setVerdict(item, "avoid")}
                                  disabled={!canVerdict}
                                  title={
                                    canVerdict
                                      ? "Mark avoid"
                                      : "Finish the research card first"
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                    canVerdict
                                      ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                      : "cursor-not-allowed bg-paper text-midnight-500"
                                  }`}
                                >
                                  {canVerdict ? (
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <Lock className="h-3.5 w-3.5" />
                                  )}
                                  Avoid
                                </button>
                              </>
                            )}
                            {(item.status === "favorite" ||
                              item.status === "avoid") && (
                              <button
                                onClick={() =>
                                  patchItem(item.id, { status: "study" })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
                              >
                                Rethink
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setShareItem(item);
                                setShareNote("");
                                setShareDone(false);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Post to community
                            </button>
                            {promoted[item.id] ? (
                              <Link
                                href={`/research/${encodeURIComponent(item.ticker)}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-gold-400/15 px-2.5 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-100"
                              >
                                <Users2 className="h-3.5 w-3.5" />
                                On club board
                              </Link>
                            ) : (
                              <button
                                onClick={() => promoteToCommunity(item)}
                                disabled={promotingId === item.id}
                                title="Add this company to the club's Community Watchlist"
                                className="inline-flex items-center gap-1 rounded-lg border border-gold-300 px-2.5 py-1.5 text-xs font-semibold text-gold-700 hover:bg-chip-amber disabled:opacity-60"
                              >
                                <Users2 className="h-3.5 w-3.5" />
                                {promotingId === item.id
                                  ? "Adding…"
                                  : "Add to community"}
                              </button>
                            )}
                          </div>

                          {/* footer: notes toggle, chart, delete */}
                          <div className="mt-3 flex items-center justify-between border-t border-sand pt-2.5">
                            <button
                              onClick={() =>
                                setOpenNotes((p) => ({
                                  ...p,
                                  [item.id]: !p[item.id],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-soft hover:text-ink"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Notes ({itemNotes.length})
                            </button>
                            <div className="flex items-center gap-2">
                              {!isKid && (
                                <button
                                  onClick={() => setKaiTicker(item.ticker)}
                                  title="Watch with Kai"
                                  aria-label="Watch with Kai"
                                  className="inline-flex items-center justify-center rounded-lg border border-kai-blue/40 bg-kai-blue-soft p-1.5 text-kai-blue transition hover:brightness-110"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {!isKid && (
                                <SetAlertButton
                                  ticker={item.ticker}
                                  surface="watchlist"
                                  defaultKind="price_cross"
                                  seedPrice={quotes[item.ticker]?.price ?? null}
                                  variant="icon"
                                  stopPropagation
                                />
                              )}
                              <Link
                                href={`/chart?symbol=${encodeURIComponent(item.ticker)}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:text-gold-800"
                              >
                                <LineChart className="h-3.5 w-3.5" />
                                Chart
                              </Link>
                              {canDelete && (
                                <button
                                  onClick={() => deleteItem(item)}
                                  className="text-midnight-500 hover:text-red-600"
                                  aria-label="Remove company"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* notes stream */}
                          <AnimatePresence initial={false}>
                            {showNotes && (
                              <m.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-2 space-y-2">
                                  {itemNotes.map((n) => (
                                    <div
                                      key={n.id}
                                      className="flex items-start gap-2"
                                    >
                                      <Avatar
                                        member={
                                          n.author_id
                                            ? members[n.author_id]
                                            : null
                                        }
                                        size={20}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[13px] text-midnight-200">
                                          {n.note}
                                        </p>
                                        <p className="text-[10px] text-midnight-500">
                                          {n.author_id
                                            ? members[n.author_id]
                                                ?.display_name || "Member"
                                            : "Member"}{" "}
                                          · {timeAgo(n.created_at)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                  {itemNotes.length === 0 && (
                                    <p className="text-[12px] text-midnight-500">
                                      No notes yet — start the conversation.
                                    </p>
                                  )}
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <input
                                      value={noteDraft[item.id] || ""}
                                      onChange={(e) =>
                                        setNoteDraft((p) => ({
                                          ...p,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") addNote(item);
                                      }}
                                      placeholder="Add a note..."
                                      className="flex-1 rounded-lg border border-sand bg-paper px-2.5 py-1.5 text-[13px] text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                                    />
                                    <button
                                      onClick={() => addNote(item)}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-chip-amber text-gold-700 hover:bg-gold-100"
                                      aria-label="Send note"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </m.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Watch with Kai (per-row, prefilled) ────────────────────────────── */}
      <AnimatePresence>
        {kaiTicker && !isKid && (
          <KaiWatch
            userId={userId}
            defaultTicker={kaiTicker}
            surface="watchlist"
            variant="modal"
            onClose={() => setKaiTicker(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Add modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
            onClick={() => !addBusy && setAddOpen(false)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-2xl bg-midnight-900 p-5 shadow-lift sm:rounded-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <Plus className="h-5 w-5 text-gold-500" />
                  Add a company
                </h2>
                <button
                  onClick={() => !addBusy && setAddOpen(false)}
                  className="text-midnight-500 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={submitAdd} className="space-y-3">
                {/* Ticker lookup (Polygon reference search) */}
                <div className="relative">
                  <label className="text-xs font-medium text-soft">
                    {isKid ? "Find a company" : "Search company or ticker"}
                  </label>
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-midnight-500" />
                    <input
                      value={tickerQuery}
                      onChange={(e) => setTickerQuery(e.target.value)}
                      placeholder={isKid ? "Type a name, like Nike" : "e.g. Nike or NKE"}
                      className="w-full rounded-lg border border-sand bg-midnight-900 py-2 pl-8 pr-3 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                    />
                    {searching && (
                      <div className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
                    )}
                  </div>
                  {tickerHits.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-sand bg-midnight-900 shadow-lift">
                      {tickerHits.map((hit) => (
                        <button
                          key={hit.ticker}
                          type="button"
                          onClick={() => pickTicker(hit)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-chip-amber"
                        >
                          <span className="min-w-0 truncate text-ink">{hit.name}</span>
                          <span className="shrink-0 font-mono text-xs font-semibold text-gold-700">
                            {hit.ticker}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-soft">
                      Company name
                    </label>
                    <input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder={isKid ? "Like Nike or Roblox" : "Company name"}
                      required
                      className="mt-1 w-full rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-soft">
                      Ticker
                    </label>
                    <input
                      value={addTicker}
                      onChange={(e) =>
                        setAddTicker(e.target.value.toUpperCase())
                      }
                      placeholder="NKE"
                      required
                      className="mt-1 w-full rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm uppercase text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-soft">
                    {isKid
                      ? "What does this company make or sell?"
                      : "What do they sell?"}{" "}
                    <span className="text-midnight-500">(optional)</span>
                  </label>
                  <input
                    value={addSell}
                    onChange={(e) => setAddSell(e.target.value)}
                    placeholder={
                      isKid ? "Sneakers and sports stuff" : "Product / service"
                    }
                    className="mt-1 w-full rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-soft">
                    {isKid
                      ? "Why did you pick it?"
                      : "Why is it on our radar?"}{" "}
                    <span className="text-midnight-500">(optional)</span>
                  </label>
                  <textarea
                    value={addWhy}
                    onChange={(e) => setAddWhy(e.target.value)}
                    rows={2}
                    placeholder={
                      isKid
                        ? "Everyone at school wears them!"
                        : "In your family's own words"
                    }
                    className="mt-1 w-full resize-none rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-paper p-2.5 text-xs text-soft">
                  <Sparkles className="h-4 w-4 shrink-0 text-gold-400" />
                  It starts in <b className="mx-1 text-ink">Watching</b> — study
                  it to unlock a Favorite or Avoid verdict.
                </div>
                <button
                  type="submit"
                  disabled={addBusy}
                  className="cta-button flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm disabled:opacity-60"
                >
                  {addBusy ? "Adding..." : "Add to Watching"}
                </button>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Research modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {researchItem && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
            onClick={() => !rBusy && setResearchId(null)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-midnight-900 p-5 shadow-lift sm:rounded-2xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <FlaskConical className="h-5 w-5 text-gold-500" />
                  Research: {researchItem.company_name}
                </h2>
                <button
                  onClick={() => !rBusy && setResearchId(null)}
                  className="text-midnight-500 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-xs text-soft">
                {isKid
                  ? "Do the homework! Fill these in to unlock your Favorite or Avoid."
                  : "Complete all four to unlock a verdict — no shortcuts to a decision."}
              </p>

              {/* progress */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full bg-gold-500 transition-all"
                    style={{ width: `${(rFilled / RESEARCH_FIELDS.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-soft">
                  {rFilled}/{RESEARCH_FIELDS.length}
                </span>
              </div>

              <div className="space-y-3">
                <ResearchField
                  label={
                    isKid
                      ? "How do they make money?"
                      : "How do they make money?"
                  }
                  required
                  value={rForm.how_they_make_money || ""}
                  onChange={(v) =>
                    setRForm((f) => ({ ...f, how_they_make_money: v }))
                  }
                  placeholder={
                    isKid
                      ? "People pay them for..."
                      : "Revenue model in plain words"
                  }
                />
                <ResearchField
                  label="One strength 👍"
                  required
                  value={rForm.strength || ""}
                  onChange={(v) => setRForm((f) => ({ ...f, strength: v }))}
                  placeholder={isKid ? "What are they GREAT at?" : "A real edge"}
                />
                <ResearchField
                  label="One risk 👎"
                  required
                  value={rForm.risk || ""}
                  onChange={(v) => setRForm((f) => ({ ...f, risk: v }))}
                  placeholder={
                    isKid ? "What could go wrong?" : "What could hurt them?"
                  }
                />
                <div>
                  <label className="text-xs font-medium text-soft">
                    Trend <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {TREND_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          setRForm((f) => ({ ...f, trend: t.value }))
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          rForm.trend === t.value
                            ? "border-gold-400 bg-chip-amber text-gold-700"
                            : "border-sand bg-paper text-soft hover:border-gold-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <ResearchField
                    label="Bull case (optional)"
                    value={rForm.bull_case || ""}
                    onChange={(v) => setRForm((f) => ({ ...f, bull_case: v }))}
                    placeholder="Why it could win"
                  />
                  <ResearchField
                    label="Bear case (optional)"
                    value={rForm.bear_case || ""}
                    onChange={(v) => setRForm((f) => ({ ...f, bear_case: v }))}
                    placeholder="Why it could lose"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={saveResearch}
                  disabled={rBusy}
                  className="cta-button inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {rBusy ? "Saving..." : "Save research"}
                </button>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-soft">
                {rComplete ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    Research complete — Favorite / Avoid are unlocked.
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Fill the 4 required fields to unlock a verdict.
                  </>
                )}
              </p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Post-to-community dialog */}
      <AnimatePresence>
        {shareItem && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
            onClick={() => !shareBusy && setShareItem(null)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-midnight-900 p-5 shadow-lift sm:rounded-2xl"
            >
              {shareDone ? (
                <div className="text-center py-4">
                  <Check className="mx-auto mb-2 h-8 w-8 text-green-600" />
                  <p className="font-display text-base font-bold text-ink">
                    Posted to the club
                  </p>
                  <Link
                    href="/community"
                    className="mt-3 inline-block text-sm font-semibold text-gold-700 hover:text-gold-800"
                  >
                    See it in the feed →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                      <Share2 className="h-5 w-5 text-gold-500" />
                      Post to community
                    </h2>
                    <button
                      onClick={() => !shareBusy && setShareItem(null)}
                      className="text-midnight-500 hover:text-ink"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-sand bg-paper p-3">
                    <CompanyLogo
                      symbol={shareItem.ticker}
                      name={shareItem.company_name}
                      size={32}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-ink">
                        {shareItem.company_name}
                      </p>
                      <p className="text-[11px] text-soft">
                        {shareItem.ticker} ·{" "}
                        {STATUS_META[shareItem.status]?.label || shareItem.status}
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note (optional)"
                    className="w-full resize-none rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                  />
                  <button
                    onClick={submitShare}
                    disabled={shareBusy}
                    className="cta-button mt-3 w-full rounded-lg py-2.5 text-sm disabled:opacity-60"
                  >
                    {shareBusy ? "Posting…" : "Post"}
                  </button>
                </>
              )}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResearchField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-soft">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full resize-none rounded-lg border border-sand bg-midnight-900 px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
      />
    </div>
  );
}
