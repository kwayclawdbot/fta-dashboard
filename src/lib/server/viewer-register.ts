import { cache } from "react";
import { redirect } from "next/navigation";
import { getRequestProfile } from "@/lib/supabase/rsc";
import { resolveViewAs } from "@/lib/server/view-as";
import { applyViewAs } from "@/lib/view-as";
import { deriveRegister, type Register } from "@/lib/register";

/**
 * THE SERVER-SIDE REGISTER, and the route guard built on it.
 *
 * /screener and /alerts each hand-rolled the same six lines (getUser → select
 * role, age_group, track → deriveRegister → redirect a kid). Every route that
 * has to close a door to a child now calls this instead, so the check is one
 * implementation and a new gated route is one line.
 *
 * THREE PROPERTIES WORTH KEEPING:
 *
 *   • ONE READ PER REQUEST. It resolves through getRequestProfile(), the
 *     request-scoped cached profile the (dashboard) layout has already fetched,
 *     so a guard costs a gated page nothing on top of the shell it was going to
 *     render anyway. `cache()` makes repeat calls within a render free.
 *   • IT HONOURS "VIEW AS". The admin preview (src/lib/view-as.ts) is applied
 *     exactly where the shell applies it and by the same gate — the cookie is
 *     never read for a non-admin — so an admin previewing the Kid register hits
 *     the same doors a real kid hits, which is the entire point of the preview.
 *   • IT FAILS OPEN ONLY FOR STRANGERS. No session ⇒ `signedIn:false` and the
 *     "adult" default, because the surfaces that use this (the public storefront)
 *     must stay readable for a logged-out visitor. Every guard below therefore
 *     tests `signedIn && register === "kid"`, never `register === "kid"` alone.
 */

export interface ViewerRegister {
  /** Is there an authenticated member behind this request at all? */
  signedIn: boolean;
  /** kid | teen | adult (after the admin preview override, if any). */
  register: Register;
  /** The effective role — the teen branch of the course rule needs it. */
  role: string | null;
}

export const getViewerRegister = cache(async (): Promise<ViewerRegister> => {
  const profile = await getRequestProfile();
  if (!profile) return { signedIn: false, register: "adult", role: null };

  const viewAs = await resolveViewAs(profile.role);
  const ctx = applyViewAs(
    {
      role: profile.role ?? undefined,
      age_group: profile.age_group ?? undefined,
      track: profile.track ?? undefined,
      tier: "fic",
      isSolo: false,
      clubLapsed: false,
    },
    viewAs
  );

  return {
    signedIn: true,
    register: deriveRegister(ctx),
    role: ctx.role ?? null,
  };
});

/** Is the member behind this request a kid? (false for a logged-out visitor.) */
export async function viewerIsKid(): Promise<boolean> {
  const { signedIn, register } = await getViewerRegister();
  return signedIn && register === "kid";
}

/**
 * Close this route to kids — the /screener pattern, in one call. Signed-out
 * visitors and every other register pass through untouched.
 *
 * MUST be awaited at the top of a server component / layout: redirect() throws
 * the Next.js NEXT_REDIRECT signal, so it can never sit inside a try/catch.
 */
export async function redirectKids(to = "/dashboard"): Promise<void> {
  if (await viewerIsKid()) redirect(to);
}
