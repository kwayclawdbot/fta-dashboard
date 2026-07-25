"use client";

import { useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Routed through our Resend-backed endpoint (not GoTrue's SMTP, which has
    // been failing). Always neutral — the server never reveals if the account
    // exists, and delivers the reset link itself over Resend.
    try {
      await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* neutral — still show the check-your-email state */
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <m.div
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
          If an account exists for{" "}
          <span className="text-midnight-100 font-medium">{email}</span>, we
          sent a password reset link.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="font-display text-2xl font-bold text-gold-400 mb-1">
        Reset Password
      </h2>
      <p className="text-midnight-300 text-sm mb-6 font-body">
        Enter your email and we&apos;ll send you a reset link
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-500 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
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

        <button
          type="submit"
          disabled={loading}
          className="cta-button w-full py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-gold-400/70 hover:text-gold-400 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </p>
    </m.div>
  );
}
