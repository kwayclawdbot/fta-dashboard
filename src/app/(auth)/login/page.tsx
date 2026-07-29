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
import { designV2Enabled } from "@/lib/design-flag";

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

  // ── v2 conversion (design-project-v2) — board 10, email-first ─────────────
  // Same email/password flow, links and invite-rescue as v1 (handlers above);
  // re-skinned to the board on --cc-* tokens. The board features Apple/Google
  // above email, but OAuth is descoped for the conversion (email-first), so the
  // existing Google sign-in stays only as a quiet secondary option below the
  // form — no functionality removed, nothing new added. Off ⇒ v1 renders below.
  if (designV2Enabled()) {
    const fieldStyle = {
      background: "var(--cc-card, #1c1920)",
      border: "1px solid var(--cc-line, #2b2731)",
      color: "var(--cc-ink, #f4f0ec)",
    } as React.CSSProperties;
    const labelCls =
      "font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.16em]";
    return (
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
          GM. <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
          Sign in to see what the Club is watching.
        </p>

        {error && (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
            role="alert"
            style={{ background: "var(--cc-card2, #232028)", borderLeft: "2px solid var(--cc-orange, #ff7a1a)" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
          <label className="block">
            <span className={labelCls} style={{ color: "var(--cc-soft, #8d8794)" }}>
              Email
            </span>
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cc-dim, #5d5865)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl py-3 pl-11 pr-4 text-[15px] outline-none placeholder:opacity-60"
                style={fieldStyle}
              />
            </span>
          </label>

          <label className="block">
            <span className={labelCls} style={{ color: "var(--cc-soft, #8d8794)" }}>
              Password
            </span>
            <span className="relative mt-2 block">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cc-dim, #5d5865)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full rounded-xl py-3 pl-11 pr-11 text-[15px] outline-none placeholder:opacity-60"
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1"
                style={{ color: "var(--cc-dim, #5d5865)" }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="rounded text-[13px] transition-colors" style={{ color: "var(--cc-soft, #8d8794)" }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cc-halo inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50"
            style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Quiet secondary — the existing Google flow, preserved (not featured). */}
        <div className="my-6 flex items-center gap-3.5">
          <span aria-hidden className="h-px flex-1" style={{ background: "var(--cc-line, #2b2731)" }} />
          <span className="font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--cc-dim, #5d5865)" }}>
            or
          </span>
          <span aria-hidden className="h-px flex-1" style={{ background: "var(--cc-line, #2b2731)" }} />
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14px] font-semibold transition-colors"
          style={{ background: "var(--cc-card, #1c1920)", border: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-ink, #f4f0ec)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Invited-user rescue: no-password accounts can't sign in above. */}
        <div className="mt-9 pt-6" style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}>
          {inviteSent ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
              Sign-in link sent to <span className="font-semibold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>{inviteEmail}</span>. Open it to finish setting up your account.
            </p>
          ) : inviteOpen ? (
            <form onSubmit={handleInviteLink} className="space-y-4">
              <p className="max-w-[42ch] text-[13px] leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
                Invited to the club but never set a password? Enter your email and we&apos;ll send a fresh sign-in link.
              </p>
              {inviteError && (
                <p className="text-[13px] font-semibold" style={{ color: "var(--cc-ink, #f4f0ec)" }}>{inviteError}</p>
              )}
              <label className="block">
                <span className={labelCls} style={{ color: "var(--cc-soft, #8d8794)" }}>Email</span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cc-dim, #5d5865)" }} />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl py-3 pl-11 pr-4 text-[15px] outline-none placeholder:opacity-60"
                    style={fieldStyle}
                  />
                </span>
              </label>
              <button
                type="submit"
                disabled={inviteLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-bold disabled:opacity-50"
                style={{ background: "var(--cc-card2, #232028)", border: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-orange-ink, #ff7a1a)" }}
              >
                <Sparkles className="h-4 w-4" />
                {inviteLoading ? "Sending…" : "Send me a sign-in link"}
              </button>
            </form>
          ) : (
            <button
              onClick={() => setInviteOpen(true)}
              className="w-full rounded py-1 text-center text-[13px] transition-colors"
              style={{ color: "var(--cc-soft, #8d8794)" }}
            >
              Invited but can&apos;t sign in?
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-[13.5px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
          New here?{" "}
          <a href="https://familyinvestingclub.com" className="font-bold" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
            Join the club
          </a>
        </p>
      </m.div>
    );
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
