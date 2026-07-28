"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { beltProgress } from "@/lib/belts";
import { levelProgress } from "@/lib/xp";
import { Belt } from "@/components/art";
import { LevelObject } from "@/components/canvas2";

/**
 * BeltHeroStrip — the always-visible belt/XP progress hero for the Home command
 * center (Lane 11A). Shows the member's current belt, how far into it they are,
 * and what the next rung costs. Register-aware copy (kids get a warmer line).
 *
 * CANVAS V2 (M1): the paper-card is gone. This is the same ruled strip the Club
 * home closes on (clubhome/YouStrip) so a family account and a solo account
 * wear one rank object rather than two.
 *
 * DESIGN SYSTEM REBUILD: the strip used to hand-roll the bar, the "N XP to X"
 * line and a 2.5px coloured stub standing in for the belt. All three are now
 * the shared objects — <LevelObject/> for the bar and its two figures,
 * <Belt/> for the belt — because this strip and /belts were two hand-built
 * answers to the same question and had already drifted apart in type scale,
 * bar height and where the remaining-XP figure sat. There is one XP object in
 * the app now, and this is it wearing a belt.
 *
 * WHAT MOVED, AND WHY IT IS BETTER:
 *   · the lifetime-XP figure leaves the top-right and joins the footer row as
 *     "1,240 / 1,600 XP" — a bare total answers nothing on its own; the same
 *     number against its target answers "how far in am I" at a glance.
 *   · the "to next" figure gets the bold gold treatment, because it is the only
 *     line on the strip a member can act on.
 *   · "The ladder" link moves to the eyebrow's right-hand `aside` slot, which
 *     is where every LevelObject puts its secondary item.
 *
 * The belt colour no longer tints the bar. It doesn't need to: the drawn belt
 * hanging off the left of the bar carries the belt's identity far better than a
 * 7px fill ever did, and the bar returns to the accent every other meter in the
 * app uses.
 *
 * Every string, the `data-tour` hook and the belt maths are untouched.
 */
export default function BeltHeroStrip({ xp, isKid = false }: { xp: number; isKid?: boolean }) {
  const { current, next, pct, toNext, nextIsNewBelt } = beltProgress(xp);
  // The absolute XP the next rung sits at. beltProgress reports the DISTANCE;
  // the level table is where the threshold itself lives, and it is the same
  // table beltProgress derives from, so the two can never disagree.
  const target = levelProgress(xp).next?.min ?? null;

  return (
    <section className="f0-rule-top pt-4" data-tour="belt" aria-label="Your belt">
      <LevelObject
        label={
          <>
            {current.label}
            <span className="ml-1.5 font-body text-[11px] font-normal normal-case tracking-normal text-soft">
              · {current.level.name}
            </span>
          </>
        }
        pct={pct}
        value={xp}
        target={target}
        toNext={toNext}
        nextLabel={
          next
            ? isKid
              ? nextIsNewBelt
                ? `your ${next.belt.name} belt!`
                : "your next level!"
              : next.label
            : null
        }
        maxedLabel="Black Belt earned — top of the ladder"
        leading={<Belt rank={current} size={52} title={current.label} />}
        aside={
          <Link
            href="/belts"
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
          >
            {isKid ? "My belt" : "The ladder"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />
    </section>
  );
}
