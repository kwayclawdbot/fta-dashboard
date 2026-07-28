export const dynamic = "force-dynamic";

import Link from "next/link";
import { CheckCircle2, Package, Mail } from "lucide-react";
import { formatUsd } from "@/lib/shop";

async function fetchSession(sessionId: string) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${sk}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      amount_total?: number;
      customer_details?: { email?: string; name?: string };
    };
  } catch {
    return null;
  }
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const session = session_id ? await fetchSession(session_id) : null;
  const email = session?.customer_details?.email;
  const name = session?.customer_details?.name;

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <CheckCircle2 className="h-9 w-9" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-black text-ink">
        Thank you{name ? `, ${name.split(" ")[0]}` : ""}!
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-soft">
        Your order is confirmed{session?.amount_total ? ` (${formatUsd(session.amount_total)})` : ""}. Your
        books are printed on demand and shipped straight to your door — you&apos;ll get tracking by
        email as soon as they&apos;re on the way.
      </p>

      <div className="mt-8 w-full space-y-3 text-left">
        {email && (
          <div className="flex items-start gap-3 rounded-2xl border border-sand bg-[var(--card)] p-4">
            <Mail className="mt-0.5 h-5 w-5 text-gold-600" />
            <div>
              <p className="font-semibold text-ink">Receipt on its way</p>
              <p className="text-sm text-soft">We emailed your receipt to {email}.</p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 rounded-2xl border border-sand bg-[var(--card)] p-4">
          <Package className="mt-0.5 h-5 w-5 text-gold-600" />
          <div>
            <p className="font-semibold text-ink">Printed just for you</p>
            <p className="text-sm text-soft">
              Print-on-demand takes a few business days before shipping. Hang tight — it&apos;s worth
              the wait.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/shop"
          className="rounded-full border border-sand px-5 py-2.5 font-semibold text-ink hover:bg-sand/50"
        >
          Keep browsing
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-5 py-2.5 font-semibold text-paper hover:opacity-90"
        >
          Go to my club
        </Link>
      </div>
    </main>
  );
}
