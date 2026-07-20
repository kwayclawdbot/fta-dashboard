"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  BookMarked,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import TradingViewMini from "@/components/fic/TradingViewMini";
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

// A curated starter set so "Add from the Big Book" feels like a real shelf
// (the final top-100 list isn't locked yet — these pre-fill name + ticker).
const BIG_BOOK_PICKS = [
  { name: "Apple", ticker: "AAPL" },
  { name: "Nike", ticker: "NKE" },
  { name: "Roblox", ticker: "RBLX" },
  { name: "Disney", ticker: "DIS" },
  { name: "McDonald's", ticker: "MCD" },
  { name: "Netflix", ticker: "NFLX" },
  { name: "Coca-Cola", ticker: "KO" },
  { name: "Chipotle", ticker: "CMG" },
  { name: "Costco", ticker: "COST" },
  { name: "Nvidia", ticker: "NVDA" },
  { name: "Lego (Mattel)", ticker: "MAT" },
  { name: "Crocs", ticker: "CROX" },
];

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
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState("parent");
  const [isKid, setIsKid] = useState(false);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [notes, setNotes] = useState<Record<string, WatchlistNote[]>>({});

  // filters
  const [fTrend, setFTrend] = useState<string | null>(null);
  const [fMember, setFMember] = useState<string | null>(null);
  const [fBigBook, setFBigBook] = useState(false);

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addBigBook, setAddBigBook] = useState(false);
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
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, family_id")
      .eq("id", user.id)
      .single();
    setFamilyId(profile?.family_id ?? null);
    setRole(profile?.role ?? "parent");
    setIsKid(profile?.age_group === "kids" || profile?.role === "child");

    if (!profile?.family_id) {
      setLoading(false);
      return;
    }

    const [{ data: memberRows }, { data: itemRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, role")
        .eq("family_id", profile.family_id),
      supabase
        .from("family_watchlist")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: false }),
    ]);

    const memMap: Record<string, Member> = {};
    for (const m of (memberRows as Member[]) || []) memMap[m.id] = m;
    setMembers(memMap);

    const list = (itemRows as WatchlistItem[]) || [];
    setItems(list);

    if (list.length > 0) {
      const { data: noteRows } = await supabase
        .from("watchlist_notes")
        .select("*")
        .in(
          "watchlist_id",
          list.map((i) => i.id)
        )
        .order("created_at", { ascending: true });
      const grouped: Record<string, WatchlistNote[]> = {};
      for (const n of (noteRows as WatchlistNote[]) || []) {
        (grouped[n.watchlist_id] ||= []).push(n);
      }
      setNotes(grouped);
    } else {
      setNotes({});
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Add ──────────────────────────────────────────────────────────────────
  function openAdd(bigBook: boolean) {
    setAddBigBook(bigBook);
    setAddName("");
    setAddTicker("");
    setAddSell("");
    setAddWhy("");
    setAddOpen(true);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addBusy || !familyId) return;
    const name = addName.trim();
    const ticker = addTicker.trim().toUpperCase();
    if (!name || !ticker) return;
    setAddBusy(true);
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
        in_big_book: addBigBook,
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
      if (!already) {
        await awardXp(
          supabase,
          userId,
          "bonus",
          WATCHLIST_XP.RESEARCH,
          `research:${updated.id}`
        );
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
        if (fBigBook && !i.in_big_book) return false;
        return true;
      }),
    [items, fTrend, fMember, fBigBook]
  );

  const researchItem = researchId
    ? items.find((i) => i.id === researchId) || null
    : null;
  const rComplete = researchComplete({ ...researchItem, ...rForm });
  const rFilled = researchFilledCount({ ...researchItem, ...rForm });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Family Watchlist
          </h1>
          <p className="mt-1 text-sm text-soft">
            {isKid
              ? "Your family's research board. Add companies you know, study them, then decide together."
              : "The family research board — anyone adds, everyone studies, verdicts come only after the homework."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openAdd(false)}
            className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add a company
          </button>
          <button
            onClick={() => openAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold-300 bg-white px-4 py-2.5 text-sm font-semibold text-gold-700 hover:bg-chip-amber"
          >
            <BookMarked className="h-4 w-4" />
            Big Book of Stocks
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sand bg-white p-3 shadow-soft">
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
          {/* big book */}
          <button
            onClick={() => setFBigBook((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              fBigBook
                ? "bg-chip-amber text-gold-700"
                : "bg-paper text-soft hover:bg-sand"
            }`}
          >
            <BookMarked className="h-3 w-3" />
            Big Book only
          </button>
          {(fTrend || fMember || fBigBook) && (
            <button
              onClick={() => {
                setFTrend(null);
                setFMember(null);
                setFBigBook(false);
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
        <div className="rounded-2xl border border-dashed border-sand bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-chip-amber text-gold-700">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-ink">
            Start your research board
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-soft">
            Add the first company your family already knows and loves — the
            snack, the sneakers, the game, the phone. Everything starts in
            Watching.
          </p>
          <button
            onClick={() => openAdd(false)}
            className="cta-button mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add your first company
          </button>
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
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="overflow-hidden rounded-2xl border border-sand bg-white shadow-soft"
                      >
                        <div className="p-4">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="truncate font-display text-base font-bold text-ink">
                                  {item.company_name}
                                </h4>
                                {item.in_big_book && (
                                  <BookMarked
                                    className="h-3.5 w-3.5 shrink-0 text-gold-500"
                                    aria-label="From the Big Book"
                                  />
                                )}
                              </div>
                              <p className="text-xs font-medium text-midnight-500">
                                {item.ticker}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                          </div>

                          {/* trend + champion */}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {item.trend ? (
                              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-soft">
                                {item.trend}
                              </span>
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

                          {/* sparkline (lazy) */}
                          <div className="mt-3">
                            <TradingViewMini symbol={item.ticker} height={80} />
                          </div>

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
                              <motion.div
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
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
            onClick={() => !addBusy && setAddOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  {addBigBook ? (
                    <>
                      <BookMarked className="h-5 w-5 text-gold-500" />
                      Add from the Big Book of Stocks 2027
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 text-gold-500" />
                      Add a company
                    </>
                  )}
                </h2>
                <button
                  onClick={() => !addBusy && setAddOpen(false)}
                  className="text-midnight-500 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {addBigBook && (
                <div className="mb-4">
                  <p className="mb-2 text-xs text-soft">
                    Tap a company from the shelf to pre-fill it, or type your
                    own below.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {BIG_BOOK_PICKS.map((p) => (
                      <button
                        key={p.ticker}
                        onClick={() => {
                          setAddName(p.name);
                          setAddTicker(p.ticker);
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          addTicker === p.ticker
                            ? "border-gold-400 bg-chip-amber text-gold-700"
                            : "border-sand bg-paper text-soft hover:border-gold-300"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={submitAdd} className="space-y-3">
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
                      className="mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
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
                      className="mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm uppercase text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
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
                    className="mt-1 w-full resize-none rounded-lg border border-sand bg-white px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Research modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {researchItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
            onClick={() => !rBusy && setResearchId(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl"
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
            </motion.div>
          </motion.div>
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
        className="mt-1 w-full resize-none rounded-lg border border-sand bg-white px-3 py-2 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
      />
    </div>
  );
}
