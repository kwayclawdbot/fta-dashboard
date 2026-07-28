"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { ArrowRight, Search, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * THE FIRST WIN — one prompt, ninety seconds, a real thing done.
 *
 * WHAT THIS REPLACED. A new adult member's first session used to be TWO
 * interruptions before they had done anything at all:
 *
 *   · a ten-step AppTour that HIJACKED THE ROUTER — several steps push the user
 *     to another page to point at a thing there, so the member is driven around
 *     an app they have no stake in yet, and
 *   · a PWA install sheet fired the moment the tour ended, asking a stranger to
 *     put an icon on their home screen before the product had done anything
 *     for them.
 *
 * Neither produced a WIN. A tour is a description of a product; the member had
 * still made nothing, held no position, and earned nothing.
 *
 * WHAT HAPPENS NOW. One question — "name a company your family already uses" —
 * over the search the app already has. Pick one and you land on that company's
 * research page with the stance control lit up, take a side, and the XP for it
 * appears on screen. That is the whole flow: a company you actually know, a
 * position that is yours, a number that says it counted.
 *
 * The tour is NOT deleted. It stays exactly where it was, reachable from
 * Settings and Start Here at /dashboard?tour=1 — it is just no longer the price
 * of admission. AppTour's auto-run is suppressed for the members this flow owns
 * (adults who are not on a Challenge pass, who keep their pass-flavoured
 * walkthrough).
 *
 * THE FLAG IS THE EXISTING ONE. Completing or skipping stamps
 * `profiles.tour_completed_at`, the same per-profile marker AppTour and FirstRun
 * already sequence on — so no one gets both, this never re-imposes, and the
 * install/push steps still follow through FirstRun's `fic:tour-finished` event.
 * No schema change, no second source of truth for "has this member been
 * onboarded".
 */

const LEGACY_AGE_DAYS = 7;

interface TickerHit {
  id: string;
  title: string;
  subtitle?: string;
  symbol?: string;
}

interface FirstWinUser {
  display_name?: string;
  role?: string;
  /** Challenge pass holders keep the challenge-flavoured tour instead. */
  isChallenge?: boolean;
}

export default function FirstWin({ user }: { user: FirstWinUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const decidedRef = useRef(false);
  const uidRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TickerHit[]>([]);
  const [searching, setSearching] = useState(false);

  const isKid = user.role === "child";
  const firstName = (user.display_name || "").split(" ")[0];

  // ── Decide, once, on the home base. Kids and challenge-pass holders keep the
  //    walkthrough they already had; everyone else gets the first win. ────────
  useEffect(() => {
    if (decidedRef.current) return;
    if (pathname !== "/dashboard") return;
    if (isKid || user.isChallenge) return;
    decidedRef.current = true;

    let alive = true;
    void (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!alive || !authUser) return;
      uidRef.current = authUser.id;

      const { data: prof } = await supabase
        .from("profiles")
        .select("tour_completed_at, created_at")
        .eq("id", authUser.id)
        .single();
      if (!alive || !prof) return;

      // Already onboarded (toured or first-won) → never again.
      if (prof.tour_completed_at) return;
      // Legacy accounts predating first-run get nothing, silently.
      const ageDays = prof.created_at
        ? (Date.now() - new Date(prof.created_at as string).getTime()) / 86_400_000
        : 0;
      if (ageDays > LEGACY_AGE_DAYS) return;

      setOpen(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── The autocomplete: the app's own /api/search, tickers only. ─────────────
  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            signal: ctrl.signal,
            headers: { accept: "application/json" },
          });
          if (!res.ok) return;
          const json = (await res.json()) as { tickers?: TickerHit[] };
          setHits((json.tickers ?? []).slice(0, 6));
        } catch {
          /* absent = no suggestions; the member can still type and pick */
        } finally {
          setSearching(false);
        }
      })();
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  /** Stamp the shared first-run marker and let FirstRun's sequence continue. */
  const finish = useCallback(
    async (completed: boolean) => {
      setOpen(false);
      const uid = uidRef.current;
      if (uid) {
        await supabase
          .from("profiles")
          .update({ tour_completed_at: new Date().toISOString() })
          .eq("id", uid)
          .then(undefined, () => {});
      }
      // FirstRun waits on this to advance to install / push — which are now
      // themselves deferred to a later session (see FirstRun).
      window.dispatchEvent(
        new CustomEvent("fic:tour-finished", { detail: { completed } })
      );
    },
    [supabase]
  );

  async function choose(hit: TickerHit) {
    const ticker = (hit.symbol || hit.title || "").toUpperCase();
    if (!ticker) return;
    await finish(true);
    // `firstwin=1` lights the stance control on arrival — see ResearchClient.
    router.push(`/research/${encodeURIComponent(ticker)}?firstwin=1`);
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <m.div
        key="first-win"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center bg-night-950/55 p-4 backdrop-blur-[2px] sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-win-title"
      >
        <m.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="club-b-card w-full max-w-md overflow-hidden px-5 py-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                Start here
                <span className="text-accent"> · 90 seconds</span>
              </p>
              <h2
                id="first-win-title"
                className="mt-2 font-display text-[19px] font-extrabold leading-snug text-ink"
              >
                {firstName ? `${firstName}, name a company` : "Name a company"} your
                family already uses
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft">
                Not a stock tip — a brand in your house. You will read where the
                Club stands on it and take your own position.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void finish(false)}
              aria-label="Skip"
              className="f0-focus f0-press -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-soft"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="club-b-chip mt-4 flex items-center gap-2 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nike, Costco, Apple…"
              aria-label="Company name"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-soft"
            />
          </div>

          {q.trim().length > 0 && (
            <div className="mt-2 flex flex-col gap-[6px]">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => void choose(h)}
                  className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-2 text-left"
                >
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                    {h.symbol || h.title}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-soft">
                    {h.subtitle}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
                </button>
              ))}
              {hits.length === 0 && (
                <p className="px-1 py-1.5 text-[12px] text-soft">
                  {searching ? "Looking…" : "No match yet — keep typing the brand name."}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void finish(false)}
            className="f0-focus f0-press mt-3.5 text-[12px] font-semibold text-soft"
          >
            I&rsquo;ll do this later
          </button>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
