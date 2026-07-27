"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, AtSign, Check, Monitor, Moon, Sun } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useResolvedTheme, useThemePref } from "@/lib/useTheme";
import type { ThemePref } from "@/lib/theme";
import { deriveRegister } from "@/lib/register";
import { useEntitlements } from "@/components/entitlements/EntitlementsProvider";
import AvatarPicker from "@/components/AvatarPicker";
import EnablePushButton from "@/components/notifications/EnablePushButton";
import PushDevices from "@/components/notifications/PushDevices";
import AddFamily from "@/components/dashboard/AddFamily";
import {
  DisplayHead,
  SectionRule,
  Ledger,
  LedgerRow,
  LedgerLink,
  LedgerAction,
  Switch,
  TextAction,
} from "@/components/f0/parts";

/* ══════════════════════════════════════════════════════════════════════════
   SETTINGS — every control as a hairline ledger row under a section rule.

   Nothing here is decorative: the theme control writes through to the real
   theme store, every switch persists to profiles.notification_prefs, the
   membership block reads the family's real tier + enrollment dates, and Sign
   out really signs out. A field with no real value renders "—".
   ══════════════════════════════════════════════════════════════════════════ */

interface NotificationPrefs {
  email_notifs: boolean;
  live_alerts: boolean;
  weekly_digest: boolean;
  push_replies: boolean;
  push_mentions: boolean;
  push_announcements: boolean;
  push_picks: boolean;
  push_lessons: boolean;
  push_recordings: boolean;
  /** Live class go-live. Opt-OUT at dispatch (absent/true = send). */
  push_lives: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_notifs: true,
  live_alerts: true,
  weekly_digest: false,
  push_replies: true,
  push_mentions: true,
  push_announcements: true,
  push_picks: true,
  push_lessons: true,
  push_recordings: true,
  push_lives: true,
};

const DELIVERY: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
  {
    key: "email_notifs",
    label: "Email",
    sub: "Course and community updates in your inbox",
  },
  {
    key: "live_alerts",
    label: "Live class alerts",
    sub: "A heads-up 15 minutes before a class starts",
  },
  {
    key: "weekly_digest",
    label: "Weekly digest",
    sub: "One summary of your week — progress and what's new",
  },
];

const PUSH: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
  { key: "push_replies", label: "Replies", sub: "Someone answers your post or comment" },
  { key: "push_mentions", label: "Mentions", sub: "Someone @mentions you or tags @everyone" },
  { key: "push_announcements", label: "Announcements", sub: "Team and admin updates" },
  { key: "push_picks", label: "New picks", sub: "The team posts a new pick" },
  { key: "push_lessons", label: "New lessons", sub: "A lesson lands in a course you're taking" },
  { key: "push_recordings", label: "Class recordings", sub: "A class you RSVP'd to is posted" },
  { key: "push_lives", label: "Class going live", sub: "A live class you asked to be reminded about starts" },
];

/* Every key above maps 1:1 onto the real gate map in
   src/app/api/push/dispatch/route.ts — a toggle that gates nothing is not a
   setting, it's decoration. */

const THEMES: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Plan label for the family's real tier. */
function planLabel(tier: string, realTier: string): string {
  if (realTier === "fta") return "Family Trading Academy";
  if (tier === "fic") return "Cheat Code Club";
  return "Free";
}

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsSurface() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const ent = useEntitlements();
  const [themePref, setThemePrefValue] = useThemePref();
  const resolved = useResolvedTheme();

  const [userId, setUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  /** Real renewal / expiry date for the current plan — null when none exists. */
  const [renewsAt, setRenewsAt] = useState<string | null>(null);
  const nameCheckSeq = useRef(0);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "display_name, username, role, age_group, avatar_url, notification_prefs, family_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      setDisplayName(
        (profile?.display_name as string | null) ||
          (user.user_metadata?.display_name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          ""
      );
      setUsername((profile?.username as string | null) ?? null);
      setRole((profile?.role as string | null) ?? "");
      setAgeGroup((profile?.age_group as string | null) ?? null);
      setAvatarUrl((profile?.avatar_url as string | null) ?? null);
      setFamilyId((profile?.family_id as string | null) ?? null);
      if (profile?.notification_prefs) {
        setPrefs({
          ...DEFAULT_PREFS,
          ...(profile.notification_prefs as Partial<NotificationPrefs>),
        });
      }

      // Real renewal date. A Challenge Pass expires; an FTA family's Club window
      // ends at club_until. Neither is invented — no row, no date.
      if (profile?.family_id) {
        const { data: rows } = await supabase
          .from("enrollments")
          .select("program, status, club_until, expires_at")
          .eq("family_id", profile.family_id as string)
          .eq("status", "active");
        let best: string | null = null;
        for (const r of (rows ?? []) as {
          club_until: string | null;
          expires_at: string | null;
        }[]) {
          for (const d of [r.expires_at, r.club_until]) {
            if (!d) continue;
            if (!best || new Date(d) < new Date(best)) best = d;
          }
        }
        setRenewsAt(best);
      }
    })();
  }, [supabase]);

  // @mentions resolve on display_name with spaces stripped — warn on a clash.
  async function checkUsername(name: string) {
    const stripped = name.replace(/\s+/g, "").toLowerCase();
    setNameWarning("");
    if (stripped.length < 2 || !userId) return;
    const seq = ++nameCheckSeq.current;
    const { data } = await supabase.from("profiles").select("id, display_name").limit(1000);
    if (seq !== nameCheckSeq.current) return;
    const clash = (data ?? []).some(
      (p) =>
        p.id !== userId &&
        (p.display_name as string | null)?.replace(/\s+/g, "").toLowerCase() === stripped
    );
    if (clash) {
      setNameWarning(
        "Someone already goes by that. Add a last name or a number so @mentions find you."
      );
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase.auth.updateUser({ data: { display_name: displayName } });
    if (userId) {
      await supabase
        .from("profiles")
        .update({ display_name: displayName, avatar_url: avatarUrl })
        .eq("id", userId);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function togglePref(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic — the row never lags the tap
    if (userId) {
      await supabase.from("profiles").update({ notification_prefs: next }).eq("id", userId);
    }
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isChild = role === "child";
  const isAdult = deriveRegister({ role, age_group: ageGroup }) === "adult";
  const plan = planLabel(ent.tier, ent.realTier);
  const renewLabel = monthYear(renewsAt);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <DisplayHead
        eyebrow="Your account"
        title="Settings"
        lede="How the app looks, what reaches you, and what you're a member of."
        aside={
          <Link
            href="/progress"
            className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> You
          </Link>
        }
      />

      {/* ── PROFILE ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>Profile</SectionRule>

        <form onSubmit={saveProfile} className="space-y-4">
          <div className="f0-ledger-row justify-between">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-sand">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-[20px] font-extrabold text-soft">
                  {(displayName || email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-ink">Avatar</p>
              <p className="mt-0.5 text-[13px] text-soft">
                {avatarUrl ? "Pick a new look" : "Choose one, or keep your initials"}
              </p>
            </div>
            <TextAction onClick={() => setPickerOpen((v) => !v)}>
              {pickerOpen ? "Close" : "Change"}
            </TextAction>
          </div>

          {pickerOpen && (
            <div className="border-l-2 border-volt-500/40 pl-4">
              <AvatarPicker
                value={avatarUrl}
                onChange={setAvatarUrl}
                role={role}
                ageGroup={ageGroup}
              />
              <p className="mt-3 text-[12px] text-soft">
                Your pick saves when you press Save below.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-eyebrow font-display font-bold uppercase text-soft">
              Display name
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                void checkUsername(e.target.value);
              }}
              className="mt-2 w-full border-b border-sand bg-transparent pb-2 font-display text-display-3 font-extrabold text-ink outline-none transition-colors focus:border-volt-500"
            />
          </label>
          {nameWarning && (
            <p className="flex items-start gap-1.5 text-[13px] text-volt-700 dark:text-volt-400">
              <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {nameWarning}
            </p>
          )}

          <Ledger>
            <LedgerRow label="Email" value={email || "—"} />
            <LedgerRow label="Handle" value={username ? `@${username}` : "—"} />
          </Ledger>

          <div className="flex items-center gap-4">
            {/* text-white is theme-INVARIANT on purpose: it sits on the volt
                fill, and volt does not change between light and dark. */}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-volt-700 dark:text-volt-400">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </section>

      {/* ── APPEARANCE ───────────────────────────────────────────────────────
          This is THE dark-mode control for the whole app. setThemePrefValue →
          setThemePref() writes localStorage, stamps <html data-theme> and
          broadcasts, so every open surface re-skins on the same tick. Nothing
          here is decorative and nothing needs a reload. */}
      <section className="space-y-4">
        <SectionRule>Appearance</SectionRule>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex items-stretch border-y border-sand"
        >
          {THEMES.map(({ value, label, Icon }) => {
            const active = themePref === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemePrefValue(value)}
                className={`relative flex flex-1 items-center justify-center gap-2 py-3.5 font-display text-[14px] font-bold transition-colors ${
                  active ? "text-ink" : "text-soft hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-volt-500" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-soft">
          {themePref === "system"
            ? `Following your device — currently ${resolved}. Pick Light or Dark to override it.`
            : `The app is in ${themePref} mode. The change applies everywhere, instantly.`}
        </p>
      </section>

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>Notifications</SectionRule>
        <Ledger>
          {DELIVERY.map((t) => (
            <LedgerRow key={t.key} label={t.label} sub={t.sub}>
              <Switch
                on={prefs[t.key]}
                onToggle={() => void togglePref(t.key)}
                label={t.label}
              />
            </LedgerRow>
          ))}
        </Ledger>

        <div className="pt-2">
          <SectionRule>On this device</SectionRule>
          <p className="mt-3 text-[13px] leading-relaxed text-soft">
            Turning a category off silences its push only — it still lands in your
            bell.
          </p>
          <div className="mt-3">
            <EnablePushButton />
            <PushDevices />
          </div>
          <Ledger className="mt-4">
            {PUSH.map((t) => (
              <LedgerRow key={t.key} label={t.label} sub={t.sub}>
                <Switch
                  on={prefs[t.key]}
                  onToggle={() => void togglePref(t.key)}
                  label={t.label}
                />
              </LedgerRow>
            ))}
          </Ledger>
        </div>

        {/* Trade-alert delivery (briefing, digest, daily cap, quiet hours) lives
            in the /alerts hub — one authority, this is only the pointer. */}
        {isAdult && ent.tier !== "free" && (
          <Ledger>
            <LedgerLink
              href="/alerts"
              label="Trade alerts"
              sub="Kai's briefing, your rules, digest and daily limit"
            />
          </Ledger>
        )}
      </section>

      {/* ── MEMBERSHIP ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>Membership</SectionRule>
        <Ledger>
          <LedgerRow label="Plan" value={plan} />
          <LedgerRow
            label={ent.challenge?.active ? "Pass expires" : "Renews"}
            sub={
              ent.clubLapsed
                ? "Your Club window has ended — the Academy stays yours for life"
                : undefined
            }
            value={renewLabel ?? "—"}
          />
          {ent.challenge?.active && (
            <LedgerRow
              label="Challenge Pass"
              sub="Full Club access for the length of the challenge"
              value={`${ent.challenge.daysRemaining}d left`}
            />
          )}
          {!isChild && (
            <LedgerLink
              href="/upgrade"
              label="Plans & billing"
              sub="See what each tier unlocks, or change your plan"
            />
          )}
          <LedgerLink href="/referrals" label="Refer a friend" sub="Share the Club" />
        </Ledger>
      </section>

      {/* Family Mode — self-gates to null for anyone who isn't a solo owner. */}
      <AddFamily variant="settings" familyId={familyId ?? undefined} />

      {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionRule>Account</SectionRule>
        <Ledger>
          <LedgerAction
            label="Replay the walkthrough"
            sub="Take the guided tour of the app again"
            onClick={() => {
              try {
                localStorage.removeItem("fic-tour-done");
              } catch {
                /* private mode — the tour just replays for this session */
              }
              router.push("/dashboard?tour=1");
            }}
          />
          <LedgerAction
            label="Add to Home Screen"
            sub="Install the app on this device"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("fic:firstrun-install"));
              } catch {
                /* non-fatal */
              }
            }}
          />
          <LedgerLink href="/help" label="Help & support" sub="Get a hand from the team" />
          {/* Terminal action, and last by position — but NOT red: red is price. */}
          <LedgerAction
            label={signingOut ? "Signing out…" : "Sign out"}
            sub="End your session on this device"
            tone="quiet"
            disabled={signingOut}
            onClick={() => void signOut()}
          />
        </Ledger>
      </section>

      <p className="flex items-center gap-2 text-[13px] text-soft">
        Looking for your level, badges and reps?
        <Link
          href="/progress"
          className="inline-flex items-center gap-1 font-display font-bold text-volt-700 dark:text-volt-400"
        >
          Your profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
