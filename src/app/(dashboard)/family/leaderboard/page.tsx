import { redirect } from "next/navigation";

/**
 * The old within-family leaderboard (lessons + streak) folded into the unified
 * belts leaderboard as the Individuals → "My family" scope. This route now
 * permanently redirects there so existing links keep working.
 */
export default function FamilyLeaderboardRedirect() {
  redirect("/leaderboard?scope=family");
}
