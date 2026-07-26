"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import { BadgeCheck } from "lucide-react";
import { SectionLabel } from "./parts";
import type { PeopleResponse } from "@/lib/clubhome/contract";

/**
 * §10 People worth following (v1 = discovery, NO follow graph). Surfaces genuinely
 * useful members by research output / helpful votes: avatar, style tags, a reason
 * line, and "View profile". Deliberately NO follower counts (fake at our N) and
 * NO follow button yet. Kid-walled upstream. A horizontal ruled rail, not cards.
 */

export default function People({ people }: { people: PeopleResponse | null }) {
  const members = people?.members ?? [];
  if (members.length === 0) return null;

  return (
    <section aria-label="People worth following">
      <SectionLabel
        action={
          <Link href="/community" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            View all →
          </Link>
        }
      >
        People worth following
      </SectionLabel>

      <div className="mt-3 -mx-1 flex gap-0 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {members.map((mbr, i) => (
          <Link
            key={mbr.id}
            href={mbr.href}
            className={`group flex w-[220px] shrink-0 snap-start flex-col gap-2 px-4 ${
              i === 0 ? "" : "border-l border-sand"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={mbr.name} avatarUrl={mbr.avatar} size="md" />
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 font-display text-sm font-bold text-ink group-hover:text-volt-700">
                  <span className="truncate">{mbr.name}</span>
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                </span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {mbr.tags.slice(0, 2).map((t) => (
                    <span key={t} className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="line-clamp-2 text-[12px] leading-snug text-soft">{mbr.reason}</p>
            <span className="mt-auto pt-1 text-[12px] font-semibold text-volt-700">View profile →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
