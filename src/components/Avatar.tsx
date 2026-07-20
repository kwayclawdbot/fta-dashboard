import type { FamilyTier } from "@/lib/tier";
import { tierRingClass } from "@/components/TierBadge";

/**
 * The ONE avatar primitive — renders a chosen avatar image when present,
 * otherwise a role-tinted initials chip. Optional gold tier ring for premium
 * (FTA) members. Used everywhere initials render (community, top bar, family
 * pages, leaderboards, settings, badge case) so avatars upgrade centrally.
 */

const SIZES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-10 h-10 text-xs",
  xl: "w-14 h-14 text-base",
} as const;

const ROLE_BG: Record<string, string> = {
  coach: "bg-chip-amber text-gold-800",
  admin: "bg-chip-amber text-gold-800",
  parent: "bg-chip-sky text-sky-800",
  child: "bg-chip-green text-green-700",
};

export function initialsOf(name?: string | null): string {
  return (name || "U")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({
  name,
  avatarUrl,
  role,
  tier,
  size = "md",
  className = "",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  tier?: FamilyTier | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const ring = tier ? tierRingClass(tier) : "";
  const base = `${SIZES[size]} rounded-full shrink-0 ${ring} ${className}`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name || "Member"}
        loading="lazy"
        className={`${base} object-cover bg-sand`}
      />
    );
  }

  const bg = (role && ROLE_BG[role]) || "bg-gold-400/15 text-gold-700";
  return (
    <div
      className={`${base} ${bg} flex items-center justify-center font-display font-bold`}
    >
      {initialsOf(name)}
    </div>
  );
}
