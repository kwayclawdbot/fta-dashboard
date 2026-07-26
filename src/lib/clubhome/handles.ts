"use client";

/**
 * useMemberHandles — resolve a batch of member ids to { username, name } via the
 * /api/members/handles route, so ClubHome surfaces (the Collective constellation,
 * People) can link avatar nodes to /u/[username]. Guarded by `enabled` so it
 * never fires for KID viewers, fixture data (fake ids), or empty lists.
 */

import { useEffect, useState } from "react";

export type MemberHandle = { username: string | null; name: string | null };
export type MemberHandleMap = Record<string, MemberHandle>;

export function useMemberHandles(ids: string[], enabled = true): MemberHandleMap {
  const [handles, setHandles] = useState<MemberHandleMap>({});
  // stable dep — refetch only when the id set actually changes
  const key = ids.join(",");

  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    let mounted = true;
    const ctrl = new AbortController();

    fetch("/api/members/handles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { handles?: MemberHandleMap } | null) => {
        if (mounted && j?.handles) setHandles(j.handles);
      })
      .catch(() => {
        /* offline / aborted → nodes stay non-clickable, still render avatars */
      });

    return () => {
      mounted = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return handles;
}
