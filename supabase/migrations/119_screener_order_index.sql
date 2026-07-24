-- 119_screener_order_index.sql  (Lane 12B — page-speed pass)
--
-- The screener page (and the research aggregate's momentum read) fetch
-- screener_metrics filtered by `price IS NOT NULL` and ordered by
-- `mcap DESC NULLS LAST, ticker ASC`, paged 1000 rows at a time. EXPLAIN showed
-- the default first page doing a Seq Scan over all ~11.5k rows + a top-N
-- heapsort (~161ms) — the existing single-column idx_screener_mcap could not
-- serve the compound ordering + partial filter, so the planner skipped it.
--
-- A partial compound index matching the exact sort key lets the planner do an
-- ordered Index Scan and drop the sort node entirely: the paint-gating first
-- page fell from ~161ms to ~4ms (measured), and every subsequent page is an
-- ordered scan too. Partial (WHERE price IS NOT NULL) so it only covers the
-- rows the screener ever reads.
CREATE INDEX IF NOT EXISTS idx_screener_price_mcap_ticker
  ON public.screener_metrics (mcap DESC NULLS LAST, ticker ASC)
  WHERE price IS NOT NULL;
