"use client";

import { ArrowRight, Check, Minus } from "lucide-react";
import { PRICING_MATRIX } from "@/lib/entitlements";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";

/**
 * /pricing — v2, canvas board 11's layout language on the REAL pricing source
 * of truth. The board draws $99/yr "Club Pro"; that is design fiction — the
 * live tiers are Cheat Code Free / Cheat Code Club $99/MO / FTA, read from
 * PRICING_MATRIX + the entitlements matrix, so the page can never drift from
 * the in-app walls. What is adopted from the board: the script "go pro" mark,
 * the Best-Value orange-edged featured card with a ✓ feature checklist, and the
 * quiet free/advanced cards — recomposed for three real tiers.
 *
 * "Restore purchases" (board 11) is a native-app concept and is omitted on web.
 */

const FTA_URL = "/upgrade";

/** Club highlights, derived from the matrix (rows where Club actually adds
 *  something over Free) so the checklist stays bound to the source of truth. */
const CLUB_HIGHLIGHTS = PRICING_MATRIX.filter(
  (r) => r.free !== r.club && r.club !== "—"
)
  .slice(0, 6)
  .map((r) => `${r.surface} — ${r.club}`);

function MatrixCell({ value, accent }: { value: string; accent?: boolean }) {
  if (value === "✓")
    return (
      <Check
        className="mx-auto h-4 w-4"
        style={{ color: accent ? "var(--cc-orange-ink, #ff7a1a)" : "var(--cc-ink, #f4f0ec)" }}
      />
    );
  if (value === "—")
    return (
      <Minus className="mx-auto h-4 w-4" style={{ color: "var(--cc-dim, #5d5865)" }} aria-label="Not included" />
    );
  return (
    <span className="text-[12.5px] leading-snug" style={{ color: "var(--cc-soft, #8d8794)" }}>
      {value}
    </span>
  );
}

export default function PricingV2() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-16" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
        {/* Board 11 mast — script "go pro". */}
        <header>
          <h1 className="cc-script text-[34px] leading-none" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
            go pro
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
            The whole community is free — read, post, vote, shape what the Club is
            watching. Cheat Code Club adds the intelligence layer on top.
          </p>
        </header>

        {/* Featured — Cheat Code Club $99/mo, orange edge + BEST VALUE ribbon. */}
        <div
          className="cc-halo-soft relative mt-8 rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--cc-orange, #ff7a1a) 12%, var(--cc-card, #1c1920)) 0%, var(--cc-card, #1c1920) 65%)",
            border: "1.5px solid var(--cc-orange, #ff7a1a)",
          }}
        >
          <span
            className="absolute -top-2.5 right-5 rounded-full px-2.5 py-1 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
          >
            Best Value
          </span>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="cc-display text-[24px]" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
                Cheat Code Club
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
                Unlock the intelligence. Keep your edge.
              </p>
            </div>
            <p className="shrink-0 text-right font-[family-name:var(--font-plex-mono)] text-[24px] font-semibold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
              $99
              <span className="text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>/mo</span>
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {CLUB_HIGHLIGHTS.map((f) => (
              <div key={f} className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
                <span
                  className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--cc-orange, #ff7a1a) 20%, transparent)",
                    color: "var(--cc-orange-ink, #ff7a1a)",
                  }}
                >
                  ✓
                </span>
                {f}
              </div>
            ))}
          </div>

          <a
            href={FIC_CHECKOUT_URL}
            className="cc-halo mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-bold"
            style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
          >
            Join the Club — $99/mo
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Free tier — quiet card. */}
        <div
          className="mt-3 rounded-2xl p-5"
          style={{ background: "var(--cc-card, #1c1920)", border: "1px solid var(--cc-line, #2b2731)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[16px] font-bold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
                Cheat Code Free
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
                Run with the Club — participate in the network.
              </p>
            </div>
            <p className="font-[family-name:var(--font-plex-mono)] text-[18px] font-semibold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
              $0
            </p>
          </div>
        </div>

        {/* FTA — advanced upgrade (its own page). */}
        <div
          className="mt-3 flex items-center justify-between gap-4 rounded-2xl p-5"
          style={{ background: "var(--cc-card, #1c1920)", border: "1px solid var(--cc-line, #2b2731)" }}
        >
          <div className="min-w-0">
            <p className="text-[16px] font-bold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
              FTA
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
              The trade-ready academy — a 6-week live program on top of your Club.
            </p>
          </div>
          <a
            href={FTA_URL}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ border: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-ink, #f4f0ec)" }}
          >
            Explore FTA <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* The binding comparison, from PRICING_MATRIX (source of truth). */}
        <div className="mt-10">
          <div className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--cc-dim, #5d5865)" }}>
            compare every feature
          </div>
          <div
            className="mt-3 overflow-x-auto rounded-2xl p-1"
            style={{ background: "var(--cc-card, #1c1920)", border: "1px solid var(--cc-line, #2b2731)" }}
          >
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cc-line, #2b2731)" }}>
                  <th className="px-3 py-3 text-left font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--cc-dim, #5d5865)" }}>
                    What you get
                  </th>
                  <th className="px-3 py-3 text-center text-[12px] font-bold" style={{ color: "var(--cc-soft, #8d8794)" }}>
                    Free
                  </th>
                  <th className="px-3 py-3 text-center text-[12px] font-bold" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
                    Club <span className="font-normal" style={{ color: "var(--cc-soft, #8d8794)" }}>$99/mo</span>
                  </th>
                  <th className="px-3 py-3 text-center text-[12px] font-bold" style={{ color: "var(--cc-soft, #8d8894)" }}>
                    FTA
                  </th>
                </tr>
              </thead>
              <tbody>
                {PRICING_MATRIX.map((row, i) => {
                  const ftaVal = row.fta ?? (row.club === "—" ? "—" : "✓");
                  return (
                    <tr key={row.surface} style={i !== PRICING_MATRIX.length - 1 ? { borderBottom: "1px solid color-mix(in srgb, var(--cc-line, #2b2731) 60%, transparent)" } : undefined}>
                      <td className="px-3 py-3 align-top text-[12.5px] font-medium" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
                        {row.surface}
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <MatrixCell value={row.free} />
                      </td>
                      <td className="px-3 py-3 text-center align-top" style={{ background: "color-mix(in srgb, var(--cc-orange, #ff7a1a) 6%, transparent)" }}>
                        <MatrixCell value={row.club} accent />
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <MatrixCell value={ftaVal} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-8 max-w-[62ch] text-xs leading-relaxed" style={{ color: "var(--cc-dim, #5d5865)" }}>
          Cheat Code measures and interprets community attention — it is education,
          never financial advice. One Club membership covers your entire household.
        </p>
    </div>
  );
}
