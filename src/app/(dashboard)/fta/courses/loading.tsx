export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
      <div className="h-32 rounded-2xl bg-sand/40" />
      <div className="grid md:grid-cols-2 gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-sand/30" />
        ))}
      </div>
    </div>
  );
}
