"use client";

import { useMemo, useState } from "react";
import { ROUTINE_SKILLS, WEEKDAYS, type Day5Payload, type DaySeed } from "./data";
import { Switch } from "@/components/f0/parts";
import {
  ErrorLine,
  KaiNote,
  PILL,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  Panel,
} from "./parts";

/**
 * DAY 5 · DO — DESIGN THE WEEK YOU WILL ACTUALLY KEEP.
 *
 * The canvas draws drag handles. Dragging is the wrong control here: it is the
 * least accessible way to express "this skill happens on this day", it needs a
 * pointer, and it needs a library. Same object, same ledger, same outcome — the
 * weekday is chosen from a rail on each row, so it works from a keyboard and on
 * a phone with one thumb.
 *
 * The five skills are fixed because they ARE the week the member just ran. What
 * they choose is when — and the total at the bottom is a sum of the row minutes,
 * not the canvas's hardcoded "55 minutes".
 */
export default function Day5Do({
  seed,
  onSubmit,
  onReminder,
  reminderOn,
  busy,
  error,
}: {
  seed: DaySeed;
  onSubmit: (payload: Day5Payload) => void;
  /** Records the consent fact via `challenge_set_sms_opt_in`. */
  onReminder: (on: boolean) => void;
  reminderOn: boolean;
  busy: boolean;
  error: string | null;
}) {
  const saved = seed.doPayload as Day5Payload | null;

  const [assigned, setAssigned] = useState<Record<string, number>>(() => {
    const a: Record<string, number> = {};
    for (const s of ROUTINE_SKILLS) a[s.key] = s.defaultDay;
    for (const l of saved?.loop ?? []) if (l.key in a) a[l.key] = l.weekday;
    return a;
  });

  const loop = useMemo(
    () =>
      ROUTINE_SKILLS.map((s) => ({ ...s, weekday: assigned[s.key] ?? s.defaultDay })).sort(
        (a, b) => a.weekday - b.weekday || a.fromDay - b.fromDay
      ),
    [assigned]
  );

  const totalMinutes = loop.reduce((n, s) => n + s.minutes, 0);

  const submit = () =>
    onSubmit({
      loop: loop.map((s) => ({
        key: s.key,
        label: s.label,
        emoji: s.emoji,
        weekday: s.weekday,
        minutes: s.minutes,
      })),
      total_minutes: totalMinutes,
      reminder: reminderOn,
    });

  return (
    <div className="f0-stagger space-y-7">
      <div className="space-y-2">
        <MissionHead align="left">
          Design the week <span className="text-gold-700">you&rsquo;ll actually keep</span>
        </MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">
          Put each skill on the day you will really do it. Move them around until
          the week looks like your week, not an ideal one.
        </p>
      </div>

      <div className="space-y-3">
        {loop.map((s) => (
          <Panel key={s.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
                <span className="mr-1.5" aria-hidden>
                  {s.emoji}
                </span>
                {s.label}
              </p>
              <p className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
                {s.minutes} min
              </p>
            </div>
            <p className="mt-0.5 text-[12px] text-soft">Day {s.fromDay} skill</p>
            <div
              role="radiogroup"
              aria-label={`Which day for ${s.label}`}
              className="mt-3 flex flex-wrap gap-1.5"
            >
              {WEEKDAYS.map((d) => {
                const on = s.weekday === d.n;
                return (
                  <button
                    key={d.n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={d.label}
                    onClick={() => setAssigned((a) => ({ ...a, [s.key]: d.n }))}
                    style={PILL}
                    className={`f0-chip f0-focus f0-press px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-[0.08em] ${
                      on ? "f0-chip-accent text-ink" : "text-soft hover:text-ink"
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>

      <div className="f0-brief-field flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="font-display text-display-3 font-extrabold tabular-nums text-ink">
            {totalMinutes} min a week
          </p>
          <p className="mt-1 text-[13px] leading-snug text-soft">
            Across {new Set(loop.map((s) => s.weekday)).size} days. That is the
            whole routine — the same loop you just ran for five.
          </p>
        </div>
      </div>

      <Panel label="Weekly reminder">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-bold text-ink">
              Remind me to run the loop
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-soft">
              Saves your number and the fact you want reminders. Text reminders
              are not switched on yet — nothing goes out today, and we will tell
              you the moment they do.
            </p>
          </div>
          <Switch
            on={reminderOn}
            onToggle={() => onReminder(!reminderOn)}
            label="Weekly routine reminder"
          />
        </div>
      </Panel>

      <KaiNote>
        the challenge ends tonight. The routine does not — your first review is
        waiting on {WEEKDAYS.find((d) => d.n === loop[0]?.weekday)?.label ?? "Monday"}.
      </KaiNote>

      <Note>
        Nothing here is a schedule anyone else can see. It is your loop, kept on
        your finisher card, and you can change it whenever the week changes.
      </Note>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton onClick={submit} busy={busy}>
          Lock my routine
        </MissionButton>
      </MissionFooter>
    </div>
  );
}
