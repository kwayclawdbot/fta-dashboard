"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award, Eye, CheckCircle2, Target, Calendar, Trophy, Sparkles, ArrowRight, MessageCircle, Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  activityLine, timeAgo, type ActivityPayload, type FeedAuthor,
} from "@/lib/feed";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { fetchXpForUsers } from "@/lib/belts";

/**
 * <ClubActivityStrip> — a compact "what's happening in the club" strip for the
 * dashboard Home (COMMUNITY-EXPERIENCE-STUDY §3, §4.3). Surfaces the latest few
 * feed items (human posts + activity cards) with a link into /community, so the
 * screen everyone lands on shows a live sliver of the community and pulls them in.
 *
 * SELF-CONTAINED: fetches its own data, renders nothing while empty/loading, and
 * is NOT wired into any page by this migration. Drop `<ClubActivityStrip />`
 * into the dashboard home to activate. Optional `limit` (default 4).
 */

const ICONS: Record<string, React.ElementType> = {
  award: Award, eye: Eye, check: CheckCircle2, target: Target,
  calendar: Calendar, trophy: Trophy, sparkles: Sparkles, heart: Heart,
};

interface Row {
  id: string;
  kind: string;
  body: string;
  created_at: string;
  activity_payload: ActivityPayload | null;
  author: FeedAuthor | null;
}

export default function ClubActivityStrip({ limit = 4 }: { limit?: number }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("feed_posts")
        .select(
          "id, kind, body, created_at, activity_payload, author:profiles!feed_posts_author_id_fkey(id, display_name, role, age_group, family_id, avatar_url)"
        )
        .neq("kind", "anchor")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!mounted) return;
      const norm: Row[] = (data ?? []).map((r) => {
        const raw = r as unknown as Row & { author: FeedAuthor | FeedAuthor[] | null };
        return { ...raw, author: Array.isArray(raw.author) ? raw.author[0] ?? null : raw.author };
      });
      setRows(norm);
      setReady(true);
      // Batched belt XP for the strip's avatars (one RPC).
      fetchXpForUsers(supabase, norm.map((r) => r.author?.id)).then((m) => mounted && setXpMap(m));
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, limit]);

  if (!ready || rows.length === 0) return null;

  return (
    <div className="paper-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-gold-600" /> In the club
        </h3>
        <Link href="/community" className="text-xs font-semibold text-gold-700 hover:text-gold-600 inline-flex items-center gap-1">
          See all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          if (r.kind === "activity" && r.activity_payload) {
            const line = activityLine(r.activity_payload);
            const Icon = ICONS[line.iconKey] || Sparkles;
            return (
              <Link key={r.id} href="/community" className="flex items-center gap-2.5 group">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${line.accent}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs text-midnight-200 min-w-0 truncate">
                  <span className="font-semibold text-ink">{line.subject}</span> {line.verb}{" "}
                  <span className="font-medium text-ink">{line.target}</span>
                </p>
                <span className="text-[10px] text-soft ml-auto shrink-0">{timeAgo(r.created_at)}</span>
              </Link>
            );
          }
          return (
            <Link key={r.id} href="/community" className="flex items-center gap-2.5 group">
              <Avatar name={r.author?.display_name} avatarUrl={r.author?.avatar_url} role={r.author?.role} xp={r.author?.id ? xpMap[r.author.id] : undefined} size="sm" />
              <p className="text-xs text-midnight-200 min-w-0 truncate">
                <span className="font-semibold text-ink">{r.author?.display_name || "Member"}</span>{" "}
                <AgeBadge role={r.author?.role} ageGroup={r.author?.age_group} className="align-middle" />{" "}
                {r.body || "shared a photo"}
              </p>
              <span className="text-[10px] text-soft ml-auto shrink-0">{timeAgo(r.created_at)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
