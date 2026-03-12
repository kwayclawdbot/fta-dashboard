"use client";

import { useState } from "react";
import { Play, Pause } from "lucide-react";

interface VideoPlayerProps {
  videoId?: string;
  provider?: "mux" | "youtube" | "placeholder";
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
  const [progress, setProgress] = useState(0);

  function handlePlay() {
    setPlaying(!playing);
    // Placeholder: simulate progress
    if (!playing && onProgress) {
      onProgress(progress);
    }
  }

  return (
    <div className="relative w-full">
      {/* Video area */}
      <div className="relative aspect-video bg-midnight-950 rounded-lg overflow-hidden">
        {provider === "placeholder" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(251,191,36,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.3) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* Play button */}
            <button
              onClick={handlePlay}
              className="relative z-10 w-16 h-16 rounded-full bg-gold-400/20 border border-gold-400/30 flex items-center justify-center hover:bg-gold-400/30 transition-all group"
            >
              {playing ? (
                <Pause className="w-6 h-6 text-gold-400" />
              ) : (
                <Play className="w-6 h-6 text-gold-400 ml-1" />
              )}
            </button>

            <p className="relative z-10 mt-4 text-sm text-midnight-400 font-body">
              Video player coming soon
            </p>
          </div>
        )}

        {provider === "youtube" && videoId && (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* Ready for Mux integration */}
        {provider === "mux" && videoId && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-midnight-400 font-body">
              Mux player loading...
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-1 w-full h-1 rounded-full bg-midnight-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gold-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
