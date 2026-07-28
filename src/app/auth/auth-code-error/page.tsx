"use client";

import { useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/site-url";

/**
 * Landing page for expired / invalid / already-used verification links.
 *
 * BOARD LANGUAGE (legacy purge): the page was a `paper-card` panel with a red
 * alert disc, a green success disc and a `.cta-button` — three chrome systems
 * that no longer exist. It is now ONE white board card on the warm paper ground:
 * a display heading, one honest sentence, one action. Standalone chrome, because
 * this route lives outside the (auth) group.
 *
 * COLOUR LAW: green/red are PRICE colours. An expired link is not a loss and a
 * sent email is not a gain, so neither state is coloured — the words carry the
 * state and the accent carries only the action.
 *
 * NO CLOCK IN RENDER: the footer used `new Date().getFullYear()`, which reads
 * the machine clock during render and can disagree between server and client.
 * The line states the owner without dating it.
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <p className="mb-7 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
        Cheat Code <span className="text-accent">Club</span>
      </p>

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="club-b-card w-full max-w-md px-6 py-7 sm:px-7"
      >
        {sent ? (
          <>
            <h1 className="font-display text-[26px] font-extrabold uppercase leading-[1.1] text-ink">
              Check your <span className="f0-underline-mark">email</span>
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-soft">
              We sent a fresh confirmation link to{" "}
              <span className="font-mono font-semibold text-ink">{email}</span>.
              Open it on this device to finish setting up your account.
            </p>
            <Link
              href="/login"
              className="f0-focus f0-press mt-6 inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] font-extrabold uppercase leading-[1.1] text-ink">
              This link has <span className="f0-underline-mark">expired</span>
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-soft">
              Verification links can only be used once and expire after a short
              while. Enter your email and we&apos;ll send a fresh one.
            </p>

            <form onSubmit={handleResend} className="mt-6">
              <label
                htmlFor="auth-retry-email"
                className="mb-1.5 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft"
                  aria-hidden
                />
                <input
                  id="auth-retry-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="f0-focus w-full rounded-[10px] border border-sand bg-paper py-3 pl-10 pr-4 text-[14px] text-ink placeholder:text-soft/60 focus:outline-none"
                />
              </div>

              {/* COLOUR LAW: no danger red — the message signals by weight in
                  the action ramp, exactly as the rest of the app does. */}
              {error && (
                <p className="mt-2.5 text-[12.5px] font-semibold leading-snug text-gold-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="f0-focus f0-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-50"
              >
                {loading ? "Sending…" : "Resend verification link"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <Link
              href="/login"
              className="f0-focus f0-press mt-5 inline-flex items-center gap-1.5 text-[13px] text-soft transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </>
        )}
      </m.div>

      <p className="mt-8 font-mono text-[9.5px] uppercase tracking-[0.16em] text-soft">
        Cheat Code Club
      </p>
    </div>
  );
}
