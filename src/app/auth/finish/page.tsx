"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side session pickup for the IMPLICIT (hash-fragment) email-link flow.
 *
 * Why this exists: admin-generated invite / magic-link emails use the default
 * `{{ .ConfirmationURL }}` template, which points at Supabase's
 * `/auth/v1/verify` endpoint. Because those links are minted server-side (no
 * PKCE code_verifier in the browser), GoTrue verifies the token and redirects
 * to our `redirect_to` with the session in the URL **hash fragment**:
 *
 *   /auth/callback?next=/onboarding#access_token=…&refresh_token=…&type=invite
 *
 * A server route handler (route.ts) can never see a hash fragment, so
 * `/auth/callback` bounces such links to `/auth/finish` (this page). Here, in
 * the browser, we read the hash, establish the session via `setSession`, and
 * hard-navigate onward so the freshly-written auth cookies reach the server.
 *
 * The server-visible flows (?code PKCE exchange, ?token_hash verifyOtp — the
 * 07-21 hardening) are still handled entirely in route.ts and never reach here.
 */
function AuthFinish() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // next: same-origin relative path only (open-redirect guard).
    const qs = new URLSearchParams(window.location.search);
    const rawNext = qs.get("next");
    const next =
      rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : "/dashboard";

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Error hash (expired / used / invalid link) → friendly re-request page.
    if (hash.get("error") || hash.get("error_description")) {
      window.location.replace("/auth/auth-code-error");
      return;
    }

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    if (!access_token || !refresh_token) {
      // Nothing to pick up — link was malformed or the hash was stripped.
      window.location.replace("/auth/auth-code-error");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) {
        setFailed(true);
        setTimeout(() => window.location.replace("/auth/auth-code-error"), 800);
        return;
      }
      // Hard navigation so the SSR middleware sees the just-written cookies and
      // the wizard (or dashboard) loads with a live session. Strips the hash.
      window.location.replace(next);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
      <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      <p className="mt-4 text-soft text-sm">
        {failed ? "Finishing sign-in…" : "Signing you in…"}
      </p>
    </div>
  );
}

export default function AuthFinishPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      }
    >
      <AuthFinish />
    </Suspense>
  );
}
