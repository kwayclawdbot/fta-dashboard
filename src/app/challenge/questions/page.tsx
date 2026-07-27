import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChallengeShell from "@/components/challenge/ChallengeShell";
import QuestionsBoard from "@/components/challenge/QuestionsBoard";
import {
  fetchChallengeState,
  fetchQuestions,
  joinChallenge,
} from "@/lib/challenge/state";

export const dynamic = "force-dynamic";

/** /challenge/questions — MINUTE 2, the four get-to-know-you questions. */
export default async function ChallengeQuestionsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/challenge/questions");

  await joinChallenge(supabase);
  const [state, questions] = await Promise.all([
    fetchChallengeState(supabase),
    fetchQuestions(supabase),
  ]);
  if (!state) redirect("/dashboard");

  return (
    <ChallengeShell back="/challenge/welcome" backLabel="Welcome">
      <QuestionsBoard state={state} questions={questions} />
    </ChallengeShell>
  );
}
