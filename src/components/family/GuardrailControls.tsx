"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { SegmentedRail } from "@/components/canvas2";
import { Switch } from "@/components/f0/parts";
import {
  GUARDRAIL_SPECS,
  DAILY_LIMIT_CHOICES,
  DOWNTIME_START_CHOICES,
  DOWNTIME_END_CHOICES,
  hourLabel,
  type FamilyGuardrails,
  type GuardrailKey,
} from "@/lib/family/guardrails";

/**
 * F3 · PARENTAL CONTROLS — the write half.
 *
 * THE RULE THIS COMPONENT EXISTS TO KEEP: every switch here is a real write
 * with a real consequence. `set_family_guardrail()` (migration 190 §5) is the
 * only write path — it verifies the caller is a parent in the child's family,
 * persists the change, appends to the audit log, and inserts a notification for
 * every OTHER parent in the household. That last step is the canvas line
 * "Guardrail changes notify both parents", made literal.
 *
 * Rows whose enforcement is `structural` render as locked statements, because
 * there is genuinely nothing to switch: this platform has no real-money order
 * path and no options or margin surface anywhere. Rows whose enforcement is
 * `absent` render as a stated absence — "Approve who they follow" needs a
 * follow graph, and this product does not have one. A switch that governs
 * nothing is worse than no switch at all, so neither is drawn as a control.
 *
 * If a write fails — including because the caller is not a parent, which the
 * database checks rather than trusting this component — the control snaps back
 * and says so. It never shows a state the server did not confirm.
 */
export default function GuardrailControls({
  initial,
  childName,
}: {
  initial: FamilyGuardrails;
  childName: string;
}) {
  const [g, setG] = useState<FamilyGuardrails>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<GuardrailKey | null>(null);
  const [, startTransition] = useTransition();

  async function write(key: GuardrailKey, value: boolean | number | string | null) {
    const previous = g;
    setError(null);
    setSaving(key);
    // Optimistic, but reverted on any server refusal.
    setG({ ...g, [key]: value } as FamilyGuardrails);

    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("set_family_guardrail", {
      p_child: initial.child_id,
      p_setting: key,
      p_value: value,
    });

    setSaving(null);
    if (err || !data) {
      setG(previous);
      setError(
        err?.message?.includes("parents only")
          ? "Only a parent in this household can change a guardrail."
          : "That change did not save. Nothing was altered."
      );
      return;
    }
    setG(data as FamilyGuardrails);
    startTransition(() => {});
  }

  const groups: { id: "money" | "people" | "time"; label: string }[] = [
    { id: "money", label: "Money" },
    { id: "people", label: "People" },
    { id: "time", label: "Time" },
  ];

  return (
    <div>
      {error && (
        <p className="mb-5 f0-rule-left py-1 pl-4 text-[14px] leading-relaxed text-ink" role="alert">
          {error}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} className="mb-10">
          <h2 className="f0-section-rule text-eyebrow font-display font-bold uppercase text-soft">
            <span className="shrink-0 whitespace-nowrap">{group.label}</span>
          </h2>

          <div className="f0-ledger mt-2">
            {GUARDRAIL_SPECS.filter((s) => s.group === group.id).map((spec) => {
              const busy = spec.key != null && saving === spec.key;

              return (
                <div key={spec.label} className="f0-ledger-row justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-bold text-ink">{spec.label}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-soft">{spec.sub}</p>

                    {/* The downtime window and the daily limit carry their own
                        choice rail beneath the row rather than opening a modal —
                        the value IS the setting, so it belongs in view. */}
                    {spec.key === "downtime_enabled" && g.downtime_enabled && (
                      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                        <div>
                          <p className="mb-1.5 text-eyebrow font-display font-bold uppercase text-soft">
                            Starts
                          </p>
                          <SegmentedRail
                            ariaLabel="Downtime start hour"
                            size="sm"
                            options={DOWNTIME_START_CHOICES.map((h) => ({
                              id: String(h),
                              label: hourLabel(h),
                            }))}
                            value={String(g.downtime_start_hour)}
                            onChange={(v) => write("downtime_start_hour", Number(v))}
                            barClassName="bg-accent"
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-eyebrow font-display font-bold uppercase text-soft">
                            Ends
                          </p>
                          <SegmentedRail
                            ariaLabel="Downtime end hour"
                            size="sm"
                            options={DOWNTIME_END_CHOICES.map((h) => ({
                              id: String(h),
                              label: hourLabel(h),
                            }))}
                            value={String(g.downtime_end_hour)}
                            onChange={(v) => write("downtime_end_hour", Number(v))}
                            barClassName="bg-accent"
                          />
                        </div>
                      </div>
                    )}

                    {spec.key === "daily_limit_min" && (
                      <div className="mt-3">
                        <SegmentedRail
                          ariaLabel="Daily limit"
                          size="sm"
                          options={DAILY_LIMIT_CHOICES.map((c) => ({
                            id: c.value == null ? "none" : String(c.value),
                            label: c.label,
                          }))}
                          value={g.daily_limit_min == null ? "none" : String(g.daily_limit_min)}
                          onChange={(v) =>
                            write("daily_limit_min", v === "none" ? null : Number(v))
                          }
                          barClassName="bg-accent"
                        />
                      </div>
                    )}

                    {spec.note && (
                      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
                        {spec.note}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 self-center pl-4">
                    {spec.enforcement === "enforced" && spec.key === "chat_family_only" && (
                      <Switch
                        on={g.chat_family_only}
                        onToggle={() => write("chat_family_only", !g.chat_family_only)}
                        label={`Chat limited to the Family Circle for ${childName}`}
                      />
                    )}
                    {spec.enforcement === "enforced" && spec.key === "downtime_enabled" && (
                      <Switch
                        on={g.downtime_enabled}
                        onToggle={() => write("downtime_enabled", !g.downtime_enabled)}
                        label={`Downtime for ${childName}`}
                      />
                    )}
                    {spec.enforcement === "recorded" && spec.key === "live_listen_only" && (
                      <Switch
                        on={g.live_listen_only}
                        onToggle={() => write("live_listen_only", !g.live_listen_only)}
                        label={`Live rooms listen-only for ${childName}`}
                      />
                    )}
                    {spec.enforcement === "structural" && (
                      <span className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-gold-700">
                        Always
                      </span>
                    )}
                    {spec.enforcement === "absent" && (
                      <span className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-soft">
                        None
                      </span>
                    )}
                    {busy && <span className="sr-only">Saving…</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-[13px] leading-relaxed text-soft">
        Guardrail changes notify both parents. Every change is logged with who
        made it.
      </p>
    </div>
  );
}
