/** Route skeleton — mirrors the desk masthead + the room card (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-10" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-64 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
      <div className="club-b-card mt-8 flex h-[62vh] min-h-[440px] flex-col justify-end gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-2/3 animate-pulse rounded-xl bg-sand/50" />
        ))}
        <div className="h-11 w-full animate-pulse rounded-xl bg-sand/40" />
      </div>
      <span className="sr-only">Loading the FTA traders room</span>
    </div>
  );
}
