import { redirect } from "next/navigation";

/**
 * Membership is purchase- or invite-only: public self-serve signup is closed.
 * Buyers get a create-account email after Stripe checkout; family members join
 * via /signup/invite/[code]; admins can invite directly from the dashboard.
 */
export default function SignupClosed() {
  redirect("https://familyinvestingclub.com");
}
