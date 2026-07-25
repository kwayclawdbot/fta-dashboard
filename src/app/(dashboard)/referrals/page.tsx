"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  Gift,
  Lock,
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
  MousePointerClick,
  Users,
  Sparkles,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { referralLink, shareTargets, REFERRAL_SIGNUP_XP } from "@/lib/referral";
import { SunCircle, Sparkle } from "@/components/fic/glyphs/motifs";

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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-sand/60" />
        <div className="h-40 rounded-2xl bg-sand/40" />
        <div className="h-24 rounded-2xl bg-sand/40" />
      </div>
    );
  }

  if (!isParent) {
    return (
      <div className="max-w-lg mx-auto paper-card p-8 text-center mt-10">
        <Lock className="w-8 h-8 text-gold-500 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-ink mb-2">
          Invite Families
        </h1>
        <p className="text-soft mb-5">
          Sharing and rewards are handled by the grown-ups. Ask a parent or
          guardian in your family to invite other families.
        </p>
        <Link
          href="/dashboard"
          className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const statTiles = [
    {
      icon: MousePointerClick,
      label: "Link clicks",
      value: stats.clicks,
      accent: "bg-chip-sky text-sky-800",
    },
    {
      icon: Users,
      label: "Families joined",
      value: stats.signups,
      accent: "bg-chip-green text-green-700",
    },
    {
      icon: Trophy,
      label: "XP earned",
      value: stats.xp,
      accent: "bg-chip-amber text-gold-800",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
            <Gift className="w-3.5 h-3.5" />
            Grow the Circle
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Invite a family, grow the club
        </h1>
        <p className="text-soft mt-1 max-w-2xl leading-relaxed">
          Word of mouth between families is how the club grows. Share your
          personal link — when a new family joins, you earn{" "}
          <span className="font-semibold text-ink">
            {REFERRAL_SIGNUP_XP} XP
          </span>{" "}
          and help another family start learning together.
        </p>
      </div>

      {/* Hero: code + link + share */}
      <div className="relative overflow-hidden paper-card p-6 lg:p-7">
        <div className="pointer-events-none absolute -top-6 -right-6 opacity-50">
          <SunCircle className="h-40 w-40" />
        </div>

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-wider text-soft mb-2">
            Your referral link
          </p>

          {/* Copyable link row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 min-w-0 rounded-xl border border-sand bg-white px-4 py-3">
              <p className="truncate font-mono text-sm text-ink" title={link}>
                {link || "…"}
              </p>
            </div>
            <button
              onClick={copyLink}
              className="cta-button inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy link
                </>
              )}
            </button>
          </div>

          {/* Code chip */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-soft">Your code:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand text-ink text-sm font-bold font-mono tracking-wide">
              <Sparkle className="h-3.5 w-3.5" />
              {code}
            </span>
          </div>

          {/* Share buttons */}
          {targets && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-soft mb-2">
                Share it
              </p>
              <div className="flex flex-wrap gap-2">
                {canNativeShare && (
                  <button
                    onClick={nativeShare}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-white text-sm font-semibold hover:bg-gold-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                )}
                <ShareLink href={targets.whatsapp} label="WhatsApp" tone="green">
                  <MessageCircle className="w-4 h-4" />
                </ShareLink>
                <ShareLink href={targets.x} label="X" tone="ink">
                  <XGlyph />
                </ShareLink>
                <ShareLink href={targets.facebook} label="Facebook" tone="sky">
                  <FacebookGlyph />
                </ShareLink>
                <ShareLink href={targets.mailto} label="Email" tone="sand">
                  <Mail className="w-4 h-4" />
                </ShareLink>
                <ShareLink href={targets.sms} label="Text" tone="sand">
                  <MessageCircle className="w-4 h-4" />
                </ShareLink>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {statTiles.map((s, i) => {
          const Icon = s.icon;
          return (
            <m.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="paper-card p-4 sm:p-5 text-center"
            >
              <div
                className={`w-9 h-9 rounded-lg ${s.accent} flex items-center justify-center mx-auto mb-2`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <p className="font-display text-2xl font-bold text-ink tabular-nums">
                {s.value}
              </p>
              <p className="text-xs text-soft mt-0.5">{s.label}</p>
            </m.div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="paper-card p-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">
          How it works
        </h2>
        <div className="space-y-4">
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
              <div key={s.title} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-gold-700" />
                </div>
                <div>
                  <p className="font-display font-semibold text-ink">
                    {s.title}
                  </p>
                  <p className="text-sm text-soft leading-relaxed">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Share button ─────────────────────────────────────────────────────────────
const TONES: Record<string, string> = {
  green: "bg-chip-green text-green-700 hover:bg-green-100",
  sky: "bg-chip-sky text-sky-800 hover:bg-sky-100",
  amber: "bg-chip-amber text-gold-800 hover:bg-gold-100",
  ink: "bg-ink text-white hover:opacity-90",
  sand: "bg-sand text-ink hover:bg-[#E0D6BE]",
};

function ShareLink({
  href,
  label,
  tone,
  children,
}: {
  href: string;
  label: string;
  tone: keyof typeof TONES | string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${TONES[tone] || TONES.sand}`}
    >
      {children}
      {label}
    </a>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
