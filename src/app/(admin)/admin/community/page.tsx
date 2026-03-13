"use client";

import { MessageCircle } from "lucide-react";

export default function AdminCommunityPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Community</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Community management tools
        </p>
      </div>

      <div className="text-center py-20 border border-zinc-800 rounded-xl bg-zinc-900/50">
        <MessageCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">
          Coming Soon
        </h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Community management features are being built. This will include
          moderation tools, announcement publishing, and member engagement
          analytics.
        </p>
      </div>
    </div>
  );
}
