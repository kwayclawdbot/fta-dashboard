/**
 * Route-level loading skeletons (warm-paper). Rendered by each route's
 * loading.tsx so client-side navigation paints an instant, shape-matched
 * placeholder instead of a blank screen while the page's data waterfall runs.
 *
 * Pure presentational + server-renderable (no "use client"): keeps the
 * loading segment out of the JS bundle and lets it stream immediately.
 */

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-sand/50 ${className}`} />;
}

function Header({ wide = false, title }: { wide?: boolean; title?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="space-y-2">
        {title ? (
          // Real page title paints instantly so the skeleton is never a blank,
          // anonymous shimmer — the user always knows where they are.
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        ) : (
          <Block className="h-7 w-56" />
        )}
        <Block className="h-4 w-40 bg-sand/40" />
      </div>
      {wide && <Block className="h-9 w-32 rounded-full" />}
    </div>
  );
}

function Card({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-sand bg-paper p-5 space-y-3 ${className}`}>
      <Block className="h-4 w-1/3 bg-sand/40" />
      <Block className="h-3 w-full bg-sand/30" />
      <Block className="h-3 w-4/5 bg-sand/30" />
    </div>
  );
}

export type SkeletonVariant =
  | "default"
  | "feed"
  | "board"
  | "list"
  | "sessions"
  | "grid"
  | "narrow"
  | "chart"
  | "detail";

const WIDTHS: Record<SkeletonVariant, string> = {
  default: "max-w-5xl",
  feed: "max-w-6xl",
  board: "max-w-6xl",
  list: "max-w-4xl",
  sessions: "max-w-5xl",
  grid: "max-w-5xl",
  narrow: "max-w-3xl",
  chart: "max-w-6xl",
  detail: "max-w-6xl",
};

export default function DashboardSkeleton({
  variant = "default",
  title,
}: {
  variant?: SkeletonVariant;
  /** When set, the real page title renders in the header instead of a
   *  placeholder block — used by client pages that know their title up front. */
  title?: string;
}) {
  const width = WIDTHS[variant];

  let body: React.ReactNode;
  switch (variant) {
    case "feed":
      body = (
        <>
          <Block className="h-24 w-full rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-sand bg-paper p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Block className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Block className="h-3 w-32 bg-sand/40" />
                  <Block className="h-2.5 w-20 bg-sand/30" />
                </div>
              </div>
              <Block className="h-3 w-full bg-sand/30" />
              <Block className="h-3 w-11/12 bg-sand/30" />
              <Block className="h-40 w-full rounded-xl bg-sand/30" />
            </div>
          ))}
        </>
      );
      break;
    case "board":
      body = (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="h-44" />
          ))}
        </div>
      );
      break;
    case "list":
      body = (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-sand bg-paper p-5 flex items-center gap-4"
            >
              <Block className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-1/2 bg-sand/40" />
                <Block className="h-3 w-3/4 bg-sand/30" />
              </div>
              <Block className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      );
      break;
    case "sessions":
      body = (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-sand bg-paper p-5 flex items-start gap-4"
            >
              <Block className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Block className="h-5 w-2/3 bg-sand/40" />
                <Block className="h-3 w-1/2 bg-sand/30" />
                <Block className="h-3 w-1/3 bg-sand/30" />
              </div>
              <Block className="h-9 w-24 rounded-full" />
            </div>
          ))}
        </div>
      );
      break;
    case "grid":
      body = (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-sand bg-paper overflow-hidden">
              <Block className="h-32 w-full rounded-none bg-sand/30" />
              <div className="p-4 space-y-2">
                <Block className="h-4 w-3/4 bg-sand/40" />
                <Block className="h-3 w-full bg-sand/30" />
              </div>
            </div>
          ))}
        </div>
      );
      break;
    case "narrow":
      body = (
        <>
          <Card className="h-32" />
          <Card className="h-40" />
        </>
      );
      break;
    case "chart":
      body = <Block className="h-[calc(100vh-14rem)] w-full rounded-2xl" />;
      break;
    case "detail":
      body = (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Block key={i} className="h-10 w-full bg-sand/40" />
            ))}
          </div>
          <div className="space-y-4">
            <Block className="h-64 w-full rounded-2xl" />
            <Block className="h-4 w-full bg-sand/30" />
            <Block className="h-4 w-5/6 bg-sand/30" />
          </div>
        </div>
      );
      break;
    default:
      body = (
        <>
          <Block className="h-64 w-full rounded-2xl" />
          <Card className="h-40" />
        </>
      );
  }

  return (
    <div className={`${width} mx-auto space-y-6 animate-pulse`} aria-hidden="true">
      {variant !== "chart" && variant !== "detail" && (
        <Header
          wide={variant === "default" || variant === "board" || variant === "list"}
          title={title}
        />
      )}
      {body}
    </div>
  );
}
