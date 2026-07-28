"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  MessageCircle,
  LogOut,
  ArrowLeft,
  Shield,
  Clapperboard,
  CalendarRange,
  Contact,
  Megaphone,
  KanbanSquare,
  Send,
  Gem,
  LifeBuoy,
  ShoppingBag,
  Filter,
  Activity,
  MailPlus,
  Flame,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Match this route only when the path equals href exactly (no descendants). */
  exact?: boolean;
}

interface AdminNavSection {
  /** Section header label. Null renders the items ungrouped (top of the nav). */
  label: string | null;
  items: AdminNavItem[];
}

// Grouped admin nav (2026-07-22 IA consolidation). The sidebar is the SINGLE
// source of truth for admin navigation — the CRM pages no longer carry their
// own competing tab bars. Sections: top (Dashboard), CRM, Content, Commerce,
// Comms, Community. The old flat 16-row list + "Marketing" group + duplicate
// "Users"/"Support" rows are folded in here.
const sections: AdminNavSection[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "CRM",
    items: [
      { label: "Overview", href: "/admin/crm", icon: Activity, exact: true },
      { label: "Contacts", href: "/admin/crm/members", icon: Contact },
      { label: "Leads", href: "/admin/crm/leads", icon: Megaphone },
      { label: "Pipeline", href: "/admin/crm/pipeline", icon: KanbanSquare },
      { label: "Campaigns", href: "/admin/crm/campaigns", icon: Send },
      { label: "Welcome Drip", href: "/admin/crm/drips", icon: MailPlus },
      { label: "Funnel", href: "/admin/crm/funnel", icon: Filter },
      { label: "Challenge", href: "/admin/crm/challenge", icon: Flame },
      { label: "Support", href: "/admin/crm/support", icon: LifeBuoy },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "This Week (FIC)", href: "/admin/fic-weeks", icon: CalendarRange },
      { label: "Community Watchlist", href: "/admin/community-watchlist", icon: Gem },
      { label: "Courses", href: "/admin/courses", icon: BookOpen },
      { label: "Learn Drafts", href: "/admin/learn-drafts", icon: GraduationCap },
      { label: "Coach Demos", href: "/admin/coach-demos", icon: Clapperboard },
      { label: "Live Sessions", href: "/admin/live-sessions", icon: Video },
    ],
  },
  {
    label: "Commerce",
    items: [{ label: "Shop", href: "/admin/shop", icon: ShoppingBag }],
  },
  {
    label: "Comms",
    items: [{ label: "Announcements", href: "/admin/announcements", icon: Megaphone }],
  },
  {
    label: "Community",
    items: [{ label: "Community", href: "/admin/community", icon: MessageCircle }],
  },
];

function isItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

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
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-60 bg-card border-r border-sand z-30">
      <div className="flex flex-col h-full">
        {/* Masthead */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sand">
          <span className="club-b-orb h-7 w-7 shrink-0" aria-hidden>
            <Shield className="h-[15px] w-[15px]" />
          </span>
          <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-ink">
            FTA <span className="text-accent">Admin</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sections.map((section, i) => (
            <div key={section.label ?? "top"} className={i > 0 ? "pt-3 mt-2 border-t border-sand" : ""}>
              {section.label && (
                <p className="px-3 pb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const active = isItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`f0-press f0-focus flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm transition-colors ${
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-soft hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sand space-y-1">
          <Link
            href="/dashboard"
            className="f0-press f0-focus flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-sm text-soft hover:bg-paper hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Dashboard</span>
          </Link>
          <button
            onClick={handleLogout}
            className="f0-press f0-focus flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-sm text-soft hover:bg-paper hover:text-ink transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
