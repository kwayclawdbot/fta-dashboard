"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkle } from "@/components/fic/glyphs/motifs";

/**
 * Bespoke mission-patch medallion for each kid mission (Higgsfield warm-paper
 * illustrations matched to the avatar packs — one consistent style, generated
 * as a reference-locked set). Replaces the meaningless rotating gradient banner.
 *
 * `collected` (mission complete) → the patch gains a gold ring + a soft sheen
 * and a small sparkle, reading as an earned collectible in the set. Missing
 * emblem art degrades to a warm monogram chip so a new mission slug never breaks.
 */

const EMBLEMS: Record<string, string> = {
  "brand-detective": "/missions/brand-detective.webp",
  "snack-stock": "/missions/snack-stock.webp",
  "money-machine": "/missions/money-machine.webp",
  "stock-vs-product": "/missions/stock-vs-product.webp",
  "family-ceo": "/missions/family-ceo.webp",
};

export function hasEmblem(slug: string): boolean {
  return slug in EMBLEMS;
}

export default function MissionEmblem({
  slug,
  title,
  collected = false,
  size = 72,
  className = "",
}: {
  slug: string;
  title?: string;
  collected?: boolean;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const src = EMBLEMS[slug];
  const ring = collected
    ? "ring-[3px] ring-gold-400 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]"
    : "ring-1 ring-sand";

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={title ? `${title} mission emblem` : "mission emblem"}
          width={size}
          height={size}
          loading="lazy"
          className={`h-full w-full rounded-full bg-paper object-cover transition-all ${ring} ${
            collected ? "" : "opacity-95"
          }`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-chip-amber font-display text-lg font-bold text-gold-700 ${ring}`}
        >
          {(title || "?").slice(0, 1).toUpperCase()}
        </div>
      )}

      {/* collected sheen + sparkle */}
      {collected && !reduce && (
        <>
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
            }}
            initial={{ opacity: 0, x: "-60%" }}
            animate={{ opacity: [0, 1, 0], x: "60%" }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-1 -top-1"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.1 }}
          >
            <Sparkle className="h-5 w-5" />
          </motion.div>
        </>
      )}
    </div>
  );
}
