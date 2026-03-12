"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
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
    <header className="sticky top-0 z-20 bg-midnight-950/90 backdrop-blur-md border-b border-midnight-700/50">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-midnight-300 hover:text-midnight-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-midnight-100">
            {pageTitle}
          </h1>
        </div>

        {/* Right: notifications, avatar */}
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <button className="relative text-midnight-400 hover:text-midnight-200 transition-colors">
            <Bell className="w-[18px] h-[18px]" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-400 text-[11px] font-bold font-display">
                {initials}
              </div>
              <ChevronDown className="w-3 h-3 text-midnight-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-2 w-52 rounded-lg bg-midnight-900 border border-midnight-700 shadow-lg shadow-black/40 overflow-hidden"
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
    </header>
  );
}
