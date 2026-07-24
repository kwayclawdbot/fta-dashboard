"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, Lock, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/site-url";

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
      <h2 className="font-display text-xl font-bold text-midnight-100 mb-1">
        Welcome Back
      </h2>
      <p className="text-midnight-400 text-sm mb-6 font-body">
        Sign in to continue your journey
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-500 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-midnight-200 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-midnight-200 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-midnight-400 hover:text-midnight-200 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-midnight-400 hover:text-midnight-200 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="cta-button w-full py-2.5 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-midnight-800" />
        <span className="text-xs text-midnight-500">or</span>
        <div className="flex-1 h-px bg-midnight-800" />
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-midnight-700 bg-midnight-800 hover:bg-midnight-700 text-midnight-200 text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      {/* Invited-user rescue: no-password accounts can't sign in above. */}
      <div className="mt-6 border-t border-midnight-800 pt-5">
        {inviteSent ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-sm text-midnight-200">
              Sign-in link sent to{" "}
              <span className="text-midnight-50 font-medium">{inviteEmail}</span>.
              Open it to finish setting up your account.
            </p>
          </div>
        ) : inviteOpen ? (
          <form onSubmit={handleInviteLink} className="space-y-3">
            <p className="text-xs text-midnight-400">
              Invited to the club but never set a password? Enter your email and
              we&apos;ll send a fresh sign-in link.
            </p>
            {inviteError && (
              <p className="text-xs text-red-500">{inviteError}</p>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={inviteLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gold-400/40 bg-gold-400/10 text-gold-300 hover:bg-gold-400/15 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {inviteLoading ? "Sending…" : "Send me a sign-in link"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setInviteOpen(true)}
            className="w-full text-center text-sm text-midnight-400 hover:text-midnight-200 transition-colors"
          >
            Invited but can&apos;t sign in?
          </button>
        )}
      </div>

      {/* Membership is purchase- or invite-only */}
      <p className="mt-6 text-center text-sm text-midnight-400">
        New here?{" "}
        <a href="https://familyinvestingclub.com" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
          Join the club
        </a>
      </p>
    </m.div>
  );
}
