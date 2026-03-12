"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Pause, Maximize2 } from "lucide-react";

interface VideoPlayerProps {
  videoId?: string;
  provider?: "mux" | "youtube" | "bunny" | "placeholder";
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
      <div className="relative aspect-video bg-midnight-950 rounded-lg overflow-hidden">
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
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-950/80 via-midnight-950/20 to-transparent" />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gold-400/90 flex items-center justify-center shadow-lg group-hover:bg-gold-400 group-hover:scale-105 transition-all">
                <Play className="w-7 h-7 text-midnight-950 ml-1" />
              </div>
            </div>
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-sm font-display font-medium text-white/90 drop-shadow-lg">
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
            <p className="text-sm text-midnight-400 font-body">
              Mux player loading...
            </p>
          </div>
        )}

        {/* Placeholder */}
        {(provider === "placeholder" || !videoId) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(251,191,36,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.3) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10 w-16 h-16 rounded-full bg-gold-400/20 border border-gold-400/30 flex items-center justify-center">
              <Play className="w-6 h-6 text-gold-400 ml-1" />
            </div>
            <p className="relative z-10 mt-4 text-sm text-midnight-400 font-body">
              Video coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
