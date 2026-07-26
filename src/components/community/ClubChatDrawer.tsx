"use client";

import { useState } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { MessageCircle, X } from "lucide-react";
import type { FamilyTier } from "@/lib/tier";
import LiveRooms, { type LiveRoomsMe } from "@/components/community/LiveRooms";

/**
 * <ClubChatDrawer> — the shared, collapsible Club Chat surface. A single launcher
 * button opens the always-on realtime chat (LiveRooms) as a drawer: a bottom
 * sheet on phones, a bottom-right floating panel on desktop. Mounted on BOTH
 * /community and /chart — each page supplies the viewer's `me` + `tier` props
 * (realtime plumbing + chat_messages schema untouched). Keeps chat one tap away
 * everywhere without stealing the primary column.
 */
export default function ClubChatDrawer({
  me,
  tier,
  label = "Main Circle",
}: {
  me: LiveRoomsMe | null;
  tier: FamilyTier;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Launcher — floats above the mobile tab bar, bottom-right on desktop */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Main Circle"
          className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 inline-flex items-center gap-2 rounded-full bg-gold-500 pl-3.5 pr-4 py-3 text-white font-display text-sm font-semibold shadow-[0_6px_20px_rgba(245,158,11,0.4)] hover:bg-gold-600 transition-colors"
        >
          <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center lg:items-end lg:justify-end lg:p-6"
          >
            <m.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "tween", duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full lg:w-[400px] bg-paper rounded-t-2xl lg:rounded-2xl p-3 shadow-[0_-8px_40px_rgba(16,24,40,0.25)]"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-gold-600" /> {label}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close Main Circle"
                  className="text-soft hover:text-ink transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <LiveRooms me={me} tier={tier} />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
