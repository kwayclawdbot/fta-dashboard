"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Ticket, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          invite_code: inviteCode || undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
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

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-4"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-400/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-gold-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-gold-400 mb-2">
          Check Your Email
        </h2>
        <p className="text-midnight-300 text-sm mb-6 font-body">
          We sent a confirmation link to{" "}
          <span className="text-midnight-100 font-medium">{email}</span>.
          <br />
          Click the link to activate your account.
        </p>
        <Link
          href="/login"
          className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors"
        >
          Back to login
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="font-display text-2xl font-bold text-gold-400 mb-1">
        Create Account
      </h2>
      <p className="text-midnight-300 text-sm mb-6 font-body">
        Start building generational wealth with your family
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-500 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-midnight-200 mb-1.5">
            Display Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-midnight-800 border border-midnight-600 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-colors text-sm"
            />
          </div>
        </div>

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
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-midnight-800 border border-midnight-600 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-colors text-sm"
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
              minLength={6}
              placeholder="Min. 6 characters"
              className="w-full pl-10 pr-11 py-3 rounded-lg bg-midnight-800 border border-midnight-600 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-colors text-sm"
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

        {/* Invite Code */}
        <div>
          <label className="block text-sm font-medium text-midnight-200 mb-1.5">
            Invite Code <span className="text-midnight-500">(optional)</span>
          </label>
          <div className="relative">
            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-midnight-800 border border-midnight-600 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30 transition-colors text-sm"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="cta-button w-full py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-midnight-700" />
        <span className="text-xs text-midnight-500">or</span>
        <div className="flex-1 h-px bg-midnight-700" />
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleSignup}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-midnight-600 bg-midnight-800 hover:bg-midnight-700 text-midnight-200 text-sm font-medium transition-colors"
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

      {/* Login link */}
      <p className="mt-6 text-center text-sm text-midnight-400">
        Already have an account?{" "}
        <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
