"use client";

/**
 * /chart — the Practice Chart (canvas rebuild B: CHROME ONLY).
 *
 * The charting itself is untouched — same TradingView embed, same
 * role-derived style default (kids → area, teens/parents → candles), same
 * symbol plumbing through the URL. What changed is the furniture around it:
 * a masthead, a ruled control strip, mono $CASHTAGs for the quick symbols,
 * and one framed dark media object for the chart pane.
 *
 * COLOUR LAW: nothing on this surface is price, sentiment or Kai, so the only
 * accent is brand orange (the active style, the active symbol, hovers) via the
 * `gold-*` ramp, which is volt orange in club mode and flips for dark.
 *
 * COMPLIANCE: "Practice reading charts — this is learning, not financial
 * advice." is rendered verbatim.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import { CandlestickChart, LineChart, Search, ArrowLeft } from "lucide-react";
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

  const shownSymbol = urlSymbol.includes(":") ? urlSymbol.split(":")[1] : urlSymbol;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      {/* ── MASTHEAD ──────────────────────────────────────────────────────── */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
      >
        <div className="min-w-0">
          <Link
            href="/watchlist"
            className="inline-flex items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft transition-colors hover:text-gold-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Watchlist
          </Link>
          <h1 className="mt-2.5 font-display text-display-2 font-extrabold uppercase text-ink">
            Practice Chart
          </h1>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-soft">
            Practice reading charts — this is learning, not financial advice.
          </p>
        </div>

        {/* The symbol on the desk — the one number-register object up here. */}
        <p className="font-mono text-[26px] font-semibold leading-none tracking-tight text-ink">
          <span className="opacity-40">$</span>
          {shownSymbol}
        </p>
      </m.header>

      {/* ── CONTROL STRIP ─────────────────────────────────────────────────── */}
      {/* Search, style, and the try-these symbols — one ruled band, no boxes. */}
      <div className="f0-rule-top mt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-3">
          <form onSubmit={submitSymbol} className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-soft" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Symbol"
              aria-label="Chart symbol"
              className="w-28 bg-transparent font-mono text-[13px] uppercase tracking-[0.06em] text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-soft/70 focus:w-36"
            />
            <button
              type="submit"
              className="font-display text-eyebrow font-bold uppercase text-gold-700 transition-colors hover:text-gold-600"
            >
              Load
            </button>
          </form>

          {roleLoaded && (
            <div className="flex items-center gap-5" role="group" aria-label="Chart style">
              <StyleButton
                on={!!lineStyle}
                onClick={() => setLineStyle(true)}
                icon={<LineChart className="h-3.5 w-3.5" />}
                label="Line"
              />
              <StyleButton
                on={lineStyle === false}
                onClick={() => setLineStyle(false)}
                icon={<CandlestickChart className="h-3.5 w-3.5" />}
                label="Candles"
              />
            </div>
          )}
        </div>
      </div>

      <div className="f0-rule-top">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
          <span className="text-eyebrow font-display font-bold uppercase text-soft opacity-70">
            Try
          </span>
          {QUICK_SYMBOLS.map((s) => {
            const shown = s.includes(":") ? s.split(":")[1] : s;
            const on = urlSymbol === s;
            return (
              <Link
                key={s}
                href={`/chart?symbol=${encodeURIComponent(s)}`}
                className={`font-mono text-[12px] font-semibold tracking-[0.02em] transition-colors ${
                  on ? "text-gold-700" : "text-soft hover:text-ink"
                }`}
              >
                <span className="opacity-50">$</span>
                {shown}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── THE CHART ─────────────────────────────────────────────────────── */}
      {/* The one framed media object on the surface: a hairline frame and no
          fill of its own, so the embed's own surface is what you see and the
          pane is theme-correct by construction rather than by a dark: class.
          (`.chart-frame` is deliberately dark in BOTH themes — right for the
          simulator's lightweight-charts pane, wrong here, because this embed
          renders its own LIGHT theme on a light page and would flip from a
          dark frame to a light chart on load.) */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-sand"
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

/** A style choice reads as a heading with a volt underscore, not a pill. */
function StyleButton({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative inline-flex items-center gap-1.5 py-1 font-display text-eyebrow font-bold uppercase transition-colors ${
        on ? "text-ink" : "text-soft hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {on && (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-gold-600"
        />
      )}
    </button>
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
