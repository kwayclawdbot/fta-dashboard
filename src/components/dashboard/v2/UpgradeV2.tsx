"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronRight, GraduationCap, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTierState, type FamilyTier } from "@/lib/tier";
import { PRICING_MATRIX } from "@/lib/entitlements";

/**
 * /upgrade — v2 (design-project-v2), board-11 paywall language on the REAL
 * commercial source of truth. Preserves 100% of the surface's function: the
 * same tier detection (free → Club pitch, fic → FTA pitch, fta → status), the
 * same Stripe checkout URLs and prices ($99/mo Club, $2,997 FTA), the child
 * redirect, the lapsed-Club renewal, and self-serve billing (ManageBilling).
 * The heavy marketing narrative (6-week curriculum, FAQ) is intentionally not
 * reproduced here — the board-11 pattern is the compact paywall; the full v1
 * marketing page remains the fallback when the flag is off.
 */

const FIC_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";
const FTA_URL = "https://buy.stripe.com/9B6aEXdbt9pH2Sw8hlbEA0b";

const CLUB_HIGHLIGHTS = PRICING_MATRIX.filter(
  (r) => r.free !== r.club && r.club !== "—"
)
  .slice(0, 6)
  .map((r) => `${r.surface} — ${r.club}`);

const FTA_BENEFITS = [
  "Everything in the Club",
  "All tracks for the whole family",
  "Advanced 6-week live trading curriculum",
  "Priority live classes, Q&A, and recordings",
  "Premium FTA badge in the community",
  "Trading simulator, drills, and coach feedback",
];

function CheckList({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((f) => (
        <div key={f} className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
          <Check
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: accent ? "var(--cc-orange-ink, #ff7a1a)" : "var(--cc-up, #4ade80)" }}
          />
          {f}
        </div>
      ))}
    </div>
  );
}

function ManageBilling() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/portal");
        const json = (await res.json()) as { available?: boolean };
        if (!cancelled) setAvailable(res.ok && json.available === true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function open() {
    setOpening(true);
    setFailed(false);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string };
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setOpening(false);
  }

  if (available === null) return null;

  return (
    <div className="mt-8 pt-5" style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}>
      <p className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--cc-dim, #5d5865)" }}>
        Billing
      </p>
      {available ? (
        <>
          <button
            type="button"
            onClick={open}
            disabled={opening}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
            style={{ color: "var(--cc-ink, #f4f0ec)" }}
          >
            {opening ? "Opening…" : "Manage billing"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <p className="mt-1.5 max-w-[52ch] text-xs leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
            Update your card, download receipts, or cancel — in Stripe, where your
            payment details already live.
          </p>
          {failed && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--cc-soft, #8d8794)" }} role="status">
              That didn&apos;t open. Try again in a moment, or email{" "}
              <a href="mailto:support@cheatcode.com" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
                support@cheatcode.com
              </a>
              .
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 max-w-[52ch] text-xs leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
          Your membership isn&apos;t linked to a self-serve billing account, so
          there&apos;s nothing here to open yet. Email{" "}
          <a href="mailto:support@cheatcode.com" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
            support@cheatcode.com
          </a>{" "}
          and we&apos;ll make any change you need.
        </p>
      )}
    </div>
  );
}

const cardStyle = {
  background: "var(--cc-card, #1c1920)",
  border: "1px solid var(--cc-line, #2b2731)",
} as React.CSSProperties;

export default function UpgradeV2() {
  const router = useRouter();
  const supabase = createClient();
  const [tier, setTier] = useState<FamilyTier | null>(null);
  const [clubLapsed, setClubLapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        if (!cancelled) setTier("free");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (profile?.role === "child") {
        router.replace("/dashboard");
        return;
      }
      const { tier: t, clubLapsed: lapsed } = await getFamilyTierState(
        supabase,
        profile?.family_id
      );
      if (cancelled) return;
      setClubLapsed(lapsed);
      setTier(t);
    }
    load();
    const fallback = setTimeout(() => {
      if (!cancelled) setTier((prev) => prev ?? "free");
    }, 5000);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tier === null) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-20">
        <div
          className="h-6 w-6 animate-spin rounded-full"
          style={{ border: "2px solid var(--cc-line, #2b2731)", borderTopColor: "var(--cc-orange, #ff7a1a)" }}
        />
      </div>
    );
  }

  // ── FTA family: status ──
  if (tier === "fta") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 pb-14" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
        {clubLapsed && (
          <div className="mb-8 rounded-2xl p-5" style={cardStyle}>
            <p className="flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>
              <ShieldCheck className="h-4 w-4" /> Your Academy access is safe — forever
            </p>
            <h2 className="cc-display mt-3 text-[24px]">Keep your Club membership</h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
              Your 12 months of Cheat Code Club that came with the Academy have
              wrapped. FTA stays yours for life. Keep the Club layer going for
              $99/mo whenever you&apos;re ready.
            </p>
            <a
              href={FIC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cc-halo mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
            >
              Keep your Club membership — $99/mo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
        <div className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--cc-dim, #5d5865)" }}>
          your membership
        </div>
        <h1 className="cc-display mt-2 text-[34px]">You&apos;re an FTA family</h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
          Your whole family has full access to everything, including all of Cheat
          Code Club.
        </p>
        <div className="mt-6 rounded-2xl p-5" style={cardStyle}>
          <CheckList items={FTA_BENEFITS} accent />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/courses" className="cc-halo inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}>
            Continue the program <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/live-sessions" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-ink, #f4f0ec)" }}>
            Live classes
          </Link>
        </div>
        <ManageBilling />
      </div>
    );
  }

  // ── FREE member: the Club $99/mo paywall (board 11) ──
  if (tier === "free") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 pb-14" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
        <h1 className="cc-script text-[34px] leading-none" style={{ color: "var(--cc-ink, #f4f0ec)" }}>go pro</h1>
        <p className="mt-2 max-w-[58ch] text-sm leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
          You&apos;re exploring free. Joining opens Kai, full research, the
          screener, the community room, live classes and every course — and
          Family Mode is included the moment you want it.
        </p>

        <div
          className="cc-halo-soft relative mt-8 rounded-2xl p-5"
          style={{
            background: "linear-gradient(150deg, color-mix(in srgb, var(--cc-orange, #ff7a1a) 12%, var(--cc-card, #1c1920)) 0%, var(--cc-card, #1c1920) 65%)",
            border: "1.5px solid var(--cc-orange, #ff7a1a)",
          }}
        >
          <span className="absolute -top-2.5 right-5 rounded-full px-2.5 py-1 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-[0.14em]" style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}>
            Best Value
          </span>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="cc-display text-[24px]" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>Cheat Code Club</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>Unlock the intelligence.</p>
            </div>
            <p className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[24px] font-semibold">
              $99<span className="text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>/mo</span>
            </p>
          </div>
          <CheckList items={CLUB_HIGHLIGHTS} accent />
          <a
            href={FIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cc-halo mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold"
            style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
          >
            Join the Club — $99/mo <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-3 text-center text-xs" style={{ color: "var(--cc-dim, #5d5865)" }}>
            Monthly, cancel anytime · Whole family included · Keep your free progress
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl p-5" style={cardStyle}>
          <div className="min-w-0">
            <p className="text-[15px] font-bold">Ready to go all the way?</p>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
              FTA is the live, 6-week trade-ready program — the advanced add-on.
              Start with the Club and add it later.
            </p>
          </div>
          <a href={FTA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold" style={{ border: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-ink, #f4f0ec)" }}>
            Explore FTA — $2,997 <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="mt-10 flex max-w-[64ch] items-start gap-2 pt-5 text-xs leading-relaxed" style={{ borderTop: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-dim, #5d5865)" }}>
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Cheat Code Club is an education platform. Nothing in the app or community is financial advice or a promise of results. All in-app portfolio activity uses practice money — no live trading, ever.</span>
        </p>
      </div>
    );
  }

  // ── FIC family/member: the FTA $2,997 pitch (board 11) ──
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-14" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
      <h1 className="cc-script text-[34px] leading-none" style={{ color: "var(--cc-ink, #f4f0ec)" }}>go pro</h1>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed" style={{ color: "var(--cc-soft, #8d8794)" }}>
        You already know the foundations. Family Trading Academy is the live,
        guided 6-week program that takes a real beginner all the way to a written
        plan and a trading routine, with a coach.
      </p>

      <div
        className="cc-halo-soft relative mt-8 rounded-2xl p-5"
        style={{
          background: "linear-gradient(150deg, color-mix(in srgb, var(--cc-orange, #ff7a1a) 12%, var(--cc-card, #1c1920)) 0%, var(--cc-card, #1c1920) 65%)",
          border: "1.5px solid var(--cc-orange, #ff7a1a)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="cc-display text-[24px]" style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}>Family Trading Academy</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cc-soft, #8d8794)" }}>Beginner to trade ready, in six weeks.</p>
          </div>
          <p className="shrink-0 text-right font-[family-name:var(--font-plex-mono)] text-[22px] font-semibold">
            $2,997<span className="block text-[11px]" style={{ color: "var(--cc-soft, #8d8794)" }}>one-time</span>
          </p>
        </div>
        <CheckList items={FTA_BENEFITS} accent />
        <a
          href={FTA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cc-halo mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold"
          style={{ background: "var(--cc-orange, #ff7a1a)", color: "var(--cc-orange-deep, #0d0b0e)" }}
        >
          Upgrade to FTA — $2,997 <ArrowRight className="h-4 w-4" />
        </a>
        <p className="mt-3 text-center text-xs" style={{ color: "var(--cc-dim, #5d5865)" }}>
          One-time payment · Your $99/mo Club keeps going · Whole family included
        </p>
      </div>

      <p className="mt-8 flex items-center gap-2 text-[13px]" style={{ color: "var(--cc-soft, #8d8794)" }}>
        <GraduationCap className="h-4 w-4" /> Checkout opens securely with Stripe in a new tab.
      </p>

      <p className="mt-8 flex max-w-[64ch] items-start gap-2 pt-5 text-xs leading-relaxed" style={{ borderTop: "1px solid var(--cc-line, #2b2731)", color: "var(--cc-dim, #5d5865)" }}>
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Family Trading Academy is an education program. Nothing in the program, app, or community is financial advice or a promise of results. All in-app portfolio activity uses practice money — no live trading, ever.</span>
      </p>

      <ManageBilling />
    </div>
  );
}
