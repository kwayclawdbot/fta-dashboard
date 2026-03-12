"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Notification toggles (placeholder)
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setDisplayName(
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          ""
        );
        setEmail(user.email || "");
      }
    });
  }, [supabase.auth]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await supabase.auth.updateUser({
      data: { display_name: displayName },
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (displayName || email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Settings
        </h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Manage your profile and preferences
        </p>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="mb-10"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Profile
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-gold-400/15 flex items-center justify-center text-gold-400 text-lg font-bold font-display">
              {initials}
            </div>
            <p className="text-sm text-midnight-400 font-body">
              Avatar is based on your initials
            </p>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-midnight-200 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-50 placeholder:text-midnight-500 focus:outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition-colors text-sm"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-midnight-200 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-2.5 rounded-lg bg-midnight-800/50 border border-midnight-800 text-midnight-400 text-sm cursor-not-allowed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="cta-button px-5 py-2 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-green-400"
              >
                Saved!
              </motion.span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Divider */}
      <div className="border-t border-midnight-800/50 mb-8" />

      {/* Notification Preferences */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-10"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Notifications
        </h3>

        <div className="space-y-4">
          {[
            {
              label: "Email Notifications",
              desc: "Receive updates about courses and community",
              value: emailNotifs,
              onChange: setEmailNotifs,
            },
            {
              label: "Live Session Alerts",
              desc: "Get notified 15 min before live sessions",
              value: liveAlerts,
              onChange: setLiveAlerts,
            },
            {
              label: "Weekly Digest",
              desc: "Summary of your progress and new content",
              value: weeklyDigest,
              onChange: setWeeklyDigest,
            },
          ].map((toggle) => (
            <div
              key={toggle.label}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-midnight-200">
                  {toggle.label}
                </p>
                <p className="text-xs text-midnight-500">{toggle.desc}</p>
              </div>
              <button
                onClick={() => toggle.onChange(!toggle.value)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${
                  toggle.value ? "bg-gold-400" : "bg-midnight-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-midnight-950 transition-transform ${
                    toggle.value ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <div className="border-t border-midnight-800/50 mb-8" />

      {/* Billing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mb-10"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Billing
        </h3>

        <p className="text-sm text-midnight-400 font-body mb-4">
          Manage your subscription and payment methods.
        </p>

        <button className="px-4 py-2 rounded-lg border border-midnight-700 text-midnight-200 text-sm font-medium hover:bg-midnight-800 transition-colors">
          Manage Subscription
        </button>
      </motion.div>

      {/* Divider */}
      <div className="border-t border-midnight-800/50 mb-8" />

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mb-8"
      >
        <h3 className="font-display text-sm font-semibold text-red-500/80 uppercase tracking-wider mb-3">
          Danger Zone
        </h3>
        <p className="text-sm text-midnight-400 font-body mb-4">
          Sign out of your account on this device.
        </p>
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
