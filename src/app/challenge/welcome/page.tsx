import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChallengeShell from "@/components/challenge/ChallengeShell";
import WelcomeBoard from "@/components/challenge/WelcomeBoard";
import { fetchChallengeState, joinChallenge } from "@/lib/challenge/state";

export const dynamic = "force-dynamic";

/**
 * /challenge/welcome — MINUTE 0.
 *
 * SERVER-SEEDED (§0.4): the journey row is provisioned and the whole state is
 * read here, so the first paint is the real board rather than a skeleton that
 * flashes a founding state while a client fetch is in flight.
 */
export default async function ChallengeWelcomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/challenge/welcome");

  await joinChallenge(supabase);
  const state = await fetchChallengeState(supabase);
  if (!state) redirect("/dashboard");

  const meta = auth.user.user_metadata as { display_name?: string } | null;
  const firstName = (meta?.display_name || "").split(" ")[0] || "";

  return (
    <ChallengeShell>
      <WelcomeBoard state={state} firstName={firstName} />
    </ChallengeShell>
  );
}
