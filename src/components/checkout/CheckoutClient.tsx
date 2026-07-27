"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { m, useReducedMotion } from "@/lib/motion";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { ClubWordmark } from "@/components/brand/ClubMark";
import OrderPanel from "@/components/checkout/OrderPanel";
import PaymentForm from "@/components/checkout/PaymentForm";
import { buildAppearance } from "@/lib/checkout-appearance";
import {
  BASE_TODAY_CENTS,
  bumpsForFlow,
  bumpNeedsShipping,
  type BumpChoice,
  type CheckoutFlow,
} from "@/lib/checkout-bumps";

/**
 * Custom checkout controller (Payment Element flow). The page is fully ours,
 * wrapped in data-mode="club" (warm-sand + volt-orange). Stripe is backend-only:
 * <Elements> is deferred-subscription mode with the live "due today" amount, so
 * toggling an order bump just updates that amount in place (no remount) and the
 * Payment Element reprices itself. On submit the payment form creates the
 * subscription server-side and confirms its invoice PaymentIntent inline.
 */

let stripeCache: Promise<Stripe | null> | null = null;
function getStripe(pk: string) {
  if (!stripeCache) stripeCache = loadStripe(pk);
  return stripeCache;
}

export default function CheckoutClient({
  flow,
  src,
  publishableKey,
  prefillEmail = "",
  token = "",
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  flow: CheckoutFlow;
  src: string;
  publishableKey: string | null;
  prefillEmail?: string;
  token?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
}) {
  const reduce = useReducedMotion();
  const [bump, setBump] = useState<BumpChoice>("none");
  const [dark, setDark] = useState(false);
  // Mount the Payment Element ONLY after its container has a stable, non-trivial
  // width. Stripe measures the element's width once at mount; mounting before the
  // grid/fonts settle makes it cache ~0 and render collapsed card fields — and a
  // later resize does NOT recover it. We poll the container width via rAF and
  // mount only once it's >200px and unchanged for 3 frames (with a safety
  // timeout so we never hang).
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) {
      setContainerReady(true);
      return;
    }
    let raf = 0;
    let lastW = -1;
    let stable = 0;
    const tick = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 200 && w === lastW) {
        if (++stable >= 3) {
          setContainerReady(true);
          return;
        }
      } else {
        stable = 0;
      }
      lastW = w;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(() => setContainerReady(true), 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
  }, []);

  useEffect(() => {
    const read = () => {
      const t = document.documentElement.dataset.theme;
      if (t === "dark") return setDark(true);
      if (t === "light") return setDark(false);
      setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    };
    read();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", read);
    return () => mq?.removeEventListener?.("change", read);
  }, []);

  const bumps = bumpsForFlow(flow);
  const selected = bumps.find((b) => b.id === bump);
  const total = BASE_TODAY_CENTS[flow] + (selected?.priceCents || 0);
  const needsShipping = flow === "vip" || bumpNeedsShipping(bump);
  const returnPath = flow === "vip" ? "/challenge/vip-success" : "/club/welcome";
  const fallbackHref =
    `/api/${flow === "vip" ? "challenge/vip-checkout" : "club/checkout"}` +
    `?fallback=1&src=${encodeURIComponent(src)}` +
    (bump !== "none" ? `&bump=${bump}` : "");

  const stripePromise = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  const appearance = useMemo(() => buildAppearance(dark), [dark]);

  const onBump = useCallback((next: BumpChoice) => setBump(next), []);

  const rise = reduce
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  // Deferred PAYMENT mode (matches confirming the invoice's PaymentIntent).
  // setupFutureUsage saves the card so the day-30 VIP charge + monthly renewals
  // succeed. Toggling a bump updates `amount` in place — no remount.
  // Card-only for brand coherence — no Link inline signup, no Cash App / Amazon
  // Pay tabs. The page reads as ours; Stripe renders only the card-field internals.
  const elementsOptions = {
    mode: "payment" as const,
    amount: total,
    currency: "usd",
    setupFutureUsage: "off_session" as const,
    paymentMethodTypes: ["card"],
    appearance,
  };

  return (
    <div
      data-mode="club"
      className="min-h-screen bg-paper text-ink"
      // TOKEN PLUMBING, not decoration. `--accent-gradient` is declared on
      // :root, so its var(--accent-a/b) references resolve against :ROOT's
      // values — re-pointing --accent-a via [data-mode="club"] on this
      // DESCENDANT does not reach it, and the .cta-button below renders FAMILY
      // GOLD on the checkout page. Re-declaring the expression here makes it
      // resolve against this element's club accents. Same defect L6 fixed on
      // the pre-auth wrappers; the dashboard never hit it because ModeManager
      // stamps data-mode on <html>, which IS :root.
      style={
        {
          "--accent-gradient":
            "linear-gradient(135deg, var(--accent-a), var(--accent-b))",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <header className="border-b border-sand">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <a href={backHref} aria-label="Cheat Code Club home" className="shrink-0">
            <ClubWordmark size={28} />
          </a>
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 font-display text-xs font-semibold text-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7 sm:py-11">
        {/* Title */}
        <m.div {...rise} className="max-w-2xl">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-gold-700">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-[1.08] text-ink sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-soft">
            {subtitle}
          </p>
        </m.div>

        <div className="mt-7 grid grid-cols-1 gap-6 lg:mt-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)] lg:gap-10">
          {/* Order summary — subordinate (right on desktop, slim bar on mobile) */}
          <div className="lg:order-2">
            <div className="lg:sticky lg:top-6">
              <OrderPanel flow={flow} bump={bump} onBump={onBump} />
            </div>
          </div>

          {/* PAYMENT — dominant (left on desktop, fills screen on mobile).
              NOTE: plain div (not m.div) + min-w-0 — animating the wrapper or a
              content-sized grid track made Stripe's Payment Element mismeasure
              its width and render collapsed. */}
          <div className="min-w-0 lg:order-1">
            <div
              ref={cardRef}
              className="rounded-2xl border border-sand bg-card p-5 shadow-lift sm:p-7"
            >
              {stripePromise && containerReady ? (
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <PaymentForm
                    flow={flow}
                    src={src}
                    bump={bump}
                    needsShipping={needsShipping}
                    totalCents={total}
                    returnPath={returnPath}
                    fallbackHref={fallbackHref}
                    prefillEmail={prefillEmail}
                    token={token}
                  />
                </Elements>
              ) : stripePromise ? (
                // Valid key, deferring mount one frame → brief sized skeleton.
                <div className="min-h-[280px] animate-pulse space-y-4 py-2">
                  <div className="h-11 rounded-xl bg-sand" />
                  <div className="h-11 rounded-xl bg-sand" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-11 rounded-xl bg-sand" />
                    <div className="h-11 rounded-xl bg-sand" />
                  </div>
                  <div className="mt-2 h-12 rounded-xl bg-gold-400/30" />
                </div>
              ) : (
                // No publishable key → straight to the hosted escape hatch.
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15">
                    <Lock className="h-6 w-6 text-gold-700" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Continue to secure checkout
                  </h3>
                  <a
                    href={fallbackHref}
                    className="cta-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px]"
                  >
                    <Lock className="h-4 w-4" /> Secure checkout
                  </a>
                </div>
              )}
            </div>

            {/* Trust strip */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-[12px] text-soft">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-gold-700" /> Stripe-secured
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-gold-700" /> Cancel anytime
              </span>
              <span className="opacity-80">Education, not financial advice.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
