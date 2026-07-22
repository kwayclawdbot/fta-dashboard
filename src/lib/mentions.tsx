"use client";

import Link from "next/link";
import React, { createContext, useContext } from "react";

/**
 * RichText — renders a post/comment/chat body with URLs and @mentions turned
 * into links. Mentions resolve via the SAME rule the composer autocomplete uses:
 * an @handle is the mentioned member's display_name with whitespace stripped,
 * matched case-insensitively. Resolution is done once per surface (a single
 * batched lookup → a handle→username map), never per-render / per-row, so there
 * is no N+1.
 */

// Handle token in body text: whitespace-free run of the chars the composer allows.
const HANDLE_CHARS = "A-Za-z0-9_.'-";
const TOKEN_RE = new RegExp(
  `(https?:\\/\\/[^\\s]+)|((?:^|\\s))@([${HANDLE_CHARS}]+)`,
  "g"
);

/** display_name → mention handle (strip whitespace, lowercase). */
export function handleFor(displayName: string | null | undefined): string {
  return (displayName || "").replace(/\s+/g, "").toLowerCase();
}

/** Collect the distinct @handles referenced in a set of bodies (lowercased). */
export function extractHandles(bodies: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  const re = new RegExp(`(?:^|\\s)@([${HANDLE_CHARS}]+)`, "g");
  for (const body of bodies) {
    if (!body) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const h = m[1].toLowerCase();
      if (h) out.add(h);
    }
  }
  return [...out];
}

export type MentionMap = Record<string, string>; // handleLower -> username

export default function RichText({
  body,
  mentions,
  className = "",
}: {
  body: string | null | undefined;
  /** handleLower → username. Missing handles render as plain text. */
  mentions?: MentionMap;
  className?: string;
}) {
  if (!body) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(body)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{body.slice(last, m.index)}</span>);

    if (m[1]) {
      // URL
      parts.push(
        <a
          key={key++}
          href={m[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-700 underline break-all"
        >
          {m[1]}
        </a>
      );
    } else {
      // @mention — m[2] = leading whitespace (preserve), m[3] = handle
      const lead = m[2] ?? "";
      const handle = m[3] ?? "";
      if (lead) parts.push(<span key={key++}>{lead}</span>);
      const username = mentions?.[handle.toLowerCase()];
      if (username) {
        parts.push(
          <Link
            key={key++}
            href={`/u/${username}`}
            className="font-semibold text-gold-700 hover:text-gold-600 hover:underline underline-offset-2"
          >
            @{handle}
          </Link>
        );
      } else {
        parts.push(<span key={key++} className="font-semibold text-gold-700">@{handle}</span>);
      }
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={key++}>{body.slice(last)}</span>);

  return <span className={className}>{parts}</span>;
}

/**
 * Context-backed variant so deeply-nested post/comment/chat bodies can render
 * mention links without every intermediate component threading the map through.
 * Wrap a surface in <MentionProvider map={...}> and render <RichBody body=... />.
 */
const MentionContext = createContext<MentionMap>({});

export function MentionProvider({
  map,
  children,
}: {
  map: MentionMap;
  children: React.ReactNode;
}) {
  return <MentionContext.Provider value={map}>{children}</MentionContext.Provider>;
}

export function RichBody({
  body,
  className = "",
}: {
  body: string | null | undefined;
  className?: string;
}) {
  const map = useContext(MentionContext);
  return <RichText body={body} mentions={map} className={className} />;
}
