"use client";

import { useState, useEffect } from "react";
import { BookOpen, FileText, Users, Home, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  totalCourses: number;
  totalLessons: number;
  totalUsers: number;
  totalFamilies: number;
  activeSessions: number;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalLessons: 0,
    totalUsers: 0,
    totalFamilies: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [coursesRes, lessonsRes, usersRes, familiesRes, sessionsRes] =
        await Promise.all([
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("lessons").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("family_id", { count: "exact", head: true })
            .not("family_id", "is", null),
          supabase
            .from("live_sessions")
            .select("id", { count: "exact", head: true })
            .eq("status", "live"),
        ]);

      // For families, we need distinct count — approximate with the count we got
      // A more precise approach would use a distinct query but Supabase JS doesn't support COUNT(DISTINCT)
      setStats({
        totalCourses: coursesRes.count ?? 0,
        totalLessons: lessonsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        totalFamilies: familiesRes.count ?? 0,
        activeSessions: sessionsRes.count ?? 0,
      });
      setLoading(false);
    }
    loadStats();
  }, [supabase]);

  const cards = [
    {
      label: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Total Lessons",
      value: stats.totalLessons,
      icon: FileText,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      label: "Families",
      value: stats.totalFamilies,
      icon: Home,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Live Sessions",
      value: stats.activeSessions,
      icon: Video,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Admin Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Overview of Family Trading Academy
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-zinc-100">{card.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
