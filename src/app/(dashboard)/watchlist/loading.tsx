import { BoardSkeleton } from "@/components/alerts/board";

/** LOADING ≠ EMPTY, and the skeleton is the SAME object as the finished board
 *  (canvas 06/17 cards), so the hand-off does not flicker from rows into cards. */
export default function Loading() {
  return <BoardSkeleton label="your watchlist" />;
}
