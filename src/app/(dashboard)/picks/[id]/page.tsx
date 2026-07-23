import { redirect } from "next/navigation";

// Team Picks retired → the communal board replaces individual pick pages.
export default function PickDetailRedirect() {
  redirect("/watchlist/community");
}
