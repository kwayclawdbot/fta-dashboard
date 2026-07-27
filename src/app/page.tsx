export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClubMark } from "@/components/brand/ClubMark";

/**
 * SPLASH / ENTRY — canvas board 09.
 *
 * Behaviour is unchanged for a signed-in member: `/` still lands them on the
 * dashboard. What is new is that a signed-out visitor used to be bounced
 * `/` → `/dashboard` → `/login` and never saw a door at all. They now get the
 * board-09 splash: the ∞ mark on a warm radial field, the wordmark, the
 * tagline, and the two real doors — sign in, or join.
 *
 * DELIBERATELY NOT ADOPTED from board 09:
 *   · The "Reading the room…" progress bar. On the board it is a native app
 *     booting; on the web it would be a fake progress indicator under a page
 *     that has already finished loading. LOADING ≠ DECORATION.
 *   · Any member count, rating or performance line. Nothing on this page makes
 *     a claim about the Club's size or about members' results.
 *
 * Copy: the wordmark and the tagline are the strings the pre-auth chrome
 * already shipped; "Join the club" and its destination are lifted verbatim
 * from /login. No commercial copy is authored here.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div
      data-mode="club"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-6 pb-24 pt-16 text-ink"
      // See the note in (auth)/layout.tsx: --accent-gradient is declared on
      // :root, so a descendant re-pointing --accent-a never reaches it and the
      // CTA renders family gold. Re-declared here so it resolves club orange.
      style={
        {
          "--accent-gradient":
            "linear-gradient(135deg, var(--accent-a), var(--accent-b))",
        } as React.CSSProperties
      }
    >
      {/* Board 09's radial: warm at the top, paper by the middle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 18%, color-mix(in srgb, var(--accent-solid) 20%, var(--paper)) 0%, var(--paper) 58%)",
        }}
      />

      <main className="relative flex w-full max-w-sm flex-col items-center text-center">
        {/* The mark held inside two concentric hairline rings — board 09's
            "signal" figure, drawn with rules rather than with a container. */}
        <div className="relative grid h-[132px] w-[132px] place-items-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              border:
                "1.5px solid color-mix(in srgb, var(--accent-solid) 35%, transparent)",
            }}
          />
          <span
            aria-hidden
            className="absolute -inset-4 rounded-full"
            style={{
              border:
                "1px solid color-mix(in srgb, var(--accent-solid) 16%, transparent)",
            }}
          />
          <ClubMark size={54} />
        </div>

        <h1 className="mt-9 font-display text-[38px] font-extrabold uppercase leading-[0.95] tracking-tight text-ink">
          Cheat Code
        </h1>
        <p className="mt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.42em] text-gold-700">
          Club
        </p>
        <p className="mt-5 text-[15px] text-soft">
          Raise investors, not spenders.
        </p>

        <div className="mt-11 flex w-full flex-col items-stretch gap-4">
          <Link
            href="/login"
            className="cta-button f0-focus f0-press inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px]"
          >
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[13.5px] text-soft">
            New here?{" "}
            <a
              href="https://familyinvestingclub.com"
              className="f0-focus rounded font-display font-bold text-gold-700 transition-colors hover:text-gold-600"
            >
              Join the club
            </a>
          </p>
        </div>
      </main>

      {/* Pinned, so the mark + wordmark stay optically centred in the field
          rather than being pushed up by a footer in the flow. */}
      <p className="absolute inset-x-0 bottom-9 text-center text-[11px] text-soft">
        &copy; {new Date().getFullYear()} Cheat Code Club. All rights reserved.
      </p>
    </div>
  );
}
