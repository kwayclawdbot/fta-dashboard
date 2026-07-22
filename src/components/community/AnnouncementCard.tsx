"use client";

import Link from "next/link";
import { Megaphone, Pin, ArrowRight } from "lucide-react";
import { timeAgo } from "@/lib/feed";
import type { FeedPost } from "@/lib/feed";

/**
 * AnnouncementCard — the distinct gold "megaphone" card for admin announcements
 * (feed_posts.kind = 'announcement', migration 090). Deliberately unlike a
 * member PostCard: gold gradient rail, megaphone glyph, title + body, optional
 * deep link. `pinned` renders the above-the-feed variant (latest announcement,
 * first 7 days); the same card flows in-feed afterwards.
 */
export default function AnnouncementCard({
  post,
  pinned = false,
}: {
  post: FeedPost;
  pinned?: boolean;
}) {
  const author = post.author?.display_name || "Family Trading Academy";
  const link = post.link || null;
  const isInternal = link ? link.startsWith("/") : false;

  const body = (
    <div
      className={`relative overflow-hidden rounded-xl border ${
        pinned
          ? "border-gold-300 bg-gradient-to-br from-chip-amber/70 to-paper shadow-soft"
          : "border-gold-200 bg-chip-amber/30"
      }`}
    >
      {/* Gold accent rail */}
      <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold-400 to-gold-600" />

      <div className="p-4 pl-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-b from-gold-400 to-gold-600 text-white shrink-0">
            <Megaphone className="w-3.5 h-3.5" />
          </span>
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-gold-800">
            Announcement
          </span>
          {pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold-700/80">
              <Pin className="w-3 h-3" /> Pinned
            </span>
          )}
          <span className="ml-auto text-[11px] text-soft">{timeAgo(post.created_at)}</span>
        </div>

        {post.title && (
          <h3 className="font-display text-base font-bold text-ink mb-1 leading-snug">
            {post.title}
          </h3>
        )}
        {post.body && (
          <p className="text-sm text-ink/80 font-body whitespace-pre-wrap leading-relaxed">
            {post.body}
          </p>
        )}

        {link &&
          (isInternal ? (
            <Link
              href={link}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold-800 hover:text-gold-600"
            >
              Open <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold-800 hover:text-gold-600"
            >
              Open link <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ))}

        <p className="mt-3 text-[11px] text-soft">Posted by {author}</p>
      </div>
    </div>
  );

  return body;
}
