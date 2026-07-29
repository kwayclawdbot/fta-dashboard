"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";

import { beltProgress } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";
import type {
  ForYouItem,
  TrendingResponse,
  TrendingRow,
} from "@/lib/clubhome/contract";
import { brandInk, signedPct, toneFor } from "./board";

const LADDER_TOP = LEVELS[LEVELS.length - 1]?.min || 1;

function compact(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function price(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TickerMark({ ticker, size = 42 }: { ticker?: string | null; size?: number }) {
  const symbol = (ticker || "?").toUpperCase();
  const ink = brandInk(symbol);
  return (
    <span
      className="grid shrink-0 place-items-center font-extrabold"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: ink.bg,
        color: ink.fg,
        fontSize: Math.round(size * 0.45),
        boxShadow: `0 0 16px color-mix(in srgb, ${ink.fg} 30%, transparent)`,
      }}
      aria-hidden
    >
      {symbol.slice(0, 1)}
    </span>
  );
}

function BrandLockup({ initials }: { initials: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-[9px]" aria-label="Cheat Code Club home">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#FF7A1A]">
          <span className="h-[9px] w-[9px] rotate-45 rounded-[1.5px] bg-[#0D0B0E]" />
        </span>
        <span className="cc-app-display text-[19px] leading-none tracking-[.02em] text-[#F4F0EC]">
          Cheat Code <span className="ml-1 text-[11px] tracking-[.2em] text-[#FF7A1A]">Club</span>
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/alerts" className="relative grid h-8 w-8 place-items-center text-[#8F8894]" aria-label="Alerts">
          <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
        </Link>
        <Link
          href="/settings"
          className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#3A3240] text-[11px] font-bold text-[#F4F0EC]"
          aria-label="Open your settings"
        >
          {initials}
        </Link>
      </div>
    </div>
  );
}

function Movers({ rows }: { rows: TrendingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="relative z-[1] mt-3 grid grid-cols-3 divide-x divide-[#2A2530] border-t border-[#2A2530] pt-3">
      {rows.map((row) => (
        <Link key={row.ticker} href={`/research/${encodeURIComponent(row.ticker)}`} className="px-2 first:pl-0 last:pr-0">
          <div className="flex items-center gap-1.5">
            <TickerMark ticker={row.ticker} size={23} />
            <span className="cc-app-signal text-[9px] font-semibold text-[#C8C2CE]">{row.ticker}</span>
          </div>
          <div className="cc-app-signal mt-1 text-[10px] font-semibold text-[#F4F0EC]">{price(row.price)}</div>
          <div className={`cc-app-signal mt-0.5 text-[8.5px] font-semibold ${toneFor(row.changePct)}`}>
            {signedPct(row.changePct)}
          </div>
          {(row.watchers ?? 0) > 0 && (
            <div className="cc-app-signal mt-1 text-[7.5px] text-[#6E6774]">{compact(row.watchers)} watching</div>
          )}
        </Link>
      ))}
    </div>
  );
}

function LeadTicker({
  row,
  movers,
  marketStarter,
}: {
  row: TrendingRow;
  movers: TrendingRow[];
  marketStarter: boolean;
}) {
  const sentiment = row.sentiment?.bullPct;
  const sentimentLabel = sentiment == null ? "BUILDING" : sentiment >= 58 ? "BULLISH" : sentiment <= 42 ? "BEARISH" : "MIXED";
  return (
    <article className="cc-app-hero mt-2 px-[14px] py-3">
      <div className="pointer-events-none absolute right-2 top-[-18px] z-0 cc-app-display text-[118px] leading-none opacity-[.07]">
        {row.ticker.slice(0, 1)}
      </div>
      <div className="relative z-[1] flex items-center gap-[10px]">
        <TickerMark ticker={row.ticker} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-extrabold leading-none text-[#F4F0EC]">{row.company || row.ticker}</h3>
          <p className="cc-app-signal mt-1 truncate text-[9px] font-semibold text-[#76B900]">
            {row.ticker} <span className="text-[#8F8894]">· {marketStarter ? "live market radar" : "live Club ranking"}</span>
          </p>
        </div>
        <span className="cc-app-signal rounded bg-[#C6FF4D] px-1.5 py-1 text-[7.5px] font-bold text-[#0D0B0E]">{marketStarter ? "LIVE MARKET" : "#1 IN ATTENTION"}</span>
      </div>

      <div className="relative z-[1] mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[24px] font-extrabold leading-none tracking-[-.02em] text-[#F4F0EC]">{price(row.price)}</div>
          <div className={`cc-app-signal mt-1 text-[10px] font-semibold ${toneFor(row.changePct)}`}>{signedPct(row.changePct)}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <div>
            <div className="cc-app-signal text-[14px] font-semibold text-[#F4F0EC]">{marketStarter || row.heat == null ? "—" : row.heat}</div>
            <div className="cc-app-signal mt-0.5 text-[6.5px] tracking-[.12em] text-[#6E6774]">CLUB SCORE</div>
          </div>
          <div>
            <div className="cc-app-signal text-[14px] font-semibold text-[#F4F0EC]">{marketStarter ? "—" : compact(row.watchers)}</div>
            <div className="cc-app-signal mt-0.5 text-[6.5px] tracking-[.12em] text-[#6E6774]">WATCHING</div>
          </div>
          <div>
            <div className={`cc-app-signal text-[10px] font-semibold ${sentimentLabel === "BEARISH" ? "text-price-down" : sentimentLabel === "BULLISH" ? "text-price-up" : "text-[#C8C2CE]"}`}>
              {sentimentLabel}
            </div>
            <div className="cc-app-signal mt-1 text-[6.5px] tracking-[.12em] text-[#6E6774]">SENTIMENT</div>
          </div>
        </div>
      </div>
      <Movers rows={movers} />
    </article>
  );
}

function SignalRow({ item }: { item: ForYouItem }) {
  const status = item.kind === "pattern" ? "KAI WATCH" : item.kind.replace(/_/g, " ").toUpperCase();
  return (
    <Link href={`/research/${encodeURIComponent(item.ticker)}`} className="cc-app-card flex items-center gap-[10px] px-3 py-[10px]">
      <TickerMark ticker={item.ticker} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="cc-app-signal text-[9px] font-semibold text-[#FF9A4D]">{status}</span>
          <span className="cc-app-signal rounded bg-[rgba(255,122,26,.14)] px-1.5 py-0.5 text-[7px] font-semibold text-[#FF9A4D]">LIVE</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-[#C8C2CE]">{item.delta}</p>
      </div>
      <div className={`cc-app-signal shrink-0 text-[9.5px] font-semibold ${toneFor(item.changePct)}`}>{signedPct(item.changePct)}</div>
    </Link>
  );
}

function YourRank({ xp, isKid }: { xp: number | null; isKid: boolean }) {
  const rank = xp == null ? null : beltProgress(xp);
  const ladder = xp == null ? 0 : Math.min(100, Math.round((xp / LADDER_TOP) * 100));
  const target = rank?.next?.level.min ?? LADDER_TOP;
  return (
    <Link href="/belts" className="cc-app-card flex items-center gap-3 border-[#3A2418] bg-[linear-gradient(120deg,#241009_0%,#17141A_70%)] px-3 py-3">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#FF7A1A]">
        <span className="h-[11px] w-[11px] rotate-45 rounded-[2px] bg-[#0D0B0E]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[#8F8894]">{isKid ? "ME" : "YOU"} · <span className="font-bold text-[#F4F0EC]">{rank?.current.label ?? "Unranked"}</span></p>
        <p className="cc-app-signal mt-1 text-[9.5px] text-[#8F8894]">XP {xp == null ? "—" : xp.toLocaleString()} / {target.toLocaleString()}</p>
        <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-[#2A2530]">
          <span className="block h-full rounded-full bg-[#FF7A1A]" style={{ width: `${rank?.pct ?? 0}%` }} />
        </span>
      </div>
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full p-[4px]"
        style={{ background: `conic-gradient(#FF7A1A ${ladder}%, #2A2530 0)` }}
      >
        <span className="grid h-full w-full place-items-center rounded-full bg-[#17141A] text-center">
          <span>
            <span className="cc-app-signal block text-[12px] font-semibold leading-none text-[#F4F0EC]">{xp == null ? "—" : ladder}</span>
            <span className="cc-app-signal mt-0.5 block text-[6px] tracking-[.1em] text-[#6E6774]">LADDER</span>
          </span>
        </span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6E6774]" />
    </Link>
  );
}

export default function StandaloneHome({
  firstName,
  trending,
  signals,
  loading,
  xp,
  isKid,
}: {
  firstName?: string;
  trending?: TrendingResponse | null;
  signals?: ForYouItem[];
  loading: boolean;
  xp: number | null;
  isKid: boolean;
}) {
  const name = (firstName || "Trader").trim();
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CC";
  const rows = trending?.rows ?? [];
  const lead = rows[0] ?? null;
  const marketStarter = rows.length > 0 && rows.every((row) => row.score === 0 && row.participants === 0);
  const personal = (signals ?? []).filter((item) => !(isKid && item.kind === "sentiment")).slice(0, 3);

  return (
    <div className="cc-app-screen px-[18px] pb-6 pt-[18px] sm:rounded-[26px] sm:border sm:border-[#2A2530]">
      <BrandLockup initials={initials} />
      <h1 className="mt-[18px] text-[26px] font-bold leading-none tracking-[-.02em] text-[#F4F0EC]">GM, {name} <span aria-hidden>👋</span></h1>
      <p className="mt-[5px] text-[13px] text-[#8F8894]">Live Club data · the Club is on it</p>

      <div className="mt-[15px] flex items-baseline justify-between gap-3">
        <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">
          {marketStarter ? <>Live market <span className="text-[#FF7A1A]">radar</span></> : <>What the club <span className="text-[#FF7A1A]">is seeing</span></>}
        </h2>
        <Link href="/discover" className="text-[10.5px] font-bold text-[#FF9A4D]">View all ›</Link>
      </div>

      {loading && !lead ? (
        <div className="cc-app-hero mt-2 h-[238px] animate-pulse" aria-label="Loading Club market activity" />
      ) : lead ? (
        <LeadTicker row={lead} movers={rows.slice(1, 4)} marketStarter={marketStarter} />
      ) : (
        <div className="cc-app-card mt-2 px-4 py-6 text-center">
          <p className="font-semibold text-[#F4F0EC]">The live board is filling in</p>
          <p className="mt-1 text-[12px] text-[#8F8894]">Watch a ticker or add a Club take to shape what appears here.</p>
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">Your signals</h2>
        <Link href="/watchlist" className="text-[10.5px] font-bold text-[#FF9A4D]">Watchlist ›</Link>
      </div>
      <div className="mt-2 flex flex-col gap-[7px]">
        {personal.length > 0 ? personal.map((item) => <SignalRow key={`${item.ticker}-${item.kind}`} item={item} />) : (
          <Link href="/watchlist" className="cc-app-card px-3 py-3 text-[12px] text-[#8F8894]">
            Add a ticker to turn on your personal signal feed.
          </Link>
        )}
      </div>

      <div className="mt-3">
        <YourRank xp={xp} isKid={isKid} />
      </div>
    </div>
  );
}
