import { Check, Minus } from "lucide-react";
import { PRICING_MATRIX } from "@/lib/entitlements";
import ScrollRow from "@/components/canvas2/ScrollRow";

/**
 * The binding free/paid comparison, rendered straight from the single source of
 * truth (PRICING_MATRIX in src/lib/entitlements/features.ts) so the pricing page
 * and the in-app walls can never drift. Three columns: Cheat Code Free /
 * Cheat Code Club $99 / FTA. No follow-graph row (it does not exist yet).
 *
 * Cell rules: "✓" → check glyph, "—" → muted dash, anything else → the verbatim
 * copy (free = participation verbs, Club = intelligence verbs). An FTA cell falls
 * back to its Club cell ("Everything in Club") unless it names something extra.
 *
 * TWO FORMS, ONE SOURCE (B8). A 640px-wide table in a 326px viewport put BOTH
 * paid columns off-screen with nothing on the page to say they were there — on
 * the one surface whose whole job is showing a member what $99 buys. Aligned
 * columns are still the right form where there is room for them, so the table
 * survives at ≥640px (now inside a ScrollRow, so if it ever does overflow the
 * edge says so instead of shearing). Below that it becomes what it always was
 * underneath: three tiers, each listing what it includes.
 *
 * NOT A REWRITE OF THE COPY. Every commercial string — the tier names, the
 * prices, "What you get", and every cell — is the same value read from the same
 * constant in both forms. The stacked form introduces no words of its own.
 */

/** The three columns, declared once so the two forms cannot drift apart. */
const TIERS = [
  { key: "free" as const, name: "Cheat Code Free", price: "$0", accent: false },
  { key: "club" as const, name: "Cheat Code Club", price: "$99/mo", accent: true },
  { key: "fta" as const, name: "FTA", price: "Advanced upgrade", accent: false },
];

type TierKey = (typeof TIERS)[number]["key"];
type MatrixRow = (typeof PRICING_MATRIX)[number];

/** What a tier shows for a row — FTA inherits Club unless it names more. */
function valueFor(row: MatrixRow, key: TierKey): string {
  if (key === "free") return row.free;
  if (key === "club") return row.club;
  return row.fta ?? (row.club === "—" ? "—" : "✓");
}

function Cell({ value, accent }: { value: string; accent?: boolean }) {
  if (value === "✓")
    return (
      <span className="inline-flex items-center justify-center">
        {/* COLOUR LAW: green is reserved for market price. An "included" tick
            is not a price, so the free column's check is ink and the Club
            column's is the brand accent. */}
        <Check className={`h-4 w-4 ${accent ? "text-gold-600" : "text-ink"}`} />
      </span>
    );
  if (value === "—")
    return <Minus className="mx-auto h-4 w-4 text-soft/40" aria-label="Not included" />;
  return <span className="text-[13px] leading-snug text-ink">{value}</span>;
}

/* ── Under 640px: one card per tier ─────────────────────────────────────────
   The rows a tier does NOT include stay in its card, carrying the same muted
   dash the table uses. A comparison that only ever lists what you get is a
   brochure; the shape of each offer is the point. */
function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  return (
    <div className={`club-b-card p-4 ${tier.accent ? "club-b-card-lead" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-sand pb-3">
        <p
          className={`font-display text-sm font-bold ${
            tier.accent ? "text-gold-700" : "text-ink"
          }`}
        >
          {tier.name}
        </p>
        <p className="text-xs font-normal text-soft">{tier.price}</p>
      </div>
      <dl>
        {PRICING_MATRIX.map((row) => (
          <div
            key={row.surface}
            className="flex items-start justify-between gap-4 border-b border-sand/60 py-2.5 last:border-b-0"
          >
            <dt className="min-w-0 flex-1 text-[13px] font-medium text-soft">
              {row.surface}
            </dt>
            <dd className="shrink-0 text-right">
              <Cell value={valueFor(row, tier.key)} accent={tier.key !== "free"} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PricingMatrix() {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {TIERS.map((t) => (
          <TierCard key={t.key} tier={t} />
        ))}
      </div>

      <ScrollRow wrapperClassName="hidden sm:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-sand text-left">
              <th className="w-[32%] py-3 pr-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-soft">
                What you get
              </th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className={`px-3 py-3 font-display text-sm font-bold ${
                    t.accent ? "text-gold-700" : "text-ink"
                  }`}
                >
                  {t.name}
                  <span className="block text-xs font-normal text-soft">
                    {t.price}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICING_MATRIX.map((row, i) => (
              <tr
                key={row.surface}
                className={i !== PRICING_MATRIX.length - 1 ? "border-b border-sand/60" : ""}
              >
                <td className="py-3 pr-3 align-top text-[13px] font-medium text-soft">
                  {row.surface}
                </td>
                {TIERS.map((t) => (
                  <td
                    key={t.key}
                    className={`px-3 py-3 text-center align-top ${
                      t.accent ? "bg-gold-400/[0.06]" : ""
                    }`}
                  >
                    <Cell value={valueFor(row, t.key)} accent={t.key !== "free"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRow>
    </>
  );
}
