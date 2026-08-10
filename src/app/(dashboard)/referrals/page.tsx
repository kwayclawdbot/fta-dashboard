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
import { useAppMode } from "@/lib/useAppMode";
import { referralLink, shareTargets, REFERRAL_SIGNUP_XP } from "@/lib/referral";
import { Sparkle } from "@/components/fic/glyphs/motifs";
import {
  BoardMast,
  Card,
  WarmCard,
  Eyebrow,
  ListHead,
  StatTile,
  StatTileRow,
} from "@/components/you/parts";

/* ══════════════════════════════════════════════════════════════════════════
   REFERRALS — no board in the archive draws this surface, so it is composed
   from the vocabulary the boards DO draw: the wordmark masthead of board 07,
   the white rounded card with a hairline border, the warm brand-tinted card
   for the object that matters most (the link), the mono eyebrow, and the small
   stat tiles of board 07's five-across strip.

   COMMERCIAL COPY IS BYTE-IDENTICAL to the version that shipped. Every string
   touching the offer — the headline, the lede with REFERRAL_SIGNUP_XP, "You
   earn N XP", the three How-it-works bodies, and the grown-ups-only block — is
   unchanged text moved between elements, never re-worded. The masthead renders
   with NO case transform for exactly that reason: lowercasing a commercial
   headline is a change to commercial copy.

   COLOUR LAW: the share row is neutral. It used to paint each destination in
   its own brand hue (green WhatsApp, sky Facebook) — green is price, and the
   chip tints collapsed in dark. The glyph does the identifying now. The only
   accent on the surface is the copy button and the link card, both of which are
   the action.
   ══════════════════════════════════════════════════════════════════════════ */

interface Stats {
  clicks: number;
  signups: number;
  xp: number;
}

export default function ReferralsPage() {
  // CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): club
  // gets the terminal masthead register and white-caps section labels. EVERY
  // commercial string (headline, lede, "You earn N XP", the How-it-works
  // bodies) is byte-identical in both branches — same strings, different
  // classes, no case transform on the headline. Wiring (code mint, stats,
  // share targets, parent gate) untouched; family render byte-identical.
  const isClub = useAppMode() === "club";
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
        const { data: myCode } = await supabase.rpc("get_or_create_referral_code");
        setCode(myCode ?? null);

        if (myCode) {
          const { data: events } = await supabase
            .from("referral_events")
            .select("kind")
            .eq("code", myCode);
          const clicks = (events || []).filter((e) => e.kind === "click").length;
          const signups = (events || []).filter((e) => e.kind === "signup").length;

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
      <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
        <div className="h-9 w-64 max-w-full rounded bg-sand/60 motion-safe:animate-pulse" />
        <div className="h-10 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
        <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="club-b-card h-[52px] flex-1 rounded-[13px] motion-safe:animate-pulse"
            />
          ))}
        </div>
        <span className="sr-only">Loading your referral link</span>
      </div>
    );
  }

  if (!isParent) {
    return (
      <div className="mx-auto mt-12 max-w-lg space-y-4">
        <Eyebrow charged>Grown-ups only</Eyebrow>
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 font-display text-[34px] font-extrabold leading-none tracking-[-0.035em] text-ink">
            Invite Families
          </h1>
          <Lock className="mt-1 h-6 w-6 shrink-0 text-gold-600" />
        </div>
        <p className="max-w-[52ch] text-[13px] leading-relaxed text-soft">
          Sharing and rewards are handled by the grown-ups. Ask a parent or guardian in your
          family to invite other families.
        </p>
        <Link
          href="/dashboard"
          className="f0-focus f0-press mt-2 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-display text-sm font-bold tracking-[0.02em] text-[color:var(--accent-on)]"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const untouched = stats.clicks === 0 && stats.signups === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-14">
      {isClub ? (
        /* Terminal masthead — the SAME commercial strings, no case transform
           (lowercasing or uppercasing a commercial headline is a copy change). */
        <header>
          <h1 className="font-display text-[clamp(26px,7vw,32px)] font-black leading-[0.98] tracking-[-0.03em] text-ink">
            Invite a family, grow the club
          </h1>
          <p className="mt-2.5 max-w-[56ch] text-[13px] leading-relaxed text-soft">
            {`Word of mouth between families is how the club grows. Share your personal link — when a new family joins, you earn ${REFERRAL_SIGNUP_XP} XP and help another family start learning together.`}
          </p>
        </header>
      ) : (
        <BoardMast
          caps="none"
          word="Invite a family, grow the club"
          lede={`Word of mouth between families is how the club grows. Share your personal link — when a new family joins, you earn ${REFERRAL_SIGNUP_XP} XP and help another family start learning together.`}
        />
      )}

      {/* ── THE LINK — the one object on this page ─────────────────────────
          It gets the warm brand-tinted card, the same treatment board 07 gives
          the streak and board 22 gives the rung you are standing on. */}
      {(() => {
        const linkCard = (
        <>
        <div className="flex items-baseline justify-between gap-4">
          {isClub ? (
            <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              Your referral link
            </h2>
          ) : (
            <Eyebrow charged>Your referral link</Eyebrow>
          )}
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-soft">
            <Sparkle className="h-3.5 w-3.5" />
            <span className="sr-only">Your code: </span>
            {code}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p
            className="club-b-chip min-w-0 flex-1 truncate px-3 py-2.5 font-mono text-[13px] text-ink sm:text-[15px]"
            title={link}
          >
            {link || "…"}
          </p>
          <button
            onClick={copyLink}
            className="f0-focus f0-press inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 font-display text-[13px] font-bold"
            style={{ background: "var(--accent-solid)", color: "var(--accent-on)" }}
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
        </>
        );
        return isClub ? (
          <section className="space-y-3.5 rounded-[16px] border border-sand bg-card px-4 py-4">
            {linkCard}
          </section>
        ) : (
          <WarmCard className="space-y-3.5 px-4 py-4">{linkCard}</WarmCard>
        );
      })()}

      {targets && (
        <section className="space-y-2.5">
          {isClub ? (
            <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              Share it
            </h2>
          ) : (
            <ListHead charged={false}>Share it</ListHead>
          )}
          <div className="flex flex-wrap gap-2">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-full border border-sand bg-card px-4 py-2.5 font-display text-[13px] font-bold text-ink transition-colors hover:text-accent"
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
        </section>
      )}

      {/* What it has done so far — the board's stat tiles. */}
      <section className="space-y-2.5 pt-1">
        {isClub ? (
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            What it has done so far
          </h2>
        ) : (
          <ListHead>What it has done so far</ListHead>
        )}
        <StatTileRow>
          <StatTile value={stats.clicks.toLocaleString()} label="Link clicks" />
          <StatTile value={stats.signups.toLocaleString()} label="Families joined" />
          <StatTile value={stats.xp.toLocaleString()} label="XP earned" />
        </StatTileRow>
        {/* FOUNDING STATE — three real zeros, said out loud instead of left to
            read as a broken counter. */}
        {untouched && (
          <p className="max-w-[62ch] text-[11px] leading-relaxed text-soft">
            Nobody has followed your link yet — it was minted for you and these counts are
            real, not a placeholder. The first one moves the moment somebody taps it.
          </p>
        )}
      </section>

      {/* How it works */}
      <section className="space-y-2.5 pt-1">
        {isClub ? (
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
            How it works
          </h2>
        ) : (
          <ListHead charged={false}>How it works</ListHead>
        )}
        <div className="space-y-2">
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
              <Card key={s.title} className="flex gap-3 rounded-[14px] px-3.5 py-3">
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold-700" />
                <div className="min-w-0">
                  <p className="font-display text-[13px] font-extrabold text-ink">{s.title}</p>
                  <p className="mt-1 max-w-[62ch] text-[11.5px] leading-relaxed text-soft">
                    {s.body}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Share destination ────────────────────────────────────────────────────────
// One neutral card-chip per destination, on the shared card geometry so the row
// matches the rest of the surface. The glyph identifies the destination; no
// destination gets a colour of its own.
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
      className="f0-focus f0-press inline-flex items-center gap-2 rounded-full border border-sand bg-card px-4 py-2.5 font-display text-[13px] font-bold text-ink transition-colors hover:text-accent"
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
