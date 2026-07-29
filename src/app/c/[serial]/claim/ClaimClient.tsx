"use client";

/**
 * ClaimClient — the binding ceremony.
 *
 * Flow: (unbound chip) → sign-in handoff → pick one of your unchipped cards
 * (or mint a new one) → POST /api/ownership/claim → a one-time "the artifact and
 * the card become one" animation → land on the now-bound, tap-verified scan page.
 *
 * Auth is handled inline (compact email/password + Google) so the ceremony is
 * never interrupted by a full-page redirect to /login and back. A link to the
 * full sign-in page is offered as a fallback.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Gem,
  Loader2,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { OwnershipCard } from "@/lib/ownership/types";
import { createClient } from "@/lib/supabase/client";
import { getCollection, claimChip } from "@/components/ownership/api";
import { demoCards } from "@/components/ownership/demo";
import { formFactorMeta } from "@/components/ownership/scan";
import LivingCard from "@/components/ownership/LivingCard";

const BG = "#060708";
const INK = "#F4F1EA";
const SUB = "rgba(244,241,234,0.66)";
const FAINT = "rgba(244,241,234,0.42)";
const HAIRLINE = "rgba(244,241,234,0.12)";
const GOLD = "#E6B84D";

type Phase = "checking" | "signin" | "picker" | "binding" | "done" | "error";

/** Cards eligible to receive a chip: active only. (The backend enforces the
 *  one-chip-per-card uniqueness on claim, so a card that already carries a chip
 *  is rejected server-side.) */
function bindable(cards: OwnershipCard[]): OwnershipCard[] {
  return cards.filter((c) => c.status === "active");
}

export default function ClaimClient({
  serial,
  demo,
  chipSerial,
  formFactor,
  claimable,
  alreadyBound,
}: {
  serial: string;
  demo: boolean;
  chipSerial: string | null;
  formFactor: string | null;
  claimable: boolean;
  alreadyBound: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const ff = formFactorMeta(formFactor);
  const demoQ = demo ? "?demo=1" : "";
  const claimPath = `/c/${encodeURIComponent(serial)}/claim${demoQ}`;

  const [phase, setPhase] = useState<Phase>("checking");
  const [cards, setCards] = useState<OwnershipCard[]>([]);
  const [selected, setSelected] = useState<OwnershipCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (demo) {
      setCards(bindable(demoCards()));
      setPhase("picker");
      return;
    }
    const res = await getCollection();
    if (res.ok) {
      setCards(bindable(res.data));
      setPhase("picker");
    } else {
      setError(res.error);
      setPhase("error");
    }
  }, [demo]);

  // Boot: confirm claimability + auth state.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alreadyBound && !claimable) {
        if (alive) setPhase("done");
        return;
      }
      if (demo) {
        if (alive) await loadCards();
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (user) await loadCards();
      else setPhase("signin");
    })();
    return () => {
      alive = false;
    };
  }, [demo, alreadyBound, claimable, loadCards]);

  async function onBind(card: OwnershipCard) {
    setSelected(card);
    setError(null);
    setPhase("binding");
    const minAnim = new Promise((r) => setTimeout(r, reduce ? 400 : 1700));
    if (demo) {
      await minAnim;
      setPhase("done");
      return;
    }
    if (!chipSerial) {
      await minAnim;
      setError("We couldn't read this artifact's chip. Tap it against your phone again to activate.");
      setPhase("error");
      return;
    }
    const [res] = await Promise.all([claimChip({ chipSerial, cardId: card.id }), minAnim]);
    if (res.ok) setPhase("done");
    else {
      setError(res.error);
      setPhase("error");
    }
  }

  const content = useMemo(() => {
    // Already activated (someone bound it already, or it was just bound).
    if (alreadyBound && !claimable && phase === "done") {
      return <AlreadyBound serial={serial} demoQ={demoQ} />;
    }
    switch (phase) {
      case "checking":
        return <Centered><Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} /></Centered>;
      case "signin":
        return <SignIn claimPath={claimPath} noun={ff.noun} onSignedIn={loadCards} />;
      case "picker":
        return (
          <Picker
            cards={cards}
            noun={ff.noun}
            demo={demo}
            claimPath={claimPath}
            onBind={onBind}
          />
        );
      case "binding":
        return <Binding card={selected} noun={ff.noun} reduce={!!reduce} />;
      case "done":
        return <Done serial={serial} demoQ={demoQ} card={selected} noun={ff.noun} onGo={() => router.push(`/c/${encodeURIComponent(serial)}${demoQ}`)} />;
      case "error":
        return <ErrorState message={error} onRetry={() => setPhase(cards.length ? "picker" : "signin")} />;
    }
  }, [phase, cards, selected, error, ff.noun, claimPath, demo, demoQ, serial, alreadyBound, claimable, reduce, loadCards, router]);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden" style={{ background: BG, color: INK }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-0 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{ background: GOLD, opacity: 0.12, filter: "blur(90px)" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10 pt-6">
        <Link
          href={`/c/${encodeURIComponent(serial)}${demoQ}`}
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: SUB }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to card
        </Link>

        <AnimatePresence mode="wait">
          <m.div
            key={phase + (alreadyBound ? "-ab" : "")}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 flex-col"
          >
            {content}
          </m.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ── Sign-in (inline, compact) ──────────────────────────────────────── */

function SignIn({
  claimPath,
  noun,
  onSignedIn,
}: {
  claimPath: string;
  noun: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    onSignedIn();
  }

  async function google() {
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${claimPath}` },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="mt-9">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "rgba(230,184,77,0.12)", border: "1px solid rgba(230,184,77,0.35)" }}
      >
        <Lock className="h-5 w-5" style={{ color: GOLD }} />
      </div>
      <h1 className="mt-5 text-center font-display text-2xl font-extrabold" style={{ color: INK }}>
        Sign in to activate
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-[14px] leading-relaxed" style={{ color: SUB }}>
        This {noun} binds to a card in your collection. Sign in to your Cheat Code
        account to make it yours — permanently.
      </p>

      {err && (
        <div
          className="mt-5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(241,112,123,0.1)", border: "1px solid rgba(241,112,123,0.3)", color: "#F1707B" }}
        >
          {err}
        </div>
      )}

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: FAINT }} />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
            style={{ background: "rgba(244,241,234,0.05)", border: `1px solid ${HAIRLINE}`, color: INK }}
          />
        </label>
        <label className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: FAINT }} />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
            style={{ background: "rgba(244,241,234,0.05)", border: `1px solid ${HAIRLINE}`, color: INK }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#c8991f)", color: "#231a08" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Sign in & continue
        </button>
      </form>

      <button
        onClick={google}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium"
        style={{ background: "rgba(244,241,234,0.05)", border: `1px solid ${HAIRLINE}`, color: INK }}
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      <div className="mt-5 text-center">
        <Link
          href={`/login?returnTo=${encodeURIComponent(claimPath)}`}
          className="text-[12px] underline decoration-dotted underline-offset-4"
          style={{ color: FAINT }}
        >
          Use the full sign-in page
        </Link>
      </div>
    </div>
  );
}

/* ── Picker ─────────────────────────────────────────────────────────── */

function Picker({
  cards,
  noun,
  demo,
  claimPath,
  onBind,
}: {
  cards: OwnershipCard[];
  noun: string;
  demo: boolean;
  claimPath: string;
  onBind: (c: OwnershipCard) => void;
}) {
  const mintHref = `/collection/mint?returnTo=${encodeURIComponent(claimPath)}${demo ? "&demo=1" : ""}`;
  return (
    <div className="mt-7">
      <h1 className="font-display text-2xl font-extrabold" style={{ color: INK }}>
        Bind this {noun} to a card
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: SUB }}>
        Choose a card from your collection to live inside this artifact — or mint
        a new one for it. This bond is permanent.
      </p>

      {cards.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {cards.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onBind(c)}
                className="group block w-full text-left outline-none"
                aria-label={`Bind to ${c.assetSymbol}`}
              >
                <div className="transition-transform duration-200 group-active:scale-[0.97] group-hover:-translate-y-1">
                  <LivingCard card={c} size="shelf" interactive={false} />
                </div>
                <div
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ background: "rgba(230,184,77,0.1)", color: GOLD }}
                >
                  <Lock className="h-3 w-3" />
                  Bind
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="mt-6 rounded-2xl px-5 py-6 text-center"
          style={{ background: "rgba(244,241,234,0.035)", border: `1px dashed ${HAIRLINE}` }}
        >
          <p className="text-[14px]" style={{ color: SUB }}>
            You don&apos;t have any unbound cards yet. Mint one for this {noun} to
            give the artifact its digital title.
          </p>
        </div>
      )}

      <Link
        href={mintHref}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold"
        style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
      >
        <Plus className="h-4 w-4" />
        Mint a new card for it
      </Link>
    </div>
  );
}

/* ── Binding ceremony ───────────────────────────────────────────────── */

function Binding({ card, noun, reduce }: { card: OwnershipCard | null; noun: string; reduce: boolean }) {
  const Artifact = noun === "pendant" || noun === "coin" ? Gem : CreditCard;
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="relative flex items-center justify-center" style={{ width: 240, height: 260 }}>
        {/* pulsing gold rings */}
        {!reduce &&
          [0, 1, 2].map((i) => (
            <m.span
              key={i}
              className="absolute rounded-full"
              style={{ width: 120, height: 120, border: `1px solid ${GOLD}` }}
              initial={{ opacity: 0.6, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            />
          ))}

        {/* artifact token slides in from left */}
        <m.div
          className="absolute flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "rgba(230,184,77,0.14)", border: `1px solid ${GOLD}` }}
          initial={reduce ? false : { x: -70, opacity: 0 }}
          animate={{ x: reduce ? 0 : -6, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        >
          <Artifact className="h-7 w-7" style={{ color: GOLD }} />
        </m.div>

        {/* the chosen card slides in from right and settles at center */}
        <m.div
          className="absolute"
          style={{ width: 120 }}
          initial={reduce ? false : { x: 70, opacity: 0, rotate: 8 }}
          animate={{ x: reduce ? 0 : 6, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        >
          {card && <LivingCard card={card} size="shelf" interactive={false} />}
        </m.div>

        {/* merge flash */}
        {!reduce && (
          <m.div
            className="absolute rounded-full"
            style={{ width: 180, height: 180, background: GOLD, filter: "blur(30px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 1.2, delay: 0.7, repeat: Infinity }}
          />
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: SUB }}>
          Binding {noun} to card
        </span>
      </div>
    </div>
  );
}

/* ── Done ───────────────────────────────────────────────────────────── */

function Done({
  card,
  noun,
  onGo,
}: {
  serial: string;
  demoQ: string;
  card: OwnershipCard | null;
  noun: string;
  onGo: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <m.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#9c7a2a)",
          color: "#231a08",
          boxShadow: "0 12px 40px -12px rgba(230,184,77,0.6)",
        }}
      >
        <Check className="h-8 w-8" strokeWidth={3} />
      </m.div>

      <h1 className="mt-5 font-display text-2xl font-extrabold" style={{ color: INK }}>
        They&apos;re one now
      </h1>
      <p className="mx-auto mt-2 flex max-w-xs items-center justify-center gap-1.5 text-[14px] leading-relaxed" style={{ color: SUB }}>
        <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
        This {noun} and{card ? ` your ${card.assetSymbol} card` : " your card"} are
        permanently bound. Every tap will verify it as genuine.
      </p>

      {card && (
        <div className="mt-6 w-[150px]">
          <LivingCard card={card} size="shelf" interactive={false} />
        </div>
      )}

      <button
        onClick={onGo}
        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold"
        style={{ background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#c8991f)", color: "#231a08" }}
      >
        View your verified card
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function AlreadyBound({ serial, demoQ }: { serial: string; demoQ: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(230,184,77,0.12)", border: "1px solid rgba(230,184,77,0.35)" }}
      >
        <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-extrabold" style={{ color: INK }}>
        Already activated
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: SUB }}>
        This artifact is already bound to a card. There&apos;s nothing to claim —
        it&apos;s someone&apos;s.
      </p>
      <Link
        href={`/c/${encodeURIComponent(serial)}${demoQ}`}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
        style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
      >
        View the card
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <h1 className="font-display text-xl font-extrabold" style={{ color: INK }}>
        That didn&apos;t go through
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: SUB }}>
        {message || "Something interrupted the activation. Give it another try."}
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
        style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
      >
        Try again
      </button>
    </div>
  );
}

/* ── bits ───────────────────────────────────────────────────────────── */

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center py-16">{children}</div>;
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
