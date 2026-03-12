"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Bot,
  MessageCircle,
  Trophy,
  Users,
  Settings,
  Lock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiresAcademy?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Live Sessions", href: "/live-sessions", icon: Video, requiresAcademy: true },
  { label: "AI Coach", href: "/ai-coach", icon: Bot, requiresAcademy: true },
  { label: "Community", href: "/community", icon: MessageCircle },
  { label: "Progress", href: "/progress", icon: Trophy },
  { label: "Family", href: "/family", icon: Users, requiresAcademy: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface DashboardSidebarProps {
  user: {
    email?: string;
    display_name?: string;
  };
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function DashboardSidebar({
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (user.display_name || user.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gold-400/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-gradient-gold">
            {collapsed ? "F" : "FTA"}
          </span>
          {!collapsed && (
            <span className="text-xs text-midnight-400 font-body hidden lg:block">
              Family Trading Academy
            </span>
          )}
        </Link>
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="lg:hidden text-midnight-400 hover:text-midnight-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? "bg-gold-400/10 text-gold-400"
                  : "text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800"
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-gold-400/10 border border-gold-400/20"
                  style={{ boxShadow: "0 0 12px rgba(251,191,36,0.1)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="relative z-10 w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="relative z-10 truncate">{item.label}</span>
              )}
              {!collapsed && item.requiresAcademy && (
                <Lock className="relative z-10 w-3.5 h-3.5 text-midnight-500 ml-auto shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:block px-3 py-2 border-t border-gold-400/10">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 rounded-lg text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-gold-400/10">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-400 text-xs font-bold font-display shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-midnight-100 truncate">
                {user.display_name || "Trader"}
              </p>
              <p className="text-xs text-midnight-500 truncate">
                {user.email}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`
            flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-red-500 hover:bg-red-500/10 transition-colors
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-midnight-900 border-r border-gold-400/10 z-30 transition-all duration-300
          ${collapsed ? "w-[72px]" : "w-64"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-0 left-0 h-screen w-64 bg-midnight-900 border-r border-gold-400/10 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
