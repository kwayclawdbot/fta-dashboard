"use client";

import { useMemo, useState } from "react";
import type { Sector } from "@/lib/screener-sectors";
import {
  applyScreen,
  chipsFor,
  summaryFor,
  withoutFilter,
  type FilterKey,
  type ScreenerCandidateVM,
  type ScreenerFilters,
} from "@/ui-v3/screener-filter";
import FilterChips from "./FilterChips";
import FilterSheet from "./FilterSheet";
import ScreenerResults from "./ScreenerResults";

/**
 * THE INTERACTIVE HALF of board 15 — the filter rail, the panel behind
 * "+ Filter", and the result list that answers to both.
 *
 * This is the only client component on the screener. Everything above it
 * (header, tabs) and below it (the stance cards, the trending chips) stays a
 * server component, because none of it changes when a chip does: the cards are
 * the CLUB's stance over the whole ledger, not a view of the current screen.
 *
 * The screen is applied here rather than re-fetched. `candidates` is the club's
 * attention ledger joined to screener_metrics — tens of rows at this size — so a
 * chip change is a filter over an array the browser already has, and the rows
 * update in the same frame as the chip disappears. The predicates themselves
 * live in src/ui-v3/screener-filter.ts and are shared verbatim with the adapter,
 * so there is no second definition of what a chip means.
 *
 * DISPLAY CAP. Every match is listed, up to RESULT_LIMIT. The count line above
 * the list therefore describes the list beneath it — the old surface reported a
 * total and drew three, which read as a screener hiding eleven matches.
 */
const RESULT_LIMIT = 25;

export default function ScreenerBoard({
  candidates,
  sectors,
  initialFilters,
}: {
  candidates: ScreenerCandidateVM[];
  sectors: Sector[];
  initialFilters: ScreenerFilters;
}) {
  const [filters, setFilters] = useState<ScreenerFilters>(initialFilters);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => applyScreen(candidates, filters), [candidates, filters]);
  const chips = useMemo(() => chipsFor(filters), [filters]);
  const shown = matches.slice(0, RESULT_LIMIT);

  const remove = (key: FilterKey) => setFilters((f) => withoutFilter(f, key));

  return (
    <>
      <FilterChips
        chips={chips}
        onRemove={remove}
        onOpen={() => setOpen((v) => !v)}
        open={open}
      />
      {open ? (
        <FilterSheet
          filters={filters}
          sectors={sectors}
          onChange={setFilters}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <ScreenerResults rows={shown} summary={summaryFor(matches.length)} />
    </>
  );
}
