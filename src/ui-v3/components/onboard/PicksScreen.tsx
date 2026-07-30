"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  searchTickers,
  fetchQuotes,
  type TickerHit,
  type MarketQuote,
} from "@/lib/market/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import { WATCHLIST_XP } from "@/lib/watchlist";
import type { PicksVM } from "@/ui-v3/onboard-data";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import TickerTile from "@/ui-v3/components/TickerTile";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import FieldInput from "./FieldInput";
import PillButton from "./PillButton";
import styles from "./PicksScreen.module.css";

/**
 * The watchlist seeding step. THIS SCREEN HAS NO ARTBOARD.
 *
 * Per the grammar's rule 9, it invents nothing: every element is a primitive
 * that already exists on a board.
 *
 *   script headline + 13px --text-dim subtitle   — "11 Pricing", "15 Screener"
 *   the search field                             — "10 Login" (FieldInput)
 *   a result row: tile, mono ticker, name, mark  — "15 Discover Screener"
 *   SectionEyebrow over the chosen list          — every board
 *   EmptyNote when nothing is chosen             — the shared empty pattern
 *   pinned bar with one accent pill              — "19 Alert Setup", "22 Belts"
 *
 * The ＋ / ✓ marks use --positive, which is the colour "01 Home" already gives
 * the add affordance in a signal row — not a second accent (grammar §4).
 *
 * WHY IT WRITES THE WAY IT DOES. There is no server route that inserts into
 * `family_watchlist`: all three existing add flows (the watchlist board, the
 * screener, the research canvas) insert from the browser with the user-scoped
 * client, so RLS enforces the family scope. This does the same thing with the
 * same column set, so a ticker seeded here is byte-identical to one added on the
 * old watchlist page — which is what makes it show up in Home's Your Signals
 * (the foryou core reads exactly this table) and on /v3/watch.
 *
 * The free cap is a BEFORE INSERT trigger (`enforce_free_watchlist_cap`), so it
 * fires no matter who writes. `remaining` lets the screen say so up front, and
 * the raised `WATCHLIST_FREE_CAP` is caught below so the failure is a sentence
 * rather than a stack trace.
 */
export default function PicksScreen({ model, done }: { model: PicksVM; done: string }) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TickerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picks, setPicks] = useState<TickerHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const already = useRef(new Set(model.existing));

  /*
   * Typeahead against the real ticker universe: /api/market/search is a
   * `screener_metrics` lookup (exact ticker + prefix/name candidates, ranked),
   * the same endpoint the old watchlist add sheet uses. Debounced at 300ms and
   * gated at 2 characters, matching that flow; every in-flight request is
   * aborted when the next keystroke lands so results can't arrive out of order.
   */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchTickers(q, controller.signal);
        setHits(results);
      } catch {
        /* aborted or offline — the list simply does not change */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const toggle = useCallback((hit: TickerHit) => {
    setError("");
    setPicks((current) =>
      current.some((p) => p.ticker === hit.ticker)
        ? current.filter((p) => p.ticker !== hit.ticker)
        : [...current, hit]
    );
  }, []);

  async function save() {
    if (picks.length === 0 || !model.familyId) return;
    setSaving(true);
    setError("");

    const supabase = createClient();

    /*
     * Snapshot the price at add time, exactly as the three existing add flows
     * do — it is the baseline every "% since we added it" reading is measured
     * against. Best-effort: a missing quote saves a null and the cron backfills.
     */
    const quotes = await fetchQuotes(picks.map((p) => p.ticker)).catch(
      () => ({}) as Record<string, MarketQuote>
    );
    const now = new Date().toISOString();

    for (const pick of picks) {
      const { data, error: insertError } = await supabase
        .from("family_watchlist")
        .insert({
          family_id: model.familyId,
          company_name: pick.name || pick.ticker,
          ticker: pick.ticker,
          status: "watch",
          champion_id: model.userId,
          snapshot_price: quotes[pick.ticker]?.price ?? null,
          snapshot_at: now,
        })
        .select("id")
        .single();

      if (insertError) {
        setSaving(false);
        setError(
          insertError.message.includes("WATCHLIST_FREE_CAP")
            ? "The free plan holds 5 tickers. Remove one, or join the Club for an unlimited watchlist."
            : insertError.message
        );
        return;
      }

      // Same XP as any other watchlist add, keyed to the row so it can only ever
      // be granted once. Non-fatal by design — a failed award never blocks a save.
      if (data?.id) {
        const ref = `watchlist:${data.id}`;
        if (!(await hasXpForRef(supabase, model.userId, "bonus", ref))) {
          await awardXp(supabase, model.userId, "bonus", WATCHLIST_XP.ADD, ref);
        }
      }
    }

    router.replace(done);
    router.refresh();
  }

  // No family row means no watchlist to write to. Say so rather than offering a
  // search box whose every save would fail on RLS.
  if (!model.familyId) {
    return (
      <AppShell nav={false}>
        <h1 className={styles.headline}>pick three</h1>
        <EmptyNote>
          Your watchlist opens once your family is set up. You can start from Home and add
          names any time.
        </EmptyNote>
      </AppShell>
    );
  }

  const chosen = new Set(picks.map((p) => p.ticker));
  const capped = model.remaining !== null && picks.length >= model.remaining;

  return (
    <AppShell
      nav={false}
      bar={
        <div className={styles.barStack}>
          <PillButton onClick={save} disabled={picks.length === 0 || saving} size="bar">
            {saving
              ? "Saving…"
              : picks.length === 0
                ? `Pick ${model.target} to start`
                : `Add ${picks.length} to my watchlist`}
          </PillButton>
          <button type="button" className={styles.skip} onClick={() => router.replace(done)}>
            Skip for now
          </button>
        </div>
      }
    >
      <h1 className={styles.headline}>pick three</h1>
      <p className={styles.subtitle}>
        Three names you actually care about. Your Home, your signals and your alerts all
        build from these — and you can change them whenever you like.
      </p>

      <div className={styles.search}>
        <FieldInput
          label="Search for a company or ticker"
          type="search"
          placeholder="Search a company or ticker"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {query.trim().length >= 2 ? (
        <section className={styles.section}>
          <SectionEyebrow
            labelTone="accent"
            caption={searching ? "Searching…" : `${hits.length} matches`}
            captionGap={2}
          >
            Results
          </SectionEyebrow>
          {hits.length === 0 && !searching ? (
            <EmptyNote>No ticker matches that. Try the company name.</EmptyNote>
          ) : (
            <div className={styles.list}>
              {hits.map((hit) => {
                const owned = already.current.has(hit.ticker);
                const picked = chosen.has(hit.ticker);
                return (
                  <button
                    key={hit.ticker}
                    type="button"
                    className={styles.row}
                    onClick={() => !owned && toggle(hit)}
                    disabled={owned || (capped && !picked)}
                  >
                    <TickerTile ticker={hit.ticker} size="sm" />
                    <span className={styles.ticker}>{hit.ticker}</span>
                    <span className={styles.name}>{hit.name}</span>
                    <span className={picked ? styles.picked : styles.add} aria-hidden="true">
                      {owned ? "ON LIST" : picked ? "✓" : "＋"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section className={styles.section}>
        <SectionEyebrow
          labelTone="accent"
          caption={`${picks.length} of ${model.target}`}
          captionGap={2}
        >
          Your picks
        </SectionEyebrow>
        {picks.length === 0 ? (
          <EmptyNote>
            Nothing picked yet. Search above for a company you already have an opinion
            about — that is the one worth watching.
          </EmptyNote>
        ) : (
          <div className={styles.list}>
            {picks.map((pick) => (
              <button
                key={pick.ticker}
                type="button"
                className={styles.row}
                onClick={() => toggle(pick)}
              >
                <TickerTile ticker={pick.ticker} size="sm" />
                <span className={styles.ticker}>{pick.ticker}</span>
                <span className={styles.name}>{pick.name}</span>
                <span className={styles.remove} aria-hidden="true">
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}
