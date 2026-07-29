"use client";

import { useEffect, useMemo, useState } from "react";

import StandaloneDiscover from "@/components/discover/StandaloneDiscover";
import type { NewsCardData } from "@/lib/news/types";
import type { CommunityBoardSeed } from "@/lib/community-watchlist-board";
import type { DiscoverExtras } from "@/lib/discover";
import type { TrendingResponse } from "@/lib/clubhome/contract";

type Tab = "foryou" | "screener" | "trending";

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
  showScreener?: boolean;
  initialTab?: Tab;
  initialQuery?: string;
}

/**
 * One source of truth for Discover. The standalone mockup component owns the
 * For You, Screener and Trending sub-tabs; this bridge only joins the live Club
 * ledger to the server-rendered newsroom and personalization seeds.
 */
export default function DiscoverClient(props: DiscoverClientProps) {
  const {
    initialNews,
    extras,
    showScreener = true,
    initialTab = "foryou",
    initialQuery = "",
  } = props;
  const { trending, loading } = useClubLedger();
  const rows = useMemo(() => trending?.rows ?? [], [trending]);

  return (
    <StandaloneDiscover
      rows={rows}
      loading={loading}
      news={initialNews}
      extras={extras}
      showScreener={showScreener}
      initialTab={initialTab}
      initialQuery={initialQuery}
    />
  );
}

function useClubLedger() {
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/club/trending", {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<TrendingResponse>) : null))
      .then((data) => {
        if (data) setTrending(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return { trending, loading };
}
