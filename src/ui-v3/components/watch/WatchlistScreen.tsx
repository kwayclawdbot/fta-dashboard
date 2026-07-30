import AppShell from "@/ui-v3/components/AppShell";
import type { WatchlistVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import WatchlistBoard from "./WatchlistBoard";

/**
 * /v3/watch/list — the WATCHLIST tab.
 *
 * NO ARTBOARD EXISTS for this screen. It is composed from the grammar (§9):
 * the Watch head and its tab rail, then the flat list row the screener and the
 * alert digest already use, carrying a ticker tile, the symbol, one caption of
 * real facts, and the stored close plus day change in mono.
 *
 * The list is a CLIENT component because it is the one Watch screen that
 * writes: adding and removing a symbol mutate `family_watchlist` in place, and
 * a row that only appears after a full navigation would make the add feel
 * broken. Everything it renders still arrives as a view model from
 * getWatchlist() — the board fetches nothing on mount.
 */
export default function WatchlistScreen({ model }: { model: WatchlistVM }) {
  return (
    <AppShell>
      <WatchHeader active="watchlist" tabGap="16px" />
      <WatchlistBoard
        rows={model.rows}
        familyId={model.familyId}
        viewerId={model.viewerId}
        // The fixtures path has no session to write for, so the board renders
        // the same rows and takes no clicks — the same contract ArmAlertButton
        // uses on "19 Alert Setup".
        interactive={model.source === "live" && Boolean(model.familyId)}
      />
    </AppShell>
  );
}
