"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Telescope,
  User as UserIcon,
  FileText,
  GraduationCap,
  MessagesSquare,
  CornerDownLeft,
} from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";

/**
 * CommandSearch — the universal ⌘K command surface (PART IV).
 *
 * One keyboard-first modal that searches the app's real entities (tickers,
 * members, theses, lessons, the live debate) via /api/search, plus two intent
 * rows that are always available: "Ask Kai about …" (opens the contextual Kai
 * sheet with the query) and "Open in Stock Finder" (deep-links the screener for
 * NL screening intents). Register-awareness (kid-safe subset) is enforced by the
 * endpoint, so the client renders whatever groups come back.
 *
 * Grammar: this is primitive #6 (action sheet) as a command palette. Keyboard-
 * initiated, so it does NOT animate (emil: never animate ⌘K). Modal keeps
 * transform-origin center. Trigger lives in the top bar.
 */

interface Hit {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  symbol?: string;
}
interface SearchResults {
  tickers: Hit[];
  members: Hit[];
  theses: Hit[];
  lessons: Hit[];
  debates: Hit[];
}
const EMPTY: SearchResults = { tickers: [], members: [], theses: [], lessons: [], debates: [] };

// Signals that the member is describing a screen, not a single entity → promote
// the Stock Finder row to the top.
const SCREEN_HINTS =
  /\b(under|over|above|below|between|rsi|oversold|overbought|market ?cap|mcap|volume|gainers|losers|dividend|p\/e|pe ratio|sector|breakout|below \$|under \$|penny|small ?cap|large ?cap)\b/i;

type FlatItem =
  | { kind: "kai" }
  | { kind: "screener" }
  | { kind: "hit"; hit: Hit; group: string };

/**
 * The palette's other front door. ⌘K is a keyboard, and a phone does not have
 * one — surfaces that draw their OWN search affordance (The Club's masthead
 * glyph) raise this same modal by dispatching the event rather than routing
 * somewhere that pretends to be search.
 */
export const COMMAND_SEARCH_EVENT = "cc:command-search";

export function openCommandSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMMAND_SEARCH_EVENT));
}

export default function CommandSearch() {
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(EMPTY);
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K to open; Escape (handled in dialog) to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_SEARCH_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_SEARCH_EVENT, onOpenRequest);
    };
  }, []);

  // Focus the input + lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    const query = q.trim();
    if (!open || query.length < 1) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults((await res.json()) as SearchResults);
      } catch {
        /* aborted / offline — keep prior */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const screenIntent = SCREEN_HINTS.test(q);

  // Flatten to a single navigable list (keyboard-first). Intent rows first when a
  // screen is described, else Ask Kai leads.
  const flat: FlatItem[] = useMemo(() => {
    const groups: [string, Hit[]][] = [
      ["Stocks", results.tickers],
      ["Members", results.members],
      ["Theses", results.theses],
      ["Debates", results.debates],
      ["Lessons", results.lessons],
    ];
    const hits: FlatItem[] = groups.flatMap(([group, arr]) =>
      arr.map((hit) => ({ kind: "hit" as const, hit, group }))
    );
    const kai: FlatItem = { kind: "kai" };
    const screener: FlatItem = { kind: "screener" };
    if (!q.trim()) return [];
    return screenIntent ? [screener, ...hits, kai] : [kai, ...hits, screener];
  }, [results, q, screenIntent]);

  useEffect(() => {
    setActive(0);
  }, [flat.length]);

  const runItem = useCallback(
    (item: FlatItem) => {
      if (item.kind === "kai") {
        openKai({ chip: q.trim(), query: q.trim() });
        close();
        return;
      }
      if (item.kind === "screener") {
        router.push(`/discover?tab=screener&q=${encodeURIComponent(q.trim())}`);
        close();
        return;
      }
      router.push(item.hit.href);
      close();
    },
    [openKai, q, router, close]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) runItem(item);
    }
  }

  // Render helpers ----------------------------------------------------------
  const GROUP_ICON: Record<string, React.ElementType> = {
    Members: UserIcon,
    Theses: FileText,
    Debates: MessagesSquare,
    Lessons: GraduationCap,
  };

  let idx = -1; // running index parallel to `flat` for active highlighting
  function itemProps(isActive: boolean) {
    return `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
      isActive ? "bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)]" : "hover:bg-paper"
    }`;
  }

  return (
    <>
      {/* Top-bar trigger — grows into a search field on desktop, compact on mobile. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        data-tour="search"
        className="flex items-center gap-2 rounded-full border border-sand bg-paper px-2.5 py-1.5 text-soft transition-colors hover:border-[var(--accent-strong)] hover:text-ink lg:w-64 lg:px-3"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left text-[13px] lg:block">
          Search anything…
        </span>
        <kbd className="hidden shrink-0 rounded border border-sand bg-card px-1.5 py-0.5 font-mono text-[10px] text-soft lg:block">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-sand bg-card shadow-[var(--shadow-lift)]"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-sand px-4">
              <Search className="h-5 w-5 shrink-0 text-soft" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search stocks, members, theses, lessons…"
                className="flex-1 bg-transparent py-4 text-[16px] text-ink placeholder:text-soft focus:outline-none"
              />
              {loading && (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sand border-t-[var(--accent-solid)] motion-reduce:animate-none" />
              )}
            </div>

            {/* Results */}
            <div className="max-h-[56vh] overflow-y-auto p-2">
              {!q.trim() ? (
                <p className="px-3 py-10 text-center text-sm text-soft">
                  Type to search across the Club — stocks, members, theses,
                  lessons — or ask Kai.
                </p>
              ) : flat.length === 0 && !loading ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-soft">
                    No matches for &ldquo;{q.trim()}&rdquo;.
                  </p>
                  <button
                    onClick={() => runItem({ kind: "kai" })}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-kai-blue px-3 py-1.5 text-[13px] font-semibold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Ask Kai instead
                  </button>
                </div>
              ) : (
                <>
                  {/* Intent rows + grouped hits, rendered in flat order with a
                      running index so keyboard highlighting stays in sync. */}
                  {(() => {
                    idx = -1;
                    let lastGroup = "";
                    return flat.map((item) => {
                      idx += 1;
                      const isActive = idx === active;
                      const myIdx = idx;
                      if (item.kind === "kai") {
                        return (
                          <button
                            key="__kai"
                            onMouseEnter={() => setActive(myIdx)}
                            onClick={() => runItem(item)}
                            className={itemProps(isActive)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kai-blue text-white">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">
                                Ask Kai about &ldquo;{q.trim()}&rdquo;
                              </span>
                              <span className="block truncate text-[11px] text-soft">
                                Your AI research analyst, with this in context
                              </span>
                            </span>
                            {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-soft" />}
                          </button>
                        );
                      }
                      if (item.kind === "screener") {
                        return (
                          <button
                            key="__screener"
                            onMouseEnter={() => setActive(myIdx)}
                            onClick={() => runItem(item)}
                            className={itemProps(isActive)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent-solid)_16%,transparent)] text-[var(--accent-strong)]">
                              <Telescope className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">
                                Open in Stock Finder
                              </span>
                              <span className="block truncate text-[11px] text-soft">
                                Screen the market for &ldquo;{q.trim()}&rdquo;
                              </span>
                            </span>
                            {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-soft" />}
                          </button>
                        );
                      }
                      const { hit, group } = item;
                      const showHeader = group !== lastGroup;
                      lastGroup = group;
                      const GroupIcon = GROUP_ICON[group];
                      return (
                        <div key={hit.id}>
                          {showHeader && (
                            <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-soft">
                              {group}
                            </p>
                          )}
                          <button
                            onMouseEnter={() => setActive(myIdx)}
                            onClick={() => runItem(item)}
                            className={itemProps(isActive)}
                          >
                            {hit.symbol ? (
                              <CompanyLogo symbol={hit.symbol} name={hit.subtitle} size={32} />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-soft">
                                {GroupIcon ? <GroupIcon className="h-4 w-4" /> : null}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">
                                {hit.title}
                              </span>
                              {hit.subtitle && (
                                <span className="block truncate text-[11px] text-soft">
                                  {hit.subtitle}
                                </span>
                              )}
                            </span>
                            {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-soft" />}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-sand px-4 py-2 text-[10.5px] text-soft">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-sand bg-paper px-1 font-mono">↑↓</kbd>
                navigate
                <kbd className="ml-2 rounded border border-sand bg-paper px-1 font-mono">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-sand bg-paper px-1 font-mono">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
