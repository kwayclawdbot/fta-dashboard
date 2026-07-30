"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "./BrandMark";
import FieldInput from "./FieldInput";
import PillButton from "./PillButton";
import styles from "./LoginScreen.module.css";

/**
 * "10 Login", translated from the artboard — and wired to the SAME Supabase auth
 * the old /login page uses, so this is a real sign-in, not a mock.
 *
 * WHAT THE BOARD DRAWS THAT THIS DOES NOT, and why (see onboard-data.ts for the
 * full list):
 *
 *  · "25,842 members are already reading the room." — no source exists for that
 *    number and production is nowhere near it. The board's own second clause
 *    ("Sign in to see what the Club is seeing") carries the line alone. The old
 *    login page rejected the same number for the same reason.
 *  · "Continue with Apple" — no Apple provider is configured on this Supabase
 *    project. A button that cannot sign anyone in is worse than no button.
 *
 * WHAT IT ADDS: a password field. The board draws email alone, but the auth this
 * app runs is `signInWithPassword`. The field is the same `FieldInput` primitive
 * repeated — the board's own box, twice.
 *
 * Where sign-in lands is decided by the caller (`next`), because the flow puts
 * the seeding step between here and Home only for a member who has no watchlist
 * yet. This screen just reports success.
 */
export default function LoginScreen({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // `next` is a server route that re-checks the session and decides between
    // the seeding step and Home, so the redirect has to re-run on the server.
    router.replace(next);
    router.refresh();
  }

  async function handleGoogle() {
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <BrandMark size="auth" />
        <div className={styles.wordmark}>
          Cheat Code <span className={styles.wordmarkClub}>Club</span>
        </div>
      </div>

      <div className={styles.body}>
        <h1 className={styles.greeting}>GM. 👋</h1>
        <p className={styles.subtitle}>Sign in to see what the Club is seeing.</p>

        <div className={styles.providers}>
          <PillButton tone="surface" type="button" onClick={handleGoogle}>
            <span className={styles.googleG} aria-hidden="true">
              G
            </span>
            Continue with Google
          </PillButton>
        </div>

        <div className={styles.rule}>
          <span className={styles.ruleLine} />
          <span className={styles.ruleLabel}>OR</span>
          <span className={styles.ruleLine} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <FieldInput
            label="Email address"
            type="email"
            autoComplete="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldInput
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <PillButton type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </PillButton>
        </form>

        <p className={styles.join}>
          New here?{" "}
          <Link href="/v3/pricing" className={styles.joinLink}>
            Join the Club →
          </Link>
        </p>
      </div>

      <p className={styles.legal}>
        By continuing you agree to the Terms &amp; Privacy Policy.
        <br />
        Not investment advice. Opinions are the Club&rsquo;s, not brokers&rsquo;.
      </p>
    </div>
  );
}
