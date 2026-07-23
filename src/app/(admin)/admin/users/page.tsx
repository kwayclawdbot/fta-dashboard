import { redirect } from "next/navigation";

// The standalone Users directory has been merged into CRM ▸ Contacts
// (/admin/crm/members), which now carries the role/tier controls and the
// Invite-member modal. This route redirects so any bookmarks/links still land.
export default function AdminUsersRedirect() {
  redirect("/admin/crm/members");
}
