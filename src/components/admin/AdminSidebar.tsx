"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Users,
  MessageCircle,
  LogOut,
  ArrowLeft,
  Shield,
  Clapperboard,
  CalendarRange,
  Contact,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "CRM", href: "/admin/crm", icon: Contact },
  { label: "This Week (FIC)", href: "/admin/fic-weeks", icon: CalendarRange },
  { label: "Courses", href: "/admin/courses", icon: BookOpen },
  { label: "Coach Demos", href: "/admin/coach-demos", icon: Clapperboard },
  { label: "Live Sessions", href: "/admin/live-sessions", icon: Video },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Community", href: "/admin/community", icon: MessageCircle },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-60 bg-[#0a0a0f] border-r border-zinc-800 z-30">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
          <Shield className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-lg text-amber-400">FTA Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "text-amber-400 bg-amber-400/5"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Dashboard</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-red-500 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
