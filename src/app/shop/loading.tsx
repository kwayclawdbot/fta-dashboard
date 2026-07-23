import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <DashboardSkeleton variant="grid" title="Shop" />
    </main>
  );
}
