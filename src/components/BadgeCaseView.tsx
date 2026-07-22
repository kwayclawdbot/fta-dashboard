import {
  Search,
  ClipboardCheck,
  ShieldCheck,
  TrendingUp,
  LineChart,
  Crown,
  Lock,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { BadgeRow } from "@/lib/badges";

/**
 * BadgeCaseView — the PRESENTATIONAL credential shelf (no data fetching, no
 * hooks). Title-card / earned-rank energy (warm-paper + gold), NOT cartoon
 * badges. Earned titles read as awarded credentials; unearned ones are quiet
 * locked placeholders whose subtitle doubles as the "how to earn it" line.
 *
 * Split out of BadgeCase so it can render server-side on the public profile
 * page (where cross-family viewers can't read badge_awards directly and the
 * earned set arrives from the public_profile RPC instead).
 */

export const BADGE_ICONS: Record<string, LucideIcon> = {
  scout: Search,
  analyst: ClipboardCheck,
  risk_manager: ShieldCheck,
  investor: TrendingUp,
  technician: LineChart,
  ceo: Crown,
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function BadgeCaseView({
  rows,
  title = "Credentials",
  emptyLine,
}: {
  /** null = loading (skeleton); [] = render all-locked/empty. */
  rows: BadgeRow[] | null;
  /** Section heading; pass "" to hide. */
  title?: string;
  /** Optional italic line shown under the grid when nothing is earned. */
  emptyLine?: string;
}) {
  const earnedCount = rows?.filter((r) => r.awarded).length ?? 0;
  const noneEarned = !!rows && earnedCount === 0;

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider">
            {title}
          </h3>
          {rows && (
            <span className="inline-flex items-center gap-1.5 text-xs font-body text-soft">
              <Award className="w-3.5 h-3.5 text-gold-600" />
              {earnedCount} of {rows.length} earned
            </span>
          )}
        </div>
      )}

      {!rows ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="paper-card p-4 h-28 animate-pulse bg-sand/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rows.map((b) => {
              const Icon = BADGE_ICONS[b.slug] || Award;
              return (
                <div
                  key={b.slug}
                  className={`relative rounded-xl border p-4 flex flex-col items-center text-center transition-colors ${
                    b.awarded
                      ? "border-gold-300 bg-gradient-to-b from-chip-amber/60 to-white"
                      : "border-sand bg-paper/60"
                  }`}
                  title={b.subtitle || b.title}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center mb-2 ${
                      b.awarded
                        ? "bg-gradient-to-b from-gold-400 to-gold-600 text-white shadow-soft"
                        : "bg-sand text-midnight-500"
                    }`}
                  >
                    {b.awarded ? <Icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <p
                    className={`font-display text-sm font-bold leading-tight ${
                      b.awarded ? "text-ink" : "text-midnight-400"
                    }`}
                  >
                    {b.title}
                  </p>
                  <p className="text-[11px] font-body text-soft mt-1 leading-snug">
                    {b.subtitle}
                  </p>
                  <p
                    className={`mt-2 text-[10px] font-display font-semibold uppercase tracking-wider ${
                      b.awarded ? "text-gold-700" : "text-midnight-500"
                    }`}
                  >
                    {b.awarded ? `Earned ${fmtDate(b.awarded_at)}` : "Locked"}
                  </p>
                </div>
              );
            })}
          </div>
          {noneEarned && emptyLine && (
            <p className="mt-4 text-center text-sm font-body italic text-soft">
              {emptyLine}
            </p>
          )}
        </>
      )}
    </div>
  );
}
