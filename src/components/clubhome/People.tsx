"use client";

import { useRef } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { Card, CardHead, formatFollowers } from "./parts";
import { useMemberHandles } from "@/lib/clubhome/handles";
import type { PeopleResponse } from "@/lib/clubhome/contract";

/**
 * §10 People worth following — mock-faithful strip. Avatar + name + verified, and
 * (fixtures / at-scale ONLY) a compact follower count. CARVE-OUT: real endpoints
 * never send follower counts (no follow graph at our N) — when absent the card
 * falls back to the member's derived reason line, so nothing is ever fabricated.
 * Kid-walled upstream. A horizontal ruled rail with a scroll control.
 */

export default function People({ people }: { people: PeopleResponse | null }) {
  const members = people?.members ?? [];
  const railRef = useRef<HTMLDivElement>(null);
  // Real endpoint omits href (no username leak); resolve id → username so
  // "View profile" links work. Fixtures already carry href, so skip the fetch.
  const needResolve = members.some((m) => !m.href);
  const handles = useMemberHandles(needResolve ? members.map((m) => m.id) : [], needResolve);
  if (members.length === 0) return null;

  return (
    <Card aria-label="People worth following">
      <CardHead
        title="People worth following"
        action={
          <Link href="/community" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            View all
          </Link>
        }
      />

      <div className="mt-3 flex items-stretch gap-0">
        <div
          ref={railRef}
          className="-mx-1 flex min-w-0 flex-1 gap-0 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {members.map((mbr, i) => {
            const hasFollowers = typeof mbr.followers === "number" && mbr.followers! > 0;
            const username = handles[mbr.id]?.username;
            const href = mbr.href || (username ? `/u/${encodeURIComponent(username)}` : null);
            const cls = `group flex w-[210px] shrink-0 snap-start items-center gap-3 px-4 py-1 ${
              i === 0 ? "" : "border-l border-sand"
            }`;
            const inner = (
              <>
                <Avatar name={mbr.name} avatarUrl={mbr.avatar} size="md" />
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 font-display text-sm font-bold text-ink group-hover:text-volt-700">
                    <span className="truncate">{mbr.name}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                  </span>
                  {hasFollowers ? (
                    <p className="text-[12px] text-soft">{formatFollowers(mbr.followers!)} followers</p>
                  ) : (
                    <p className="line-clamp-1 text-[12px] text-soft">{mbr.reason}</p>
                  )}
                </div>
              </>
            );
            return href ? (
              <Link key={mbr.id} href={href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={mbr.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => railRef.current?.scrollBy({ left: railRef.current.clientWidth * 0.7, behavior: "smooth" })}
          aria-label="More people"
          className="my-auto ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sand bg-card text-soft transition-colors hover:border-volt-400 hover:text-volt-700 active:scale-95"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
