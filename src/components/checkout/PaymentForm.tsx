"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  PaymentElement,
  AddressElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { USD, type BumpChoice, type CheckoutFlow } from "@/lib/checkout-bumps";

/**
 * The DOMINANT payment block (owner: payment is the largest visual mass, first in
 * reading order on mobile). WE own email + shipping; Stripe's Payment Element
 * renders only the card-method fields, themed to our tokens. On submit we create
 * the subscription server-side (default_incomplete) and confirm its first
 * invoice's PaymentIntent inline — no hosted/embedded Stripe page.
 */

type ShippingValue = {
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

export default function PaymentForm({
  flow,
  src,
  bump,
  needsShipping,
  totalCents,
  returnPath,
  fallbackHref,
}: {
  flow: CheckoutFlow;
  src: string;
  bump: BumpChoice;
  needsShipping: boolean;
  totalCents: number;
  returnPath: string;
  fallbackHref: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shippingRef = useRef<ShippingValue | null>(null);

  const ready = !!stripe && !!elements;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    // Validate all mounted Elements (payment + address).
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message || "Please check your details.");
      setSubmitting(false);
      return;
    }

    const sh = shippingRef.current;
    if (needsShipping && !sh?.address?.line1) {
      setError("Please complete your shipping address.");
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
          name: sh?.name,
          shipping: needsShipping
            ? { name: sh?.name, phone: sh?.phone, ...sh?.address }
            : undefined,
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
        <label
          htmlFor="checkout-email"
          className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-soft"
        >
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
          className="w-full rounded-xl border border-sand bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
        />
        <p className="mt-1.5 text-[11px] text-soft">
          Your receipt and account setup go here.
        </p>
      </div>

      {/* Shipping — only when a physical item is in the order */}
      {needsShipping && (
        <div>
          <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-soft">
            Ship my book to
          </p>
          <AddressElement
            options={{ mode: "shipping", fields: { phone: "always" } }}
            onChange={(e) => {
              shippingRef.current = e.value as ShippingValue;
            }}
          />
        </div>
      )}

      {/* Payment method — the only Stripe-rendered surface */}
      <div>
        <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-soft">
          Payment
        </p>
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
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-3 text-[13px] text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="cta-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base disabled:cursor-not-allowed disabled:opacity-70"
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
