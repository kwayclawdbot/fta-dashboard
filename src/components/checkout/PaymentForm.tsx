"use client";

import { useState, type FormEvent } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { USD, type BumpChoice, type CheckoutFlow } from "@/lib/checkout-bumps";

/**
 * The DOMINANT payment block (owner: payment is the largest visual mass, first in
 * reading order on mobile). WE own email + shipping (plain themed inputs — not
 * Stripe's AddressElement, so the ONLY Stripe-rendered surface is the card
 * fields). On submit we create the subscription server-side (default_incomplete)
 * and confirm its first invoice's PaymentIntent inline — no hosted/embedded page.
 */

const inputCls =
  "w-full rounded-xl border border-sand bg-card px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15";
const labelCls =
  "mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-soft";

export default function PaymentForm({
  flow,
  src,
  bump,
  needsShipping,
  totalCents,
  returnPath,
  fallbackHref,
  prefillEmail = "",
  token = "",
}: {
  flow: CheckoutFlow;
  src: string;
  bump: BumpChoice;
  needsShipping: boolean;
  totalCents: number;
  returnPath: string;
  fallbackHref: string;
  prefillEmail?: string;
  token?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState(prefillEmail);
  const [ship, setShip] = useState({
    name: "",
    country: "US",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!stripe && !!elements;
  const setS = (k: keyof typeof ship) => (e: { target: { value: string } }) =>
    setShip((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (needsShipping && (!ship.name.trim() || !ship.line1.trim() || !ship.city.trim() || !ship.postal_code.trim())) {
      setError("Please complete your shipping address.");
      return;
    }

    setSubmitting(true);

    // Validate the Payment Element.
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message || "Please check your card details.");
      setSubmitting(false);
      return;
    }

    // Create the subscription + first-invoice PaymentIntent server-side.
    let clientSecret: string | undefined;
    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow,
          src,
          bump,
          email: email.trim().toLowerCase(),
          name: ship.name.trim() || undefined,
          shipping: needsShipping
            ? {
                name: ship.name.trim(),
                phone: ship.phone.trim() || undefined,
                line1: ship.line1.trim(),
                line2: ship.line2.trim() || undefined,
                city: ship.city.trim(),
                state: ship.state.trim() || undefined,
                postal_code: ship.postal_code.trim(),
                country: ship.country,
              }
            : undefined,
          token: token || undefined,
        }),
      });
      const j = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !j.clientSecret) {
        setError(j.error || "We couldn't start your payment. Please try again.");
        setSubmitting(false);
        return;
      }
      clientSecret = j.clientSecret;
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
      return;
    }

    // Confirm inline (Stripe handles any 3DS via redirect to return_url).
    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}${returnPath}`,
        receipt_email: email.trim().toLowerCase(),
      },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message || "Your payment could not be completed.");
      setSubmitting(false);
      return;
    }

    // Success without a redirect — send to the confirmation page.
    window.location.href = `${returnPath}?payment_intent=${paymentIntent?.id ?? ""}`;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Email — our own field */}
      <div>
        <label htmlFor="checkout-email" className={labelCls}>
          Email
        </label>
        <input
          id="checkout-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className={inputCls}
        />
        <p className="mt-1.5 text-[11px] text-soft">
          Your receipt and account setup go here.
        </p>
      </div>

      {/* Shipping — our own inputs, only when a physical item is in the order */}
      {needsShipping && (
        <div className="space-y-3">
          <p className={labelCls + " mb-0"}>Ship my book to</p>
          <input
            type="text"
            autoComplete="name"
            placeholder="Full name"
            value={ship.name}
            onChange={setS("name")}
            className={inputCls}
          />
          <select
            aria-label="Country"
            value={ship.country}
            onChange={setS("country")}
            className={inputCls}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <input
            type="text"
            autoComplete="address-line1"
            placeholder="Address line 1"
            value={ship.line1}
            onChange={setS("line1")}
            className={inputCls}
          />
          <input
            type="text"
            autoComplete="address-line2"
            placeholder="Apartment, suite, etc. (optional)"
            value={ship.line2}
            onChange={setS("line2")}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              autoComplete="address-level2"
              placeholder="City"
              value={ship.city}
              onChange={setS("city")}
              className={inputCls}
            />
            <input
              type="text"
              autoComplete="address-level1"
              placeholder="State"
              value={ship.state}
              onChange={setS("state")}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              autoComplete="postal-code"
              placeholder="ZIP / Postal"
              value={ship.postal_code}
              onChange={setS("postal_code")}
              className={inputCls}
            />
            <input
              type="tel"
              autoComplete="tel"
              placeholder="Phone"
              value={ship.phone}
              onChange={setS("phone")}
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* Payment method — the only Stripe-rendered surface */}
      <div>
        <p className={labelCls}>Payment</p>
        {ready ? (
          <PaymentElement options={{ layout: "tabs" }} />
        ) : (
          <div className="animate-pulse space-y-3 py-2">
            <div className="h-11 rounded-xl bg-sand" />
            <div className="h-11 rounded-xl bg-sand" />
          </div>
        )}
      </div>

      {error && (
        // COLOUR LAW: green/red is PRICE. A declined card is not a price, so
        // the failure is carried by an icon, a brand rule and weight — same
        // treatment AuthNotice uses, and it needs no `dark:` variant.
        <div
          role="alert"
          className="flex items-start gap-2.5 border-l-2 py-1 pl-3.5 text-[13px] font-semibold text-ink"
          style={{ borderLeftColor: "var(--accent-solid)" }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="f0-press f0-focus flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 font-display text-base font-bold tracking-[0.02em] text-[color:var(--accent-on)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> Pay {USD(totalCents)}
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-soft">
        Payments are encrypted and processed by Stripe. Having trouble?{" "}
        <a href={fallbackHref} className="font-semibold text-gold-700 underline">
          Use secure checkout
        </a>
        .
      </p>
    </form>
  );
}
