import { redirect } from "next/navigation";

// Admin Team Picks retired → the Community Watchlist admin console.
export default function AdminPicksRedirect() {
  redirect("/admin/community-watchlist");
}
