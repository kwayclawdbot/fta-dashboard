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
import { StanceControl } from "@/components/canvas2";
import { type Stance } from "@/lib/social/stance";
import {
  SECTION_META,
  TIME_HORIZON_META,
  publishThesis,
  type TimeHorizon,
} from "@/lib/social/research-object";

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
    /* Not a tinted card: an opened section on the same hairline everything else
       on the page sits on. A boxed rounded rectangle around a form is the
       generic container the brand register bans. */
    <div className="f0-rule-top space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gold-700" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold-800">
          Publish a thesis · {ticker.toUpperCase()}
        </h3>
      </div>

      {/* stance — the shared lime-keyed control. This used to paint
          STANCE_META[s].chip, i.e. the green/red PRICE ramp, onto the moment a
          member declares an opinion; direction now rides the label and the
          left-to-right axis, and colour means only "community sentiment". */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-soft">Your stance</label>
        <StanceControl
          value={stance}
          onChange={(s: Stance) => setStance(s)}
          ariaLabel={`Your stance on ${ticker.toUpperCase()}`}
          emptyHint={null}
        />
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
          className="f0-focus w-full border-b border-sand bg-transparent pb-1.5 text-[16px] font-bold text-ink placeholder:font-semibold placeholder:text-soft focus:outline-none"
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
              aria-pressed={horizon === h}
              className={`f0-chip f0-press f0-focus font-display text-[11px] font-bold uppercase tracking-[0.1em] ${
                horizon === h ? "f0-chip-on" : "text-soft"
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
            className="f0-focus w-full resize-none border-b border-sand bg-transparent pb-1.5 text-[13.5px] leading-relaxed text-ink placeholder:text-soft focus:outline-none"
          />
        </div>
      ))}

      {err && <p className="text-xs font-semibold text-ink">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={busy || !headline.trim()}
          className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-night-950 transition-colors disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Publish thesis
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="f0-focus font-display text-[13px] font-semibold text-soft transition-colors hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
