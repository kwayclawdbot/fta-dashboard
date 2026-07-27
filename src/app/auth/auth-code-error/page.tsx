"use client";

import { useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/site-url";

/**
 * Landing page for expired / invalid / already-used verification links.
 * Warm-paper styled, standalone (this lives outside the (auth) route group, so
 * it renders its own page chrome). Offers a one-tap "resend verification".
 */
export default function AuthCodeErrorPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // A magic link (OTP) works for every account that can reach this page — a
    // never-confirmed signup AND an admin-invited user who has no password yet
    // (for whom `resend({type:"signup"})` would fail as "already confirmed").
    // Lands them in onboarding; a fully set-up member is bounced to /dashboard.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl("/onboarding"),
      },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gold-600">
          Cheat Code Club
        </h1>
        <p className="mt-1.5 text-soft text-sm">
          Build Generational Wealth Together
        </p>
      </div>

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md paper-card p-8"
      >
        {sent ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-chip-green flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-display text-xl font-bold text-ink mb-2">
              Verification sent
            </h2>
            <p className="text-soft text-sm mb-6">
              We sent a fresh confirmation link to{" "}
              <span className="text-ink font-medium">{email}</span>. Open it on
              this device to finish setting up your account.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-gold-700 hover:text-gold-800 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink mb-2">
                This link has expired
              </h2>
              <p className="text-soft text-sm">
                Verification links can only be used once and expire after a short
                while. Enter your email and we&apos;ll send a fresh one.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-card border border-sand text-ink placeholder:text-soft/60 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition-colors text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="cta-button w-full py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Resend verification link"}
              </button>
            </form>

            <p className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-gold-700/80 hover:text-gold-800 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </p>
          </>
        )}
      </m.div>

      <p className="mt-8 text-soft text-xs">
        &copy; {new Date().getFullYear()} Cheat Code Club. All rights reserved.
      </p>
    </div>
  );
}
