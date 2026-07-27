"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "@/lib/motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/site-url";
import {
  AuthField,
  AuthHeading,
  AuthNotice,
  AuthSubmit,
  FieldToggle,
  MarkWord,
} from "@/components/auth/AuthParts";

/**
 * Invite signup — the family-member door. Restyle only: every string here,
 * including the invalid-invite copy and the button labels, is byte-identical
 * to the previous revision.
 *
 * The invite banner was a bordered, centred card; it is now a hairline-left
 * statement — the invitation is a fact about who you are joining, so it reads
 * as composed type, not as a badge in a box.
 */
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
      // Invite codes are bearer secrets. Validation runs through the
      // invite_details SECURITY DEFINER RPC — the family_invites/families tables
      // are RLS-locked and unreadable by a not-yet-signed-in visitor.
      const { data } = await supabase.rpc("invite_details", { p_code: code });
      const info = data as {
        valid?: boolean;
        family_id?: string;
        family_name?: string;
        inviter_name?: string;
        role?: string;
      } | null;

      if (!info?.valid) {
        setInviteValid(false);
        setChecking(false);
        return;
      }

      setInviteData({
        family_id: info.family_id!,
        family_name: info.family_name!,
        invited_by_name: info.inviter_name || "A family member",
        role: info.role,
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
        emailRedirectTo: authCallbackUrl(),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, auto-join the family. The join + invite
    // consume happen atomically inside the redeem_invite SECURITY DEFINER RPC (the
    // client can no longer write another family's invite row under RLS).
    if (signUpData.user && signUpData.session) {
      await supabase.rpc("redeem_invite", {
        p_code: code,
        p_display_name: displayName,
      });

      // Invited children finish a short kid onboarding at /onboarding
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // Email confirmation required
    setSuccess(true);
    setLoading(false);
  }

  // LOADING ≠ EMPTY: while the invite is being validated we show a skeleton of
  // the screen that is coming, never the invalid-invite branch.
  if (checking) {
    return (
      <div aria-busy className="animate-pulse space-y-4">
        <div className="h-3 w-24 rounded bg-sand" />
        <div className="h-8 w-3/4 rounded bg-sand" />
        <div className="h-3 w-2/3 rounded bg-sand" />
        <div className="h-12 rounded-xl bg-sand" />
        <div className="h-12 rounded-xl bg-sand" />
        <div className="h-12 rounded-xl bg-sand" />
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AuthHeading
          eyebrow="Invite"
          title={
            <>
              Invalid or Expired <MarkWord>Invite</MarkWord>
            </>
          }
          sub="This invite link is no longer valid. Ask your family member to send a new invite, or create your own account."
        />
        <div className="mt-8 flex flex-col gap-4">
          <Link
            href="/signup"
            className="cta-button f0-focus f0-press inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px]"
          >
            Create Account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="f0-focus rounded text-center font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            Sign in instead
          </Link>
        </div>
      </m.div>
    );
  }

  if (success) {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AuthHeading
          eyebrow="One more step"
          title={
            <>
              Check Your <MarkWord>Email</MarkWord>
            </>
          }
        />
        <div className="mt-6">
          <AuthNotice tone="done">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-ink">{email}</span>. Click it to
            join{" "}
            <span className="font-semibold text-ink">
              {inviteData?.family_name}
            </span>
            .
          </AuthNotice>
        </div>
        <div className="f0-rule-top mt-8 pt-6">
          <Link
            href="/login"
            className="f0-focus rounded font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
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
      {/* Who invited you — a hairline statement, not a bordered badge. */}
      <div
        className="f0-rule-left pl-4"
        style={{ borderLeftColor: "var(--accent-solid)", borderLeftWidth: "3px" }}
      >
        <p className="text-[13px] text-soft">You&apos;ve been invited to join</p>
        <p className="mt-1 font-display text-[22px] font-extrabold leading-tight text-ink">
          {inviteData?.family_name}
        </p>
        <p className="mt-1 text-[12.5px] text-soft">
          by {inviteData?.invited_by_name}
        </p>
      </div>

      <div className="mt-8">
        <AuthHeading
          title={
            <>
              Create Your <MarkWord>Account</MarkWord>
            </>
          }
          sub="Sign up to join the family and start learning"
        />
      </div>

      {error && (
        <div className="mt-6">
          <AuthNotice>{error}</AuthNotice>
        </div>
      )}

      <form onSubmit={handleSignup} className="mt-8 space-y-5">
        <AuthField
          label="Your Name"
          icon={User}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Your name"
        />

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
          minLength={6}
          placeholder="Min. 6 characters"
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

        <AuthSubmit type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Join Family & Create Account"}
        </AuthSubmit>
      </form>

      <p className="mt-8 text-center text-[13.5px] text-soft">
        Already have an account?{" "}
        <Link
          href="/login"
          className="f0-focus rounded font-display font-bold text-gold-700 transition-colors hover:text-gold-600"
        >
          Sign in
        </Link>
      </p>
    </m.div>
  );
}
