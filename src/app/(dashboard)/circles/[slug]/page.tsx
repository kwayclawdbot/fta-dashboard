import CircleRoomSurface from "@/components/circles/CircleRoom";

export const dynamic = "force-dynamic";

/**
 * /circles/[slug] — one Circle: premise, clock, roster, thread.
 * Schema-backed by migration 190; the surface states its own absence if the
 * migration has not been applied to this deployment.
 */
export default async function CirclePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CircleRoomSurface slug={slug} />;
}
