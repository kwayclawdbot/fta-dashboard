"use client";

import { Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/feed";
import { RichBody } from "@/lib/mentions";
import type { FamilyTier } from "@/lib/tier";
import { beltNameStyleOnDark } from "@/lib/belts";
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
  xpOf,
  tone = "paper",
  emptyText = "No messages yet — say hi 👋",
  className = "",
  variant = "rows",
  meId = null,
}: {
  messages: ChatMsg[];
  loading: boolean;
  tierOf: (a: ChatAuthor | null) => FamilyTier;
  /** Batched belt XP per author id (never N+1). Undefined → no belt ring. */
  xpOf?: (userId: string | null | undefined) => number;
  tone?: "paper" | "dark";
  emptyText?: string;
  className?: string;
  /** "bubbles" is the drawn Club Screens 06 Lounge: tailed speech bubbles, the
   *  viewer's own turned around and inked. "rows" is the original dense list
   *  the FTA channel surface and the Club drawer use. */
  variant?: "rows" | "bubbles";
  /** Required by "bubbles" to know which turns are the viewer's own. */
  meId?: string | null;
}) {
  const dark = tone === "dark";
  const nameClass = dark ? "text-night-50" : "text-ink";
  const bodyClass = dark ? "text-night-100" : "text-midnight-200";
  const metaClass = dark ? "text-night-300" : "text-soft";

  /* ── Club Screens 06 — the Lounge as drawn ─────────────────────────────
     Tailed bubbles on the warm ground: the speaker's name and clock sit ABOVE
     the bubble, the corner nearest the avatar is squared off to point at them,
     and the viewer's own turn flips to the right on an inked ground. Same data,
     same @mention rendering, same attachments as the dense row form. */
  if (variant === "bubbles") {
    return (
      <div className={`flex-1 space-y-4 overflow-y-auto py-1 ${className}`}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="max-w-[40ch] py-6 text-[13.5px] leading-relaxed text-soft">{emptyText}</p>
        ) : (
          [...messages].reverse().map((m) => {
            const mine = !!meId && m.user_id === meId;
            const name = m.author?.display_name || "Member";
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
              >
                <ProfileLink username={m.author?.username} variant="avatar">
                  <Avatar
                    name={m.author?.display_name}
                    avatarUrl={m.author?.avatar_url}
                    role={m.author?.role}
                    tier={tierOf(m.author)}
                    xp={xpOf?.(m.user_id)}
                    size="sm"
                  />
                </ProfileLink>
                <div className={`min-w-0 max-w-[82%] ${mine ? "text-right" : ""}`}>
                  <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-soft"
                     style={mine ? { justifyContent: "flex-end" } : undefined}>
                    <span className="font-medium">{mine ? "You" : name}</span>
                    <AgeBadge role={m.author?.role} ageGroup={m.author?.age_group} />
                    <span>· {timeAgo(m.created_at)}</span>
                  </p>
                  {m.content && (
                    <div
                      className={`inline-block whitespace-pre-wrap break-words px-3.5 py-2.5 text-left text-[13px] leading-[1.5] ${
                        mine
                          ? "bg-[#14110F] text-[#F7F3EA]"
                          : "border border-sand bg-card text-ink"
                      }`}
                      style={{
                        borderRadius: mine ? "15px 3px 15px 15px" : "3px 15px 15px 15px",
                      }}
                    >
                      <RichBody body={m.content} />
                    </div>
                  )}
                  {m.attachment_url && m.attachment_type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.attachment_url}
                      alt="shared"
                      loading="lazy"
                      className="mt-1.5 max-h-56 w-auto rounded-[14px] border border-sand"
                    />
                  )}
                  {m.attachment_url && m.attachment_type === "video" && (
                    <video
                      src={m.attachment_url}
                      controls
                      playsInline
                      className="mt-1.5 max-h-56 w-auto rounded-[14px] border border-sand bg-night-950"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[180px] ${className}`}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <p className={`text-center text-xs py-8 ${metaClass}`}>{emptyText}</p>
      ) : (
        [...messages].reverse().map((m) => {
          // On the dark FTA surface, color each username by the member's earned
          // belt (dark-bg-safe hues; Black belt reads as champagne, never
          // black-on-black). Paper (Club drawer) keeps the flat ink name.
          const beltStyle = dark ? beltNameStyleOnDark(xpOf?.(m.user_id) ?? 0) : undefined;
          return (
          <div key={m.id} className="flex items-start gap-2">
            <ProfileLink username={m.author?.username} variant="avatar">
              <Avatar name={m.author?.display_name} avatarUrl={m.author?.avatar_url} role={m.author?.role} tier={tierOf(m.author)} xp={xpOf?.(m.user_id)} size="sm" />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ProfileLink username={m.author?.username} className={`font-display text-xs font-semibold ${beltStyle ? "" : nameClass}`}>
                  {beltStyle ? (
                    <span style={beltStyle}>{m.author?.display_name || "Member"}</span>
                  ) : (
                    m.author?.display_name || "Member"
                  )}
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
          );
        })
      )}
    </div>
  );
}
