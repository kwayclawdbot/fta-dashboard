import { Baby, Bike, User } from "lucide-react";
import { AGE_META, ageGroupOf, type AgeGroup } from "@/lib/feed";

/**
 * Small kid / teen / adult indicator shown next to every member's name on
 * posts, comments, and messages in the community (owner decision 2026-07-20:
 * kid posting is unrestricted, so a clear age cue everywhere is the safety
 * affordance instead). age_group is authoritative; role is the fallback.
 */

const ICON: Record<AgeGroup, React.ElementType> = {
  kids: Baby,
  teens: Bike,
  adults: User,
};

export default function AgeBadge({
  role,
  ageGroup,
  showLabel = false,
  className = "",
}: {
  role?: string | null;
  ageGroup?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  const group = ageGroupOf(role, ageGroup);
  const meta = AGE_META[group];
  const Icon = ICON[group];
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`inline-flex items-center gap-1 rounded ${meta.chip} ${
        showLabel ? "px-1.5 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider" : "p-0.5"
      } ${className}`}
    >
      <Icon className="w-3 h-3" />
      {showLabel && meta.label}
    </span>
  );
}
