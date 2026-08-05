export const dynamic = "force-dynamic";

import { ClubMark } from "@/components/brand/ClubMark";
import { publicBrand } from "@/lib/experience/server";

/**
 * PRE-AUTH CHROME (lane L6, canvas boards 09–11).
 *
 * Was: a dark midnight page with the form floating inside a rounded, bordered
 * panel — the last surface still on the pre-redesign system. Now: the light
 * club system (`data-mode="club"`, so the accent resolves to volt orange for
 * the flat-orange CTA, the focus ring and the underline mark), the canvas's
 * warm radial header wash behind the ∞ mark, and the form sitting directly on
 * the paper with hairlines doing the structure.
 *
 * No `--accent-gradient` plumbing any more: the primary action is a FLAT
 * `bg-accent` fill (board 09/12), which reads `--accent-solid` directly and so
 * resolves correctly against the mode set on THIS element.
 *
 * Copy is untouched — the wordmark, the tagline and the copyright line are
 * byte-identical to the previous revision.
 *
 * NOTE: /onboarding renders `fixed inset-0` over this chrome by design; it
 * still inherits the mode set here because it is a DOM descendant.
 *
 * E1: the mode and the wordmark are no longer literals — they come from the
 * experience the ENTRY HOST resolves to (src/lib/experience). Host wins on every
 * logged-out surface. While the club host is not yet serving, publicBrand()
 * returns the Club umbrella for every host, so this renders exactly as before.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode, brand } = await publicBrand();

  return (
    <div
      data-mode={mode}
      className="relative min-h-dvh bg-paper text-ink"
    >
      {/* Canvas board 10: a 230px warm brand wash behind the mark. Token-mixed
          so it is correct on cream AND on the warm night page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 0%, color-mix(in srgb, var(--accent-solid) 16%, var(--paper)) 0%, var(--paper) 72%)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-12 sm:pt-16">
        <header className="flex flex-col items-center text-center">
          <ClubMark size={46} />
          <p className="mt-4 font-display text-[13px] font-extrabold uppercase tracking-[0.2em] text-ink">
            {brand}
          </p>
          <p className="mt-2 text-[13px] text-soft">
            Raise investors, not spenders.
          </p>
        </header>

        <main className="mt-11 flex-1">{children}</main>

        <footer className="f0-rule-top mt-12 pt-5 text-center text-[11px] text-soft">
          &copy; {new Date().getFullYear()} {brand}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
