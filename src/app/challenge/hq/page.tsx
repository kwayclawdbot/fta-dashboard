import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChallengeShell from "@/components/challenge/ChallengeShell";
import HqBoard from "@/components/challenge/HqBoard";
import { fetchChallengeState, joinChallenge } from "@/lib/challenge/state";

export const dynamic = "force-dynamic";

/**
 * /challenge/hq — the pre-season home and, from kickoff, the challenge home.
 *
 * The phase is decided by `challenge_state()` in Postgres against the cohort's
 * real timestamps, and passed down whole. Nothing about what is unlocked is ever
 * decided by the device clock.
 */
export default async function ChallengeHqPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/challenge/hq");

  await joinChallenge(supabase);
  const state = await fetchChallengeState(supabase);
  if (!state) redirect("/dashboard");

  return (
    <ChallengeShell>
      <HqBoard state={state} />
    </ChallengeShell>
  );
}
