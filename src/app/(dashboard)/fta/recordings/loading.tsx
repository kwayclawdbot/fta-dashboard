export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
      <div className="h-32 rounded-2xl bg-sand/40" />
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-sand/30" />
        ))}
      </div>
    </div>
  );
}
