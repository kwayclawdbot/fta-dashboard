"use client";

import Link from "next/link";

import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";
import { BrandTile } from "./board";

/**
 * WHAT THE CLUB IS SEEING — the CCDoors attention section.
 *
 * The old horizontal ranked-card strip is recomposed as the prototype's
 * ATTENTION GRAVITY list: a display-face section title, one framing sub-line,
 * and vertical rows — brand tile, ticker in Sora, a human line under it, and a
 * 4px attention bar whose fill is proportional to the row's real club
 * attention score (top row = 100%; if no scores exist the fill degrades to a
 * linear rank ramp so the ordering itself is still drawn).
 *
 * REAL DATA ONLY. The rows are the same trending ledger as before; the human
 * line is composed only from fields the row actually carries (company name,
 * distinct watchers) and states the ranking itself when neither exists.
 *
 * SECTORS HEAT GRID + ROTATION (the prototype's opening objects). The trending
 * rows now carry a real `sector` — classified server-side from
 * screener_metrics.sector (Polygon SIC) via src/lib/screener-sectors.ts — so
 * the grid aggregates the SAME attention ledger per sector: heat is each
 * sector's share of Club attention (distinct watcher counts, degrading to row
 * count when nobody watches yet), normalized against the hottest sector, and
 * the % line is the plain average day move of that sector's tickers (omitted
 * when no quote landed — never a fabricated 0.00%). The rotation row is the
 * same ranking read top-vs-bottom. Rows without a sector are skipped; zero
 * classified sectors renders no grid at all, exactly like the prototype's
 * continuous-encoding tiles: alpha, border and heat label ramp with the
 * normalized heat, no threshold buckets.
 *
 * The verbatim compliance line (`disclaimer`) still rides under the list: this
 * is the attention ranking, so it is the object that has to carry it.
 *
 * LOADING ≠ EMPTY: `loading` renders pulsing rows; zero rows after loading
 * renders the founding line.
 */

interface SectorHeat {
  name: string;
  /** 0–100, share of Club attention vs the hottest sector. */
  heat: number;
  /** Average day move across the sector's quoted tickers. null = no quotes. */
  avgChangePct: number | null;
  /** Normalized position over the set's real range, 0..1 (drives the ramp). */
  t: number;
}

/** Aggregate the trending ledger into per-sector attention heat. */
function deriveSectors(rows: TrendingRow[]): SectorHeat[] {
  const by = new Map<string, { watchers: number; count: number; changes: number[] }>();
  for (const r of rows) {
    if (!r.sector) continue;
    const e = by.get(r.sector) ?? { watchers: 0, count: 0, changes: [] };
    e.watchers += typeof r.watchers === "number" && r.watchers > 0 ? r.watchers : 0;
    e.count += 1;
    if (typeof r.changePct === "number" && Number.isFinite(r.changePct)) {
      e.changes.push(r.changePct);
    }
    by.set(r.sector, e);
  }
  if (by.size === 0) return [];

  // ONE attention unit for the whole grid: watcher counts when any exist,
  // otherwise plain row count — never a mix of the two across sectors.
  const totalWatchers = [...by.values()].reduce((s, e) => s + e.watchers, 0);
  const entries = [...by.entries()].map(([name, e]) => ({
    name,
    attention: totalWatchers > 0 ? e.watchers : e.count,
    avgChangePct:
      e.changes.length > 0
        ? e.changes.reduce((s, c) => s + c, 0) / e.changes.length
        : null,
  }));

  const max = Math.max(...entries.map((e) => e.attention), 1);
  const heats = entries
    .map((e) => ({
      name: e.name,
      heat: Math.max(1, Math.round((e.attention / max) * 100)),
      avgChangePct: e.avgChangePct,
      t: 0,
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6);

  // Continuous encoding over the set's REAL range (the prototype's rule):
  // a single sector — no range — sits at full intensity.
  const lo = Math.min(...heats.map((h) => h.heat));
  const hi = Math.max(...heats.map((h) => h.heat));
  for (const h of heats) h.t = hi > lo ? (h.heat - lo) / (hi - lo) : 1;
  return heats;
}

/** Signed one-decimal move for the sector tiles ("+2.4%" / "-0.8%"). */
function sectorPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1)}%`;
}

function SectorsHeatGrid({ sectors }: { sectors: SectorHeat[] }) {
  return (
    <div
      className="mt-3.5 grid grid-cols-3 gap-2"
      aria-label="Club attention by sector"
    >
      {sectors.map((s) => (
        <Link
          key={s.name}
          href="/discover"
          className="f0-focus f0-press rounded-[14px] border px-3.5 pb-3.5 pt-3.5 text-left"
          style={{
            borderColor: `color-mix(in srgb, var(--accent-solid) ${Math.round(
              (0.12 + s.t * 0.55) * 100
            )}%, transparent)`,
            background: `color-mix(in srgb, var(--accent-solid) ${Math.round(
              s.t * 24
            )}%, transparent)`,
          }}
        >
          <span className="block truncate font-display text-[12.5px] font-bold leading-[1.15] text-ink">
            {s.name}
          </span>
          <span
            className="mt-[7px] block font-display text-[17px] font-extrabold leading-none"
            style={{
              color: `color-mix(in srgb, var(--accent-solid) ${Math.round(
                (0.45 + s.t * 0.55) * 100
              )}%, transparent)`,
            }}
          >
            {s.heat}
          </span>
          {s.avgChangePct != null && (
            <span
              className={`mt-[5px] block font-mono text-[10.5px] font-medium leading-none tabular-nums ${
                s.avgChangePct >= 0 ? "text-price-up" : "text-price-down"
              }`}
            >
              {sectorPct(s.avgChangePct)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function RotationRow({ sectors }: { sectors: SectorHeat[] }) {
  // Top vs bottom of the SAME ranking: up to two names each, never overlapping.
  const intoCount = Math.min(2, Math.floor(sectors.length / 2));
  const into = sectors.slice(0, intoCount);
  const outOf = sectors.slice(-Math.min(2, sectors.length - intoCount));
  if (into.length === 0 || outOf.length === 0) return null;
  return (
    <div className="flex gap-[26px] pt-[22px]" aria-label="Sector rotation">
      {[
        { k: "Out of", list: outOf, cls: "text-price-down" },
        { k: "Into", list: into, cls: "text-price-up" },
      ].map(({ k, list, cls }) => (
        <div key={k} className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-soft">
            {k}
          </div>
          <div className={`mt-1.5 font-display text-[13.5px] font-bold leading-[1.25] ${cls}`}>
            {list.map((s) => s.name).join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

function whyLine(r: TrendingRow): string {
  const bits: string[] = [];
  if (r.company) bits.push(r.company);
  if (typeof r.watchers === "number" && r.watchers > 0)
    bits.push(`${r.watchers} watching`);
  return bits.join(" · ") || "Ranked by Club attention";
}

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 border-b border-sand py-[13px] motion-safe:animate-pulse"
      aria-hidden
    >
      <div className="h-[30px] w-[30px] shrink-0 rounded-[10px] bg-ink/10" />
      <div className="min-w-0 flex-1">
        <div className="h-2.5 w-14 rounded-full bg-ink/10" />
        <div className="mt-1.5 h-2 w-32 rounded-full bg-ink/[0.07]" />
        <div className="mt-[6px] h-1 w-full max-w-[220px] rounded-full bg-ink/[0.07]" />
      </div>
    </div>
  );
}

export default function TopInTheClub({
  trending,
  loading = false,
  isKid = false,
}: {
  trending?: TrendingResponse | null;
  loading?: boolean;
  isKid?: boolean;
}) {
  const all = trending?.rows ?? [];
  const rows = all.slice(0, 10);
  const total = trending?.totalCount ?? all.length;
  const topScore = rows[0]?.score ?? 0;
  // Sector heat + rotation, from the SAME ledger. Empty (no classifiable
  // sector on any row) renders neither block.
  const sectors = deriveSectors(all);

  return (
    <section aria-labelledby="club-top">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="club-top"
          className="min-w-0 font-display text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-ink"
        >
          What the Club is seeing
        </h2>
        {total > rows.length && (
          <Link
            href="/discover"
            className="f0-focus f0-press shrink-0 rounded-md text-[11px] font-semibold text-accent"
          >
            See all
          </Link>
        )}
      </div>
      <p className="mt-[6px] text-[12.5px] leading-snug text-soft">
        Where attention is pooling this morning, not what moved most.
      </p>

      {/* SECTORS HEAT GRID — real Club attention per sector, ramped orange */}
      {sectors.length > 0 && <SectorsHeatGrid sectors={sectors} />}

      {/* ROTATION — the same ranking read top-vs-bottom */}
      {sectors.length > 0 && <RotationRow sectors={sectors} />}

      {/* the board's section labels are white bold caps, not soft gray */}
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
        Attention gravity
      </p>

      {loading ? (
        <div className="mt-1" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
          <span className="sr-only">Loading the Club ranking</span>
        </div>
      ) : rows.length > 0 ? (
        <div className="mt-1" aria-label="Tickers ranked by Club attention">
          {rows.map((r, i) => {
            // Fill is the row's REAL attention score against the leader; when
            // no score exists (a feed gap) it degrades to a linear rank ramp
            // so the ordering itself is still legible.
            const fill =
              topScore > 0
                ? Math.max(8, Math.round((r.score / topScore) * 100))
                : Math.max(
                    8,
                    Math.round(((rows.length - i) / rows.length) * 100)
                  );
            return (
              <Link
                key={r.ticker}
                href={`/research/${encodeURIComponent(r.ticker)}`}
                className="f0-focus f0-press flex items-center gap-3 border-b border-sand py-[13px] last:border-b-0"
              >
                <BrandTile ticker={r.ticker} size={30} radius={10} fontSize={13} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[13.5px] font-bold leading-none text-ink">
                    {r.ticker}
                  </span>
                  <span className="mt-[4px] block truncate text-[11.5px] leading-snug text-soft">
                    {whyLine(r)}
                  </span>
                  <span
                    className="mt-[6px] block h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-sand"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${fill}%`,
                        background: "var(--accent-solid)",
                      }}
                    />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          {isKid
            ? "No company has caught the Club's eye yet. Pick one you know and it lands here first."
            : "No ticker has drawn the Club's attention yet. Rate one and yours is the first on this board."}
        </p>
      )}

      {trending?.disclaimer && (
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
          {trending.disclaimer}
        </p>
      )}
    </section>
  );
}
