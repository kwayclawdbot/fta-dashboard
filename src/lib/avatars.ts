/**
 * Preset onboarding avatar packs (warm-paper illustrated style).
 *
 * 10 avatars per group live in public/avatars/{adults,teens,kids}/. A chosen
 * preset is stored in profiles.avatar_url as its public path
 * (e.g. "/avatars/adults/a03.svg"); uploaded/remote avatars are full URLs.
 * Both render through <Avatar/> with an initials fallback.
 *
 * The interim set ships as SVG (deterministic, <2KB, guaranteed). If the
 * Higgsfield illustrated PNG packs land in the same folders with the same
 * a01/t01/k01 basenames, flip AVATAR_EXT to "png" — nothing else changes.
 */

export type AvatarGroup = "adults" | "teens" | "kids";

export const AVATAR_EXT = "svg" as const;

const PREFIX: Record<AvatarGroup, string> = {
  adults: "a",
  teens: "t",
  kids: "k",
};

function pack(group: AvatarGroup): string[] {
  return Array.from(
    { length: 10 },
    (_, i) =>
      `/avatars/${group}/${PREFIX[group]}${String(i + 1).padStart(2, "0")}.${AVATAR_EXT}`
  );
}

export const AVATAR_PACKS: Record<AvatarGroup, string[]> = {
  adults: pack("adults"),
  teens: pack("teens"),
  kids: pack("kids"),
};

export const AVATAR_GROUPS: { id: AvatarGroup; label: string }[] = [
  { id: "kids", label: "Kids" },
  { id: "teens", label: "Teens" },
  { id: "adults", label: "Adults" },
];

/** The default pack for a member, from role + age band. */
export function packForRole(
  role: string | null | undefined,
  ageGroup: string | null | undefined
): AvatarGroup {
  if (ageGroup === "kids") return "kids";
  if (ageGroup === "teens") return "teens";
  if (role === "child") return "teens";
  return "adults";
}

/** Parents/coaches/admins may browse every pack; kids/teens see their own. */
export function canSeeAllPacks(role: string | null | undefined): boolean {
  return role === "parent" || role === "coach" || role === "admin";
}

/** Every preset path (used to detect whether an avatar_url is a preset). */
export function allPresetAvatars(): string[] {
  return [...AVATAR_PACKS.kids, ...AVATAR_PACKS.teens, ...AVATAR_PACKS.adults];
}

export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/avatars/");
}
