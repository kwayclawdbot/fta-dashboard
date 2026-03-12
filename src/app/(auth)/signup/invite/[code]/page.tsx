"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, Users, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteSignupForm />
    </Suspense>
  );
}

interface InviteData {
  family_id: string;
  family_name: string;
  invited_by_name: string;
  role?: string;
}

function InviteSignupForm() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const code = params.code as string;

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validateInvite() {
      // Look up invite code
      const { data: invite } = await supabase
        .from("family_invites")
        .select("family_id, role, expires_at, used")
        .eq("code", code)
        .single();

      if (
        !invite ||
        invite.used ||
        new Date(invite.expires_at) < new Date()
      ) {
        setInviteValid(false);
        setChecking(false);
        return;
      }

      // Get family info
      const { data: family } = await supabase
        .from("families")
        .select("id, name, owner_id")
        .eq("id", invite.family_id)
        .single();

      if (!family) {
        setInviteValid(false);
        setChecking(false);
        return;
      }

      // Get inviter name
      const { data: inviter } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", family.owner_id)
        .single();

      setInviteData({
        family_id: family.id,
        family_name: family.name,
        invited_by_name: inviter?.display_name || "A family member",
        role: invite.role,
      });
      setInviteValid(true);
      setChecking(false);
    }

    validateInvite();
  }, [code, supabase]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteData) return;
    setError("");
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          invite_code: code,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, auto-join the family
    if (signUpData.user && signUpData.session) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        display_name: displayName,
        family_id: inviteData.family_id,
        role: inviteData.role || "child",
        onboarding_complete: false,
      });

      // Mark invite as used
      await supabase
        .from("family_invites")
        .update({ used: true })
        .eq("code", code);

      router.push("/onboarding");
      router.refresh();
      return;
    }

    // Email confirmation required
    setSuccess(true);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-4"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="font-display text-2xl font-bold text-midnight-100 mb-2">
          Invalid or Expired Invite
        </h2>
        <p className="text-midnight-300 text-sm mb-6 font-body max-w-sm mx-auto">
          This invite link is no longer valid. Ask your family member to send a
          new invite, or create your own account.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="cta-button px-6 py-3 rounded-lg text-sm"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors"
          >
            Sign in instead
          </Link>
        </div>
      </motion.div>
    );
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
          Click it to join{" "}
          <span className="text-gold-400 font-medium">
            {inviteData?.family_name}
          </span>
          .
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
      {/* Invite banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-xl bg-gold-400/5 border border-gold-400/20 p-4 text-center"
      >
        <div className="w-10 h-10 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center mb-2">
          <Users className="w-5 h-5 text-gold-400" />
        </div>
        <p className="text-sm text-midnight-200 font-body">
          You&apos;ve been invited to join
        </p>
        <p className="font-display text-lg font-bold text-gold-400 mt-1">
          {inviteData?.family_name}
        </p>
        <p className="text-xs text-midnight-400 mt-1 font-body">
          by {inviteData?.invited_by_name}
        </p>
      </motion.div>

      <h2 className="font-display text-xl font-bold text-midnight-100 mb-1">
        Create Your Account
      </h2>
      <p className="text-midnight-300 text-sm mb-6 font-body">
        Sign up to join the family and start learning
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
            Your Name
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
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cta-button w-full py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Join Family & Create Account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-midnight-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
