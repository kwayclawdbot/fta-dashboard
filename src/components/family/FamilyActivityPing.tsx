"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GUARDRAIL_ACTIVE_NOTICE } from "@/lib/family/guardrails";

/**
 * THE METER BEHIND THE DAILY LIMIT (canvas F3).
 *
 * The parental control offers "Daily limit · 45 min". Nothing in this schema
 * measured time in the app, so before this component that control could only
 * ever have been a switch that persisted a number nobody read — the exact thing
 * this lane refuses to ship. `family_activity_ping()` (migration 190 §6) credits
 * one minute per 50s of wall clock, rate-limited server-side so two open tabs or
 * a reload storm cannot inflate it, and `family_writes_allowed()` reads the same
 * row when it decides whether to accept a write.
 *
 * COVERAGE, STATED PLAINLY: minutes accrue while a surface that mounts this
 * component is open. This lane mounts it on every /family route. Making it
 * whole-app is one <FamilyActivityPing /> in the dashboard shell — a file this
 * lane does not own. The digest labels the number for exactly what it measures.
 *
 * When the server says the account is locked (downtime window, or the limit is
 * spent) this renders the lock plainly. It is not decoration: the database is
 * already refusing the writes, and a teen deserves to be told why rather than
 * watching posts fail silently.
 */
export default function FamilyActivityPing({ active = true }: { active?: boolean }) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active) return;
    const supabase = createClient();
    let cancelled = false;

    const ping = async () => {
      if (document.visibilityState === "hidden") return;
      const { data, error } = await supabase.rpc("family_activity_ping");
      if (cancelled || error || !data) return;
      setLocked(Boolean((data as { locked?: boolean }).locked));
    };

    ping();
    const id = window.setInterval(ping, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active]);

  if (!locked) return null;

  return (
    <div
      className="mb-6 rounded-xl border p-4"
      role="status"
      style={{
        background:
          "linear-gradient(120deg, color-mix(in srgb, var(--accent-solid) 16%, var(--card)) 0%, var(--card) 72%)",
        borderColor: "color-mix(in srgb, var(--accent-solid) 32%, var(--sand))",
      }}
    >
      <p className="font-display text-[14px] font-extrabold text-ink">
        🌙 Your account is resting
      </p>
      <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-soft">
        {GUARDRAIL_ACTIVE_NOTICE}
      </p>
    </div>
  );
}
