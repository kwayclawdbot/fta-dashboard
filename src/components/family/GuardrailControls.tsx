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
import { RowCard, Row, SectionLabel, Chip } from "@/components/family/canvas";
import { toast } from "@/components/ui/Toast";

/**
 * F3 · PARENTAL CONTROLS — the write half, drawn as the board draws it: one
 * card per group (Money / People / Time), rows divided by a hairline inside it,
 * the switch on the right of each row.
 *
 * THE RULE THIS COMPONENT EXISTS TO KEEP: every switch here is a real write
 * with a real consequence. `set_family_guardrail()` (migration 190 §5) is the
 * only write path — it verifies the caller is a parent in the child's family,
 * persists the change, appends to the audit log, and inserts a notification for
 * every OTHER parent in the household. That last step is the canvas line
 * "Guardrail changes notify both parents", made literal. The restyle below
 * touches presentation only; `write()` is unchanged.
 *
 * Rows whose enforcement is `structural` render as locked statements, because
 * there is genuinely nothing to switch: this platform has no real-money order
 * path and no options or margin surface anywhere. Rows whose enforcement is
 * `absent` render as a stated absence — "Approve who they follow" needs a
 * follow graph, and this product does not have one. A switch that governs
 * nothing is worse than no switch at all, so neither is drawn as a control.
 *
 * IF A WRITE FAILS — including because the server does not accept this account
 * as a parent, which the database decides rather than trusting this component —
 * three things happen, and they are the whole point of this file:
 *
 *   1. the optimistic value SNAPS BACK to what the server last confirmed;
 *   2. the refusal is stated in three places at once — a toast (visible
 *      wherever the member is on a long page), a banner at the head of the
 *      controls, and a line under the exact row that refused;
 *   3. a PERMISSION refusal locks the whole surface read-only with the reason
 *      spelled out, because every remaining control would refuse too, and a
 *      live-looking switch that cannot write is the bug this lane exists to
 *      kill.
 *
 * The read-only posture is not a disabled switch. A greyed knob still looks
 * like a control; the rows render their CURRENT STATE as a chip instead, which
 * is what a read-only guardrail actually is — a statement, not an offer.
 *
 * PRE- AND POST-MIGRATION. Migration 192 gated the RPC on `role = 'parent'`
 * while getFamilyContext admits `parent || admin`, so an admin-parent (the
 * owner's own account) got a silent 400 on every toggle. Migration 200 widens
 * the database to `role in ('parent','admin')`. This component is correct on
 * BOTH sides of that deploy: before it, the first refusal explains itself and
 * locks the surface; after it, the writes simply succeed.
 */
export default function GuardrailControls({
  initial,
  childName,
  canWrite = true,
  readOnlyReason,
}: {
  initial: FamilyGuardrails;
  childName: string;
  /** False when the viewer is known up front to have no write path. */
  canWrite?: boolean;
  /** Stated reason shown in the read-only posture. */
  readOnlyReason?: string;
}) {
  const [g, setG] = useState<FamilyGuardrails>(initial);
  const [error, setError] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<GuardrailKey | null>(null);
  const [saving, setSaving] = useState<GuardrailKey | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(
    canWrite
      ? null
      : (readOnlyReason ??
        "This account can view these guardrails but not change them.")
  );
  const [, startTransition] = useTransition();

  const locked = lockedReason != null;

  async function write(key: GuardrailKey, value: boolean | number | string | null) {
    if (locked) return;
    const previous = g;
    setError(null);
    setFailedKey(null);
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
      // The server did not confirm it, so it does not stay on screen.
      setG(previous);

      const raw = err?.message ?? "";
      const refused = /parents only|not authenticated|permission|policy|denied/i.test(raw);
      const message = refused
        ? "The server refused that change: only a parent in this household can set a guardrail. Nothing was altered."
        : `That change did not save${raw ? ` — ${raw}` : ""}. Nothing was altered.`;

      setError(message);
      setFailedKey(key);
      toast(message, "error");

      if (refused) {
        // Every other control would refuse identically. Say so once, and stop
        // drawing switches that cannot write.
        setLockedReason(
          "This account cannot change guardrails. The server accepts a guardrail write only from a parent in this household, and it did not accept this one — so the controls are shown as they stand, read-only."
        );
      }
      return;
    }
    setG(data as FamilyGuardrails);
    setError(null);
    setFailedKey(null);
    toast("Guardrail saved — logged, and the other parent is notified.");
    startTransition(() => {});
  }

  const groups: { id: "money" | "people" | "time"; label: string }[] = [
    { id: "money", label: "Money" },
    { id: "people", label: "People" },
    { id: "time", label: "Time" },
  ];

  /** The read-only stand-in for a switch: the state as a statement. */
  function StateChip({ on }: { on: boolean }) {
    return <Chip tone={on ? "accent" : "muted"}>{on ? "On" : "Off"}</Chip>;
  }

  return (
    <div>
      {/* The refusal, stated where the eye already is. `aria-live` because the
          member's attention is on the switch they just moved, not the top of
          the page. */}
      {error && (
        <p
          className="mb-3 rounded-xl border border-sand bg-card p-3 text-[13px] leading-relaxed text-ink shadow-soft"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      {/* READ-ONLY POSTURE. One stated reason at the head of the surface, and
          every row below renders its value instead of a control. */}
      {locked && (
        <div className="mb-5 rounded-xl border border-sand bg-card p-3.5 shadow-soft">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-soft">
            Read-only
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">{lockedReason}</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-soft">
            Ask a parent on this household to make the change, and it will appear in
            Recent changes below with their name on it.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.id} className="mb-6">
          <SectionLabel tone="accent">{group.label}</SectionLabel>

          <RowCard className="mt-2.5">
            {GUARDRAIL_SPECS.filter((s) => s.group === group.id).map((spec) => {
              const busy = spec.key != null && saving === spec.key;

              return (
                <Row
                  key={spec.label}
                  label={spec.label}
                  sub={spec.sub}
                  right={
                    <>
                      {spec.enforcement === "enforced" &&
                        spec.key === "chat_family_only" &&
                        (locked ? (
                          <StateChip on={g.chat_family_only} />
                        ) : (
                          <Switch
                            on={g.chat_family_only}
                            onToggle={() => write("chat_family_only", !g.chat_family_only)}
                            label={`Chat limited to the Family Circle for ${childName}`}
                          />
                        ))}
                      {spec.enforcement === "enforced" &&
                        spec.key === "downtime_enabled" &&
                        (locked ? (
                          <StateChip on={g.downtime_enabled} />
                        ) : (
                          <Switch
                            on={g.downtime_enabled}
                            onToggle={() => write("downtime_enabled", !g.downtime_enabled)}
                            label={`Downtime for ${childName}`}
                          />
                        ))}
                      {spec.enforcement === "recorded" &&
                        spec.key === "live_listen_only" &&
                        (locked ? (
                          <StateChip on={g.live_listen_only} />
                        ) : (
                          <Switch
                            on={g.live_listen_only}
                            onToggle={() => write("live_listen_only", !g.live_listen_only)}
                            label={`Live rooms listen-only for ${childName}`}
                          />
                        ))}
                      {spec.enforcement === "structural" && <Chip tone="accent">Always</Chip>}
                      {spec.enforcement === "absent" && <Chip tone="muted">None</Chip>}
                      {busy && <span className="sr-only">Saving…</span>}
                    </>
                  }
                >
                  {/* The downtime window and the daily limit carry their own
                      choice rail beneath the row rather than opening a modal —
                      the value IS the setting, so it belongs in view. */}
                  {spec.key === "downtime_enabled" && g.downtime_enabled && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                      <div>
                        <p className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-soft">
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
                          disabled={locked}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-soft">
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
                          disabled={locked}
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
                        onChange={(v) => write("daily_limit_min", v === "none" ? null : Number(v))}
                        barClassName="bg-accent"
                        disabled={locked}
                      />
                    </div>
                  )}

                  {spec.note && (
                    <p className="mt-2 max-w-md text-[11px] leading-relaxed text-soft">
                      {spec.note}
                    </p>
                  )}

                  {/* The failure, under the row that produced it — so the
                      member never has to hunt the page for the reason the
                      switch moved back. */}
                  {spec.key != null && failedKey === spec.key && error && (
                    <p
                      className="mt-2 max-w-md text-[11.5px] font-semibold leading-relaxed text-ink"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                </Row>
              );
            })}
          </RowCard>
        </section>
      ))}
    </div>
  );
}
