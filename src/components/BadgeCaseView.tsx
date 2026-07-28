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
 * hooks). Title-card / earned-rank energy, NOT cartoon badges.
 *
 * FORM (board 01): each credential is a white `.club-b-card` — 14px radius,
 * sand hairline — carrying an identity TILE at the board's own tile geometry
 * and, when earned, the lead rank pip hung half off its top-left corner. The
 * section label is the board's tracked mono mark with one phrase in the accent.
 * The previous version used the legacy paper card class, a gold gradient wash
 * and the midnight ramp (which does not re-map at :root[data-theme="dark"], so
 * locked titles were near-invisible on the dark page); none of that survives.
 *
 * HONESTY: an unearned credential is DIMMED, never hidden and never faked — its
 * subtitle doubles as the "how to earn it" line, and the locked mark says
 * Locked rather than inventing progress. `rows === null` is LOADING and keeps
 * the grid's shape; `[]` renders the all-locked/empty case.
 *
 * COLOUR LAW: earning is not green — green and red are price. An earned title is
 * marked by the accent (brand + achievement) on its tile, its pip and its date
 * line; a locked one sits in `soft` at reduced opacity.
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
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
            {title}
            <span className="text-accent"> earned so far</span>
          </h3>
          {rows && (
            <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-soft">
              {earnedCount}
              <span className="opacity-70">/{rows.length}</span>
            </span>
          )}
        </div>
      )}

      {!rows ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="club-b-card h-28 animate-pulse px-3 py-3">
              <div className="h-9 w-9 rounded-[10px] bg-sand/60" />
              <div className="mt-2.5 h-3 w-2/3 rounded bg-sand/60" />
              <div className="mt-2 h-2.5 w-full rounded bg-sand/40" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rows.map((b) => {
              const Icon = BADGE_ICONS[b.slug] || Award;
              return (
                <div key={b.slug} className="relative">
                  {/* The board's lead rank pip, hung half off the corner. It
                      appears ONLY on an earned title — a locked card carries no
                      pip at all rather than a pip that implies partial credit. */}
                  {b.awarded && (
                    <span
                      className="club-b-pip club-b-pip-lead absolute -left-[7px] -top-[7px] z-10"
                      aria-hidden
                    >
                      ★
                    </span>
                  )}

                  <div
                    className={`club-b-card flex h-full flex-col px-3 py-3 ${
                      b.awarded ? "" : "opacity-70"
                    }`}
                    title={b.subtitle || b.title}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                      style={
                        b.awarded
                          ? {
                              background: "var(--accent-solid)",
                              color: "var(--accent-on)",
                            }
                          : {
                              background: "var(--sand)",
                              color: "var(--soft)",
                            }
                      }
                      aria-hidden
                    >
                      {b.awarded ? (
                        <Icon className="h-4 w-4" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </span>

                    <p
                      className={`mt-2.5 font-display text-[13.5px] font-extrabold leading-tight ${
                        b.awarded ? "text-ink" : "text-soft"
                      }`}
                    >
                      {b.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-soft">
                      {b.subtitle}
                    </p>
                    <p
                      className={`mt-auto pt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${
                        b.awarded ? "text-accent" : "text-soft"
                      }`}
                    >
                      {b.awarded ? `Earned ${fmtDate(b.awarded_at)}` : "Locked"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {noneEarned && emptyLine && (
            <p className="mt-4 text-[13px] leading-relaxed text-soft">{emptyLine}</p>
          )}
        </>
      )}
    </div>
  );
}
