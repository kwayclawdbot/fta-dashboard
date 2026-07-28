import { BoardSkeleton } from "@/components/alerts/board";

/** LOADING ≠ EMPTY — the club's board skeleton is the club's board, pulsing. */
export default function Loading() {
  return <BoardSkeleton label="the club's board" />;
}
