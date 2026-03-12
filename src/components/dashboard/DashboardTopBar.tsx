"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Bell, Flame, ChevronDown, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const routeTitles: Record<string, string> = {
  "/dashboard": "Command Center",
  "/courses": "Courses",
  "/live-sessions": "Live Sessions",
  "/ai-coach": "AI Coach",
  "/community": "Community",
  "/progress": "Progress",
  "/family": "Family",
  "/settings": "Settings",
};

interface DashboardTopBarProps {
  user: {
    email?: string;
    display_name?: string;
  };
  onMenuClick: () => void;
}

export default function DashboardTopBar({ user, onMenuClick }: DashboardTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = routeTitles[pathname] || "Dashboard";
  const streak = 0; // Placeholder

  const initials = (user.display_name || user.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 bg-midnight-950/80 backdrop-blur-md border-b border-gold-400/10">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-midnight-300 hover:text-midnight-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-midnight-100">
            {pageTitle}
          </h1>
        </div>

        {/* Right: streak, notifications, avatar */}
        <div className="flex items-center gap-4">
          {/* Streak counter */}
          <div className="flex items-center gap-1.5 text-sm">
            <Flame className="w-4 h-4 text-gold-500" />
            <span className="font-display font-bold text-gold-400">{streak}</span>
          </div>

          {/* Notification bell */}
          <button className="relative text-midnight-400 hover:text-midnight-200 transition-colors">
            <Bell className="w-5 h-5" />
            {/* Dot indicator — uncomment when notifications exist */}
            {/* <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gold-400 rounded-full" /> */}
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-400 text-xs font-bold font-display">
                {initials}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-midnight-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-midnight-900 border border-gold-400/10 shadow-lg shadow-black/40 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-midnight-800">
                    <p className="text-sm font-medium text-midnight-100 truncate">
                      {user.display_name || "Trader"}
                    </p>
                    <p className="text-xs text-midnight-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-midnight-300 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Gold accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
    </header>
  );
}
