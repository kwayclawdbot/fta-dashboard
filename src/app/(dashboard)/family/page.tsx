import { redirect } from "next/navigation";

/**
 * /family is now a thin redirect to /family/overview — the authoritative
 * per-family view (roster lives under Members). Keeping the route avoids dead
 * links from older nav entries and bookmarks. The overview page's own guard
 * bounces non-parents / familyless viewers to /dashboard, so there is no loop.
 */
export default function FamilyIndexPage() {
  redirect("/family/overview");
}
