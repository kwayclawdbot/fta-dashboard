import Link from "next/link";
import React from "react";

/**
 * ProfileLink — wraps an author's identity (avatar and/or name) in a link to
 * their public profile at /u/[username]. Degrades to a plain fragment when no
 * username is known, so call sites can wrap unconditionally. `variant` picks the
 * hover/press affordance: "name" adds a subtle underline, "avatar" a gentle
 * press/opacity cue.
 */

export default function ProfileLink({
  username,
  children,
  className = "",
  variant = "name",
  title,
}: {
  username?: string | null;
  children: React.ReactNode;
  className?: string;
  variant?: "name" | "avatar" | "bare";
  title?: string;
}) {
  if (!username) return <>{children}</>;
  const affordance =
    variant === "name"
      ? "hover:underline underline-offset-2 transition-colors"
      : variant === "avatar"
      ? "inline-block hover:opacity-90 active:scale-95 transition"
      : "";
  return (
    <Link
      href={`/u/${username}`}
      title={title ?? "View profile"}
      className={`${affordance} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
