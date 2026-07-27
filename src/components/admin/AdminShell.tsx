"use client";

import AdminSidebar from "./AdminSidebar";
import ViewAsBar from "./ViewAsBar";
import type { ViewAs } from "@/lib/view-as";

interface AdminShellProps {
  /**
   * Active admin register preview, resolved SERVER-SIDE in (admin)/layout.tsx
   * from the real profile. Null = no override (the normal state).
   */
  viewAs?: ViewAs | null;
  children: React.ReactNode;
}

export default function AdminShell({ viewAs = null, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <AdminSidebar />
      <div className="lg:ml-60">
        {/* The admin settings bar — persistent across every admin page so the
            register preview is one click away wherever the admin already is. */}
        <ViewAsBar current={viewAs} />
        <main className="px-4 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
