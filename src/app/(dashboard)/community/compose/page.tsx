import { redirect } from "next/navigation";

/**
 * /community/compose — RETIRED (owner directive, 2026-08-01).
 *
 * SHARE YOUR CALL was the structured composer for the Club feed. With
 * /community restored to the chat area there is no feed for a typed,
 * stance-carrying post to land in, so the destination no longer opens; the
 * route survives only to catch old links and hand them to the chat, whose own
 * composer is the way a member posts.
 *
 * ShareYourCallClient stays on disk, unrouted — the established policy is to
 * unroute rather than delete.
 */
export const dynamic = "force-dynamic";

export default async function ComposePage() {
  redirect("/community");
}
