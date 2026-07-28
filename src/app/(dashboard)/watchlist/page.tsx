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
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import UpsellCard from "@/components/dashboard/UpsellCard";
import WatchlistDowngradeScreen from "@/components/entitlements/WatchlistDowngradeScreen";
import { awardXp, hasXpForRef, getUserXp } from "@/lib/xp";
import Sparkline from "@/components/fic/Sparkline";
import CompanyLogo from "@/components/fic/CompanyLogo";
import WatchRail from "@/components/watch/WatchRail";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import {
  Card,
  Dial,
  BoardSkeleton,
  Eyebrow as BoardEyebrow,
  BoardLead,
} from "@/components/alerts/board";
import SetAlertButton from "@/components/alerts/SetAlertButton";
import KaiWatch from "@/components/kai/KaiWatch";
import WatchlistPerformance from "@/components/fic/WatchlistPerformance";
import SentimentDots from "@/components/fic/SentimentDots";
import ResearchLadder from "@/components/fic/ResearchLadder";
import TrendGlyph from "@/components/fic/glyphs/TrendGlyph";
import { EmptyWatchlist } from "@/components/fic/EmptyState";
import Celebrate, {
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { formatMove, moveToneClass } from "@/lib/format-move";
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

/**
 * WATCHLIST — my board. CANVAS BOARDS 06 + 17.
 *
 * Same objects as the club's board, because on the canvas they are the same
 * screen with a different rail cell selected: the lowercase wordmark, the
 * orange pill rail, then one CARD per company — logo tile, ticker with price
 * and move, the sub-line, a ring, a sparkline, and the footer strip. The ladder
 * (Watching → Studying → verdict) survives as the card GROUPS, so the teaching
 * mechanic is untouched.
 *
 * Neither the obsidian performance slab that used to open this screen nor the
 * hairline-ledger rows below it are on any board. The performance reading has
 * moved to the bottom, where board 17 puts it.
 *
 * COLOUR LAW on this surface:
 *   green/red = price only · lime = community sentiment only (including the
 *   ring) · orange = brand + action only · Kai blue = the Kai affordance.
 *   Price never sits on orange.
 *
 * Every behaviour of the previous board is preserved: the research gate on
 * verdicts, XP + belt celebration, community promotion, feed share, notes,
 * per-row Kai Watch + alert buttons, tier gating and the downgrade screen.
 */

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
  // Community sentiment + discussion enrichments, keyed by ticker.
  const [likeCounts, setLikeCounts] = useState<
    Record<string, { net: number; votes: number }>
  >({});
  const [discussCounts, setDiscussCounts] = useState<Record<string, number>>({});
  // Per-row "Watch with Kai" prefilled modal.
  const [kaiTicker, setKaiTicker] = useState<string | null>(null);
  const [kaiOpen, setKaiOpen] = useState(false);
  const [register, setRegister] = useState<Register>("parent");
  const [xp, setXp] = useState(0);
  const [queue, setQueue] = useState<CelebrateOptions[]>([]);
  const [unlockedId, setUnlockedId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
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
    // notes. Timeout-capped so a slow board RPC degrades to an empty board
    // instead of spinning forever.
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
          for (const r of (data || []) as {
            source_watchlist_id: string | null;
          }[]) {
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
    // proxy). Fails soft to no-price so rows degrade to static content.
    const tickers = Array.from(
      new Set(list.map((i) => i.ticker).filter(Boolean))
    );
    if (tickers.length > 0) {
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));

      // Community sentiment + discussion counts (adult board only; the kid board
      // keeps its pure research flow, no bull/bear framing).
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
      setOpenRow(updated.id);
      setTimeout(
        () => setUnlockedId((v) => (v === updated.id ? null : v)),
        1600
      );
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
    const canDelete =
      item.champion_id === userId || role === "parent" || role === "admin";
    if (!canDelete) return;
    if (!confirm(`Remove ${item.company_name} from the watchlist?`)) return;
    const { error } = await supabase
      .from("family_watchlist")
      .delete()
      .eq("id", item.id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  // ── Promote to the community watchlist ─────────────────────────────────────
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
    return <BoardSkeleton label="your watchlist" />;
  }

  // Solo member = a family of one (no other members on the board).
  const isSolo = Object.keys(members).length <= 1;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <Celebrate
        opts={queue[0] ?? null}
        onDone={() => setQueue((q) => q.slice(1))}
      />

      {/* ── Board head — canvas 06/17: wordmark, pill rail, actions ───────── */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <BoardLead
          word="watch"
          sub={
            isSolo
              ? "Companies you know, studied properly, decided with conviction. A verdict only unlocks after the homework."
              : isKid
                ? "Companies your family knows. Study one, then decide together — the verdict unlocks after the homework."
                : "Anyone adds, everyone studies, verdicts come only after the homework."
          }
        />

        <WatchRail active="board" showKai={!isKid} className="mt-4" />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAdd()}
            className="cta-button f0-focus f0-press inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add a company
          </button>
          {!isKid && (
            <button
              onClick={() => {
                setKaiTicker(null);
                setKaiOpen(true);
              }}
              className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full border border-kai-500/35 bg-kai-500/[0.07] px-4 py-2.5 text-sm font-semibold text-kai-600 transition hover:bg-kai-500/[0.12]"
            >
              <Sparkles className="h-4 w-4" />
              Ask Kai to watch
            </button>
          )}
        </div>
      </m.header>

      {/* ── The board at a glance (canvas 01/17 ticker tile) ────────────────
          Padded out to nine slots on purpose: production IS a board of a
          handful of names, and a strip that ends in designed empty slots reads
          as a board filling up, where a strip of three reads as a broken row.
          A tile with no quote yet prints "—", never a fabricated 0.00%. */}
      {items.length > 0 && (
        <section className="mt-7">
          <BoardEyebrow
            className="mb-3"
            meta={
              <span className="font-mono text-[10px] tabular-nums text-soft/70">
                {items.length}
              </span>
            }
          >
            On the board
          </BoardEyebrow>
          <TickerTileStrip minSlots={9} size="md">
            {items.map((it) => (
              <TickerTile
                key={it.id}
                ticker={it.ticker}
                changePct={quotes[it.ticker]?.changePercent ?? null}
                href={`/research/${encodeURIComponent(it.ticker)}`}
              />
            ))}
          </TickerTileStrip>
        </section>
      )}

      {/* ── Filters — a line of chips, never a filter bar box ──────────────── */}
      {items.length > 0 && (trendsPresent.length > 0 || championIds.length > 0) && (
        <div className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft/70">
            Filter
          </span>
          {trendsPresent.map((t) => (
            <button
              key={t}
              aria-pressed={fTrend === t}
              onClick={() => setFTrend(fTrend === t ? null : t)}
              className={`f0-chip f0-focus f0-press text-[12px] font-semibold ${
                fTrend === t ? "f0-chip-on" : "text-soft hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
          {championIds.length > 1 && (
            <select
              value={fMember || ""}
              onChange={(e) => setFMember(e.target.value || null)}
              className="f0-chip f0-focus bg-transparent text-[12px] font-semibold text-soft"
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
              className="f0-focus ml-auto text-[12px] font-semibold text-gold-700 hover:text-gold-600"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Empty board ────────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="mt-8 space-y-5">
          <EmptyWatchlist onAdd={() => openAdd()} />
          {!isKid && (
            <p className="text-center text-[13px] text-soft">
              Or{" "}
              <button
                onClick={() => {
                  setKaiTicker(null);
                  setKaiOpen(true);
                }}
                className="font-semibold text-kai-600 underline decoration-kai-500/40 underline-offset-2 hover:text-kai-500"
              >
                have Kai keep an eye on something
              </button>{" "}
              while you decide what to add.
            </p>
          )}
        </div>
      )}

      {/* ── MY STOCKS — one card per company, grouped by rung of the ladder ── */}
      {items.length > 0 && (
        <div className="mt-8 space-y-8">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const colItems = filtered.filter((i) => i.status === status);
            if (colItems.length === 0 && (fTrend || fMember)) return null;
            return (
              <section key={status}>
                <BoardEyebrow
                  className="mb-3"
                  meta={
                    <span className="font-mono text-[10px] tabular-nums text-soft/70">
                      {colItems.length}
                    </span>
                  }
                >
                  {meta.label}
                </BoardEyebrow>
                {colItems.length === 0 ? (
                  <Card className="px-4 py-4">
                    <p className="text-[12.5px] text-soft/85">{meta.blurb}</p>
                  </Card>
                ) : (
                  <div className="f0-stagger space-y-2.5">
                    {colItems.map((item, idx) => {
                      const champ = item.champion_id
                        ? members[item.champion_id]
                        : null;
                      const complete = researchComplete(item);
                      const itemNotes = notes[item.id] || [];
                      const showNotes = !!openNotes[item.id];
                      const canDelete =
                        item.champion_id === userId ||
                        role === "parent" ||
                        role === "admin";
                      const q = quotes[item.ticker];
                      const open = openRow === item.id;
                      const pct = q?.changePercent ?? null;

                      // The move SINCE IT LANDED — the number this board has
                      // always claimed to measure. `snapshot_price` is written
                      // by the add flow above and backfilled by the daily cron;
                      // it is not on the shared WatchlistItem type (which the
                      // watchlist lib owns), so it is read defensively and the
                      // line simply does not draw when the board RPC did not
                      // return one. Honest absence, never a fabricated 0%.
                      const snapPrice =
                        (item as WatchlistItem & { snapshot_price?: number | null })
                          .snapshot_price ?? null;
                      const sincePct =
                        snapPrice != null && snapPrice > 0 && q?.price != null
                          ? ((q.price - snapPrice) / snapPrice) * 100
                          : null;

                      return (
                        <Card
                          key={item.id}
                          padded={false}
                          className={`px-4 py-4 ${
                            unlockedId === item.id ? "border-accent/50" : ""
                          }`}
                        >
                          <div
                            style={{ ["--i" as string]: idx }}
                            className="f0-focus cursor-pointer"
                            onClick={() =>
                              setOpenRow((v) => (v === item.id ? null : item.id))
                            }
                            role="button"
                            tabIndex={0}
                            aria-expanded={open}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenRow((v) =>
                                  v === item.id ? null : item.id
                                );
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <CompanyLogo
                                symbol={item.ticker}
                                name={item.company_name}
                                size={40}
                                rounded="rounded-[11px]"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
                                    {item.ticker}
                                  </span>
                                  {q?.price != null ? (
                                    <span className="font-mono text-[12px] tabular-nums text-ink">
                                      {q.price.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[11px] text-soft/50">
                                      no quote
                                    </span>
                                  )}
                                  {pct != null && (
                                    /* Flat gets no arrow and no price colour —
                                       "▼0.0%" is a down arrow on a number that
                                       says nothing moved. src/lib/format-move. */
                                    <span
                                      className={`font-mono text-[10px] tabular-nums ${moveToneClass(pct)}`}
                                    >
                                      {formatMove(pct)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-[10px] text-soft/85">
                                  {item.company_name}
                                  {snapPrice != null && (
                                    <>
                                      {" · on the board at "}
                                      {snapPrice.toFixed(2)}
                                    </>
                                  )}
                                  {sincePct != null && (
                                    <>
                                      {" · "}
                                      <span
                                        className={`font-mono ${
                                          sincePct >= 0
                                            ? "text-price-up"
                                            : "text-price-down"
                                        }`}
                                      >
                                        {sincePct >= 0 ? "+" : ""}
                                        {sincePct.toFixed(1)}%
                                      </span>
                                      {" since"}
                                    </>
                                  )}
                                </p>
                              </div>

                              {/* The ring is the RESEARCH ladder — how much of
                                  the homework is done. It is the accent, not a
                                  price colour: nothing on it is a price. */}
                              <Dial
                                value={
                                  researchFilledCount(item) / RESEARCH_FIELDS.length
                                }
                                size={44}
                                ring={5}
                                tone={complete ? "teal" : "volt"}
                                center={`${researchFilledCount(item)}/${RESEARCH_FIELDS.length}`}
                                centerClassName="text-[9px]"
                                label={`${researchFilledCount(item)} of ${RESEARCH_FIELDS.length} research fields filled in for ${item.ticker}`}
                              />

                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-soft/60 transition-transform ${
                                  open ? "rotate-180" : ""
                                }`}
                                aria-hidden
                              />
                            </div>

                            <div className="mt-2.5">
                              <Sparkline symbol={item.ticker} height={38} />
                            </div>

                            {/* the card footer strip: the club's read (lime) and
                                who champions it */}
                            <div className="mt-2.5 flex items-center gap-2.5 border-t border-sand pt-2.5">
                              {!isKid ? (
                                <SentimentDots
                                  net={likeCounts[item.ticker]?.net ?? 0}
                                  votes={likeCounts[item.ticker]?.votes ?? 0}
                                  showLabel={false}
                                />
                              ) : (
                                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/70">
                                  {researchFilledCount(item)}/
                                  {RESEARCH_FIELDS.length} researched
                                </span>
                              )}
                              <p className="min-w-0 flex-1 truncate text-[11px] italic leading-relaxed text-soft">
                                {item.why_we_picked || meta.blurb}
                              </p>
                              {champ && !isSolo && (
                                <span className="flex shrink-0 items-center gap-1">
                                  <Avatar member={champ} size={18} />
                                  <span className="hidden text-[10.5px] text-soft/80 sm:inline">
                                    {champ.display_name}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ── the detail ── */}
                          <AnimatePresence initial={false}>
                            {open && (
                              <m.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-sand pt-3.5">
                                  <div className="max-w-lg">
                                    <ResearchLadder
                                      status={item.status}
                                      filled={researchFilledCount(item)}
                                      total={RESEARCH_FIELDS.length}
                                      researchDone={complete}
                                    />
                                  </div>

                                  {item.why_we_picked && (
                                    <p className="mt-3 max-w-prose text-[13.5px] leading-relaxed text-ink/85">
                                      “{item.why_we_picked}”
                                    </p>
                                  )}

                                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {item.trend ? (
                                      <TrendGlyph trend={item.trend} kid={isKid} />
                                    ) : (
                                      <span className="text-[11px] text-soft/70">
                                        No trend yet
                                      </span>
                                    )}
                                    {discussCounts[item.ticker] ? (
                                      <Link
                                        href={`/research/${encodeURIComponent(item.ticker)}`}
                                        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-soft hover:text-ink"
                                      >
                                        <MessageCircle className="h-3 w-3" />
                                        {discussCounts[item.ticker]} discussing
                                      </Link>
                                    ) : null}
                                  </div>

                                  {item.status !== "watch" && (
                                    <dl className="mt-3 space-y-1.5 text-[12.5px]">
                                      {item.how_they_make_money && (
                                        <div>
                                          <dt className="inline font-semibold text-ink">
                                            Makes money:{" "}
                                          </dt>
                                          <dd className="inline text-soft">
                                            {item.how_they_make_money}
                                          </dd>
                                        </div>
                                      )}
                                      {item.strength && (
                                        <div className="flex items-start gap-1.5 text-soft">
                                          <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0 text-ink/60" />
                                          <span>{item.strength}</span>
                                        </div>
                                      )}
                                      {item.risk && (
                                        <div className="flex items-start gap-1.5 text-soft">
                                          <ThumbsDown className="mt-0.5 h-3 w-3 shrink-0 text-ink/60" />
                                          <span>{item.risk}</span>
                                        </div>
                                      )}
                                    </dl>
                                  )}

                                  {/* actions */}
                                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] font-semibold">
                                    {item.status === "watch" && (
                                      <button
                                        onClick={() => startStudy(item)}
                                        className="inline-flex items-center gap-1.5 text-gold-700 hover:text-gold-600"
                                      >
                                        <FlaskConical className="h-3.5 w-3.5" />
                                        Start studying
                                      </button>
                                    )}
                                    {item.status !== "watch" && (
                                      <button
                                        onClick={() => openResearch(item)}
                                        className="inline-flex items-center gap-1.5 text-soft hover:text-ink"
                                      >
                                        <FlaskConical className="h-3.5 w-3.5" />
                                        {complete
                                          ? "Research card"
                                          : "Finish research"}
                                      </button>
                                    )}
                                    {item.status === "study" && (
                                      <>
                                        <button
                                          onClick={() =>
                                            setVerdict(item, "favorite")
                                          }
                                          disabled={!complete}
                                          title={
                                            complete
                                              ? "Mark favorite"
                                              : "Finish the research card first"
                                          }
                                          className={`inline-flex items-center gap-1.5 ${
                                            complete
                                              ? "text-ink hover:text-gold-700"
                                              : "cursor-not-allowed text-soft/50"
                                          }`}
                                        >
                                          {complete ? (
                                            <ThumbsUp className="h-3.5 w-3.5" />
                                          ) : (
                                            <Lock className="h-3.5 w-3.5" />
                                          )}
                                          Favorite
                                        </button>
                                        <button
                                          onClick={() =>
                                            setVerdict(item, "avoid")
                                          }
                                          disabled={!complete}
                                          title={
                                            complete
                                              ? "Mark avoid"
                                              : "Finish the research card first"
                                          }
                                          className={`inline-flex items-center gap-1.5 ${
                                            complete
                                              ? "text-ink hover:text-gold-700"
                                              : "cursor-not-allowed text-soft/50"
                                          }`}
                                        >
                                          {complete ? (
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
                                        className="text-soft hover:text-ink"
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
                                      className="inline-flex items-center gap-1.5 text-soft hover:text-ink"
                                    >
                                      <Share2 className="h-3.5 w-3.5" />
                                      Post to community
                                    </button>
                                    {promoted[item.id] ? (
                                      <Link
                                        href={`/research/${encodeURIComponent(item.ticker)}`}
                                        className="inline-flex items-center gap-1.5 text-gold-700 hover:text-gold-600"
                                      >
                                        <Users2 className="h-3.5 w-3.5" />
                                        On club board
                                      </Link>
                                    ) : (
                                      <button
                                        onClick={() => promoteToCommunity(item)}
                                        disabled={promotingId === item.id}
                                        title="Add this company to the club's Community Watchlist"
                                        className="inline-flex items-center gap-1.5 text-soft hover:text-ink disabled:opacity-60"
                                      >
                                        <Users2 className="h-3.5 w-3.5" />
                                        {promotingId === item.id
                                          ? "Adding…"
                                          : "Add to community"}
                                      </button>
                                    )}
                                    <Link
                                      href={`/chart?symbol=${encodeURIComponent(item.ticker)}`}
                                      className="inline-flex items-center gap-1.5 text-soft hover:text-ink"
                                    >
                                      <LineChart className="h-3.5 w-3.5" />
                                      Chart
                                    </Link>
                                    <button
                                      onClick={() =>
                                        setOpenNotes((p) => ({
                                          ...p,
                                          [item.id]: !p[item.id],
                                        }))
                                      }
                                      className="inline-flex items-center gap-1.5 text-soft hover:text-ink"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                      Notes ({itemNotes.length})
                                    </button>

                                    <span className="ml-auto flex items-center gap-3">
                                      {!isKid && (
                                        <button
                                          onClick={() => {
                                            setKaiTicker(item.ticker);
                                            setKaiOpen(true);
                                          }}
                                          title="Watch with Kai"
                                          aria-label="Watch with Kai"
                                          className="inline-flex items-center gap-1.5 text-kai-600 hover:text-kai-500"
                                        >
                                          <Sparkles className="h-3.5 w-3.5" />
                                          Watch with Kai
                                        </button>
                                      )}
                                      {!isKid && (
                                        <SetAlertButton
                                          ticker={item.ticker}
                                          surface="watchlist"
                                          defaultKind="price_cross"
                                          seedPrice={
                                            quotes[item.ticker]?.price ?? null
                                          }
                                          variant="icon"
                                          stopPropagation
                                        />
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => deleteItem(item)}
                                          className="f0-focus text-soft/60 transition hover:text-ink"
                                          aria-label="Remove company"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </span>
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
                                        <div className="mt-4 max-w-lg space-y-2.5 border-t border-sand/70 pt-3">
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
                                                <p className="text-[13px] text-ink/85">
                                                  {n.note}
                                                </p>
                                                <p className="text-[10.5px] text-soft/70">
                                                  {n.author_id
                                                    ? members[n.author_id]
                                                        ?.display_name ||
                                                      "Member"
                                                    : "Member"}{" "}
                                                  · {timeAgo(n.created_at)}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                          {itemNotes.length === 0 && (
                                            <p className="text-[12.5px] text-soft/70">
                                              No notes yet — start the
                                              conversation.
                                            </p>
                                          )}
                                          <div className="flex items-center gap-2 pt-1">
                                            <input
                                              value={noteDraft[item.id] || ""}
                                              onChange={(e) =>
                                                setNoteDraft((p) => ({
                                                  ...p,
                                                  [item.id]: e.target.value,
                                                }))
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter")
                                                  addNote(item);
                                              }}
                                              placeholder="Add a note…"
                                              className="flex-1 border-b border-sand bg-transparent px-1 py-1.5 text-[13px] text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                                            />
                                            <button
                                              onClick={() => addNote(item)}
                                              className="text-soft transition hover:text-gold-700"
                                              aria-label="Send note"
                                            >
                                              <Send className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </div>
                                      </m.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* ── The board's own record — canvas 17's footer object. It sits at
              the BOTTOM, where the board puts it, instead of opening the screen
              as an obsidian slab the canvas never draws. */}
          {!isKid && (
            <section>
              <BoardEyebrow accent className="mb-3">
                How the board is doing
              </BoardEyebrow>
              <WatchlistPerformance
                tickers={items.map((i) => i.ticker)}
                familyId={familyId}
              />
            </section>
          )}
        </div>
      )}

      {/* ── Watch with Kai (prefilled from a row, or blank from the masthead) ─ */}
      <AnimatePresence>
        {kaiOpen && !isKid && (
          <KaiWatch
            userId={userId}
            defaultTicker={kaiTicker ?? undefined}
            surface="watchlist"
            variant="modal"
            onClose={() => {
              setKaiOpen(false);
              setKaiTicker(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Add sheet ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => !addBusy && setAddOpen(false)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-lift sm:rounded-2xl"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                    New position on the board
                  </p>
                  <h2 className="mt-1.5 font-display text-display-3 font-extrabold text-ink">
                    Add a company
                  </h2>
                </div>
                <button
                  onClick={() => !addBusy && setAddOpen(false)}
                  className="text-soft hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={submitAdd} className="space-y-4">
                {/* Ticker lookup (Polygon reference search) */}
                <div className="relative">
                  <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                    {isKid ? "Find a company" : "Search company or ticker"}
                  </label>
                  <div className="relative mt-1.5">
                    <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-soft/60" />
                    <input
                      value={tickerQuery}
                      onChange={(e) => setTickerQuery(e.target.value)}
                      placeholder={
                        isKid ? "Type a name, like Nike" : "e.g. Nike or NKE"
                      }
                      className="w-full border-b border-sand bg-transparent py-2 pl-6 pr-3 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                    />
                    {searching && (
                      <div className="absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-volt-400/30 border-t-volt-500" />
                    )}
                  </div>
                  {tickerHits.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-sand bg-paper shadow-lift">
                      {tickerHits.map((hit) => (
                        <button
                          key={hit.ticker}
                          type="button"
                          onClick={() => pickTicker(hit)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-volt-500/[0.07]"
                        >
                          <span className="min-w-0 truncate text-ink">
                            {hit.name}
                          </span>
                          <span className="shrink-0 font-mono text-xs font-semibold text-gold-700">
                            ${hit.ticker}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                      Company name
                    </label>
                    <input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder={isKid ? "Like Nike or Roblox" : "Company name"}
                      required
                      className="mt-1.5 w-full border-b border-sand bg-transparent px-1 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                      Ticker
                    </label>
                    <input
                      value={addTicker}
                      onChange={(e) =>
                        setAddTicker(e.target.value.toUpperCase())
                      }
                      placeholder="NKE"
                      required
                      className="mt-1.5 w-full border-b border-sand bg-transparent px-1 py-2 font-mono text-sm uppercase text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                    {isKid
                      ? "What does this company make or sell?"
                      : "What do they sell?"}{" "}
                    <span className="normal-case tracking-normal text-soft/60">
                      (optional)
                    </span>
                  </label>
                  <input
                    value={addSell}
                    onChange={(e) => setAddSell(e.target.value)}
                    placeholder={
                      isKid ? "Sneakers and sports stuff" : "Product / service"
                    }
                    className="mt-1.5 w-full border-b border-sand bg-transparent px-1 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                    {isKid ? "Why did you pick it?" : "Why is it on our radar?"}{" "}
                    <span className="normal-case tracking-normal text-soft/60">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={addWhy}
                    onChange={(e) => setAddWhy(e.target.value)}
                    rows={2}
                    placeholder={
                      isKid
                        ? "Everyone at school wears them!"
                        : "In your own words"
                    }
                    className="mt-1.5 w-full resize-none border-b border-sand bg-transparent px-1 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                  />
                </div>

                <p className="flex items-start gap-2 border-t border-sand pt-3 text-[12px] leading-relaxed text-soft">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
                  It starts in <b className="text-ink">Watching</b> — study it to
                  unlock a Favorite or Avoid verdict.
                </p>

                <button
                  type="submit"
                  disabled={addBusy}
                  className="cta-button flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm disabled:opacity-60"
                >
                  {addBusy ? "Adding…" : "Add to Watching"}
                </button>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Research card ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {researchItem && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => !rBusy && setResearchId(null)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-6 shadow-lift sm:rounded-2xl"
            >
              <div className="mb-1 flex items-start justify-between">
                <div>
                  <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                    Research card · ${researchItem.ticker}
                  </p>
                  <h2 className="mt-1.5 font-display text-display-3 font-extrabold text-ink">
                    {researchItem.company_name}
                  </h2>
                </div>
                <button
                  onClick={() => !rBusy && setResearchId(null)}
                  className="text-soft hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-5 mt-2 text-[13px] leading-relaxed text-soft">
                {isKid
                  ? "Do the homework! Fill these in to unlock your Favorite or Avoid."
                  : "Complete all four to unlock a verdict — no shortcuts to a decision."}
              </p>

              {/* progress */}
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-sand">
                  <div
                    className="h-px bg-volt-500 transition-all"
                    style={{
                      width: `${(rFilled / RESEARCH_FIELDS.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums text-soft">
                  {rFilled}/{RESEARCH_FIELDS.length}
                </span>
              </div>

              <div className="space-y-4">
                <ResearchField
                  label="How do they make money?"
                  required
                  value={rForm.how_they_make_money || ""}
                  onChange={(v) =>
                    setRForm((f) => ({ ...f, how_they_make_money: v }))
                  }
                  placeholder={
                    isKid
                      ? "People pay them for…"
                      : "Revenue model in plain words"
                  }
                />
                <ResearchField
                  label="One strength"
                  required
                  value={rForm.strength || ""}
                  onChange={(v) => setRForm((f) => ({ ...f, strength: v }))}
                  placeholder={isKid ? "What are they GREAT at?" : "A real edge"}
                />
                <ResearchField
                  label="One risk"
                  required
                  value={rForm.risk || ""}
                  onChange={(v) => setRForm((f) => ({ ...f, risk: v }))}
                  placeholder={
                    isKid ? "What could go wrong?" : "What could hurt them?"
                  }
                />
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                    Trend <span className="text-gold-600">*</span>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TREND_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          setRForm((f) => ({ ...f, trend: t.value }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                          rForm.trend === t.value
                            ? "border-volt-500 bg-volt-500/10 text-gold-700"
                            : "border-sand text-soft hover:border-volt-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
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

              <button
                onClick={saveResearch}
                disabled={rBusy}
                className="cta-button mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {rBusy ? "Saving…" : "Save research"}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] text-soft">
                {rComplete ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-gold-700" />
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

      {/* ── Post to community ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {shareItem && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => !shareBusy && setShareItem(null)}
          >
            <m.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-paper p-6 shadow-lift sm:rounded-2xl"
            >
              {shareDone ? (
                <div className="py-4 text-center">
                  <Check className="mx-auto mb-2 h-8 w-8 text-gold-700" />
                  <p className="font-display text-display-3 font-extrabold text-ink">
                    Posted to the club
                  </p>
                  <Link
                    href="/community"
                    className="f0-focus mt-3 inline-block text-sm font-semibold text-gold-700 hover:text-gold-600"
                  >
                    See it in the feed →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                        Share your read
                      </p>
                      <h2 className="mt-1.5 font-display text-display-3 font-extrabold text-ink">
                        Post to community
                      </h2>
                    </div>
                    <button
                      onClick={() => !shareBusy && setShareItem(null)}
                      className="text-soft hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 border-y border-sand py-3">
                    <CompanyLogo
                      symbol={shareItem.ticker}
                      name={shareItem.company_name}
                      size={32}
                      rounded="rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-[14px] font-extrabold text-ink">
                        ${shareItem.ticker}
                      </p>
                      <p className="truncate text-[11.5px] text-soft">
                        {shareItem.company_name} ·{" "}
                        {STATUS_META[shareItem.status]?.label ||
                          shareItem.status}
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note (optional)"
                    className="mt-3 w-full resize-none border-b border-sand bg-transparent px-1 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
                  />
                  <button
                    onClick={submitShare}
                    disabled={shareBusy}
                    className="cta-button mt-5 w-full rounded-full py-3 text-sm disabled:opacity-60"
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
      <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
        {label}
        {required && <span className="ml-0.5 text-gold-600">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1.5 w-full resize-none border-b border-sand bg-transparent px-1 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-volt-400 focus:outline-none"
      />
    </div>
  );
}
