/**
 * Route shell for /news. The masthead, the pill row and the desk discs are
 * known at build time, so navigation lands on finished page furniture in the
 * board's card language and only the story column fills in.
 */
import { AI_GENERATED_TAG } from "@/lib/news/types";
import { Bone, SectionMark } from "@/components/discover/board";
import { NewsSkeleton } from "./NewsClient";

export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6 lg:max-w-3xl" aria-busy="true">
      <header>
        <h1 className="font-display text-[34px] font-extrabold lowercase leading-none tracking-[-0.035em] text-ink sm:text-[40px]">
          news
        </h1>
        <p className="mt-2 text-[12.5px] leading-snug text-soft">
          The market, explained for the whole family
        </p>
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
          {AI_GENERATED_TAG} · delayed market data
        </p>
      </header>

      {/* The pill row and the desk discs are furniture too — without their
          placeholders the whole column jumped the moment the route resolved. */}
      <div className="mt-5 flex items-center gap-4">
        <Bone w={54} h={22} className="!rounded-full" />
        <Bone w={72} h={10} />
        <Bone w={72} h={10} />
      </div>

      <section className="mt-6">
        <SectionMark label="In the news today" gloss="The names the desk is filing on" />
        <div className="mt-2.5 flex gap-[13px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bone w={46} h={46} className="!rounded-full" />
              <Bone w={28} h={7} className="mx-auto" />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <NewsSkeleton />
      </div>
    </div>
  );
}
