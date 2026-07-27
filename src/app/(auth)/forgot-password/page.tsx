"use client";

import { useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, ArrowLeft, ArrowRight } from "lucide-react";
import {
  AuthField,
  AuthHeading,
  AuthNotice,
  AuthSubmit,
  MarkWord,
} from "@/components/auth/AuthParts";

/**
 * Reset password — same pre-auth register as board 10. Restyle only: every
 * string here is byte-identical to the previous revision, including the
 * deliberately neutral "If an account exists for …" confirmation.
 */
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
      >
        <AuthHeading
          eyebrow="Password reset"
          title={
            <>
              Check Your <MarkWord>Email</MarkWord>
            </>
          }
        />
        <div className="mt-6">
          <AuthNotice tone="done">
            If an account exists for{" "}
            <span className="font-semibold text-ink">{email}</span>, we sent a
            password reset link.
          </AuthNotice>
        </div>
        <div className="f0-rule-top mt-8 pt-6">
          <Link
            href="/login"
            className="f0-focus inline-flex items-center gap-1.5 rounded font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AuthHeading
        eyebrow="Password reset"
        title={
          <>
            Reset <MarkWord>Password</MarkWord>
          </>
        }
        sub="Enter your email and we'll send you a reset link"
      />

      {error && (
        <div className="mt-6">
          <AuthNotice>{error}</AuthNotice>
        </div>
      )}

      <form onSubmit={handleReset} className="mt-8 space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />

        <AuthSubmit type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </AuthSubmit>
      </form>

      <div className="f0-rule-top mt-9 pt-6">
        <Link
          href="/login"
          className="f0-focus inline-flex items-center gap-1.5 rounded text-[13.5px] text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </m.div>
  );
}
