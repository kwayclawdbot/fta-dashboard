import { Check, Minus } from "lucide-react";
import { PRICING_MATRIX } from "@/lib/entitlements";

/**
 * The binding free/paid comparison, rendered straight from the single source of
 * truth (PRICING_MATRIX in src/lib/entitlements/features.ts) so the pricing page
 * and the in-app walls can never drift. Three columns: Cheat Code Free /
 * Cheat Code Club $99 / FTA. No follow-graph row (it does not exist yet).
 *
 * Cell rules: "✓" → check glyph, "—" → muted dash, anything else → the verbatim
 * copy (free = participation verbs, Club = intelligence verbs). An FTA cell falls
 * back to its Club cell ("Everything in Club") unless it names something extra.
 */
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

export default function PricingMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-sand text-left">
            <th className="w-[32%] py-3 pr-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-soft">
              What you get
            </th>
            <th className="px-3 py-3 font-display text-sm font-bold text-ink">
              Cheat Code Free
              <span className="block text-xs font-normal text-soft">$0</span>
            </th>
            <th className="px-3 py-3 font-display text-sm font-bold text-gold-700">
              Cheat Code Club
              <span className="block text-xs font-normal text-soft">$99/mo</span>
            </th>
            <th className="px-3 py-3 font-display text-sm font-bold text-ink">
              FTA
              <span className="block text-xs font-normal text-soft">
                Advanced upgrade
              </span>
            </th>
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
              <td className="px-3 py-3 text-center align-top">
                <Cell value={row.free} />
              </td>
              <td className="bg-gold-400/[0.06] px-3 py-3 text-center align-top">
                <Cell value={row.club} accent />
              </td>
              <td className="px-3 py-3 text-center align-top">
                <Cell value={row.fta ?? (row.club === "—" ? "—" : "✓")} accent />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
