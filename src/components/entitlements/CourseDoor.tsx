"use client";

import { BookOpen } from "lucide-react";
import LockedState from "@/components/dashboard/LockedState";
import type { Register } from "@/lib/register";

/**
 * THE COURSE DOOR — what a kid or a teen sees where an out-of-register course
 * would have been.
 *
 * It is the /fta/chat door's twin, deliberately: same primitive (LockedState),
 * same silhouette, same voice. That door already settled how this app speaks to
 * a child standing in front of something that is not theirs — "…Ask a parent
 * about joining the Academy" — warm, short, and with NO commercial ask pointed
 * at the child. This one says the same thing about the adult library.
 *
 * `tone="amber"` and `lockBadge={false}`: this is not a purchase wall, it is a
 * register boundary. Nothing here is for sale and nothing about it is the kid's
 * to unlock, so it wears the quiet well rather than the orange action orb.
 *
 * The CTA is NAVIGATION, never commerce — it points back at the member's own
 * lessons so the door is not a dead end.
 */
export default function CourseDoor({ register }: { register: Register }) {
  const isKid = register === "kid";

  return (
    <LockedState
      icon={BookOpen}
      tone="amber"
      lockBadge={false}
      eyebrow={isKid ? "Grown-ups' shelf" : "Another track"}
      title={isKid ? "This one's for the grown-ups" : "Not your track"}
      body={
        isKid
          ? "This course belongs to the grown-ups' shelf in your family's library. Your own adventures are waiting in My Lessons — ask a parent if you want to know what's in this one."
          : "This course belongs to another track in your family's library. Your own course — and everything on the teen track — is waiting in Courses."
      }
      cta={{
        label: isKid ? "Back to my lessons" : "Back to courses",
        href: "/courses",
      }}
    />
  );
}
