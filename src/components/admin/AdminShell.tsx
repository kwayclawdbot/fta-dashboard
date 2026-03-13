"use client";

import AdminSidebar from "./AdminSidebar";

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <AdminSidebar />
      <div className="lg:ml-60">
        <main className="px-4 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
