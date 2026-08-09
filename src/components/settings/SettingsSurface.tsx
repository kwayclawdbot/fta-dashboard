"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AtSign, Check, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useResolvedTheme, useThemePref } from "@/lib/useTheme";
import { useAppMode } from "@/lib/useAppMode";
import type { ThemePref } from "@/lib/theme";
import { deriveRegister } from "@/lib/register";
import { useEntitlements } from "@/components/entitlements/EntitlementsProvider";
import AvatarPicker from "@/components/AvatarPicker";
import EnablePushButton from "@/components/notifications/EnablePushButton";
import PushDevices from "@/components/notifications/PushDevices";
import AddFamily from "@/components/dashboard/AddFamily";
import { SegmentedRail } from "@/components/canvas2";
import { Switch } from "@/components/f0/parts";
import {
  BoardMast,
  Card,
  Eyebrow,
  ListHead,
  RingAvatar,
  TextAction,
} from "@/components/you/parts";

/* ══════════════════════════════════════════════════════════════════════════
   SETTINGS — no board in the archive draws this surface, so it is composed
   from the vocabulary the boards DO draw: the lowercase wordmark masthead of
   board 07, white rounded cards with hairline borders, mono eyebrows, and
   hairline-separated rows INSIDE a card (board 22's "How belts show up"
   object) rather than a stack of loose rules on the paper.

   The theme picker is the SHARED one-of-N primitive (SegmentedRail, canvas v2
   L0), so it has the same keyboard model, focus ring and underline geometry as
   every other selector in the app.

   Nothing here is decorative: the theme control writes through to the real
   theme store, every switch persists to profiles.notification_prefs, the
   membership block reads the family's real tier + enrollment dates, and Sign
   out really signs out. A field with no real value renders "—".

   COMMERCIAL COPY IS BYTE-IDENTICAL to the version that shipped — every plan
   label, renewal line, Challenge Pass string and billing row is unchanged. The
   `push_challenge` row added by the Challenge lane is carried through verbatim.

   COLOUR: orange TEXT is `text-gold-700` (the ramp that flips at night), never
   `text-volt-*` (frozen across themes). Filled actions ride --accent-solid with
   the declared --accent-on foreground, which is the only pairing legible on
   orange, family gold and FTA metallic alike. There is no red destructive tone
   by law — red is price, so Sign out is differentiated by position and by its
   sub-line, never by hue.
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
  /** 5-Day Challenge day reminders. Opt-OUT at dispatch (absent/true = send). */
  push_challenge: boolean;
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
  push_challenge: true,
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
  { key: "push_challenge", label: "Challenge days", sub: "Your daily 5-Day Challenge mission and when the class starts" },
];

/* Every key above maps 1:1 onto the real gate map in
   src/app/api/push/dispatch/route.ts — a toggle that gates nothing is not a
   setting, it's decoration. */

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
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

/* ── Card-internal row ────────────────────────────────────────────────────
   Board 22's explainer object at setting scale: rows separated by hairlines
   INSIDE one card, never a card per row. `.f0-ledger` supplies the hairline
   between siblings (and its dark lift), so the rule never has to be re-tuned
   per theme here. */
function SettingRow({
  label,
  sub,
  value,
  children,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  /** Replaces the value slot entirely (a switch, a control). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[10.5px] leading-snug text-soft">{sub}</p>}
      </div>
      {children ?? (
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
          {value}
        </span>
      )}
    </div>
  );
}

function SettingLink({
  href,
  label,
  sub,
  meta,
}: {
  href: string;
  label: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href} className="f0-focus group flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[10.5px] leading-snug text-soft">{sub}</p>}
      </div>
      {meta && (
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
          {meta}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-soft transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  );
}

function SettingAction({
  onClick,
  label,
  sub,
  tone = "ink",
  disabled,
}: {
  onClick: () => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
  /** No "danger" tone by law — red is price. A terminal action reads quiet. */
  tone?: "ink" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="f0-focus flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <p
          className={`font-display text-[13px] font-bold ${
            tone === "quiet" ? "text-soft" : "text-ink"
          }`}
        >
          {label}
        </p>
        {sub && <p className="mt-0.5 text-[10.5px] leading-snug text-soft">{sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-soft" />
    </button>
  );
}

export default function SettingsSurface() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const ent = useEntitlements();
  const [themePref, setThemePrefValue] = useThemePref();
  const resolved = useResolvedTheme();
  // Appearance is a CLUB-mode control (family is light-only) — see the
  // Appearance section below. SSR default is "family", so the control appears
  // after mount for club members rather than flashing for family ones.
  const appMode = useAppMode();

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
  /**
   * Does this family have a Stripe customer behind it? Answered by
   * GET /api/billing/portal without touching Stripe, so the MEMBERSHIP row
   * knows on load whether it can open the real billing portal or must hand off
   * to /upgrade. `null` = still asking.
   */
  const [portalAvailable, setPortalAvailable] = useState<boolean | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
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

  /**
   * BILLING — ask once, on load, whether there is a portal to open. The route
   * answers from the family row alone (no Stripe call), so this costs nothing
   * and lets the MEMBERSHIP row render its true state instead of discovering it
   * after a click. A child gets a 403 here, which resolves to `false` and the
   * row never appears for them anyway.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/portal");
        const json = (await res.json()) as { available?: boolean };
        if (!cancelled) setPortalAvailable(res.ok && json.available === true);
      } catch {
        if (!cancelled) setPortalAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Open Stripe's own Customer Portal — the only place a member can change a
   * card, read an invoice or cancel. If the family has no customer on file
   * (a hand-provisioned beta household), the 409 lands them on /upgrade, which
   * is the honest destination for "there is nothing to manage yet".
   */
  async function openBillingPortal() {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/settings" }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
    } catch {
      /* fall through to the plans page */
    }
    setOpeningPortal(false);
    router.push("/upgrade");
  }

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
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <BoardMast
        word="settings"
        lede="How the app looks, what reaches you, and what you're a member of."
        action={
          <Link
            href="/progress"
            className="f0-focus inline-flex items-center gap-1.5 rounded font-display text-[12px] font-bold text-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> You
          </Link>
        }
      />

      {/* ── PROFILE ──────────────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead>Profile</ListHead>
        <form onSubmit={saveProfile}>
          <Card className="space-y-4 rounded-[16px] px-3.5 py-3.5">
            <div className="flex items-center gap-3.5">
              <RingAvatar name={displayName || email || "?"} avatarUrl={avatarUrl} size={64} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[13px] font-bold text-ink">Avatar</p>
                <p className="mt-0.5 text-[10.5px] text-soft">
                  {avatarUrl ? "Pick a new look" : "Choose one, or keep your initials"}
                </p>
              </div>
              <TextAction onClick={() => setPickerOpen((v) => !v)}>
                {pickerOpen ? "Close" : "Change"}
              </TextAction>
            </div>

            {pickerOpen && (
              <div
                className="pl-3.5"
                style={{ borderLeft: "2px solid color-mix(in srgb, var(--accent-solid) 40%, transparent)" }}
              >
                <AvatarPicker
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  role={role}
                  ageGroup={ageGroup}
                />
                <p className="mt-3 text-[10.5px] text-soft">
                  Your pick saves when you press Save below.
                </p>
              </div>
            )}

            <label className="block">
              <Eyebrow>Display name</Eyebrow>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  void checkUsername(e.target.value);
                }}
                className="mt-2 w-full border-b border-sand bg-transparent pb-2 font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink outline-none transition-colors focus:border-[color:var(--accent-solid)]"
              />
            </label>
            {nameWarning && (
              <p className="flex items-start gap-1.5 text-[11.5px] text-gold-700">
                <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {nameWarning}
              </p>
            )}

            <div className="f0-ledger">
              <SettingRow label="Email" value={email || "—"} />
              <SettingRow label="Handle" value={username ? `@${username}` : "—"} />
            </div>

            <div className="flex items-center gap-4">
              {/* --accent-solid is the mode-correct action fill and --accent-on
                  is its declared foreground — the only pairing legible on club
                  orange, family gold and FTA metallic alike. */}
              <button
                type="submit"
                disabled={saving}
                className="f0-focus f0-press inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[13px] font-bold disabled:opacity-50"
                style={{ background: "var(--accent-solid)", color: "var(--accent-on)" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-gold-700">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </Card>
        </form>
      </section>

      {/* ── APPEARANCE ───────────────────────────────────────────────────────
          This is THE dark-mode control for the whole app. setThemePrefValue →
          setThemePref() writes localStorage, stamps <html data-theme> and
          broadcasts, so every open surface re-skins on the same tick. Nothing
          here is decorative and nothing needs a reload.

          CLUB MODE ONLY (doors build): the Club defaults dark with this toggle;
          Family Mode is light-only by design, so showing a control that could
          never take effect there would be a lie. Policy: src/lib/theme.ts. */}
      {appMode === "club" && (
        <section className="space-y-2.5 pt-1">
          <ListHead>Appearance</ListHead>
          <Card className="space-y-3 rounded-[16px] px-3.5 py-3.5">
            <SegmentedRail
              options={THEMES}
              value={themePref}
              onChange={setThemePrefValue}
              ariaLabel="Theme"
              barClassName="bg-accent"
              fill
            />
            <p className="text-[11px] leading-relaxed text-soft">
              {themePref === "system"
                ? `Following your device — currently ${resolved}. Pick Light or Dark to override it.`
                : `The app is in ${themePref} mode. The change applies everywhere, instantly.`}
            </p>
          </Card>
        </section>
      )}

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead>Notifications</ListHead>
        <Card className="rounded-[16px] px-3.5">
          <div className="f0-ledger">
            {DELIVERY.map((t) => (
              <SettingRow key={t.key} label={t.label} sub={t.sub}>
                <Switch
                  on={prefs[t.key]}
                  onToggle={() => void togglePref(t.key)}
                  label={t.label}
                />
              </SettingRow>
            ))}
          </div>
        </Card>

        <div className="space-y-2.5 pt-2">
          <ListHead charged={false}>On this device</ListHead>
          <Card className="space-y-3 rounded-[16px] px-3.5 py-3.5">
            <p className="text-[11px] leading-relaxed text-soft">
              Turning a category off silences its push only — it still lands in your
              bell.
            </p>
            <div>
              <EnablePushButton />
              <PushDevices />
            </div>
            <div className="f0-ledger">
              {PUSH.map((t) => (
                <SettingRow key={t.key} label={t.label} sub={t.sub}>
                  <Switch
                    on={prefs[t.key]}
                    onToggle={() => void togglePref(t.key)}
                    label={t.label}
                  />
                </SettingRow>
              ))}
            </div>
          </Card>
        </div>

        {/* Trade-alert delivery (briefing, digest, daily cap, quiet hours) lives
            in the /alerts hub — one authority, this is only the pointer. */}
        {isAdult && ent.tier !== "free" && (
          <Card className="rounded-[16px] px-3.5">
            <SettingLink
              href="/alerts"
              label="Trade alerts"
              sub="Kai's briefing, your rules, digest and daily limit"
            />
          </Card>
        )}
      </section>

      {/* ── MEMBERSHIP ───────────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead>Membership</ListHead>
        <Card className="rounded-[16px] px-3.5">
          <div className="f0-ledger">
            <SettingRow label="Plan" value={plan} />
            {/* THE ABSENT DATE IS DESIGNED, not a fallback character. `Renews —`
                rendered a bare em dash, which reads as a value that failed to
                load. There are two real reasons this date is missing and they
                are different facts, so they get different sentences: a free
                member has nothing that renews, and a paying member's next
                charge lives at the payment processor, not in `enrollments` —
                the app must not imply it knows a date it has never been told.
                Either way the row hands off to Plans & billing below. */}
            {renewLabel ? (
              <SettingRow
                label={ent.challenge?.active ? "Pass expires" : "Renews"}
                sub={
                  ent.clubLapsed
                    ? "Your Club window has ended — the Academy stays yours for life"
                    : undefined
                }
                value={renewLabel}
              />
            ) : (
              <SettingRow
                label="Renews"
                sub={
                  ent.clubLapsed
                    ? "Your Club window has ended — the Academy stays yours for life"
                    : undefined
                }
              >
                <span className="shrink-0 text-right text-[11px] font-medium leading-snug text-soft">
                  {ent.tier === "free"
                    ? "Nothing renews on the free plan"
                    : "No renewal date on file"}
                </span>
              </SettingRow>
            )}
            {ent.challenge?.active && (
              <SettingRow
                label="Challenge Pass"
                sub="Full Club access for the length of the challenge"
                value={`${ent.challenge.daysRemaining}d left`}
              />
            )}
            {/* THE DOOR OUT. This row used to link to /upgrade — the SALES
                page — so a paying parent had no way from Settings to see a
                renewal, change a card or cancel. When the family has a Stripe
                customer, the row now opens Stripe's own Customer Portal and
                returns here; when it doesn't (a hand-provisioned household,
                or a free member), it still hands off to the plans page. While
                the answer is unknown the row reads as the plans link, which is
                true for everyone and never flashes the wrong promise. */}
            {!isChild &&
              (portalAvailable ? (
                <SettingAction
                  onClick={() => void openBillingPortal()}
                  disabled={openingPortal}
                  label="Plans & billing"
                  sub={
                    openingPortal
                      ? "Opening your billing portal…"
                      : "Payment method, invoices, renewal — or cancel"
                  }
                />
              ) : (
                <SettingLink
                  href="/upgrade"
                  label="Plans & billing"
                  sub="See what each tier unlocks, or change your plan"
                />
              ))}
            <SettingLink href="/referrals" label="Refer a friend" sub="Share the Club" />
          </div>
        </Card>
      </section>

      {/* Family Mode — self-gates to null for anyone who isn't a solo owner. */}
      <AddFamily variant="settings" familyId={familyId ?? undefined} />

      {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
      <section className="space-y-2.5 pt-1">
        <ListHead>Account</ListHead>
        <Card className="rounded-[16px] px-3.5">
          <div className="f0-ledger">
            <SettingAction
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
            <SettingAction
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
            <SettingLink href="/help" label="Help & support" sub="Get a hand from the team" />
            {/* Terminal action, and last by position — but NOT red: red is price. */}
            <SettingAction
              label={signingOut ? "Signing out…" : "Sign out"}
              sub="End your session on this device"
              tone="quiet"
              disabled={signingOut}
              onClick={() => void signOut()}
            />
          </div>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[11px] text-soft">
        <span>Looking for your belt, badges and reps?</span>
        <TextAction href="/progress">Your profile</TextAction>
        <TextAction href="/belts">The belt ladder</TextAction>
      </div>
    </div>
  );
}
