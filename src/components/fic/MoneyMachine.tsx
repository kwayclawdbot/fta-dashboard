"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useInView,
  AnimatePresence,
} from "framer-motion";
import {
  ChevronDown,
  HeartHandshake,
  Eye,
  ShieldAlert,
  Package,
} from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
import {
  fetchCompany,
  type MarketCompany,
  type MarketQuote,
} from "@/lib/market/client";
import { DotCluster } from "@/components/fic/glyphs/motifs";

/**
 * <MoneyMachine> — the flagship Company-of-the-Week teaching visual. Turns the
 * five free-text COTW fields into ONE data-driven diagram of the company as a
 * machine that converts inputs into profit, so kids build one durable mental
 * model every week instead of re-reading five paragraphs.
 *
 *   inputs (what they do)      → tokens slide into…
 *   the engine (how they make money) → gears turn, coins drop out…
 *   output (why investors watch)   annotates the profit stream
 *   warning light (what could go wrong) blinks once, red
 *   love gauge (why customers love them) fills once, heart
 *
 * v1 maps the existing free-text schema (no admin change). Company logo + live
 * price + market cap come from the Polygon layer (/api/market/company), failing
 * soft to a monogram + no-price. Full text stays available via "read more" so
 * nothing is lost. Motif/coin language is shared with the Money Machine mission
 * emblem. Reduced-motion → everything renders in final state, no particles.
 */

interface Props {
  companyName: string | null;
  ticker: string | null;
  whatTheyDo: string | null;
  howTheyMakeMoney: string | null;
  whyCustomersLove: string | null;
  whyInvestorsWatch: string | null;
  whatCouldGoWrong: string | null;
  kid?: boolean;
}

/** Pull up to 3 short input tokens out of the free-text "what they do". */
function inputTokens(text: string | null): string[] {
  if (!text) return [];
  const parts = text
    .replace(/\band\b/gi, ",")
    .split(/[,.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 40);
  // Prefer the shortest, most noun-like fragments.
  const picks = parts
    .map((p) => p.split(/\s+/).slice(0, 3).join(" "))
    .filter((p) => p.length > 1);
  return Array.from(new Set(picks)).slice(0, 3);
}

function Coin({ delay, reduce }: { delay: number; reduce: boolean | null }) {
  return (
    <motion.span
      className="absolute h-4 w-4 rounded-full border border-gold-600 bg-gradient-to-b from-gold-300 to-gold-500 shadow-sm"
      style={{ left: "50%" }}
      initial={reduce ? { opacity: 1, y: 30 } : { opacity: 0, y: -6, x: "-50%" }}
      animate={
        reduce
          ? { opacity: 1, y: 30 }
          : { opacity: [0, 1, 1, 0], y: [-6, 34], x: "-50%" }
      }
      transition={
        reduce
          ? undefined
          : { duration: 1.1, delay, repeat: Infinity, repeatDelay: 1.4, ease: "easeIn" }
      }
    />
  );
}

export default function MoneyMachine(props: Props) {
  const {
    companyName,
    ticker,
    whatTheyDo,
    howTheyMakeMoney,
    whyCustomersLove,
    whyInvestorsWatch,
    whatCouldGoWrong,
    kid,
  } = props;
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-40px" });
  const [company, setCompany] = useState<MarketCompany | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    const ctrl = new AbortController();
    fetchCompany(ticker, true, ctrl.signal).then((d) => {
      if (ctrl.signal.aborted || !d) return;
      setCompany(d.company);
      setQuote(d.quote ?? null);
    });
    return () => ctrl.abort();
  }, [ticker]);

  const tokens = inputTokens(whatTheyDo);
  const displayTokens = tokens.length ? tokens : ["What they sell"];
  const marketCapText = company?.marketCapText ?? null;
  const anim = inView && !reduce;

  return (
    <div ref={rootRef} className="rounded-2xl border border-sand bg-midnight-900 p-5 lg:p-6">
      {/* Company header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanyLogo symbol={ticker || ""} name={companyName} size={48} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-soft">
              Company of the Week
            </p>
            <h3 className="font-display text-xl font-bold leading-tight text-ink">
              {companyName || ticker}
              {ticker && (
                <span className="ml-2 align-middle text-sm font-semibold text-gold-700">
                  {ticker.toUpperCase()}
                </span>
              )}
            </h3>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <LivePrice quote={quote} size="md" showDelayed />
          {marketCapText && (
            <span className="text-xs text-soft">
              Market cap <span className="font-semibold text-ink">{marketCapText}</span>
            </span>
          )}
        </div>
      </div>

      {/* The machine */}
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        {/* INPUTS */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-soft">
            {kid ? "What goes in" : "What they sell"}
          </p>
          {displayTokens.map((t, i) => (
            <motion.div
              key={t + i}
              className="flex items-center gap-2 rounded-xl border border-sand bg-paper px-3 py-2"
              initial={anim ? { opacity: 0, x: -18 } : false}
              animate={anim ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.4, ease: "easeOut" }}
            >
              <Package className="h-4 w-4 shrink-0 text-gold-600" />
              <span className="truncate text-sm text-ink">{t}</span>
            </motion.div>
          ))}
        </div>

        {/* ENGINE */}
        <div className="relative mx-auto flex flex-col items-center">
          {/* connector arrows on desktop */}
          <div className="pointer-events-none absolute -left-4 top-1/2 hidden -translate-y-1/2 md:block">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M0 6h12M12 6l-4-4M12 6l-4 4" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <motion.div
            className="relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-gold-400/50 bg-gradient-to-b from-gold-50 to-chip-amber"
            initial={anim ? { scale: 0.9, opacity: 0 } : false}
            animate={anim ? { scale: 1, opacity: 1 } : undefined}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 16 }}
          >
            {/* turning gears */}
            <motion.svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              animate={anim ? { rotate: 360 } : undefined}
              transition={anim ? { duration: 6, repeat: Infinity, ease: "linear" } : undefined}
              style={{ transformOrigin: "50% 50%" }}
            >
              <path
                d="M12 8a4 4 0 100 8 4 4 0 000-8zm0-6l1.2 2.4L16 3l.3 2.7L19 6l-1 2.5L20 10l-2 1.5.6 2.7-2.7-.3L14 16l-2 .1L10 16l-1.9.4L6 14.2l-2.7.3.6-2.7L2 10l2-1.5L3 6l2.7-.3L6 3l2.8 1.4L10 2z"
                fill="#D97706"
              />
            </motion.svg>
            <span className="mt-1 px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-gold-700">
              {kid ? "The machine" : "Makes money"}
            </span>

            {/* warning light — blinks once */}
            <motion.span
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 ring-red-200"
              initial={anim ? { scale: 0 } : false}
              animate={anim ? { scale: 1 } : undefined}
              transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
              title="What could go wrong"
            >
              <motion.span
                className="block h-3 w-3 rounded-full bg-red-500"
                animate={anim ? { opacity: [1, 0.25, 1, 0.25, 1] } : undefined}
                transition={{ delay: 0.7, duration: 1.4, times: [0, 0.25, 0.5, 0.75, 1] }}
              />
            </motion.span>
          </motion.div>

          {/* engine label from how_they_make_money */}
          {howTheyMakeMoney && (
            <p className="mt-2 max-w-[10rem] text-center text-[11px] leading-snug text-soft">
              {howTheyMakeMoney.length > 70
                ? howTheyMakeMoney.slice(0, 70).trim() + "…"
                : howTheyMakeMoney}
            </p>
          )}
        </div>

        {/* OUTPUT — coins + why investors watch */}
        <div className="space-y-2">
          <p className="text-right text-[11px] font-bold uppercase tracking-wider text-soft md:text-left">
            {kid ? "Money out" : "The payoff"}
          </p>
          <div className="relative flex items-center justify-end gap-2 md:justify-start">
            <div className="relative h-14 w-10">
              {(anim ? [0, 0.4, 0.8] : [0]).map((d, i) => (
                <Coin key={i} delay={d} reduce={reduce} />
              ))}
              <DotCluster className="absolute -bottom-1 right-0 h-6 w-7 opacity-70" />
            </div>
            <div className="flex flex-wrap items-end gap-0.5">
              {[10, 16, 13, 20, 24].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-1.5 rounded-full bg-green-500"
                  style={{ height: h }}
                  initial={anim ? { scaleY: 0 } : false}
                  animate={anim ? { scaleY: 1 } : undefined}
                  transition={{ delay: 0.4 + i * 0.06, ease: "easeOut" }}
                />
              ))}
            </div>
          </div>
          {whyInvestorsWatch && (
            <p className="flex items-start gap-1 text-right text-[11px] leading-snug text-soft md:text-left">
              <Eye className="mt-0.5 hidden h-3 w-3 shrink-0 text-gold-600 md:inline" />
              {whyInvestorsWatch.length > 64
                ? whyInvestorsWatch.slice(0, 64).trim() + "…"
                : whyInvestorsWatch}
            </p>
          )}
        </div>
      </div>

      {/* Love gauge */}
      {whyCustomersLove && (
        <div className="mt-5 rounded-xl bg-paper p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4 text-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-soft">
              {kid ? "How much people love it" : "Why customers love them"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
              initial={anim ? { width: 0 } : false}
              animate={anim ? { width: "82%" } : undefined}
              transition={{ delay: 0.5, duration: 0.9, ease: "easeOut" }}
              style={reduce ? { width: "82%" } : undefined}
            />
          </div>
          <p className="mt-1.5 text-xs leading-snug text-ink">{whyCustomersLove}</p>
        </div>
      )}

      {/* Read more — full text, nothing lost */}
      {(whatTheyDo || whatCouldGoWrong || howTheyMakeMoney) && (
        <div className="mt-4 border-t border-sand pt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-800"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide the details" : "Read the full breakdown"}
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3 text-sm">
                  <ReadRow label="What they do" body={whatTheyDo} />
                  <ReadRow label="How they make money" body={howTheyMakeMoney} />
                  <ReadRow label="Why customers love them" body={whyCustomersLove} />
                  <ReadRow label="Why investors watch" body={whyInvestorsWatch} />
                  <ReadRow
                    label="What could go wrong"
                    body={whatCouldGoWrong}
                    icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ReadRow({
  label,
  body,
  icon,
}: {
  label: string;
  body: string | null;
  icon?: React.ReactNode;
}) {
  if (!body) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-soft">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 leading-relaxed text-ink">{body}</p>
    </div>
  );
}
