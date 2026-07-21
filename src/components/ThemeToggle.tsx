"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useThemePref } from "@/lib/useTheme";
import type { ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle() {
  const [pref, setPref] = useThemePref();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex w-full max-w-xs rounded-xl border border-sand bg-paper p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? "bg-midnight-900 text-ink shadow-soft"
                : "text-soft hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
