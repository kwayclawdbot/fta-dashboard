import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /challenge → the HQ, which self-routes to the right phase. */
export default function ChallengeIndexPage() {
  redirect("/challenge/hq");
}
