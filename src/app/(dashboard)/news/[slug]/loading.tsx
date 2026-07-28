/**
 * Route shell for an article — the reading measure and the board's carded
 * provenance strip, before the prose. Identical geometry to the surface's own
 * in-flight branch, so the route resolving does not cause a second swap.
 */
import { Bone, BoardCard } from "@/components/discover/board";

export default function NewsArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6" aria-busy="true">
      <Bone w={84} h={9} />
      <div className="mt-5 space-y-3">
        <Bone w={110} h={8} />
        <Bone w="80%" h={26} />
        <Bone w="100%" h={12} />
      </div>
      <BoardCard radius={12} className="mt-5 px-[13px] py-2.5">
        <Bone w={180} h={9} />
      </BoardCard>
      <div className="mt-7 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} w="100%" h={11} />
        ))}
      </div>
      <span className="sr-only">Loading the story</span>
    </div>
  );
}
