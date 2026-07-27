"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { CollectiveResponse } from "@/lib/clubhome/contract";

/**
 * MEMBER PRESENCE — the "other people are in here with you" line.
 *
 * A hairline-ruled row, not a card: an overlapped face stack, then ONE plain
 * sentence. The register is deliberately conversational ("34 people are reading
 * the same board as you today") rather than a dashboard stat — the number is a
 * fact about the room, not a KPI.
 *
 * REAL COUNT ONLY. `connectedMinds` renders only when the DATA lane says the
 * metric cleared its floor (`collective.floorMet`, FLOORS.connectedMinds). Below
 * floor the row keeps its identity but switches to founding-era copy — a small
 * room is stated as a small room, never dressed as a big one.
 *
 * THEME: the separating hairline is the foundation's `.f0-rule-top`, which
 * carries the same dark lift as the ledger's rules (bare --sand at 1px nearly
 * vanishes on the dark page). Avatar rings use `ring-paper` so the stack always
 * knocks out against the live page colour.
 *
 * KID WALL (unchanged law): kids never see member faces. The stack degrades to
 * the same faceless teal nodes the Collective uses, and the "see who's in" link
 * — a route into the adult community — is not rendered.
 */
export default function PresenceRow({
  collective,
  isKid,
  loading = false,
}: {
  collective: CollectiveResponse | null;
  isKid: boolean;
  /**
   * LOADING IS NOT EMPTY. Without a server seed `collective` is null while the
   * fetch is in flight, and the floor-not-met branch below ("You're in the
   * founding room…") was rendering on every load before the real member count
   * arrived. That copy is TRUE only when the club is genuinely below the floor.
   */
  loading?: boolean;
}) {
  const floorMet = collective?.floorMet ?? false;
  const minds = collective?.connectedMinds ?? 0;
  const faces = (collective?.avatars ?? []).slice(0, 6);
  const nodeCount = Math.max(faces.length, 5);

  return (
    /* LAYOUT: three flex children on one row put the sentence in a ~150px
       column at 390px, where it wrapped to six lines beside a squat avatar
       block. The stack and the action share the first line; the sentence gets
       the full measure underneath. At sm+ there is room to sit them together,
       so it returns to a single row there. */
    <section
      className="f0-rule-top pt-4"
      aria-label="Members in the Club today"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
      <div className="flex shrink-0 -space-x-2" aria-hidden>
        {isKid || faces.length === 0
          ? Array.from({ length: nodeCount }).map((_, i) => (
              <span
                key={`node-${i}`}
                className="h-7 w-7 rounded-full bg-teal-400 ring-2 ring-paper"
                style={{ opacity: 0.75 - (i % 4) * 0.13 }}
              />
            ))
          : faces.map((a) => (
              <Avatar
                key={a.id}
                name={a.name || "Member"}
                avatarUrl={a.url ?? undefined}
                size="sm"
                className="ring-2 ring-paper"
              />
            ))}
      </div>

      {/* gold-700 = the THEMED orange (club mode remaps the gold ramp to volt):
          #C24400 in light, lifted to #FF9A5C in dark. `volt-700` would freeze at
          #C24400 and go dim on the obsidian page. */}
      {!isKid && (
        <Link
          href="/community"
          className="ml-auto inline-flex shrink-0 items-center gap-1 font-display text-[13px] font-bold text-gold-700 hover:text-gold-600 sm:order-3 sm:ml-0"
        >
          Who&apos;s in <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <p className="mt-2 w-full min-w-0 text-[14px] leading-snug text-soft sm:mt-0 sm:w-auto sm:flex-1">
        {loading && !collective ? (
          /* Still arriving — a measure-shaped shimmer, never the founding line. */
          <span
            className="inline-block h-3.5 w-48 max-w-full rounded-full bg-ink/10 align-middle motion-safe:animate-pulse"
            aria-hidden
          />
        ) : floorMet ? (
          <>
            <span className="font-display font-extrabold tabular-nums text-ink">
              {minds.toLocaleString()}
            </span>{" "}
            people are reading the same board as you today.
          </>
        ) : isKid ? (
          <>You&apos;re one of the first people in here. Your reads help build the board.</>
        ) : (
          <>
            You&apos;re in the founding room — the board gets sharper with every member
            reading it.
          </>
        )}
      </p>
      </div>
    </section>
  );
}
