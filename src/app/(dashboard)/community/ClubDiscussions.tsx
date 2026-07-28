"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FamilyTier } from "@/lib/tier";
import type { FeedPost } from "@/lib/feed";
import { timeAgo } from "@/lib/feed";
import Avatar from "@/components/Avatar";
import { RoomGrid } from "./ClubRooms";
import {
  BoardCard,
  CardRow,
  Pill,
  PillRow,
  RingMark,
  SectionLabel,
  StripeField,
  TickerMark,
} from "./board";

/* ══════════════════════════════════════════════════════════════════════════
   CLUB · DISCUSSIONS — Club Screens 02, built as drawn.

   Top to bottom, exactly the board: the HOT / NEW / TICKERS / MINE pill row, the
   pinned thread as a striped near-black field with the lassoed ring and the JUMP
   IN action, the coloured ROOMS BY TOPIC grid, then TRENDING THREADS as a card
   of divided rows.

   WHERE IT DIFFERS FROM THE DRAWING, AND WHY:
     · "152 new replies · 41 in thread now". A thread states the replies it has;
       nothing invents "in thread now" (there is no presence per thread) and no
       count is printed before it is true.
     · The row sparklines. The board draws a price squiggle beside each thread.
       There is no intraday series on this read, and drawing a squiggle without
       one is a fabricated chart — so the row carries its real last-voice line
       instead. The `Sparkline` primitive is built and waits for a real series.
   ══════════════════════════════════════════════════════════════════════════ */

type Filter = "hot" | "new" | "tickers" | "mine";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "tickers", label: "Tickers" },
  { id: "mine", label: "Mine" },
];

interface Thread {
  ticker: string;
  posts: FeedPost[];
  latest: string;
}

export default function ClubDiscussions({
  posts,
  meId,
  tier,
  roomId,
  onOpenRoom,
}: {
  posts: FeedPost[];
  meId: string | null;
  tier: FamilyTier;
  roomId: string;
  /** Picking a room on this screen hands the member into the Lounge on it. */
  onOpenRoom: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("hot");

  const threads = useMemo<Thread[]>(() => {
    const by = new Map<string, FeedPost[]>();
    for (const p of posts) {
      if (p.kind !== "post") continue;
      if (filter === "mine" && p.author?.id !== meId) continue;
      for (const t of p.ticker_tags ?? []) {
        const key = t.toUpperCase();
        const arr = by.get(key) ?? [];
        arr.push(p);
        by.set(key, arr);
      }
    }
    const list: Thread[] = Array.from(by.entries()).map(([ticker, list]) => ({
      ticker,
      posts: list,
      latest: list.reduce(
        (acc, p) => (p.created_at > acc ? p.created_at : acc),
        list[0]?.created_at ?? ""
      ),
    }));
    if (filter === "new") return list.sort((a, b) => b.latest.localeCompare(a.latest));
    return list.sort((a, b) => b.posts.length - a.posts.length || b.latest.localeCompare(a.latest));
  }, [posts, filter, meId]);

  const pinned = threads[0] ?? null;
  const rest = threads.slice(1, 6);

  return (
    <div className="space-y-6">
      <PillRow>
        {FILTERS.map((f) => (
          <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Pill>
        ))}
      </PillRow>

      {pinned ? (
        <PinnedThread thread={pinned} />
      ) : (
        /* FOUNDING STATE. The board's pinned field always has a thread in it; a
           club with no tagged names yet gets the same object, saying what puts a
           thread in this slot. It is never a grey placeholder. */
        <StripeField className="p-4">
          <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.14em] text-volt-300">
            No thread pinned yet
          </p>
          <p className="mt-2.5 max-w-[22ch] font-display text-[21px] font-black uppercase leading-[1.02] tracking-[-0.03em] text-[#F7F3EA]">
            Tag a name and it gets a thread.
          </p>
          <p className="mt-2 max-w-[40ch] text-[12.5px] leading-relaxed text-[#F7F3EA]/65">
            Every entry that tags the same company joins one thread. The busiest
            one pins here.
          </p>
          <Link
            href="/community/compose"
            className="mt-4 inline-flex rounded-[8px] bg-volt-500 px-4 py-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
          >
            Share your call
          </Link>
        </StripeField>
      )}

      <RoomGrid tier={tier} activeId={roomId} onSelect={onOpenRoom} />

      {rest.length > 0 && (
        <section>
          <SectionLabel>Trending threads</SectionLabel>
          <BoardCard flush>
            {rest.map((t) => (
              <CardRow key={t.ticker}>
                <TickerMark ticker={t.ticker} size={30} tone="cream" />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/research/${encodeURIComponent(t.ticker)}`}
                    className="f0-focus block truncate font-display text-[12.5px] font-bold text-ink hover:text-gold-700"
                  >
                    ${t.ticker} thread
                  </Link>
                  <span className="mt-0.5 block truncate text-[11px] text-soft">
                    {t.posts.length} {t.posts.length === 1 ? "entry" : "entries"} · last{" "}
                    {timeAgo(t.latest)}
                  </span>
                </span>
                <span className="flex shrink-0 -space-x-1.5">
                  {Array.from(
                    new Map(
                      t.posts
                        .filter((p) => p.author?.id)
                        .map((p) => [p.author!.id, p.author!])
                    ).values()
                  )
                    .slice(0, 3)
                    .map((a) => (
                      <Avatar
                        key={a.id}
                        name={a.display_name}
                        avatarUrl={a.avatar_url}
                        role={a.role}
                        size="xs"
                        className="ring-2 ring-card"
                      />
                    ))}
                </span>
              </CardRow>
            ))}
          </BoardCard>
        </section>
      )}
    </div>
  );
}

/* ── the pinned thread field ──────────────────────────────────────────────── */

function PinnedThread({ thread }: { thread: Thread }) {
  const voices = Array.from(
    new Map(
      thread.posts.filter((p) => p.author?.id).map((p) => [p.author!.id, p.author!])
    ).values()
  );
  return (
    <StripeField>
      <div className="relative px-4 pb-3.5 pt-3.5">
        <div className="flex items-center gap-2">
          <TickerMark ticker={thread.ticker} size={26} radius={7} tone="up" field="#FFFFFF" />
          <span className="rounded-[4px] bg-volt-500 px-[7px] py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white">
            Pinned
          </span>
        </div>
        <h2 className="mt-6 max-w-[15ch] font-display text-[23px] font-black uppercase leading-none tracking-[-0.03em] text-[#F7F3EA]">
          ${thread.ticker} thread
        </h2>
        <RingMark size={56} style={{ right: 18, top: 46 }} />
      </div>
      <div className="flex items-center gap-3 px-4 pb-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-[#F7F3EA]/62">
            {thread.posts.length} {thread.posts.length === 1 ? "entry" : "entries"} ·{" "}
            {voices.length} {voices.length === 1 ? "voice" : "voices"}
          </p>
          <span className="mt-2 flex -space-x-1.5">
            {voices.slice(0, 4).map((a) => (
              <Avatar
                key={a.id}
                name={a.display_name}
                avatarUrl={a.avatar_url}
                role={a.role}
                size="xs"
                className="ring-2 ring-[#14110F]"
              />
            ))}
          </span>
        </div>
        <Link
          href={`/research/${encodeURIComponent(thread.ticker)}`}
          className="shrink-0 rounded-[8px] bg-volt-500 px-4 py-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-volt-600"
        >
          Jump in
        </Link>
      </div>
    </StripeField>
  );
}
