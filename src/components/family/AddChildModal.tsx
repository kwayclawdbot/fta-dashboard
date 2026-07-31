"use client";

/**
 * ADD A CHILD / LINK AN EXISTING ACCOUNT — the two parent-side modals.
 *
 * Extracted from /family/members rather than inlined because that screen is
 * already carrying two modals (invite link, Kai memory) and both of these have
 * real multi-step state. The markup is deliberately the SAME vocabulary as the
 * modals already on that page — `bg-midnight-900 border border-midnight-700
 * rounded-xl p-6`, `cta-button`, `bg-midnight-800` inputs — because this is the
 * old-app family surface (warm-gold register, inverted midnight scale), not the
 * v3 surface, and a second dialect on one screen reads as a bug.
 *
 * Neither mode holds the service role: both post to a server route
 * (/api/family/children, /api/family/children/link) which re-derives the caller
 * and the family from the session. Nothing here is trusted.
 */

import { useCallback, useState } from "react";
import { m as mm, AnimatePresence } from "@/lib/motion";
import { X, Loader2, UserPlus, Link2, Check, AlertCircle } from "lucide-react";
import { AGE_BANDS, MIN_PASSWORD, type AgeBand } from "@/lib/family/children";

export type ChildMode = "create" | "link";

export interface AddedChild {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  age_group: string;
  track: string;
}

interface Props {
  mode: ChildMode;
  onClose: () => void;
  onAdded: (child: AddedChild) => void;
}

/** The band picker — same pill vocabulary the family surfaces already use. */
function BandPicker({
  value,
  onChange,
}: {
  value: AgeBand | null;
  onChange: (b: AgeBand) => void;
}) {
  return (
    <div className="flex gap-2">
      {AGE_BANDS.map((b) => {
        const on = value === b.value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            aria-pressed={on}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-display font-semibold transition-colors ${
              on
                ? "bg-gold-500 text-night-950"
                : "bg-midnight-800 border border-midnight-700 text-midnight-300 hover:text-midnight-100"
            }`}
          >
            {b.label}
            <span className={`ml-1.5 font-body font-normal ${on ? "opacity-70" : "text-midnight-500"}`}>
              {b.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-display font-semibold uppercase tracking-wider text-midnight-400 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-midnight-500 font-body mt-1">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-100 text-sm font-body placeholder:text-midnight-500 focus:outline-none focus:border-gold-400";

export default function AddChildModal({ mode, onClose, onAdded }: Props) {
  // shared
  const [band, setBand] = useState<AgeBand | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // create
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<AddedChild | null>(null);

  // link
  const [found, setFound] = useState<{ display_name: string | null; email: string | null } | null>(
    null
  );
  const [confirm, setConfirm] = useState("");

  const submitCreate = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/family/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, band, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Couldn't add them. Try again.");
        return;
      }
      setCreated(json.child as AddedChild);
      onAdded(json.child as AddedChild);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }, [name, band, email, password, onAdded]);

  const lookUp = useCallback(async () => {
    setError("");
    setFound(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/family/children/link?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Couldn't find that account.");
        return;
      }
      setFound(json.target);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }, [email]);

  const submitLink = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/family/children/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, band, confirm }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Couldn't move that account.");
        return;
      }
      onAdded(json.child as AddedChild);
      onClose();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }, [email, band, confirm, onAdded, onClose]);

  const canCreate = name.trim().length > 0 && !!band && email.includes("@") && password.length >= MIN_PASSWORD;
  const canLink = !!found && !!band && confirm.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <AnimatePresence>
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <mm.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto max-h-[88vh] overflow-y-auto rounded-xl bg-midnight-900 border border-midnight-700 p-6 z-50"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/20 text-gold-700">
              {mode === "create" ? <UserPlus className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            </span>
            <h3 className="font-display text-base font-bold text-midnight-100">
              {mode === "create" ? "Add a child" : "Link an existing account"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-midnight-400 hover:text-midnight-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── created confirmation ── */}
        {mode === "create" && created ? (
          <div>
            <p className="text-sm text-midnight-300 font-body">
              <span className="font-semibold text-midnight-100">{created.display_name}</span> is in
              your family. They can sign in right now with the email and password you just set —
              nothing to confirm, no link to chase.
            </p>
            <div className="mt-4 rounded-lg bg-midnight-800 border border-midnight-700 p-3 text-sm font-body text-midnight-200">
              <p className="truncate">{created.email}</p>
              <p className="text-xs text-midnight-500 mt-1">
                Give them the starter password you chose. They can change it in Settings.
              </p>
            </div>
            <button onClick={onClose} className="cta-button mt-5 w-full px-5 py-2.5 rounded-lg text-sm">
              Done
            </button>
          </div>
        ) : mode === "create" ? (
          <div className="space-y-4">
            <p className="text-sm text-midnight-400 font-body">
              You make the account, so nothing depends on your child following a link. They can sign
              in the moment you&apos;re done.
            </p>

            <Field label="Their name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Eli"
                maxLength={60}
              />
            </Field>

            <Field label="Age band">
              <BandPicker value={band} onChange={setBand} />
            </Field>

            <Field
              label="Their email"
              hint="Most families use an address the parent manages — it's how they sign in."
            >
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eli@example.com"
                autoComplete="off"
              />
            </Field>

            <Field label="Starter password" hint={`At least ${MIN_PASSWORD} characters. They can change it later.`}>
              <input
                className={inputClass}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="something they'll remember"
                autoComplete="new-password"
              />
            </Field>

            {error && (
              <p className="flex items-start gap-2 text-sm text-red-400 font-body">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <button
              onClick={submitCreate}
              disabled={!canCreate || busy}
              className="cta-button w-full px-5 py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? "Adding…" : "Add to my family"}
            </button>
          </div>
        ) : (
          /* ── link mode ── */
          <div className="space-y-4">
            <p className="text-sm text-midnight-400 font-body">
              If they already signed up on their own, pull that account in — they keep their
              progress, their password and their email.
            </p>

            <Field label="Their email">
              <div className="flex items-center gap-2">
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFound(null);
                    setConfirm("");
                    setError("");
                  }}
                  placeholder="eli@example.com"
                  autoComplete="off"
                />
                <button
                  onClick={lookUp}
                  disabled={!email.includes("@") || busy}
                  className="shrink-0 px-3 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-sm text-midnight-200 hover:text-midnight-100 disabled:opacity-40"
                >
                  {busy && !found ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
                </button>
              </div>
            </Field>

            {found && (
              <>
                <div className="flex items-start gap-2 rounded-lg bg-midnight-800 border border-midnight-700 p-3">
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-display font-semibold text-midnight-100 truncate">
                      {found.display_name || "That account"}
                    </p>
                    <p className="text-xs text-midnight-400 font-body truncate">{found.email}</p>
                    <p className="text-xs text-midnight-500 font-body mt-1">
                      On their own, with nothing to cancel.
                    </p>
                  </div>
                </div>

                <Field label="Age band">
                  <BandPicker value={band} onChange={setBand} />
                </Field>

                <div className="rounded-lg border border-gold-400/40 bg-gold-400/10 p-3">
                  <p className="text-sm text-midnight-200 font-body">
                    Their account moves into your family. You become the parent on it, they become a
                    child, and their own household goes away.
                  </p>
                </div>

                <Field label="Type their email to confirm">
                  <input
                    className={inputClass}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={email}
                    autoComplete="off"
                  />
                </Field>
              </>
            )}

            {error && (
              <p className="flex items-start gap-2 text-sm text-red-400 font-body">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            {found && (
              <button
                onClick={submitLink}
                disabled={!canLink || busy}
                className="cta-button w-full px-5 py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Moving…" : "Move them into my family"}
              </button>
            )}
          </div>
        )}
      </mm.div>
    </AnimatePresence>
  );
}
