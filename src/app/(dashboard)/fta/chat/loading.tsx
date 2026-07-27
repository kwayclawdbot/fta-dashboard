/** Route skeleton — mirrors the desk masthead + room panel (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-10" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-64 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
      <div className="mt-8 h-[62vh] min-h-[440px] animate-pulse rounded-2xl bg-sand/30" />
    </div>
  );
}
