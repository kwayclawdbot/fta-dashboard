"use client";

import { useState, useRef, useCallback } from "react";
import { Play } from "lucide-react";

interface VideoPlayerProps {
  videoId?: string;
  provider?: "mux" | "youtube" | "bunny" | "html" | "placeholder";
  title: string;
  onProgress?: (percent: number) => void;
}

export default function VideoPlayer({
  videoId,
  provider = "placeholder",
  title,
  onProgress,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleYouTubePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  // YouTube embed with autoplay on click
  const youtubeUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=${playing ? 1 : 0}&enablejsapi=1`
    : "";

  return (
    <div className="relative w-full">
      {/* The media well is a deliberate dark island (night-* is constant across
          themes) framed by a sand hairline — NOT bg-midnight-950, which is the
          CREAM page colour in light and would paint the player as paper. */}
      <div className={`relative overflow-hidden rounded-2xl border border-sand bg-night-950 ${provider === "html" ? "aspect-[4/3] lg:aspect-[16/10]" : "aspect-video"}`}>
        {/* YouTube */}
        {provider === "youtube" && videoId && !playing && (
          <button
            onClick={handleYouTubePlay}
            className="absolute inset-0 z-10 group cursor-pointer"
          >
            {/* YouTube thumbnail */}
            <img
              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Fallback to hqdefault if maxres not available
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-950/25 to-transparent" />
            {/* Play button — volt, because play is the ACTION */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-volt-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
            </div>
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="font-display text-[14px] font-bold text-white drop-shadow-lg">
                {title}
              </p>
            </div>
          </button>
        )}

        {provider === "youtube" && videoId && playing && (
          <iframe
            ref={iframeRef}
            className="absolute inset-0 w-full h-full"
            src={youtubeUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title={title}
          />
        )}

        {/* Bunny.net CDN */}
        {provider === "bunny" && videoId && (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://iframe.mediadelivery.net/embed/${videoId}?autoplay=false&preload=true`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title={title}
          />
        )}

        {/* Mux placeholder */}
        {provider === "mux" && videoId && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-night-200">Mux player loading…</p>
          </div>
        )}

        {/* Interactive HTML lesson (from course-creator) */}
        {provider === "html" && videoId && (
          <iframe
            className="absolute inset-0 w-full h-full border-0"
            src={videoId}
            allow="autoplay; microphone"
            allowFullScreen
            title={title}
            style={{ background: "var(--paper)" }}
          />
        )}

        {/* Placeholder */}
        {(provider === "placeholder" || !videoId) && provider !== "html" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <Play className="ml-1 h-6 w-6 text-white/80" />
            </div>
            <p className="relative z-10 mt-4 text-sm text-night-200">
              Video coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
