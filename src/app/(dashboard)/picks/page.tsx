import { redirect } from "next/navigation";

// Team Picks retired → absorbed into the Community Watchlist.
export default function PicksRedirect() {
  redirect("/watchlist/community");
}
