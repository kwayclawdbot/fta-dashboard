"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/site-url";
import {
  AuthField,
  AuthHeading,
  AuthNotice,
  AuthOrRule,
  AuthSubmit,
  FieldToggle,
  GoogleButton,
  MarkWord,
} from "@/components/auth/AuthParts";

/**
 * Sign in — canvas board 10.
 *
 * Restyle only. Every string on this page is byte-identical to the previous
 * revision, including the join link and its destination. What changed is the
 * composition: the boxed panel is gone, the headline carries the canvas's
 * drawn underline on one word, social sits above the rule and email below it
 * (board 10's order), and every control now shares `.f0-focus` / `.f0-press`.
 *
 * DELIBERATELY NOT ADOPTED from board 10:
 *   · "25,842 members are already reading the room" — an invented number on a
 *     pre-auth page. Production is nowhere near it and no honest source exists.
 *   · The board's legal footer ("By continuing you agree to…") — new legal
 *     copy is not a restyle; it needs owner sign-off, not a design lane.
 *   · "Continue with Apple" — no Apple provider is configured.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // "Invited but can't sign in?" — invited users have no password yet; send a
  // fresh magic link that lands them in onboarding to set one.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function handleInviteLink(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl("/onboarding"),
      },
    });
    setInviteLoading(false);
    if (otpError) {
      setInviteError(otpError.message);
      return;
    }
    setInviteSent(true);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Admins land in the admin console; everyone else on the member dashboard.
    let dest = "/dashboard";
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signInData.user.id)
        .single();
      if (profile?.role === "admin") dest = "/admin/crm";
    }

    router.push(dest);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AuthHeading
        title={
          <>
            Welcome <MarkWord>Back</MarkWord>
          </>
        }
        sub="Sign in to continue your journey"
      />

      {error && (
        <div className="mt-6">
          <AuthNotice>{error}</AuthNotice>
        </div>
      )}

      {/* Social first, then the rule, then email — canvas board 10 order. */}
      <div className="mt-8">
        <GoogleButton onClick={handleGoogleLogin}>
          Continue with Google
        </GoogleButton>
      </div>

      <AuthOrRule label="or" />

      <form onSubmit={handleLogin} className="space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />

        <AuthField
          label="Password"
          icon={Lock}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          trailing={
            <FieldToggle
              onClick={() => setShowPassword(!showPassword)}
              label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </FieldToggle>
          }
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="f0-focus rounded text-[13px] text-soft transition-colors hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>

        <AuthSubmit type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </AuthSubmit>
      </form>

      {/* Invited-user rescue: no-password accounts can't sign in above. */}
      <div className="f0-rule-top mt-9 pt-6">
        {inviteSent ? (
          <AuthNotice tone="done">
            Sign-in link sent to{" "}
            <span className="font-semibold text-ink">{inviteEmail}</span>. Open
            it to finish setting up your account.
          </AuthNotice>
        ) : inviteOpen ? (
          <form onSubmit={handleInviteLink} className="space-y-4">
            <p className="max-w-[42ch] text-[13px] leading-relaxed text-soft">
              Invited to the club but never set a password? Enter your email and
              we&apos;ll send a fresh sign-in link.
            </p>
            {inviteError && <AuthNotice>{inviteError}</AuthNotice>}
            <AuthField
              label="Email"
              icon={Mail}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="f0-frame f0-focus f0-press inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-display text-[14px] font-bold text-gold-700 transition-colors disabled:opacity-50"
              style={{
                background:
                  "color-mix(in srgb, var(--accent-solid) 9%, transparent)",
              }}
            >
              <Sparkles className="h-4 w-4" />
              {inviteLoading ? "Sending…" : "Send me a sign-in link"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setInviteOpen(true)}
            className="f0-focus w-full rounded py-1 text-center text-[13px] text-soft transition-colors hover:text-ink"
          >
            Invited but can&apos;t sign in?
          </button>
        )}
      </div>

      {/* Membership is purchase- or invite-only */}
      <p className="mt-8 text-center text-[13.5px] text-soft">
        New here?{" "}
        <a
          href="https://familyinvestingclub.com"
          className="f0-focus rounded font-display font-bold text-gold-700 transition-colors hover:text-gold-600"
        >
          Join the club
        </a>
      </p>
    </m.div>
  );
}
