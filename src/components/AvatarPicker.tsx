"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  AVATAR_GROUPS,
  AVATAR_PACKS,
  canSeeAllPacks,
  packForRole,
  type AvatarGroup,
} from "@/lib/avatars";

/**
 * Preset avatar picker. Role/age decides the default pack (kids/teens/adults);
 * parents & coaches may browse every pack. The chosen public path is returned
 * via onChange and stored in profiles.avatar_url.
 */
export default function AvatarPicker({
  value,
  onChange,
  role,
  ageGroup,
}: {
  value: string | null;
  onChange: (url: string) => void;
  role?: string | null;
  ageGroup?: string | null;
}) {
  const defaultGroup = packForRole(role, ageGroup);
  const [group, setGroup] = useState<AvatarGroup>(defaultGroup);
  const showTabs = canSeeAllPacks(role);
  const options = useMemo(() => AVATAR_PACKS[group], [group]);

  return (
    <div>
      {showTabs && (
        <div className="flex items-center gap-1.5 mb-3">
          {AVATAR_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-colors ${
                group === g.id
                  ? "bg-chip-amber text-gold-800 border-gold-300"
                  : "text-midnight-400 border-sand hover:border-gold-300 hover:text-midnight-100"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
        {options.map((url) => {
          const selected = value === url;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              aria-pressed={selected}
              aria-label="Choose this avatar"
              className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${
                selected
                  ? "border-gold-400 ring-2 ring-gold-400/30 scale-105"
                  : "border-transparent hover:border-gold-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Avatar option" className="w-full h-full object-cover bg-sand" />
              {selected && (
                <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center shadow">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
