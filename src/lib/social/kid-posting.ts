/**
 * KID FEED READ-ONLY — the single UI flag for the ratified kid-safety posture.
 *
 * SOCIAL-OBJECTS.md REGISTER POLICY + FIC-LEARNING-WORLD Phase 8: kid social is
 * structured, cohort-scoped, and moderated — NOT the open adult feed. Kids READ
 * and REACT freely, but do not post top-level entries into the shared community
 * feed. This constant gates the composer UI (a warm "coming soon, explore & react"
 * note replaces the composer for the kid register).
 *
 * SERVER PAIR: the authoritative enforcement is the RLS policy in migration 161
 * (kid_feed_readonly() → feed_posts INSERT with_check). This TS flag is the UI
 * half. To fully re-open kid posting the owner flips BOTH:
 *   • KID_FEED_READONLY = false   (here — restores the composer)
 *   • kid_feed_readonly() → false (migration 161 — restores the server INSERT)
 * Flip only the TS half and kids see a composer whose submits the server rejects.
 */
export const KID_FEED_READONLY = true;

/** Warm, age-appropriate note shown to kids in place of the shared-feed composer. */
export const KID_FEED_READONLY_NOTE =
  "Kid missions and clubs are coming — for now, explore and react!";

/**
 * Whether THIS viewer is read-only in the shared adult feed. Kids only (teens and
 * adults post normally), and only while the flag is on. `register` comes from
 * deriveRegister() so the precedence matches viewer_is_kid() server-side.
 */
export function isSharedFeedReadOnly(register: string | null | undefined): boolean {
  return KID_FEED_READONLY && register === "kid";
}
