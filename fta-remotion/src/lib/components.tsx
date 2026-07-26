import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { COLORS, FONT } from "./theme";

// ---- Warm paper backdrop with a soft brand glow ----
export const Backdrop: React.FC<{ glow?: string }> = ({ glow = COLORS.kai }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.sand }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 12%, ${glow}22 0%, ${glow}00 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 70% at 50% 108%, ${COLORS.sandDeep} 0%, ${COLORS.sandDeep}00 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- The infinity brand mark (Cheat Code Club) ----
export const InfinityMark: React.FC<{ size: number; color?: string; stroke?: number }> = ({
  size,
  color = COLORS.ink,
  stroke = 0.14,
}) => {
  const r = size * 0.24;
  const cy = size / 2;
  const sw = size * stroke;
  return (
    <svg width={size} height={size / 2 + sw} viewBox={`0 0 ${size} ${size / 2 + sw}`}>
      <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round">
        <circle cx={size * 0.3} cy={cy} r={r} />
        <circle cx={size * 0.7} cy={cy} r={r} />
      </g>
    </svg>
  );
};

// ---- Spring-in wrapper (translate up + fade) ----
export const RiseIn: React.FC<{
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, distance = 60, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const y = interpolate(s, [0, 1], [distance, 0]);
  return (
    <div style={{ opacity: s, transform: `translateY(${y}px)`, ...style }}>{children}</div>
  );
};

// ---- The volt "graffiti" underline accent that sweeps in under a word ----
export const VoltUnderline: React.FC<{
  delay?: number;
  height: number;
  width: number | string;
  color?: string;
}> = ({ delay = 0, height, width, color = COLORS.volt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 18 });
  return (
    <div
      style={{
        width,
        height,
        marginTop: height * 0.4,
        borderRadius: height,
        background: color,
        transformOrigin: "left center",
        transform: `scaleX(${s})`,
      }}
    />
  );
};

// ---- Kai mascot in a corner (uses staticFile) ----
export const KaiGuide: React.FC<{
  pose: "teaching" | "celebrating" | "thinking" | "watchful";
  height: number;
  delay?: number;
  flip?: boolean;
  style?: React.CSSProperties;
}> = ({ pose, height, delay = 0, flip = false, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.9 } });
  const bob = Math.sin((frame - delay) / 14) * (height * 0.012);
  return (
    <div
      style={{
        transform: `translateY(${interpolate(s, [0, 1], [height * 0.4, bob])}px) scale(${s}) ${
          flip ? "scaleX(-1)" : ""
        }`,
        opacity: s,
        ...style,
      }}
    >
      <Img src={staticFile(`kai/${pose}.webp`)} style={{ height, width: "auto" }} />
    </div>
  );
};

// ---- Branded outro shared across templates ----
export const BrandOutro: React.FC<{ enterAt: number }> = ({ enterAt }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const s = spring({ frame: frame - enterAt, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: s,
        transform: `scale(${interpolate(s, [0, 1], [0.94, 1])})`,
      }}
    >
      <InfinityMark size={base * 0.22} color={COLORS.ink} />
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          color: COLORS.ink,
          fontSize: base * 0.058,
          letterSpacing: -1,
          marginTop: base * 0.03,
        }}
      >
        Smarter Together.
      </div>
      <div
        style={{
          fontFamily: FONT.body,
          fontWeight: 700,
          color: COLORS.inkSoft,
          fontSize: base * 0.026,
          letterSpacing: 3,
          marginTop: base * 0.015,
          textTransform: "uppercase",
        }}
      >
        Cheat Code Club · Learn
      </div>
    </AbsoluteFill>
  );
};

// ---- Number count-up ----
export const useCountUp = (target: number, startFrame: number, durationFrames: number) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease out cubic
  const eased = 1 - Math.pow(1 - p, 3);
  return target * eased;
};
