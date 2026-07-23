"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  CandlestickChart,
  LineChart,
  Search,
  Info,
  Star,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import TradingViewAdvancedChart from "@/components/fic/TradingViewAdvancedChart";
import ClubChatDrawer from "@/components/community/ClubChatDrawer";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import type { LiveRoomsMe } from "@/components/community/LiveRooms";
import type { Role } from "@/lib/feed";

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

// A few friendly, well-known symbols to get kids exploring fast.
const QUICK_SYMBOLS = ["SPY", "AAPL", "NKE", "DIS", "MCD", "ROBLOX:RBLX"];

function ChartInner() {
  const supabase = createClient();
  const params = useSearchParams();
  const router = useRouter();

  const urlSymbol = normalizeSymbol(params.get("symbol") || "SPY") || "SPY";
  const [input, setInput] = useState(urlSymbol);
  const [lineStyle, setLineStyle] = useState<boolean | null>(null); // null = not loaded
  const [roleLoaded, setRoleLoaded] = useState(false);
  // Club Chat drawer needs the viewer's profile + tier, same shape /community
  // supplies. Realtime plumbing + chat_messages schema untouched.
  const [me, setMe] = useState<LiveRoomsMe | null>(null);
  const [tier, setTier] = useState<FamilyTier>("fic");

  // Default chart style from role/age: kids → clean area/line, teens+parents → candles.
  const loadRole = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLineStyle(false);
      setRoleLoaded(true);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, age_group, family_id, avatar_url, username")
      .eq("id", user.id)
      .single();
    const isKid =
      profile?.age_group === "kids" ||
      (profile?.role === "child" && profile?.age_group !== "teens");
    setLineStyle(isKid);
    setRoleLoaded(true);
    if (profile) {
      setMe({
        id: user.id,
        display_name: profile.display_name || "You",
        role: (profile.role as Role) || "parent",
        age_group: profile.age_group ?? null,
        family_id: profile.family_id ?? null,
        avatar_url: profile.avatar_url ?? null,
        username: profile.username ?? null,
      });
      getFamilyTier(supabase, profile.family_id ?? null).then(setTier);
    }
  }, [supabase]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  useEffect(() => {
    setInput(urlSymbol);
  }, [urlSymbol]);

  function submitSymbol(e: React.FormEvent) {
    e.preventDefault();
    const s = normalizeSymbol(input);
    if (s) router.replace(`/chart?symbol=${encodeURIComponent(s)}`);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col gap-4">
      {/* Header row */}
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/watchlist"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Watchlist
          </Link>
          <div className="h-4 w-px bg-sand" />
          <div>
            <h1 className="font-display text-xl font-bold text-ink">
              Practice Chart
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-soft">
              <Info className="h-3 w-3" />
              Practice reading charts — this is learning, not financial advice.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Symbol search */}
          <form onSubmit={submitSymbol} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-midnight-500" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Symbol (e.g. AAPL)"
              className="w-40 rounded-lg border border-sand bg-midnight-900 py-2 pl-8 pr-3 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
              aria-label="Chart symbol"
            />
          </form>
          {/* Style toggle */}
          {roleLoaded && (
            <div className="flex overflow-hidden rounded-lg border border-sand">
              <button
                onClick={() => setLineStyle(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  lineStyle
                    ? "bg-chip-amber text-gold-700"
                    : "bg-midnight-900 text-soft hover:bg-paper"
                }`}
                aria-pressed={!!lineStyle}
              >
                <LineChart className="h-3.5 w-3.5" />
                Line
              </button>
              <button
                onClick={() => setLineStyle(false)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  !lineStyle
                    ? "bg-chip-amber text-gold-700"
                    : "bg-midnight-900 text-soft hover:bg-paper"
                }`}
                aria-pressed={lineStyle === false}
              >
                <CandlestickChart className="h-3.5 w-3.5" />
                Candles
              </button>
            </div>
          )}
        </div>
      </m.div>

      {/* Quick symbols */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-soft">
          <Star className="h-3 w-3 text-gold-400" /> Try:
        </span>
        {QUICK_SYMBOLS.map((s) => {
          const shown = s.includes(":") ? s.split(":")[1] : s;
          return (
            <Link
              key={s}
              href={`/chart?symbol=${encodeURIComponent(s)}`}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                urlSymbol === s
                  ? "border-gold-400 bg-chip-amber text-gold-700"
                  : "border-sand bg-midnight-900 text-soft hover:border-gold-300"
              }`}
            >
              {shown}
            </Link>
          );
        })}
      </div>

      {/* The chart — fills remaining height */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-sand bg-midnight-900 shadow-soft"
      >
        {roleLoaded && lineStyle !== null ? (
          <TradingViewAdvancedChart symbol={urlSymbol} lineStyle={lineStyle} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
          </div>
        )}
      </m.div>

      {/* Club Chat — shared drawer, one tap away while studying a chart */}
      <ClubChatDrawer key={tier} me={me} tier={tier} />
    </div>
  );
}

export default function ChartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      }
    >
      <ChartInner />
    </Suspense>
  );
}
