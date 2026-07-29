import Link from "next/link";
import type { ReactNode } from "react";
import ClubMark from "@/components/brand/ClubMark";
import Avatar from "@/components/Avatar";
import type { CircleState, KaiWatchState, Opinion, Reputation, Stance, TickerRank } from "./types";

const stanceLabel: Record<Stance, string> = { bullish: "Bullish", neutral: "Neutral", bearish: "Bearish" };

export function TickerRankItem({ item, onSelect }: { item: TickerRank; onSelect?: (item: TickerRank) => void }) {
  const body = <><span className="font-mono text-xs text-soft">{item.rank.toString().padStart(2, "0")}</span><span className="grid size-9 place-items-center rounded-xl bg-ink font-display font-bold text-paper">{item.ticker[0]}</span><span className="min-w-0 flex-1"><strong className="block font-display text-sm text-ink">{item.ticker}</strong><span className="block truncate text-xs text-soft">{item.statistic}</span></span><span className="font-mono text-xs text-ink" aria-label={`${Math.abs(item.movement)} ranks ${item.movement >= 0 ? "up" : "down"}`}>{item.movement === 0 ? "—" : `${item.movement > 0 ? "↑" : "↓"}${Math.abs(item.movement)}`}</span></>;
  const cls = "flex min-w-56 items-center gap-3 border-b border-border py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action";
  return onSelect ? <button type="button" className={cls} onClick={() => onSelect(item)}>{body}</button> : item.href ? <Link className={cls} href={item.href}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function ClubRankRail({ items, label = "Top in the Club", onSelect }: { items: TickerRank[]; label?: string; onSelect?: (item: TickerRank) => void }) {
  return <section aria-labelledby="club-rank-title"><div className="mb-2 flex items-baseline justify-between"><h2 id="club-rank-title" className="font-display text-2xl font-bold text-ink">{label}</h2><span className="font-mono text-[10px] uppercase tracking-widest text-soft">Live attention</span></div><div className="flex snap-x gap-6 overflow-x-auto pb-2">{items.map(item => <div className="snap-start" key={item.ticker}><TickerRankItem item={item} onSelect={onSelect} /></div>)}</div></section>;
}

export function CollectiveSignal({ raw, weighted, opinions }: { raw: number; weighted: number; opinions: number }) {
  const safeRaw = Math.max(0, Math.min(100, raw)); const safeWeighted = Math.max(0, Math.min(100, weighted));
  return <section aria-label={`Club signal: ${safeRaw}% raw bullish and ${safeWeighted}% reputation-weighted bullish`} className="space-y-4"><div><span className="font-mono text-[10px] uppercase tracking-widest text-soft">Where the Club stands</span><div className="mt-1 flex items-end gap-3"><strong className="font-display text-4xl text-ink">{safeWeighted}%</strong><span className="pb-1 text-sm text-soft">weighted bullish</span></div></div><div className="relative h-10 overflow-hidden rounded-full bg-[var(--color-stance-bearish)]" role="img"><div className="h-full bg-[var(--color-stance-bullish)] transition-[width] motion-reduce:transition-none" style={{ width: `${safeWeighted}%` }} /><span className="absolute inset-0 grid place-items-center text-xs font-semibold text-white">Bullish / Bearish</span></div><div className="flex justify-between font-mono text-xs text-soft"><span>Raw crowd {safeRaw}%</span><span>{opinions.toLocaleString()} opinions</span></div></section>;
}

export function MemberReputationIdentity({ member }: { member: Reputation }) {
  return <div className="flex items-center gap-3"><Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" /><div className="min-w-0"><strong className="block truncate text-sm text-ink">{member.name}</strong><span className="text-xs text-soft">{member.belt}{member.expertise ? ` · ${member.expertise}` : ""}</span></div>{member.weight != null && <span className="ml-auto font-mono text-xs text-ink" aria-label={`Opinion weight ${member.weight} times`}>{member.weight.toFixed(1)}×</span>}</div>;
}

export function OpinionObject({ opinion }: { opinion: Opinion }) {
  return <article className="border-l-4 border-action py-2 pl-4"><MemberReputationIdentity member={opinion.author} /><div className="mt-4 flex items-center gap-2"><strong className="font-mono text-sm text-ink">${opinion.ticker}</strong><span className="text-xs font-semibold text-soft">{stanceLabel[opinion.stance]}{opinion.conviction ? ` · ${opinion.conviction}/5 conviction` : ""}</span></div><p className="mt-2 max-w-prose text-sm leading-relaxed text-ink">{opinion.thesis}</p>{opinion.risk && <p className="mt-2 text-xs text-soft"><strong>Changes my view:</strong> {opinion.risk}</p>}</article>;
}

export function ChangedMyMindObject({ from, to, reason, author }: { from: Stance; to: Stance; reason: string; author: Reputation }) {
  return <article className="border-y border-border py-4"><MemberReputationIdentity member={author} /><div className="my-3 flex items-center gap-3 font-display text-lg text-ink"><span>{stanceLabel[from]}</span><span aria-hidden>→</span><span>{stanceLabel[to]}</span><span className="sr-only">Changed stance</span></div><p className="text-sm leading-relaxed text-ink">{reason}</p></article>;
}

export function KaiAnnotation({ children }: { children: ReactNode }) { return <aside className="border-l-2 border-kai-blue pl-4" aria-label="Kai context"><span className="font-mono text-[10px] uppercase tracking-widest text-kai-blue">Kai spotted</span><p className="mt-1 text-sm leading-relaxed text-ink">{children}</p></aside>; }
export function SignalRow({ label, value, href }: { label: string; value: ReactNode; href?: string }) { const row=<><span className="text-sm text-ink">{label}</span><span className="ml-auto font-mono text-xs text-soft">{value}</span></>; return href?<Link href={href} className="flex border-b border-border py-3 focus-visible:outline-2 focus-visible:outline-action">{row}</Link>:<div className="flex border-b border-border py-3">{row}</div>; }
export function TickerQuickSheet({ children }: { children: ReactNode }) { return <section className="rounded-t-3xl border border-border bg-surface-raised p-5 shadow-lift" aria-label="Ticker quick view">{children}</section>; }
export function CircleObject({ name, state, progress, children }: { name: string; state: CircleState; progress: number; children?: ReactNode }) { return <article className="grid aspect-square place-items-center rounded-full border-[10px] border-action bg-surface-raised p-8 text-center" aria-label={`${name}, ${state}, ${Math.round(progress * 100)} percent remaining`}><div><span className="font-mono text-[10px] uppercase tracking-widest text-soft">{state}</span><h3 className="mt-2 font-display text-xl font-bold text-ink">{name}</h3>{children}</div></article>; }
export function KaiWatchStateObject({ state, children }: { state: KaiWatchState; children: ReactNode }) { return <div className="border-l-4 border-kai-blue py-2 pl-4"><span className="font-mono text-[10px] uppercase tracking-widest text-kai-blue">{state.replace("-", " ")}</span>{children}</div>; }
export function LiveStage({ title, children }: { title: string; children?: ReactNode }) { return <section className="min-h-72 bg-ink p-6 text-paper"><span className="font-mono text-[10px] uppercase tracking-widest text-action">● Live</span><h2 className="mt-12 max-w-xl font-display text-3xl font-bold">{title}</h2>{children}</section>; }
export function FamilyProgressPath({ value, label }: { value: number; label: string }) { return <div><div className="mb-2 flex justify-between text-sm text-ink"><span>{label}</span><span className="font-mono">{value}%</span></div><progress value={value} max={100} className="h-3 w-full accent-[var(--color-family-progress)]" /></div>; }
export function XpAwardMoment({ amount, reason }: { amount: number; reason: string }) { return <output className="flex items-baseline gap-2 text-action"><strong className="font-display text-3xl">+{amount} XP</strong><span className="text-sm text-soft">{reason}</span></output>; }
export function BeltProgressObject({ belt, value, next }: { belt: string; value: number; next: string }) { return <div><div className="flex justify-between"><strong className="font-display text-ink">{belt} belt</strong><span className="text-xs text-soft">Next: {next}</span></div><progress value={value} max={100} className="mt-3 h-2 w-full accent-action" /></div>; }

export { ClubMark };
export type { CircleState, KaiWatchState, Opinion, Reputation, Stance, TickerRank } from "./types";
