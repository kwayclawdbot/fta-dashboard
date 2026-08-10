"use client";

/**
 * /chart — the Practice Chart, built to the owner's mockup.
 *
 * There is no dedicated chart board in the archive, so this is derived from
 * `Cheat Code App Light.dc.html` "03 Ticker · NVDA", which is the canvas's own
 * price screen — and it now uses that board's ACTUAL objects rather than a
 * reinterpretation of them: the back row, the logo tile + company name, the
 * mono mark with the delta beside it, the search and style controls inside a
 * CARD, filled pill switchers, and the chart in a rounded card frame. An
 * earlier pass rendered all of this as hairline rules on bare paper; the owner
 * rejected that reading, so the cards and pills the board draws are what ship.
 *
 * BACKEND — this surface used to be chrome around an embed with no data of its
 * own. It now reads real, delayed market data through the existing server
 * proxies (the Polygon key never leaves the server):
 *   • /api/market/company — company name + logo for the identity row
 *   • /api/market/quote   — the mark and today's move (single + batched)
 *   • /api/market/search  — real symbol suggestions as you type
 * Every one of those fails soft. A missing quote renders "—", never a
 * fabricated 0.00%.
 *
 * COLOUR LAW: the delta is the only price on the page and uses
 * `text-price-up` / `text-price-down` with no `dark:` variant. Everything else
 * that is an action — the active style, the load control, the active quick
 * symbol — is brand orange via the `gold-*` ramp (volt orange in club mode,
 * and it flips for dark, which `text-volt-*` does not). Nothing here is Kai, so
 * nothing here is blue.
 *
 * COMPLIANCE: "Practice reading charts — this is learning, not financial
 * advice." is rendered verbatim. No verdict, no BUY/SELL, no target.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Search, ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";
import TradingViewAdvancedChart from "@/components/fic/TradingViewAdvancedChart";
import ClubChatDrawer from "@/components/community/ClubChatDrawer";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import { Card, CardLabel, RangePills } from "@/components/research/board";
import {
  fetchCompany,
  fetchQuotes,
  searchTickers,
  type MarketCompany,
  type MarketQuote,
  type TickerHit,
} from "@/lib/market/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import type { LiveRoomsMe } from "@/components/community/LiveRooms";
import type { Role } from "@/lib/feed";
import FtaDoor from "@/components/entitlements/FtaDoor";

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** The bare ticker behind a TradingView-prefixed symbol ("ROBLOX:RBLX" → "RBLX"). */
function bareSymbol(raw: string): string {
  return raw.includes(":") ? raw.split(":")[1] : raw;
}

// A few friendly, well-known symbols to get kids exploring fast.
const QUICK_SYMBOLS = ["SPY", "AAPL", "NKE", "DIS", "MCD", "ROBLOX:RBLX"];
const QUICK_BARE = QUICK_SYMBOLS.map(bareSymbol);

type ChartStyle = "Line" | "Candles";

const STYLE_OPTIONS = ["Line", "Candles"] as const;

function ChartInner() {
  const supabase = createClient();
  const params = useSearchParams();
  const router = useRouter();
  /* CLUB TERMINAL BRANCH (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09).
     The composition is board 03's and stays shared — the club-dark tokens
     already reskin the cards and wells — so the branch only corrects the
     three spots the family skin deviates from the law in club mode: the
     hardcoded-hex Load CTA becomes the semantic orange pill, the tiny brand
     mono "TRY" label becomes the WHITE BOLD CAPS section register, and the
     chart frame becomes a flat dark well (border + card fill, no lifted
     shadow). The chart ENGINE and every read/write are untouched, and the
     family render keeps its exact class strings. */
  const isClub = useAppMode() === "club";

  const urlSymbol = normalizeSymbol(params.get("symbol") || "SPY") || "SPY";
  const shownSymbol = bareSymbol(urlSymbol);

  const [input, setInput] = useState(shownSymbol);
  const [style, setStyle] = useState<ChartStyle | null>(null); // null = role not loaded
  const [roleLoaded, setRoleLoaded] = useState(false);

  // Real market reads. LOADING is DERIVED, not stored: a read is "in flight"
  // exactly while the settled result does not belong to the symbol on screen.
  // That keeps the two states honestly distinct (skeleton vs "—") without a
  // synchronous setState inside an effect, which cascades a second render.
  const [mark, setMark] = useState<{
    symbol: string;
    company: MarketCompany | null;
    quote: MarketQuote | null;
  } | null>(null);
  const markLoading = mark?.symbol !== shownSymbol;
  const company = markLoading ? null : (mark?.company ?? null);
  const quote = markLoading ? null : (mark?.quote ?? null);

  // null = still reading; {} = read completed and returned nothing.
  const [quickQuotes, setQuickQuotes] = useState<Record<string, MarketQuote> | null>(null);
  const quickLoading = quickQuotes === null;

  // Symbol suggest — the same ranked universe every other search bar uses.
  const [hits, setHits] = useState<TickerHit[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Club Chat drawer needs the viewer's profile + tier, same shape /community
  // supplies. Realtime plumbing + chat_messages schema untouched.
  const [me, setMe] = useState<LiveRoomsMe | null>(null);
  const [tier, setTier] = useState<FamilyTier>("fic");

  /**
   * Default chart style from role/age: kids → clean area/line, teens+parents →
   * candles. Pure read — it RESOLVES the viewer and returns it, and the effect
   * below is the only thing that writes state. Same query, same shape as
   * /community supplies.
   */
  const resolveRole = useCallback(async (): Promise<{
    style: ChartStyle;
    me: LiveRoomsMe | null;
    tier: FamilyTier | null;
  } | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { style: "Candles", me: null, tier: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, age_group, family_id, avatar_url, username")
      .eq("id", user.id)
      .single();
    const isKid =
      profile?.age_group === "kids" ||
      (profile?.role === "child" && profile?.age_group !== "teens");

    if (!profile) return { style: isKid ? "Line" : "Candles", me: null, tier: null };

    const tier = await getFamilyTier(supabase, profile.family_id ?? null).catch(
      () => null
    );
    return {
      style: isKid ? "Line" : "Candles",
      me: {
        id: user.id,
        display_name: profile.display_name || "You",
        role: (profile.role as Role) || "parent",
        age_group: profile.age_group ?? null,
        family_id: profile.family_id ?? null,
        avatar_url: profile.avatar_url ?? null,
        username: profile.username ?? null,
      },
      tier,
    };
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    // Wrapped so nothing lands after unmount, and so no state is written
    // synchronously inside the effect body (which would cascade a render).
    void (async () => {
      const next = await resolveRole();
      if (!alive || !next) return;
      setStyle(next.style);
      setRoleLoaded(true);
      if (next.me) setMe(next.me);
      if (next.tier) setTier(next.tier);
    })();
    return () => {
      alive = false;
    };
  }, [resolveRole]);

  // Follow the URL back into the field when the symbol changes from outside the
  // form (a Try tile, a back button). This is React's own "adjust state while
  // rendering" pattern rather than an effect — an effect here would paint the
  // stale symbol for a frame and cascade a second render.
  const [trackedSymbol, setTrackedSymbol] = useState(shownSymbol);
  if (trackedSymbol !== shownSymbol) {
    setTrackedSymbol(shownSymbol);
    setInput(shownSymbol);
    setSuggestOpen(false);
  }

  // The mark on the desk — company identity + today's move for the shown symbol.
  useEffect(() => {
    const ac = new AbortController();
    fetchCompany(shownSymbol, true, ac.signal)
      .then((d) => {
        if (ac.signal.aborted) return;
        setMark({
          symbol: shownSymbol,
          company: d?.company ?? null,
          quote: d?.quote ?? null,
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) setMark({ symbol: shownSymbol, company: null, quote: null });
      });
    return () => ac.abort();
  }, [shownSymbol]);

  // One batched request for the whole "try these" strip.
  useEffect(() => {
    const ac = new AbortController();
    fetchQuotes(QUICK_BARE, ac.signal)
      .then((q) => {
        if (!ac.signal.aborted) setQuickQuotes(q);
      })
      .catch(() => {
        if (!ac.signal.aborted) setQuickQuotes({});
      });
    return () => ac.abort();
  }, []);

  // Debounced suggest against the real ticker universe.
  function onInputChange(v: string) {
    setInput(v);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = v.trim();
    if (q.length < 1) {
      setHits([]);
      setSuggestOpen(false);
      return;
    }
    setSuggesting(true);
    setSuggestOpen(true);
    suggestTimer.current = setTimeout(async () => {
      const r = await searchTickers(q).catch(() => [] as TickerHit[]);
      setHits(r.slice(0, 6));
      setSuggesting(false);
    }, 220);
  }

  function go(symbol: string) {
    const s = normalizeSymbol(symbol);
    if (!s) return;
    setSuggestOpen(false);
    router.replace(`/chart?symbol=${encodeURIComponent(s)}`);
  }

  function submitSymbol(e: React.FormEvent) {
    e.preventDefault();
    go(input);
  }

  const changePct = quote?.changePercent ?? null;
  const hasMove = typeof changePct === "number" && Number.isFinite(changePct);
  const moveTone = !hasMove
    ? "text-soft"
    : changePct > 0
      ? "text-price-up"
      : changePct < 0
        ? "text-price-down"
        : "text-soft";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      {/* ── IDENTITY + MARK ───────────────────────────────────────────────
          Canvas 03: the logo tile and the company name lead, then the price
          set as the largest number on the screen with the move beside it. */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Link
          href="/watchlist"
          className="f0-focus inline-flex items-center gap-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.16em] text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Watchlist
        </Link>

        {/* Board 03's identity row — logo tile, name, then the mark. */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CompanyLogo
              symbol={shownSymbol}
              name={company?.name ?? shownSymbol}
              size={40}
              rounded="rounded-[11px]"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[21px] font-extrabold leading-tight tracking-tight text-ink">
                {company?.name ?? shownSymbol}
              </h1>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                <span className="opacity-50">$</span>
                {shownSymbol}
                {company?.primaryExchange ? ` · ${company.primaryExchange}` : ""}
              </p>
            </div>
          </div>

          {/* The mark. LOADING is a pulsing measure; ABSENT is an honest dash. */}
          <div className="shrink-0 text-right">
            {markLoading ? (
              <div aria-busy="true" aria-label="Reading the mark">
                <div className="ml-auto h-7 w-32 animate-pulse rounded bg-sand" />
                <div className="ml-auto mt-2 h-3 w-24 animate-pulse rounded bg-sand/70" />
              </div>
            ) : (
              <>
                <p className="font-mono text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
                  {quote?.price != null ? `$${quote.price.toFixed(2)}` : "—"}
                </p>
                <p className={`mt-1.5 font-mono text-[12px] font-semibold tabular-nums ${moveTone}`}>
                  {hasMove
                    ? `${changePct > 0 ? "▲ " : changePct < 0 ? "▼ " : ""}${Math.abs(changePct).toFixed(2)}% today`
                    : "Move unavailable"}
                  <span className="ml-2 uppercase tracking-[0.14em] text-soft/70">delayed</span>
                </p>
              </>
            )}
          </div>
        </div>

        <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
          Practice reading charts — this is learning, not financial advice.
        </p>
      </m.header>

      {/* ── CONTROL CARD ──────────────────────────────────────────────────── */}
      {/* Search and style live inside one card, as the board draws its controls. */}
      <Card radius="md" className="mt-4 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="relative">
            <form onSubmit={submitSymbol} className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-soft" />
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onFocus={() => hits.length > 0 && setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 140)}
                placeholder="Symbol or company"
                aria-label="Chart symbol"
                autoComplete="off"
                className="w-40 bg-transparent font-mono text-[13px] uppercase tracking-[0.06em] text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-soft/70 focus:w-56"
              />
              <button
                type="submit"
                className={
                  isClub
                    ? "f0-focus f0-press shrink-0 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-[color:var(--accent-on)] transition-opacity hover:opacity-90"
                    : "f0-focus f0-press shrink-0 rounded-full bg-volt-500 px-3 py-1 text-[11px] font-extrabold text-[#1A1614] transition-colors hover:bg-volt-600"
                }
              >
                Load
              </button>
            </form>

            {/* Suggestions — real results from the ranked ticker universe,
                inside the same card object the control sits in. */}
            {suggestOpen && (
              <Card
                radius="sm"
                className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden p-1 shadow-lift"
              >
                {suggesting && hits.length === 0 ? (
                  <p className="flex items-center gap-2 px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching
                  </p>
                ) : hits.length === 0 ? (
                  <p className="px-3 py-3 text-[12.5px] leading-snug text-soft">
                    No listed company matches that. Try the ticker.
                  </p>
                ) : (
                  <div className="px-2">
                    {hits.map((h) => (
                      <button
                        key={h.ticker}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(h.ticker)}
                        className="f0-focus flex w-full items-center gap-2.5 border-b border-sand py-2.5 text-left last:border-b-0"
                      >
                        <span className="shrink-0 font-mono text-[12px] font-bold tracking-[0.04em] text-ink">
                          {h.ticker}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-soft">
                          {h.name}
                        </span>
                        {h.exchange && (
                          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft/70">
                            {h.exchange}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {roleLoaded && style && (
            <RangePills<ChartStyle>
              ranges={STYLE_OPTIONS}
              active={style}
              onSelect={setStyle}
              ariaLabel="Chart style"
            />
          )}
        </div>
      </Card>

      {/* ── TRY THESE ─────────────────────────────────────────────────────── */}
      {/* The canvas ticker tile, carrying a REAL delta. A symbol we could not
          get a quote for renders "—", never a fabricated flat. */}
      <div className="mt-3 flex items-center gap-3">
        {isClub ? (
          /* Terminal section label — white bold caps, never tiny gray mono. */
          <span className="shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            Try
          </span>
        ) : (
          <CardLabel tone="brand" className="shrink-0">
            Try
          </CardLabel>
        )}
        <TickerTileStrip size="sm" loading={quickLoading} loadingCount={6}>
          {QUICK_SYMBOLS.map((s) => {
            const bare = bareSymbol(s);
            return (
              <TickerTile
                key={s}
                ticker={bare}
                changePct={quickQuotes?.[bare]?.changePercent ?? null}
                size="sm"
                href={`/chart?symbol=${encodeURIComponent(s)}`}
              />
            );
          })}
        </TickerTileStrip>
      </div>

      {/* ── THE CHART ─────────────────────────────────────────────────────── */}
      {/* The media object, in the board's card frame. No fill of its own, so
          the embed's own surface is what you see and the pane is theme-correct
          by construction rather than by a dark: class. (`.chart-frame` is
          deliberately dark in BOTH themes — right for the simulator's
          lightweight-charts pane, wrong here, because this embed renders its
          own LIGHT theme on a light page.) */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={
          isClub
            ? // The dark well: card fill behind the pane, hairline edge, no
              // lifted shadow — a terminal instrument, not a floating sheet.
              "mt-3 min-h-0 flex-1 overflow-hidden rounded-[16px] border border-sand bg-card"
            : "mt-3 min-h-0 flex-1 overflow-hidden rounded-[18px] border border-sand shadow-soft"
        }
      >
        {roleLoaded && style ? (
          <TradingViewAdvancedChart symbol={urlSymbol} lineStyle={style === "Line"} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
          </div>
        )}
      </m.div>

      {/* THE PAGE FOOT. A chart teaches a read; it cannot teach the plan that
          follows one. One quiet line at the true bottom of the surface —
          suppressed for kids, teens and existing FTA members inside FtaDoor. */}
      <FtaDoor
        className="shrink-0"
        line="Reading the chart is the first half. FTA is the six weeks that turn a read into a plan."
      />

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
