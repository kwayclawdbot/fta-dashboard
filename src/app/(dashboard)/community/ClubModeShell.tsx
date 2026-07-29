"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { deriveRegister } from "@/lib/register";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import type { ChatMe } from "@/lib/useChatRoom";
import { useLiveEventsState, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import StandaloneClubFeed from "./StandaloneClubFeed";
import ClubRooms from "./ClubRooms";
import ClubDiscussions from "./ClubDiscussions";
import ClubLiveTab from "./ClubLiveTab";
import { FIC_ROOM_ID, FREE_LOUNGE_ROOM_ID } from "./rooms";
import type { TrendingRow } from "@/lib/clubhome/contract";

/**
 * THE CLUB — Club Screens 01/02/06/07, built as drawn.
 *
 * The standalone Club Feed board is the source of truth: script masthead,
 * circular utilities, orange active pill, 96px happening-now rings, then the
 * compact card feed. Real post and market data are kept underneath that frame.
 *
 * The boards reach the Lounge and the Live rooms from the phone's bottom bar. On
 * this surface there is no bottom bar to reach them from, so LOUNGE and LIVE ride
 * the same strip — one navigation, in the drawn grammar, rather than a second
 * control competing with it. CHANGED MY MIND is a route (it is server-seeded), so
 * it is a link wearing a tab.
 *
 */

type Mode = "feed" | "discussions" | "lounge" | "live";

export default function ClubModeShell({
  initialData,
  demoEvents = false,
}: {
  initialData: CommunityFeedSeed | null;
  /** preview/dev only — surface fixture live_events so the Live mode + on-air
   *  rule are reviewable before the S2.5 backend lands. */
  demoEvents?: boolean;
}) {
  const searchParams = useSearchParams();
  // Go-live deep-link (/club?live={id} → /community?mode=live&live={id}): the
  // push lands here and opens the Live tab focused on that room.
  const liveParam = searchParams.get("live");
  const initialMode = ((): Mode => {
    const m = searchParams.get("mode");
    if (liveParam) return "live";
    return m === "lounge" || m === "live" || m === "discussions" ? m : "feed";
  })();
  const [mode, setMode] = useState<Mode>(initialMode);

  const me = initialData?.me ?? null;
  const tier = initialData?.myTier ?? "fic";
  const register = deriveRegister(me);
  const isKid = register === "kid";
  const chatMe: ChatMe | null = me
    ? {
        id: me.id,
        display_name: me.display_name,
        role: me.role,
        age_group: me.age_group ?? null,
        family_id: me.family_id ?? null,
        avatar_url: me.avatar_url ?? null,
        username: me.username ?? null,
      }
    : null;

  // The room the member is standing in. Lifted here so the coloured grid on
  // Discussions and the pill rail in the Lounge stay one selection, not two.
  const [roomId, setRoomId] = useState<string>(
    tier === "free" ? FREE_LOUNGE_ROOM_ID : FIC_ROOM_ID
  );

  // LOADING IS NOT EMPTY: the live tab owns "Nobody is on the air." at
  // display size, so it needs the in-flight signal, not just an empty array.
  const { events, loading: eventsLoading } = useLiveEventsState({ fixtures: demoEvents });
  const showLive = !isKid;
  const primaryLive = showLive ? primaryLiveEvent(events) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  const liveCount = showLive
    ? events.filter((e) => e.status === "live" || e.status === "starting_soon").length
    : 0;

  const [marketRows, setMarketRows] = useState<TrendingRow[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/club/trending", { signal: ctrl.signal, headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setMarketRows(payload?.rows ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const happening = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of initialData?.posts ?? []) {
      for (const ticker of post.ticker_tags ?? []) {
        const symbol = ticker.toUpperCase();
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      }
    }
    const fromPosts = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ticker, count]) => ({ ticker, label: `${ticker} discussion`, detail: `${count} ${count === 1 ? "take" : "takes"}` }));
    const seen = new Set(fromPosts.map((item) => item.ticker));
    for (const row of marketRows) {
      if (seen.has(row.ticker)) continue;
      fromPosts.push({
        ticker: row.ticker,
        label: row.company || `${row.ticker} discussion`,
        detail: (row.watchers ?? 0) > 0 ? `${row.watchers!.toLocaleString()} watching` : "Live market",
      });
      seen.add(row.ticker);
      if (fromPosts.length >= 3) break;
    }
    return fromPosts.slice(0, 3);
  }, [initialData?.posts, marketRows]);

  function selectMode(next: Mode) {
    setMode(next);
    try {
      const url = new URL(window.location.href);
      if (next === "feed") url.searchParams.delete("mode");
      else url.searchParams.set("mode", next);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="cc-app-screen mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[390px] px-[18px] pb-20 pt-[18px] sm:rounded-[34px] sm:border sm:border-[#2A2530]">
      <header className="flex items-center justify-between">
        <h1 className="script-mark text-[34px] leading-none text-[#F4F0EC]">
          {mode === "lounge" ? "lounge" : mode === "live" ? "live" : "club"}
        </h1>
        <div className="flex gap-[9px]">
          {!isKid && (
            <Link href="/community/compose" aria-label="Share your take" className="cc-app-card grid h-[34px] w-[34px] place-items-center rounded-full text-[#C8C2CE]">
              <Plus className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          )}
          <Link href="/discover" aria-label="Search" className="cc-app-card grid h-[34px] w-[34px] place-items-center rounded-full text-[#C8C2CE]">
            <Search className="h-[15px] w-[15px]" strokeWidth={2} />
          </Link>
        </div>
      </header>

      <nav className="mt-[14px] flex items-center gap-[18px]" aria-label="The Club">
        <button type="button" onClick={() => selectMode("feed")} className={`rounded-full px-[14px] py-[5px] text-[11px] font-extrabold uppercase tracking-[.06em] ${mode === "feed" ? "bg-[#FF7A1A] text-[#0D0B0E]" : "px-0 text-[#8F8894]"}`}>Feed</button>
        <Link href="/circles" className="text-[12px] font-semibold uppercase tracking-[.04em] text-[#8F8894]">Circles</Link>
        {showLive && (
          <button type="button" onClick={() => selectMode("live")} className={`flex items-center gap-1.5 rounded-full text-[12px] font-semibold uppercase tracking-[.04em] ${mode === "live" ? "bg-[#FF7A1A] px-[13px] py-[5px] font-extrabold text-[#0D0B0E]" : "text-[#8F8894]"}`}>
            {liveCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#FF4D6D]" />}
            Live
          </button>
        )}
      </nav>

      {mode === "feed" && happening.length > 0 && (
        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">Happening now</h2>
            <button type="button" onClick={() => selectMode("discussions")} className="text-[10.5px] font-bold text-[#FF9A4D]">See all</button>
          </div>
          <div className="mt-3 flex justify-between gap-4 px-1">
            {happening.map((item, index) => (
              <Link key={item.ticker} href={`/research/${encodeURIComponent(item.ticker)}`} className="w-[104px] shrink-0 text-center">
                <span className={`mx-auto grid h-24 w-24 place-items-center rounded-full border-[3px] bg-[#101408] text-[26px] font-extrabold ${index === 0 ? "border-[#4AE383] text-[#76B900] shadow-[0_0_14px_rgba(74,227,131,.15)]" : index === 1 ? "border-[#A66BFF] text-[#C9B5FF]" : "border-[#FF7A1A] text-[#FF4D6D] shadow-[0_0_14px_rgba(255,122,26,.15)]"}`}>
                  {item.ticker.slice(0, 1)}
                </span>
                <span className="mt-2 block truncate text-[11px] font-bold text-[#F4F0EC]">{item.label}</span>
                <span className="mt-0.5 block truncate text-[9px] text-[#8F8894]">{item.detail}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Amendment #2 — the on-air rule stays, now as the board's own object: a
          near-black strip directly under the tabs that hands the member into the
          Live screen. It renders only when a room is genuinely on the air. */}
      {liveNow && mode !== "live" && (
        <button
          type="button"
          onClick={() => selectMode("live")}
          className="f0-focus mt-4 flex w-full items-center gap-2.5 rounded-[12px] bg-[#14110F] px-3.5 py-2.5 text-left transition-opacity hover:opacity-90"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="shrink-0 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-volt-300">
            {liveNow.status === "live" ? "On air" : "Starting"}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[13px] font-bold text-[#F7F3EA]">
            {liveNow.title}
          </span>
          <span className="shrink-0 rounded-[6px] bg-volt-500 px-2.5 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-white">
            Join
          </span>
        </button>
      )}

      <div className="mt-4">
        {mode === "feed" && (
          <StandaloneClubFeed initialData={initialData} />
        )}

        {mode === "discussions" && (
          <ClubDiscussions
            posts={initialData?.posts ?? []}
            meId={me?.id ?? null}
            tier={tier}
            roomId={roomId}
            onOpenRoom={(id) => {
              setRoomId(id);
              selectMode("lounge");
            }}
          />
        )}

        {mode === "lounge" && (
          <ClubRooms me={chatMe} tier={tier} activeId={roomId} onSelect={setRoomId} />
        )}

        {mode === "live" && showLive && (
          <ClubLiveTab
            events={events}
            loading={eventsLoading}
            focusId={liveParam}
            onGoToLounge={() => selectMode("lounge")}
          />
        )}
      </div>
    </div>
  );
}
