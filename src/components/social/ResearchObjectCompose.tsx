"use client";

/**
 * ResearchObjectCompose (SOCIAL OBJECTS S1) — the structured-thesis composer for
 * a ticker. Collects stance + one-line hook + time horizon + the four body
 * sections (thesis / catalysts / risks / valuation) and publishes through the
 * SINGLE gated entry point (publishThesis → POST /api/social/research).
 *
 * GATED (research_publish → publish_thesis): structured publishing is a paid
 * (Cheat Code Club / FTA) feature per MONETIZATION-GATES.md. The server enforces
 * it on POST /api/social/research via the central can() gate, and the caller
 * wraps THIS composer in <Gated feature="publish_thesis"> so free members see the
 * contextual wall and Challenge-Pass holders see the countdown ribbon. The basic
 * free ticker post stays on the community composer, untouched. The publish()
 * handler below also fails soft on a server "walled" verdict (belt-and-suspenders).
 */

import { useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { checkClean } from "@/lib/profanity";
import { STANCE_META, type Stance } from "@/lib/social/stance";
import {
  SECTION_META,
  TIME_HORIZON_META,
  publishThesis,
  type TimeHorizon,
} from "@/lib/social/research-object";

const STANCES: Stance[] = ["bull", "neutral", "bear"];
const HORIZONS: TimeHorizon[] = ["near", "1yr", "3-5yr"];

export default function ResearchObjectCompose({
  ticker,
  companyName,
  onPublished,
  onCancel,
}: {
  ticker: string;
  companyName?: string | null;
  onPublished?: (id: string) => void;
  onCancel?: () => void;
}) {
  const [stance, setStance] = useState<Stance>("bull");
  const [headline, setHeadline] = useState("");
  const [horizon, setHorizon] = useState<TimeHorizon | null>("1yr");
  const [body, setBody] = useState<Record<string, string>>({
    thesis: "",
    catalysts: "",
    risks: "",
    valuation: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    const hook = headline.trim();
    if (!hook) {
      setErr("Give your thesis a one-line hook.");
      return;
    }
    // Moderation on structured free text (SOCIAL-OBJECTS guardrails).
    for (const text of [hook, ...Object.values(body)]) {
      if (text && !checkClean(text).ok) {
        setErr("Let's keep it friendly — please reword that.");
        return;
      }
    }
    setBusy(true);
    setErr(null);
    const res = await publishThesis({
      ticker,
      stance,
      headline: hook,
      timeHorizon: horizon,
      thesis: body.thesis,
      catalysts: body.catalysts,
      risks: body.risks,
      valuation: body.valuation,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.reason === "kid_walled"
          ? "This isn't available on your account."
          : res.reason === "walled"
          ? "Publishing a structured thesis is a Cheat Code Club feature."
          : "Couldn't publish that — try again."
      );
      return;
    }
    onPublished?.(res.id!);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gold-300/50 bg-chip-amber/10 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gold-700" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold-800">
          Publish a thesis · {ticker.toUpperCase()}
        </h3>
      </div>

      {/* stance */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-soft">Your stance</label>
        <div className="inline-flex rounded-xl border border-sand p-0.5">
          {STANCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStance(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                stance === s ? STANCE_META[s].chip : "text-soft hover:text-ink"
              }`}
            >
              {STANCE_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* hook */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-soft">One-line hook</label>
        <input
          value={headline}
          onChange={(e) => {
            setHeadline(e.target.value);
            if (err) setErr(null);
          }}
          maxLength={200}
          placeholder={`Why ${companyName || ticker.toUpperCase()} — in one line`}
          className="w-full rounded-lg border border-sand bg-card px-3 py-2 text-sm font-semibold text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
        />
      </div>

      {/* horizon */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-soft">Time horizon</label>
        <div className="flex flex-wrap gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                horizon === h ? "bg-gold-500 text-white" : "border border-sand text-soft hover:bg-paper"
              }`}
            >
              {TIME_HORIZON_META[h].label}
            </button>
          ))}
        </div>
      </div>

      {/* four body sections */}
      {SECTION_META.map((sec) => (
        <div key={sec.key}>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-soft">{sec.label}</label>
          <textarea
            value={body[sec.key]}
            onChange={(e) => {
              setBody((b) => ({ ...b, [sec.key]: e.target.value }));
              if (err) setErr(null);
            }}
            rows={sec.key === "thesis" ? 3 : 2}
            placeholder={`Your ${sec.label.toLowerCase()}…`}
            className="w-full resize-none rounded-lg border border-sand bg-card px-3 py-2 text-[13px] text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
          />
        </div>
      ))}

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={busy || !headline.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Publish thesis
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-sand px-4 py-2 text-sm font-semibold text-soft hover:bg-paper"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
