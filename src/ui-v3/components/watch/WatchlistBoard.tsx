"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { WatchlistRowVM } from "@/ui-v3/watch-data";
import styles from "./WatchlistBoard.module.css";

/**
 * The member's board, with the two mutations that really exist for it.
 *
 * WRITE PATH. There is no watchlist API route in this application. The old app
 * writes `family_watchlist` DIRECTLY from the browser client under RLS — see the
 * star toggle in `src/app/(dashboard)/research/[ticker]/ResearchCanvas.tsx` —
 * and the table's policies are what authorise it: a member may insert, update
 * and delete rows whose `family_id` matches their own profile's. This component
 * uses that same path with the same column set rather than inventing a route or
 * a table, so both boards stay one board.
 *
 * The symbol universe for the add field is `GET /api/market/search`, which ranks
 * against `screener_metrics` — the same suggest endpoint every other search bar
 * in the app uses.
 *
 * FLAGGED FOR PREVIEW (no artboard draws either of these):
 *  1. The text INPUT. No board in the mockup set contains one, so it is rendered
 *     as the flat card the feed composer already draws, with the field itself
 *     unstyled inside it — the card is the border, the input adds no chrome of
 *     its own. If an artboard for a field ever lands, this is what it replaces.
 *  2. The REMOVE glyph. Every row here is on the watchlist by definition, so a
 *     star that is always filled would be decoration, not state — the honest
 *     affordance is removal, drawn with the ✕ the screener's filter chips
 *     already use, at the same --text-faint weight.
 */

interface Suggestion {
  ticker: string;
  name: string | null;
}

export default function WatchlistBoard({
  rows,
  familyId,
  viewerId,
  interactive,
}: {
  rows: WatchlistRowVM[];
  familyId: string | null;
  viewerId: string | null;
  interactive: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(rows);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The server is the source of truth: a fresh view model replaces local state.
  useEffect(() => setItems(rows), [rows]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  /* Typeahead. Debounced, and every response is stamped with the query it
     answered so a slow reply can never overwrite a newer one. */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { results?: Suggestion[] };
        if (live) setHits((json.results ?? []).slice(0, 6));
      } catch {
        if (live) setHits([]);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const owned = useMemo(() => new Set(items.map((i) => i.ticker)), [items]);

  const add = useCallback(
    async (hit: Suggestion) => {
      if (!interactive || !familyId || busy) return;
      const ticker = hit.ticker.toUpperCase();
      if (owned.has(ticker)) {
        setAdding(false);
        setQuery("");
        return;
      }
      setBusy(true);
      setFailed(null);
      const { data, error } = await supabase
        .from("family_watchlist")
        .insert({
          family_id: familyId,
          ticker,
          // NOT NULL on the table. The suggest endpoint carries the screener's
          // own name; a symbol with none falls back to itself, never to blank.
          company_name: hit.name || ticker,
          // Everything enters the ladder at `watch` — the status ladder in
          // src/lib/watchlist.ts, and the table's own default.
          status: "watch",
          champion_id: viewerId,
          // snapshot_at without a snapshot_price is the documented shape: the
          // daily cron backfills the price from the first available close
          // (migration 097). Writing a price this screen has not read would be
          // a made-up entry basis.
          snapshot_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      setBusy(false);
      if (error || !data) {
        setFailed(`Couldn't add ${ticker}. Nothing was saved.`);
        return;
      }
      setItems((prev) => [
        {
          id: (data as { id: string }).id,
          ticker,
          name: hit.name,
          // This screen has read no quote for a symbol it just added, so the
          // row goes up without one rather than with a zero. The refresh below
          // re-runs getWatchlist() and the numbers land a beat later.
          priceLabel: null,
          changePct: null,
          watchers: null,
          monitored: true,
          href: `/v3/ticker/${ticker}`,
        },
        ...prev,
      ]);
      setAdding(false);
      setQuery("");
      setHits([]);
      startTransition(() => router.refresh());
    },
    [supabase, router, interactive, familyId, viewerId, busy, owned]
  );

  const remove = useCallback(
    async (row: WatchlistRowVM) => {
      if (!interactive || busy) return;
      setBusy(true);
      setFailed(null);
      const before = items;
      setItems((prev) => prev.filter((i) => i.id !== row.id));
      const { error } = await supabase.from("family_watchlist").delete().eq("id", row.id);
      setBusy(false);
      if (error) {
        // The write failed, so the list must go back to the truth.
        setItems(before);
        setFailed(`Couldn't remove ${row.ticker}. It is still on your board.`);
        return;
      }
      startTransition(() => router.refresh());
    },
    [supabase, router, interactive, busy, items]
  );

  const caption =
    items.length === 0
      ? undefined
      : `${items.length} symbol${items.length === 1 ? "" : "s"} · newest first`;

  return (
    <>
      <div className={styles.section}>
        <SectionEyebrow caption={caption}>Your board</SectionEyebrow>
      </div>

      {interactive ? (
        <div className={styles.addRegion}>
          {adding ? (
            <div className={styles.field}>
              <input
                ref={inputRef}
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAdding(false);
                    setQuery("");
                  }
                  if (e.key === "Enter" && hits[0]) void add(hits[0]);
                }}
                placeholder="Search a symbol or company"
                aria-label="Add a ticker to your watchlist"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => {
                  setAdding(false);
                  setQuery("");
                }}
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <button type="button" className={styles.addChip} onClick={() => setAdding(true)}>
              + Add ticker
            </button>
          )}

          {adding && hits.length > 0 ? (
            <div className={styles.hits}>
              {hits.map((hit) => (
                <button
                  key={hit.ticker}
                  type="button"
                  className={styles.hit}
                  onClick={() => void add(hit)}
                  disabled={busy}
                  aria-label={
                    owned.has(hit.ticker.toUpperCase())
                      ? `${hit.ticker} is already on your watchlist`
                      : `Add ${hit.ticker} to your watchlist`
                  }
                >
                  <TickerTile ticker={hit.ticker} size="sm" />
                  <span className={styles.hitCopy}>
                    <span className={styles.symbol}>{hit.ticker}</span>
                    {hit.name ? <span className={styles.hitName}>{hit.name}</span> : null}
                  </span>
                  <span className={styles.hitMark} aria-hidden="true">
                    {owned.has(hit.ticker.toUpperCase()) ? "✓" : "+"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {failed ? (
        <p className={styles.failed} role="alert">
          {failed}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyNote>
          Nothing on your board yet. Add a symbol and it starts showing up here, in Kai&rsquo;s
          morning alerts, and everywhere the Club talks about it.
        </EmptyNote>
      ) : (
        <div className={styles.list}>
          {items.map((row) => {
            const parts = [
              row.name,
              row.watchers === null ? null : `${row.watchers} watching`,
              row.monitored ? null : "Monitoring paused",
            ].filter(Boolean);
            return (
              <div key={row.id} className={styles.row}>
                <Link href={row.href} className={styles.face}>
                  <TickerTile ticker={row.ticker} size="sm" />
                  <span className={styles.copy}>
                    <span className={styles.symbol}>{row.ticker}</span>
                    {parts.length > 0 ? (
                      <span className={styles.caption}>{parts.join(" · ")}</span>
                    ) : null}
                  </span>
                  <span className={styles.price} data-numeric>
                    {row.priceLabel ?? ""}
                  </span>
                  {row.changePct !== null ? (
                    <span
                      className={`${styles.change} ${row.changePct < 0 ? styles.changeDown : ""}`}
                      data-numeric
                    >
                      {row.changePct < 0 ? "▼" : "▲"}
                      {Math.abs(row.changePct).toFixed(1)}%
                    </span>
                  ) : (
                    <span className={styles.change} />
                  )}
                </Link>
                {interactive ? (
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => void remove(row)}
                    disabled={busy}
                    aria-label={`Remove ${row.ticker} from your watchlist`}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
