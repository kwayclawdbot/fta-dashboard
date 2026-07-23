"use client";

import { Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/feed";
import { RichBody } from "@/lib/mentions";
import type { FamilyTier } from "@/lib/tier";
import Avatar from "@/components/Avatar";
import ProfileLink from "@/components/ProfileLink";
import TierBadge from "@/components/TierBadge";
import AgeBadge from "@/components/community/AgeBadge";
import type { ChatAuthor, ChatMsg } from "@/lib/useChatRoom";

/**
 * Shared chat message list — the scrolling message column used by BOTH the Club
 * Chat drawer (paper) and the FTA Traders page (dark). `tone` swaps only the
 * text/emptyness chrome; the row structure, avatars, badges and @mention
 * rendering are identical. Oldest-at-top (the incoming array is newest-first).
 * Must be rendered inside a <MentionProvider> so RichBody can link @handles.
 */

export default function ChatMessageList({
  messages,
  loading,
  tierOf,
  tone = "paper",
  emptyText = "No messages yet — say hi 👋",
  className = "",
}: {
  messages: ChatMsg[];
  loading: boolean;
  tierOf: (a: ChatAuthor | null) => FamilyTier;
  tone?: "paper" | "dark";
  emptyText?: string;
  className?: string;
}) {
  const dark = tone === "dark";
  const nameClass = dark ? "text-night-50" : "text-ink";
  const bodyClass = dark ? "text-night-100" : "text-midnight-200";
  const metaClass = dark ? "text-night-300" : "text-soft";

  return (
    <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[180px] ${className}`}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <p className={`text-center text-xs py-8 ${metaClass}`}>{emptyText}</p>
      ) : (
        [...messages].reverse().map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <ProfileLink username={m.author?.username} variant="avatar">
              <Avatar name={m.author?.display_name} avatarUrl={m.author?.avatar_url} role={m.author?.role} tier={tierOf(m.author)} size="sm" />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ProfileLink username={m.author?.username} className={`font-display text-xs font-semibold ${nameClass}`}>
                  {m.author?.display_name || "Member"}
                </ProfileLink>
                <AgeBadge role={m.author?.role} ageGroup={m.author?.age_group} />
                {tierOf(m.author) === "free" && <TierBadge tier="free" size="xs" />}
                <span className={`text-[10px] ${metaClass}`}>{timeAgo(m.created_at)}</span>
              </div>
              {m.content && (
                <p className={`text-xs whitespace-pre-wrap break-words mt-0.5 ${bodyClass}`}>
                  <RichBody body={m.content} />
                </p>
              )}
              {m.attachment_url && m.attachment_type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.attachment_url} alt="shared" loading="lazy" className={`mt-1 max-h-40 w-auto rounded-lg border ${dark ? "border-night-700" : "border-sand"}`} />
              )}
              {m.attachment_url && m.attachment_type === "video" && (
                <video src={m.attachment_url} controls playsInline className={`mt-1 max-h-40 w-auto rounded-lg border bg-night-950 ${dark ? "border-night-700" : "border-sand"}`} />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
