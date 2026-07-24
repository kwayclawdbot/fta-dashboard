"use client";

/**
 * Wizard invite step (parents only) — reuses the referral system wholesale:
 * mints the permanent code via get_or_create_referral_code, builds the tracked
 * /r/[code] link with referralLink(), and shares through shareTargets() exactly
 * like /referrals. Warm-paper + gold register; kids never reach this step.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
  Gift,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { referralLink, shareTargets, REFERRAL_SIGNUP_XP } from "@/lib/referral";
import { StepHeading } from "@/components/onboarding/WizardSteps";

export default function InviteStep({ isSolo = false }: { isSolo?: boolean }) {
  const supabase = createClient();
  const [code, setCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    (async () => {
      // Parent + family are already established by this step (username step ran
      // onboard_create_family), so the parent-gated RPC succeeds.
      const { data } = await supabase.rpc("get_or_create_referral_code");
      setCode((data as string) ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = useMemo(() => (code && origin ? referralLink(origin, code) : ""), [code, origin]);
  const targets = useMemo(() => (link ? shareTargets(link) : null), [link]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — link is still selectable */
    }
  }

  async function nativeShare() {
    if (!link || !targets) return;
    try {
      await navigator.share({ title: "Family Investing Club", text: targets.message, url: link });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div>
      <StepHeading
        eyebrow="Grow the circle"
        title={isSolo ? "Invite a friend?" : "Know another family?"}
        sub={
          isSolo
            ? `Know someone who'd love to learn this alongside you? When they join, you earn ${REFERRAL_SIGNUP_XP} XP — totally optional, and you can do it later from Referrals.`
            : `Invite a family you'd love to learn alongside. When they join, you earn ${REFERRAL_SIGNUP_XP} XP — and this is totally optional, you can do it later from Referrals.`
        }
      />

      <div className="rounded-2xl border-2 border-sand bg-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-soft mb-2">Your referral link</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex-1 min-w-0 rounded-xl border-2 border-sand bg-paper px-4 py-3">
            <p className="truncate font-mono text-sm text-ink" title={link}>
              {link || "Minting your link…"}
            </p>
          </div>
          <button
            onClick={copyLink}
            disabled={!link}
            className="cta-button inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm shrink-0 disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy
              </>
            )}
          </button>
        </div>

        {targets && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-white text-sm font-semibold hover:bg-gold-600 transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            <Share href={targets.whatsapp} label="WhatsApp" tone="green">
              <MessageCircle className="w-4 h-4" />
            </Share>
            <Share href={targets.mailto} label="Email" tone="sand">
              <Mail className="w-4 h-4" />
            </Share>
            <Share href={targets.sms} label="Text" tone="sand">
              <MessageCircle className="w-4 h-4" />
            </Share>
          </div>
        )}

        {code && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-soft">Your code:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand text-ink text-sm font-bold font-mono tracking-wide">
              <Gift className="h-3.5 w-3.5" />
              {code}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "bg-chip-green text-green-700 hover:bg-green-100",
  sand: "bg-sand text-ink hover:bg-[#E0D6BE]",
};

function Share({
  href,
  label,
  tone,
  children,
}: {
  href: string;
  label: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${TONES[tone]}`}
    >
      {children}
      {label}
    </a>
  );
}
