/**
 * Friendly-sector labelling for the "HOW THEY INVEST" insight.
 *
 * The raw `screener_metrics.sector` is Polygon's SIC description — ~374 messy
 * strings ("SEMICONDUCTORS & RELATED DEVICES", "SERVICES-COMPUTER PROGRAMMING,
 * DATA PROCESSING, ETC.", "STATE COMMERCIAL BANKS"…). The screener already
 * ships a mature, ordered rule table that collapses those into GICS-style
 * sectors and a curated subsector (`src/lib/screener-sectors.ts`). We reuse it
 * verbatim rather than maintain a second taxonomy.
 *
 * For a member's FAVORITE SECTORS we want the *friendly, specific* label the
 * mockup shows ("Semiconductors", "Software", "Banks", "Oil & Gas") rather than
 * the broad sector ("Technology"). That is exactly the screener's SUBSECTOR,
 * with two adjustments:
 *   - a subsector like "Other Technology" reads better as its parent sector,
 *     so we fall back to the sector name for those "Other <sector>" buckets;
 *   - anything the screener can't classify buckets to "Other" so a member with
 *     an obscure holding still gets a labelled slice rather than a gap.
 */

import { classifySector } from "@/lib/screener-sectors";

/**
 * Map a raw SIC string to the single friendly sector label used on the profile.
 * Returns "Other" for anything unclassifiable so every held ticker contributes.
 */
export function friendlySector(raw: string | null | undefined): string {
  const c = classifySector(raw);
  if (!c) return "Other";
  // "Other Technology" etc. → just "Technology"; a real subsector stays as-is.
  if (c.subsector.startsWith("Other ")) return c.sector;
  return c.subsector;
}
