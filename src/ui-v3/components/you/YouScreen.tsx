import type { YouViewModel } from "@/ui-v3/you-data";
import AppShell from "@/ui-v3/components/AppShell";
import ProfileHeader from "./ProfileHeader";
import StandingCards from "./StandingCards";
import StatTiles from "./StatTiles";
import StreakPanel from "./StreakPanel";
import RecentCalls from "./RecentCalls";

/**
 * "07 You Profile", translated from the artboard.
 *
 * Pure presentation. Every region omits itself when its slice of the view model
 * is null, which is how this same tree serves a member with a full history and
 * one who has not posted yet.
 */
export default function YouScreen({ model }: { model: YouViewModel }) {
  return (
    <AppShell>
      <ProfileHeader vm={model.header} />
      <StandingCards figure={model.figure} strengths={model.strengths} />
      <StatTiles tiles={model.tiles} />
      {model.streak ? <StreakPanel vm={model.streak} /> : null}
      {/* No v3 call-history screen has been translated, so "See all" has no
          destination yet and the action is omitted rather than pointed at a 404. */}
      <RecentCalls rows={model.calls} seeAllHref={null} />
    </AppShell>
  );
}
