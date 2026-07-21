"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Save, CreditCard, AtSign, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EnablePushButton from "@/components/notifications/EnablePushButton";
import Avatar from "@/components/Avatar";
import AvatarPicker from "@/components/AvatarPicker";
import BadgeCase from "@/components/BadgeCase";
import ThemeToggle from "@/components/ThemeToggle";

interface NotificationPrefs {
  email_notifs: boolean;
  live_alerts: boolean;
  weekly_digest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_notifs: true,
  live_alerts: true,
  weekly_digest: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameWarning, setNameWarning] = useState("");
  const nameCheckSeq = useRef(0);

  // Notification prefs — persisted to profiles.notification_prefs
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, role, age_group, avatar_url, notification_prefs")
        .eq("id", user.id)
        .single();

      setDisplayName(
        profile?.display_name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          ""
      );
      setRole(profile?.role || "");
      setAgeGroup(profile?.age_group ?? null);
      setAvatarUrl(profile?.avatar_url ?? null);
      if (profile?.notification_prefs) {
        setPrefs({ ...DEFAULT_PREFS, ...(profile.notification_prefs as Partial<NotificationPrefs>) });
      }
    }
    load();
  }, [supabase]);

  // Soft uniqueness check — @mentions match display_name spaces-stripped (028).
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
      setNameWarning("Someone already goes by that. Add a last name or number so @mentions find you.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
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
    setPrefs(next); // optimistic
    if (userId) {
      await supabase.from("profiles").update({ notification_prefs: next }).eq("id", userId);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isChild = role === "child";

  const toggles: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: "email_notifs", label: "Email Notifications", desc: "Receive updates about courses and community" },
    { key: "live_alerts", label: "Live Session Alerts", desc: "Get notified 15 min before live sessions" },
    { key: "weekly_digest", label: "Weekly Digest", desc: "Summary of your progress and new content" },
  ];

  return (
    <div className="max-w-xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mb-8">
        <h2 className="font-display text-2xl font-bold text-midnight-100">Settings</h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">Manage your profile and preferences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.3 }} className="mb-10">
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">Profile</h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <Avatar name={displayName || email} avatarUrl={avatarUrl} role={role} size="xl" />
            <div>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sand text-midnight-200 text-sm font-medium hover:bg-paper transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                {pickerOpen ? "Close" : "Change avatar"}
              </button>
              <p className="text-xs text-midnight-500 font-body mt-1.5">
                {avatarUrl ? "Pick a new look below" : "Choose an avatar or keep your initials"}
              </p>
            </div>
          </div>

          {pickerOpen && (
            <div className="rounded-xl border border-sand bg-paper/50 p-4">
              <AvatarPicker
                value={avatarUrl}
                onChange={setAvatarUrl}
                role={role}
                ageGroup={ageGroup}
              />
              <p className="text-[11px] text-midnight-500 font-body mt-3">
                Selection saves when you press Save Changes.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-midnight-200 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                checkUsername(e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-lg bg-midnight-900 border border-sand text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm"
            />
            {nameWarning && (
              <p className="flex items-start gap-1.5 text-xs text-gold-700 font-body mt-1.5">
                <AtSign className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {nameWarning}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-midnight-200 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-2.5 rounded-lg bg-midnight-800/50 border border-sand text-midnight-400 text-sm cursor-not-allowed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="cta-button px-5 py-2 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-600">
                Saved!
              </motion.span>
            )}
          </div>
        </form>
      </motion.div>

      <div className="border-t border-sand mb-8" />

      {/* Credentials — professional-title badge case */}
      {userId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08, duration: 0.3 }} className="mb-10">
          <BadgeCase userId={userId} title="Your Credentials" evaluateSelf />
        </motion.div>
      )}

      <div className="border-t border-sand mb-8" />

      {/* Appearance */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.09, duration: 0.3 }} className="mb-10">
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">Appearance</h3>
        <p className="text-sm text-midnight-400 font-body mb-4">
          Choose how the dashboard looks. System follows your device setting.
        </p>
        <ThemeToggle />
      </motion.div>

      <div className="border-t border-sand mb-8" />

      {/* Notifications */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.3 }} className="mb-10">
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">Notifications</h3>

        <div className="space-y-4">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-midnight-200">{t.label}</p>
                <p className="text-xs text-midnight-500">{t.desc}</p>
              </div>
              <button
                onClick={() => togglePref(t.key)}
                aria-pressed={prefs[t.key]}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${prefs[t.key] ? "bg-gold-400" : "bg-midnight-700"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${
                    prefs[t.key] ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}

          {/* Browser push — replies + @mentions land on your device */}
          <div className="pt-4 mt-4 border-t border-sand">
            <p className="text-sm font-medium text-midnight-200">Push Notifications</p>
            <p className="text-xs text-midnight-500 mb-3">
              Get a notification on this device when someone replies to you or @mentions you in
              the community.
            </p>
            <EnablePushButton />
          </div>
        </div>
      </motion.div>

      {/* Billing — parent-only */}
      {!isChild && (
        <>
          <div className="border-t border-sand mb-8" />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.3 }} className="mb-10">
            <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">Billing</h3>
            <p className="text-sm text-midnight-400 font-body mb-4">
              Manage your family&apos;s plan and see what each tier unlocks.
            </p>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sand text-midnight-200 text-sm font-medium hover:bg-paper transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              View plans &amp; billing
            </Link>
          </motion.div>
        </>
      )}

      <div className="border-t border-sand mb-8" />

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }} className="mb-8">
        <h3 className="font-display text-sm font-semibold text-red-500/80 uppercase tracking-wider mb-3">Danger Zone</h3>
        <p className="text-sm text-midnight-400 font-body mb-4">Sign out of your account on this device.</p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-sm font-medium hover:bg-red-500/5 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </motion.div>
    </div>
  );
}
