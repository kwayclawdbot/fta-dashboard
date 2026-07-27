"use client";

/**
 * /club/canvas-b — proof harness for Canvas rebuild B3 (boards 06/07/08/15).
 * Renders the four screens at exact 390px in mobile frames, wired to the real
 * signed-in member's data (own-user RLS reads). A Light/Dark toggle flips the
 * whole set for the proof pairs. Not linked in nav — a review surface only.
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress, levelForXp } from "@/lib/xp";
import { getBadgeState } from "@/lib/badges";
import { setThemePref } from "@/lib/theme";
import { useLiveEvents } from "@/lib/clubhome/live-events";
import { TopBar, TabBar } from "@/components/canvasb/chrome";
import {
  AskKaiScreen,
  LearnScreen,
  YouScreen,
  SettingsScreen,
  type CanvasData,
} from "@/components/canvasb/screens";

const EMPTY: CanvasData = {
  name: "",
  avatarUrl: null,
  since: null,
  xp: 0,
  level: { level: 1, name: "Explorer" },
  prog: { pct: 0, toNext: 0, nextMin: null, nextLevel: null },
  stats: { tickersRated: null, conviction: null, research: null },
  streakWeeks: 0,
  badges: [],
  plan: null,
  liveClasses: [],
  journey: null,
  modules: [],
  userId: null,
  prefs: {},
};

function Frame({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-canvas-frame={id}
      data-mode="club"
      className="h-[844px] w-[390px] shrink-0 overflow-hidden rounded-[28px] bg-paper shadow-2xl ring-1 ring-black/5"
    >
      {children}
    </div>
  );
}

export default function CanvasBHarness() {
  const [data, setData] = useState<CanvasData>(EMPTY);
  const live = useLiveEvents({ fixtures: true, scale: "scale" });

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, xp, badges] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url, created_at, notification_prefs")
          .eq("id", user.id)
          .single(),
        getUserXp(supabase, user.id).catch(() => 0),
        getBadgeState(supabase, user.id).catch(() => []),
      ]);

      const profile = profileRes.data;
      const prog = levelProgress(xp);
      const lvl = levelForXp(xp);
      const since = profile?.created_at
        ? new Date(profile.created_at as string).toLocaleString("en-US", {
            month: "short",
            year: "numeric",
          })
        : null;

      // stat trio — real own-user counts, honest "—" on any absence.
      const stats = { tickersRated: null as number | null, conviction: null as number | null, research: null as number | null };
      try {
        const { data: rows } = await supabase
          .from("ticker_sentiment")
          .select("vote")
          .eq("user_id", user.id)
          .limit(1000);
        if (rows) {
          stats.tickersRated = rows.length;
          if (rows.length) {
            const bull = rows.filter((r) => Number(r.vote) === 1).length;
            stats.conviction = Math.round((bull / rows.length) * 100);
          }
        }
      } catch {}
      try {
        const { data: notes } = await supabase
          .from("report_notes")
          .select("id")
          .eq("author_id", user.id)
          .limit(1000);
        if (notes) stats.research = notes.length;
      } catch {}

      // participation streak — distinct ISO-weeks with an xp_event, trailing run.
      let streakWeeks = 0;
      try {
        const { data: ev } = await supabase
          .from("xp_events")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);
        if (ev && ev.length) {
          const weekKey = (d: Date) => {
            const t = new Date(d);
            t.setHours(0, 0, 0, 0);
            t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // Monday
            return t.toISOString().slice(0, 10);
          };
          const weeks = new Set(ev.map((e) => weekKey(new Date(e.created_at as string))));
          const cur = new Date();
          let w = weekKey(cur);
          while (weeks.has(w)) {
            streakWeeks++;
            const prev = new Date(w);
            prev.setDate(prev.getDate() - 7);
            w = prev.toISOString().slice(0, 10);
          }
        }
      } catch {}

      // membership plan — real entitlement (best-effort).
      let plan: CanvasData["plan"] = null;
      try {
        const { data: ent } = await supabase
          .from("entitlements")
          .select("plan, renews_at, current_period_end, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (ent) {
          const label = ent.plan ? `${ent.plan}` : "Club";
          const renewRaw = (ent.renews_at ?? ent.current_period_end) as string | null;
          plan = {
            label: label.charAt(0).toUpperCase() + label.slice(1),
            renews: renewRaw
              ? new Date(renewRaw).toLocaleString("en-US", { month: "short", year: "numeric" })
              : null,
          };
        }
      } catch {}

      setData((d) => ({
        ...d,
        name: (profile?.display_name as string) || user.email?.split("@")[0] || "Member",
        avatarUrl: (profile?.avatar_url as string) ?? null,
        since,
        xp,
        level: { level: lvl.level, name: lvl.name },
        prog: {
          pct: prog.pct,
          toNext: prog.toNext,
          nextMin: prog.next?.min ?? null,
          nextLevel: prog.next?.level ?? null,
        },
        stats,
        streakWeeks,
        badges: (badges as { slug: string; title: string; awarded: boolean }[]).map((b) => ({
          slug: b.slug,
          title: b.title,
          awarded: b.awarded,
        })),
        plan,
        userId: user.id,
        prefs: (profile?.notification_prefs as Record<string, boolean>) ?? {},
      }));
    })();
  }, []);

  const merged = useMemo<CanvasData>(() => ({ ...data, liveClasses: live }), [data, live]);

  return (
    <div className="min-h-screen bg-neutral-200 p-6 dark:bg-neutral-900">
      <div className="mb-5 flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-neutral-600 dark:text-neutral-300">
          Canvas B3 · boards 06/07/08/15
        </span>
        <button onClick={() => setThemePref("light")} className="rounded-md bg-white px-3 py-1.5 text-sm font-bold shadow">
          light
        </button>
        <button onClick={() => setThemePref("dark")} className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-bold text-white shadow">
          dark
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <Frame id="06-ask-kai">
          <div className="flex h-full flex-col">
            <TopBar avatarUrl={merged.avatarUrl} showSearch={false} />
            <div className="min-h-0 flex-1">
              <AskKaiScreen data={merged} />
            </div>
            <TabBar active="Discover" />
          </div>
        </Frame>

        <Frame id="07-learn">
          <div className="flex h-full flex-col">
            <TopBar avatarUrl={merged.avatarUrl} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <LearnScreen data={merged} />
            </div>
            <TabBar active="Discover" />
          </div>
        </Frame>

        <Frame id="08-you">
          <div className="flex h-full flex-col">
            <TopBar avatarUrl={merged.avatarUrl} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <YouScreen data={merged} />
            </div>
            <TabBar active="You" />
          </div>
        </Frame>

        <Frame id="15-settings">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <SettingsScreen data={merged} />
            </div>
            <TabBar active="You" />
          </div>
        </Frame>
      </div>
    </div>
  );
}
