"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";

import { Card } from "@/components/clubhome/parts";
import { setThemePref, type ThemePref } from "@/lib/theme";
import type { LiveEvent } from "@/lib/clubhome/live-events";
import { DisplayTitle } from "./chrome";

/* ══════════════════════════════════════════════════════════════════════════
   Canvas rebuild B3 — screens 06 Ask Kai · 07 Learn · 08 You · 15 Settings.
   Pixel-faithful COMPOSITIONS of the App-UI artboards, wired to real member
   data. No fabricated market numbers: a live analysis card renders its honest
   "temporarily unavailable" state while Kai's credits are dead.
   ══════════════════════════════════════════════════════════════════════════ */

export interface CanvasData {
  name: string;
  avatarUrl: string | null;
  since: string | null; // "Mar 2024"
  xp: number;
  level: { level: number; name: string };
  prog: { pct: number; toNext: number; nextMin: number | null; nextLevel: number | null };
  stats: {
    tickersRated: number | null;
    conviction: number | null;
    research: number | null;
  };
  streakWeeks: number;
  badges: { slug: string; title: string; awarded: boolean }[];
  plan: { label: string; renews: string | null } | null;
  liveClasses: LiveEvent[];
  journey: { title: string; lessonNum: number; lessonTotal: number; pct: number } | null;
  modules: { title: string; lessons: string; pct: number; tint: string }[];
  userId: string | null;
  prefs: Record<string, boolean>;
}

/* ── 06 · ASK KAI ─────────────────────────────────────────────────────────── */
export function AskKaiScreen({ data }: { data: CanvasData }) {
  const first = (data.name || "there").split(/\s+/)[0];
  const suggestions = [
    "What's moving in the market right now?",
    "Break down a ticker for me",
    "What should I study next?",
  ];
  return (
    <div className="flex h-full flex-col">
      {/* hero — title left, Kai avatar tile right */}
      <div className="flex items-start justify-between gap-3 px-5 pt-3">
        <div>
          <h1 className="font-display text-[40px] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-volt-600">
            Ask Kai
          </h1>
          <p className="mt-1 font-display text-[17px] font-medium text-soft">
            Your AI co-pilot
          </p>
        </div>
        <div
          className="mt-1 grid h-[92px] w-[128px] shrink-0 place-items-center overflow-hidden rounded-2xl"
          style={{ background: "linear-gradient(150deg,#DCEBF5 0%,#EAF3F8 60%,#F3ECE0 100%)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/kai/waving.webp" alt="Kai" className="h-[84px] w-auto object-contain" />
        </div>
      </div>

      {/* chat stream */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-6">
        {/* Kai greeting */}
        <div className="flex gap-2.5">
          <KaiChip />
          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-sand bg-card p-4 shadow-soft">
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-kai-600">
              Kai
            </p>
            <p className="mt-1.5 text-[17px] leading-snug text-ink">
              Hey {first} — what do you want to know today?
            </p>
          </div>
        </div>

        {/* honest analysis-card composition (live analysis temporarily paused) */}
        <div className="flex gap-2.5">
          <KaiChip />
          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-sand bg-card p-4 shadow-soft">
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-kai-600">
              Kai
            </p>
            <p className="mt-1.5 text-[17px] leading-snug text-ink">
              Ask about any ticker and I&apos;ll break down the story, the levels,
              and what the Club is watching.
            </p>
            <div className="mt-3 rounded-xl border border-sand bg-paper p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px] font-extrabold text-ink">
                  Live analysis
                </span>
                <span className="rounded-full bg-sand/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-soft">
                  Paused
                </span>
              </div>
              <p className="mt-1.5 text-[14px] leading-snug text-soft">
                Kai&apos;s live market read is temporarily unavailable. Your
                questions are still saved — open the full chat and Kai will answer
                the moment it&apos;s back.
              </p>
            </div>
          </div>
        </div>

        {/* suggestion follow-ups */}
        <div className="flex flex-wrap gap-2 pl-[46px]">
          {suggestions.map((s) => (
            <Link
              key={s}
              href={`/kai?q=${encodeURIComponent(s)}`}
              className="rounded-full border border-sand bg-card px-3.5 py-2 text-[13px] font-semibold text-ink shadow-soft transition-colors hover:border-volt-400"
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* ask-anything input */}
      <div className="border-t border-sand px-5 pb-3 pt-3">
        <Link
          href="/kai"
          className="flex items-center gap-2 rounded-full border border-sand bg-card p-1.5 pl-5 shadow-soft"
        >
          <span className="flex-1 text-[16px] text-soft">Ask anything…</span>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-volt-500 text-white">
            <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
          </span>
        </Link>
        <p className="mt-2 text-center text-[12px] text-soft">
          Kai can make mistakes. Always do your own research.
        </p>
      </div>
    </div>
  );
}

function KaiChip() {
  return (
    <span
      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl"
      style={{ background: "linear-gradient(150deg,#DCEBF5,#F3ECE0)" }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/kai/avatar.webp" alt="" className="h-8 w-8 object-contain" />
    </span>
  );
}

/* ── 07 · LEARN ───────────────────────────────────────────────────────────── */
export function LearnScreen({ data }: { data: CanvasData }) {
  const [tab, setTab] = useState<"journey" | "classes" | "missions">("journey");
  const tabs = [
    { id: "journey" as const, label: "Journey" },
    { id: "classes" as const, label: "Classes" },
    { id: "missions" as const, label: "Missions" },
  ];
  return (
    <div className="flex h-full flex-col">
      <DisplayTitle title="Learn" sub="Grow your edge" />

      {/* tabs */}
      <div className="mt-4 flex gap-6 border-b border-sand px-5">
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative pb-3 font-display text-[15px] font-bold uppercase tracking-[0.08em] ${
                on ? "text-ink" : "text-soft"
              }`}
            >
              {t.label}
              {on && (
                <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-volt-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {tab === "journey" && <JourneyTab data={data} />}
        {tab === "classes" && <ClassesTab classes={data.liveClasses} />}
        {tab === "missions" && <MissionsTab />}
      </div>
    </div>
  );
}

function JourneyTab({ data }: { data: CanvasData }) {
  const j = data.journey;
  const nextClass = data.liveClasses.find((c) => c.status !== "replay_ready") ?? null;
  return (
    <>
      {/* continue learning */}
      <Card className="!p-5">
        {j ? (
          <>
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">
              Continue learning
            </p>
            <h3 className="mt-1.5 font-display text-[24px] font-extrabold leading-[1.08] tracking-tight text-ink">
              {j.title}
            </h3>
            <p className="mt-1.5 text-[15px] text-soft">
              Lesson {j.lessonNum} of {j.lessonTotal}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full bg-volt-500" style={{ width: `${j.pct}%` }} />
              </div>
              <span className="font-mono text-[14px] font-bold text-soft">{j.pct}%</span>
            </div>
            <Link
              href="/learn"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-teal-500 px-5 py-2.5 font-display text-[15px] font-bold text-teal-700"
            >
              Continue lesson <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">
              Start learning
            </p>
            <h3 className="mt-1.5 font-display text-[24px] font-extrabold leading-[1.08] tracking-tight text-ink">
              Pick your first path
            </h3>
            <p className="mt-1.5 text-[15px] text-soft">
              Your progress shows up here the moment you open a lesson.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-teal-500 px-5 py-2.5 font-display text-[15px] font-bold text-teal-700"
            >
              Browse paths <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </Card>

      {/* next live class */}
      {nextClass && <ClassCard c={nextClass} />}

      {/* your modules */}
      {data.modules.length > 0 && (
        <Card className="!p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em] text-ink">
              Your modules
            </h3>
            <Link href="/learn" className="inline-flex items-center gap-1 font-display text-[14px] font-bold text-teal-700">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {data.modules.map((m) => (
              <div key={m.title} className="flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: m.tint }} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-extrabold text-ink">{m.title}</p>
                  <p className="text-[13px] text-soft">{m.lessons}</p>
                </div>
                <div className="flex w-[110px] items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className="font-mono text-[13px] font-bold text-soft">{m.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function ClassesTab({ classes }: { classes: LiveEvent[] }) {
  const upcoming = classes.filter((c) => c.status !== "replay_ready");
  if (upcoming.length === 0) {
    return (
      <Card className="!p-5 text-[15px] text-soft">
        No live classes on the calendar right now. The Club&apos;s September
        webinar series drops here as it&apos;s scheduled.
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {upcoming.map((c) => (
        <ClassCard key={c.id} c={c} />
      ))}
    </div>
  );
}

function ClassCard({ c }: { c: LiveEvent }) {
  const when =
    c.status === "live"
      ? "Live now"
      : c.starts_at
        ? new Date(c.starts_at).toLocaleString("en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
        : "Scheduled";
  return (
    <Card className="!overflow-hidden !p-0">
      <div
        className="relative h-36 w-full"
        style={{ background: "linear-gradient(135deg,#0B1220 0%,#12233B 55%,#0A2320 100%)" }}
      >
        <div className="absolute inset-0 club-brief-grid" aria-hidden />
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
            {c.status === "live" ? "Live" : "Live"}
          </span>
          <span className="font-display text-[15px] font-bold text-ink">{when}</span>
        </div>
        <h3 className="mt-2.5 font-display text-[22px] font-extrabold leading-[1.1] tracking-tight text-ink">
          {c.title}
          {c.host?.name ? <span className="text-soft"> · {c.host.name}</span> : null}
        </h3>
        <Link
          href={c.join_url || "/live-sessions"}
          className="mt-4 inline-flex items-center rounded-full border-2 border-volt-500 px-5 py-2.5 font-display text-[15px] font-bold text-volt-700"
        >
          {c.status === "live" ? "Join room" : "Set reminder"}
        </Link>
      </div>
    </Card>
  );
}

function MissionsTab() {
  return (
    <Card className="!p-5">
      <h3 className="font-display text-[18px] font-extrabold text-ink">
        Missions live in Family Mode
      </h3>
      <p className="mt-1.5 text-[15px] text-soft">
        Kid and family missions — money maps, ticker hunts, streak challenges —
        run inside Family Mode. Switch a profile to a kid or family adult to play.
      </p>
      <Link
        href="/family"
        className="mt-4 inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-volt-700"
      >
        Open Family Mode <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

/* ── 08 · YOU ─────────────────────────────────────────────────────────────── */
export function YouScreen({ data }: { data: CanvasData }) {
  const nextLvl = data.prog.nextLevel;
  const streakDots = 7;
  const filled = Math.min(streakDots - 1, Math.max(0, data.streakWeeks % streakDots || (data.streakWeeks > 0 ? 6 : 0)));
  const badges = data.badges.slice(0, 5);
  while (badges.length < 5) badges.push({ slug: `ph-${badges.length}`, title: "", awarded: false });

  return (
    <div className="flex h-full flex-col">
      <DisplayTitle title="You" sub="Your profile & progress" />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {/* identity + level */}
        <Card className="!p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-full ring-[3px] ring-volt-500">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="h-full w-full bg-midnight-800" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[26px] font-extrabold tracking-tight text-ink">
                {data.name || "Member"}
              </h2>
              <p className="text-[15px] text-soft">
                Club member{data.since ? ` · since ${data.since}` : ""}
              </p>
            </div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-full border border-sand px-4 py-2 font-display text-[14px] font-bold text-ink"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </div>

          <div className="my-4 border-t border-sand" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[20px] font-extrabold tracking-tight text-ink">
                Level {data.level.level} · {data.level.name}
              </p>
              <p className="mt-1">
                <span className="font-display text-[34px] font-extrabold tracking-tight text-ink tabular-nums">
                  {data.xp.toLocaleString()}
                </span>{" "}
                <span className="font-display text-[15px] font-bold text-volt-600">XP</span>
              </p>
              {nextLvl != null && (
                <p className="text-[15px] text-soft">
                  {data.prog.toNext.toLocaleString()} XP to Level {nextLvl}
                </p>
              )}
            </div>
            <span
              className="h-[92px] w-[110px] shrink-0 rounded-2xl ring-2 ring-volt-500"
              style={{ background: "linear-gradient(150deg,#7A5A16,#3A2A08)" }}
              aria-hidden
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-volt-500" style={{ width: `${data.prog.pct}%` }} />
            </div>
            {data.prog.nextMin != null && (
              <span className="font-mono text-[13px] font-bold text-soft tabular-nums">
                {data.prog.nextMin.toLocaleString()}
              </span>
            )}
          </div>
        </Card>

        {/* stat trio */}
        <Card className="!p-0">
          <div className="grid grid-cols-3 divide-x divide-sand py-4">
            <Stat label="Tickers rated" value={fmt(data.stats.tickersRated)} />
            <Stat label="Conviction" value={data.stats.conviction != null ? `${data.stats.conviction}%` : "—"} tone="teal" />
            <Stat label="Research" value={fmt(data.stats.research)} />
          </div>
        </Card>

        {/* participation streak */}
        <Card className="!p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink">
                Participation streak
              </p>
              <p className="mt-0.5 font-display text-[28px] font-extrabold tracking-tight text-ink">
                {data.streakWeeks} {data.streakWeeks === 1 ? "week" : "weeks"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: streakDots }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full ${
                    i < filled ? "bg-volt-500" : "border-2 border-sand bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* badges */}
        <Card className="!p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em] text-ink">
              Badges
            </h3>
            <Link href="/you/badges" className="inline-flex items-center gap-1 font-display text-[14px] font-bold text-volt-700">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {badges.map((b, i) => (
              <span
                key={b.slug + i}
                className={`aspect-square rounded-2xl ${
                  b.awarded
                    ? "ring-2 ring-volt-500"
                    : "bg-sand/60"
                }`}
                style={b.awarded ? { background: "linear-gradient(150deg,#7A5A16,#3A2A08)" } : undefined}
                title={b.title || undefined}
              />
            ))}
          </div>
        </Card>

        {/* rows */}
        <div className="overflow-hidden rounded-2xl border border-sand bg-card shadow-soft">
          <RowLink href="/community?mine=1" label="My posts" />
          <RowLink href="/watchlist?saved=1" label="Saved insights" border />
          <RowLink href="/settings" label="Settings" border />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "teal" }) {
  return (
    <div className="px-2 text-center">
      <p className="text-[13px] text-soft">{label}</p>
      <p className={`mt-1 font-display text-[28px] font-extrabold tracking-tight tabular-nums ${tone === "teal" ? "text-teal-600" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function RowLink({ href, label, border }: { href: string; label: string; border?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-5 py-4 ${border ? "border-t border-sand" : ""}`}
    >
      <span className="font-display text-[17px] font-semibold text-ink">{label}</span>
      <ChevronRight className="h-5 w-5 text-soft" />
    </Link>
  );
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}

/* ── 15 · SETTINGS ────────────────────────────────────────────────────────── */
export function SettingsScreen({ data }: { data: CanvasData }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-5">
        <Link href="/you" aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-ink" />
        </Link>
        <h1 className="font-display text-[30px] font-extrabold uppercase tracking-[-0.01em] text-ink">
          Settings
        </h1>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* appearance */}
        <section>
          <SectionLabel>Appearance</SectionLabel>
          <Card className="!p-5">
            <p className="font-display text-[18px] font-bold text-ink">Theme</p>
            <ThemeSegmented />
            <p className="mt-3 text-[14px] text-soft">Tap Light or Dark to preview the whole set.</p>
          </Card>
        </section>

        {/* notifications */}
        <section>
          <SectionLabel>Notifications</SectionLabel>
          <Card className="!p-0">
            <NotifRow userId={data.userId} k="live_alerts" initial={data.prefs.live_alerts ?? true} title="Signal triggers" desc="Push the moment a setup fires" />
            <NotifRow userId={data.userId} k="push_replies" initial={data.prefs.push_replies ?? true} title="Club replies" desc="When members answer your posts" border />
            <NotifRow userId={data.userId} k="push_lives" initial={data.prefs.push_lives ?? false} title="Kai daily brief" desc="7:00 AM summary" border />
          </Card>
        </section>

        {/* membership */}
        <section>
          <SectionLabel>Membership</SectionLabel>
          <Card className="!p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-display text-[17px] font-semibold text-ink">Plan</span>
              <span className="font-display text-[16px] font-bold text-volt-600">
                {data.plan?.label ?? "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-sand px-5 py-4">
              <span className="font-display text-[17px] font-semibold text-ink">Renews</span>
              <span className="font-mono text-[15px] font-semibold text-soft">
                {data.plan?.renews ?? "—"}
              </span>
            </div>
            <RowLink href="/refer" label="Referrals" border />
          </Card>
        </section>

        {/* account */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <Card className="!p-0">
            <RowLink href="/settings#profile" label="Profile & avatar" />
            <RowLink href="/settings#privacy" label="Privacy" border />
            <SignOutRow />
          </Card>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-soft">
      {children}
    </h2>
  );
}

function ThemeSegmented() {
  const [pref, setPref] = useState<ThemePref>("system");
  const opts: { id: ThemePref; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
  ];
  return (
    <div className="mt-3 flex rounded-xl bg-sand/70 p-1">
      {opts.map((o) => {
        const on = pref === o.id;
        return (
          <button
            key={o.id}
            onClick={() => {
              setPref(o.id);
              setThemePref(o.id);
            }}
            className={`flex-1 rounded-lg py-2.5 text-center font-display text-[15px] font-bold transition-colors ${
              on ? "bg-card text-ink shadow-soft" : "text-soft"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NotifRow({
  userId,
  k,
  initial,
  title,
  desc,
  border,
}: {
  userId: string | null;
  k: string;
  initial: boolean;
  title: string;
  desc: string;
  border?: boolean;
}) {
  const [on, setOn] = useState(initial);
  async function toggle() {
    const next = !on;
    setOn(next);
    if (userId) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: prof } = await supabase
          .from("profiles")
          .select("notification_prefs")
          .eq("id", userId)
          .single();
        const prefs = { ...(prof?.notification_prefs ?? {}), [k]: next };
        await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", userId);
      } catch {
        /* non-fatal */
      }
    }
  }
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-4 ${border ? "border-t border-sand" : ""}`}>
      <div className="min-w-0">
        <p className="font-display text-[17px] font-semibold text-ink">{title}</p>
        <p className="text-[14px] text-soft">{desc}</p>
      </div>
      <button
        onClick={toggle}
        aria-pressed={on}
        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${on ? "bg-volt-500" : "bg-midnight-400/40"}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

function SignOutRow() {
  async function signOut() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
      window.location.href = "/login";
    } catch {
      /* non-fatal */
    }
  }
  return (
    <button
      onClick={signOut}
      className="flex w-full items-center justify-between border-t border-sand px-5 py-4 text-left"
    >
      <span className="font-display text-[17px] font-semibold text-red-600">Sign out</span>
      <ChevronRight className="h-5 w-5 text-red-500/70" />
    </button>
  );
}
