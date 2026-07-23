"use client";

import { useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Award, X } from "lucide-react";

interface MilestoneAlertProps {
  memberName: string;
  achievement: string;
  timestamp: string;
}

export default function MilestoneAlert({
  memberName,
  achievement,
  timestamp,
}: MilestoneAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const timeAgo = (() => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  })();

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3 py-3 px-4 border border-gold-400/15 rounded-lg bg-gold-400/5 mb-3"
      >
        <Award className="w-4 h-4 text-gold-400 shrink-0" />
        <p className="text-sm text-midnight-200 font-body flex-1 min-w-0">
          <span className="text-midnight-100 font-medium">{memberName}</span>{" "}
          {achievement}
        </p>
        <span className="text-xs text-midnight-500 font-body shrink-0">
          {timeAgo}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="text-midnight-500 hover:text-midnight-300 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </m.div>
    </AnimatePresence>
  );
}
