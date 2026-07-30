import { notFound } from "next/navigation";
import { getCircleRoomViewModel } from "@/ui-v3/club-data";
import CircleRoomScreen from "@/ui-v3/components/club/CircleRoomScreen";

/**
 * /v3/club/circles/[id] — "23 Inside Circle".
 *
 * `[id]` is `club_circles.slug`, which is the table's own URL identity (unique,
 * title-derived) — the same key `getCircleRoom()` takes.
 */
export const dynamic = "force-dynamic";

export default async function V3CircleRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const model = await getCircleRoomViewModel(decodeURIComponent(id));
  if (!model) notFound();
  return <CircleRoomScreen model={model} />;
}
