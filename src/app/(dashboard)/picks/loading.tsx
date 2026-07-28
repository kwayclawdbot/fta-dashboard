/**
 * /picks is retired — page.tsx (and [id]/page.tsx) redirect to the Community
 * Watchlist, which absorbed Team Picks. This shell only ever shows for the
 * instant of that redirect.
 *
 * (The mockup's "Official Club Picks" board — 17 Club Picks — is drawn as a TAB
 * of `watch`, not as this route, so the board's picks surface belongs to the
 * watchlist lane. What lives on /picks is only the door a stale bookmark hits.)
 *
 * It is deliberately NOT a skeleton: a skeleton is a promise that content is
 * arriving on THIS route, and nothing ever will. It is a redirect notice in the
 * board's own card language — one white card, an orange mono mark, a display
 * line — so a member landing on an old link reads a sentence rather than
 * watching grey rectangles for a board that no longer exists.
 */
import { BoardCard, SectionMark } from "@/components/discover/board";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <BoardCard radius={18} className="px-[15px] py-[14px]">
        <SectionMark label="Team Picks has moved" />
        <p className="mt-2 max-w-[46ch] font-display text-[21px] font-extrabold tracking-[-0.02em] text-ink">
          It&apos;s the Community Watchlist now.
        </p>
        <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-soft">
          One communal board the whole Club builds together — taking you there…
        </p>
      </BoardCard>
    </div>
  );
}
