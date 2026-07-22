"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { evaluateBadges, getBadgeState, type BadgeRow } from "@/lib/badges";
import BadgeCaseView from "@/components/BadgeCaseView";

/**
 * BadgeCase — the family's professional-title credential shelf (self-fetching
 * wrapper). Reads the credential state for `userId` (own + family via RLS) and
 * renders it through the presentational <BadgeCaseView>. For cross-family public
 * profiles the page uses <BadgeCaseView> directly with RPC-supplied rows.
 */

export default function BadgeCase({
  userId,
  title = "Credentials",
  evaluateSelf = false,
}: {
  userId: string;
  /** Section heading; pass "" to hide. */
  title?: string;
  /** Run evaluation before display — ONLY valid for the signed-in user. */
  evaluateSelf?: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<BadgeRow[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) return;
      if (evaluateSelf) {
        // Cheap + idempotent; awards anything earned-but-missing for this user.
        await evaluateBadges(supabase, userId);
      }
      const state = await getBadgeState(supabase, userId);
      if (mounted) setRows(state);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, evaluateSelf]);

  return <BadgeCaseView rows={rows} title={title} />;
}
