"use client";

import { ExternalLink, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PICKS_MEDIA_BUCKET,
  youtubeEmbedUrl,
  type Pick,
} from "@/lib/picks";

/**
 * Team-pick video player — mirrors the class-recording player model:
 *   upload   → file in the public community-media bucket, played inline
 *   youtube  → privacy-enhanced youtube-nocookie embed
 *   external → a link-out card (opens in a new tab)
 *
 * For 'upload' + 'youtube' the URL lives in video_path; for 'external' it lives
 * in video_path as the raw link (admin stores the pasted URL there for both
 * youtube + external).
 */
export default function PickVideo({ pick }: { pick: Pick }) {
  const { video_kind, video_path } = pick;
  if (!video_kind || !video_path) return null;

  if (video_kind === "upload") {
    const supabase = createClient();
    const { data } = supabase.storage
      .from(PICKS_MEDIA_BUCKET)
      .getPublicUrl(video_path);
    const url = data?.publicUrl;
    if (!url) return null;
    return (
      <div className="overflow-hidden rounded-2xl border border-sand bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full"
        />
      </div>
    );
  }

  if (video_kind === "youtube") {
    const embed = youtubeEmbedUrl(video_path);
    if (!embed) {
      return <ExternalVideoCard url={video_path} />;
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-sand bg-black">
        <iframe
          src={embed}
          title={`${pick.company_name} — pick video`}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return <ExternalVideoCard url={video_path} />;
}

function ExternalVideoCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-sand bg-midnight-900 p-4 shadow-soft transition-colors hover:border-gold-300"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
        <PlayCircle className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink">Watch the walkthrough</p>
        <p className="truncate text-xs text-soft">{url}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-soft" />
    </a>
  );
}
