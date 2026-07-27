"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Lock,
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
  Users,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { referralLink, shareTargets, REFERRAL_SIGNUP_XP } from "@/lib/referral";
import { Sparkle } from "@/components/fic/glyphs/motifs";
import { DisplayHead, MeasureStrip, SectionRule } from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   REFERRALS — no canvas board exists for this surface, so it is derived from
   the canvas design language rather than invented: the same masthead scale,
   the same eyebrow + section-rule marking, hairline ledgers instead of boxes,
   and a stated founding state.

   THE OBJECT ON THIS PAGE IS THE LINK. It used to sit in a bordered `bg-card`
   rectangle beside a button — a generic card container, and the one thing the
   brand register bans outright. It is now set as a mono line on a hairline
   baseline, the same treatment the display-name field gets in Settings: the
   link reads as a value you can take, not as a widget.

   COMMERCIAL COPY IS BYTE-IDENTICAL to the version that shipped. Every string
   touching the offer — the lede with REFERRAL_SIGNUP_XP, "You earn N XP", the
   three How-it-works bodies, and the grown-ups-only block — is unchanged text
   moved between elements, never re-worded.

   COLOUR LAW: the share row is neutral. It used to paint each destination in
   its own brand hue (green WhatsApp, sky Facebook) — green is price, and the
   chip tints collapsed in dark. The glyph does the identifying now.
   ══════════════════════════════════════════════════════════════════════════ */

interface Stats {
  clicks: number;
  signups: number;
  xp: number;
}

export default function ReferralsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isParent, setIsParent] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [stats, setStats] = useState<Stats>({ clicks: 0, signups: 0, xp: 0 });
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const parent = profile?.role === "parent" || profile?.role === "admin";
      setIsParent(parent);

      if (parent) {
        // Lazily mint the permanent code (server-side, parent-gated).
        const { data: myCode } = await supabase.rpc(
          "get_or_create_referral_code"
        );
        setCode(myCode ?? null);

        if (myCode) {
          const { data: events } = await supabase
            .from("referral_events")
            .select("kind")
            .eq("code", myCode);
          const clicks = (events || []).filter((e) => e.kind === "click").length;
          const signups = (events || []).filter(
            (e) => e.kind === "signup"
          ).length;

          // XP earned is deterministic: attach_referral awards exactly
          // REFERRAL_SIGNUP_XP once per verified referred family, so the signup
          // count is the single source of truth. (Reading xp_events directly is
          // unreliable here — that table's SELECT policy is family-scoped, so a
          // parent without a family, or reading pre-aggregation, can miss rows.)
          const xp = signups * REFERRAL_SIGNUP_XP;

          setStats({ clicks, signups, xp });
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = useMemo(
    () => (code && origin ? referralLink(origin, code) : ""),
    [code, origin]
  );
  const targets = useMemo(() => (link ? shareTargets(link) : null), [link]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  async function nativeShare() {
    if (!link || !targets) return;
    try {
      await navigator.share({
        title: "Cheat Code Club",
        text: targets.message,
        url: link,
      });
    } catch {
      /* user dismissed */
    }
  }

  // LOADING ≠ EMPTY: this is the shape of the page arriving. The founding state
  // — a link nobody has followed yet — is designed separately, below.
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-8" aria-busy="true">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-sand/60 motion-safe:animate-pulse" />
          <div className="h-11 w-80 max-w-full rounded bg-sand/60 motion-safe:animate-pulse" />
          <div className="h-4 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
        </div>
        <div className="h-10 w-full rounded bg-sand/40 motion-safe:animate-pulse" />
        <div className="h-20 rounded bg-sand/30 motion-safe:animate-pulse" />
        <span className="sr-only">Loading your referral link</span>
      </div>
    );
  }

  if (!isParent) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <DisplayHead
          eyebrow="Grown-ups only"
          title="Invite Families"
          lede="Sharing and rewards are handled by the grown-ups. Ask a parent or guardian in your family to invite other families."
          aside={<Lock className="h-6 w-6 text-gold-600" />}
        />
        <Link
          href="/dashboard"
          className="cta-button f0-focus f0-press mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const untouched = stats.clicks === 0 && stats.signups === 0;

  return (
    <div className="mx-auto max-w-3xl pb-14">
      {/* Masthead */}
      <DisplayHead
        eyebrow="Grow the Circle"
        title="Invite a family, grow the club"
        lede={`Word of mouth between families is how the club grows. Share your personal link — when a new family joins, you earn ${REFERRAL_SIGNUP_XP} XP and help another family start learning together.`}
      />

      {/* ── THE LINK — the one object on this page ─────────────────────────
          Set on a baseline hairline, not inside a card. */}
      <section className="mt-9">
        <SectionRule
          action={
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold tracking-wide text-soft">
              <Sparkle className="h-3.5 w-3.5" />
              <span className="sr-only">Your code: </span>
              {code}
            </span>
          }
        >
          Your referral link
        </SectionRule>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <p
            className="min-w-0 flex-1 truncate border-b border-sand pb-2 font-mono text-[15px] text-ink sm:text-[17px]"
            title={link}
          >
            {link || "…"}
          </p>
          <button
            onClick={copyLink}
            className="f0-focus f0-press inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[14px] font-bold text-night-950"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy link
              </>
            )}
          </button>
        </div>

        {targets && (
          <div className="mt-7">
            <p className="text-eyebrow font-display font-bold uppercase text-soft">
              Share it
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canNativeShare && (
                <button
                  onClick={nativeShare}
                  className="f0-chip f0-chip-on f0-focus f0-press px-4 py-2.5 font-display text-[14px] font-bold"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
              )}
              <ShareLink href={targets.whatsapp} label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </ShareLink>
              <ShareLink href={targets.x} label="X">
                <XGlyph />
              </ShareLink>
              <ShareLink href={targets.facebook} label="Facebook">
                <FacebookGlyph />
              </ShareLink>
              <ShareLink href={targets.mailto} label="Email">
                <Mail className="h-4 w-4" />
              </ShareLink>
              <ShareLink href={targets.sms} label="Text">
                <MessageCircle className="h-4 w-4" />
              </ShareLink>
            </div>
          </div>
        )}
      </section>

      {/* What it has done so far — measures on the paper, not stat cards. */}
      <section className="mt-11">
        <SectionRule>What it has done so far</SectionRule>
        <div className="mt-5">
          <MeasureStrip
            items={[
              { label: "Link clicks", value: stats.clicks.toLocaleString() },
              { label: "Families joined", value: stats.signups.toLocaleString() },
              { label: "XP earned", value: stats.xp.toLocaleString() },
            ]}
          />
        </div>
        {/* FOUNDING STATE — three real zeros, said out loud instead of left to
            read as a broken counter. */}
        {untouched && (
          <p className="f0-rule-top mt-6 max-w-[62ch] pt-4 text-[13px] leading-relaxed text-soft">
            Nobody has followed your link yet — it was minted for you and these
            counts are real, not a placeholder. The first one moves the moment
            somebody taps it.
          </p>
        )}
      </section>

      {/* How it works */}
      <section className="mt-11">
        <SectionRule>How it works</SectionRule>
        <div className="f0-ledger mt-1">
          {[
            {
              icon: Share2,
              title: "Share your link",
              body: "Send it to a family who'd love learning to invest together. Copy it or use any share button above.",
            },
            {
              icon: Users,
              title: "They join the club",
              body: "When a new family creates an account through your link and confirms their email, we credit it to you automatically.",
            },
            {
              icon: Sparkles,
              title: `You earn ${REFERRAL_SIGNUP_XP} XP`,
              body: "Every welcomed family adds XP to your progress and gets a shout-out in the community feed. Building the circle is its own reward.",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex gap-4 py-5">
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold-700" />
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-extrabold text-ink">
                    {s.title}
                  </p>
                  <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-soft">
                    {s.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Share destination ────────────────────────────────────────────────────────
// One neutral chip per destination, on the shared .f0-chip geometry so the row
// matches every other chip set in the app. The glyph identifies the destination;
// no destination gets a colour of its own.
function ShareLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="f0-chip f0-focus f0-press px-4 py-2.5 font-display text-[14px] font-bold text-ink"
    >
      {children}
      {label}
    </a>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
