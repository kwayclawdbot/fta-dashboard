import type { FamilyTier } from "@/lib/tier";
import { tierRingClass } from "@/components/TierBadge";
import { BELTS, beltForXp, type BeltKey } from "@/lib/belts";

/**
 * The ONE avatar primitive — renders a chosen avatar image when present,
 * otherwise a role-tinted initials chip. Optional gold tier ring for premium
 * (FTA) members. Used everywhere initials render (community, top bar, family
 * pages, leaderboards, settings, badge case) so avatars upgrade centrally.
 *
 * Belt indicator: pass `beltKey` (or `xp` to resolve one) to render a subtle
 * belt-colored corner dot. It coexists with the gold tier ring by design — the
 * ring hugs the outer edge (purchased axis), the dot sits at the corner (earned
 * axis) — so the two never fight. No text chip is added next to names anywhere;
 * the dot is the universal cue and the full belt name lives on hover/profile/
 * leaderboards via <BeltBadge/>.
 */

const SIZES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-10 h-10 text-xs",
  xl: "w-14 h-14 text-base",
  hero: "w-20 h-20 text-2xl",
} as const;

// Belt-dot diameter per avatar size (Tailwind size classes).
const DOT_SIZE: Record<keyof typeof SIZES, string> = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-3.5 h-3.5",
  hero: "w-5 h-5",
};

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
  beltKey,
  xp,
  size = "md",
  className = "",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  tier?: FamilyTier | null;
  /** Belt corner dot — pass a resolved key, or `xp` to resolve one. */
  beltKey?: BeltKey | null;
  xp?: number | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const ring = tier ? tierRingClass(tier) : "";
  const base = `${SIZES[size]} rounded-full shrink-0 ${ring} ${className}`;

  const resolvedBelt: BeltKey | null =
    beltKey ?? (typeof xp === "number" ? beltForXp(xp).belt.key : null);

  const inner = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={name || "Member"}
      loading="lazy"
      className={`${base} object-cover bg-sand`}
    />
  ) : (
    <div
      className={`${base} ${(role && ROLE_BG[role]) || "bg-gold-400/15 text-gold-700"} flex items-center justify-center font-display font-bold`}
    >
      {initialsOf(name)}
    </div>
  );

  if (!resolvedBelt) return inner;

  const belt = BELTS[resolvedBelt];
  return (
    <span className="relative inline-flex shrink-0">
      {inner}
      {/* Belt corner dot — ringed in the page background so it reads on any
          avatar; white/black belts carry their own border for contrast. */}
      <span
        title={`${belt.name} Belt`}
        className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-paper ${DOT_SIZE[size]}`}
        style={{ backgroundColor: belt.hex, boxShadow: `inset 0 0 0 1px ${belt.borderHex}` }}
      />
    </span>
  );
}
