import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { COLORS, FONT, scaler } from "./lib/theme";
import { Backdrop, RiseIn, InfinityMark, KaiGuide, useCountUp } from "./lib/components";

export const revealSchema = z.object({
  company: z.string(),
  ticker: z.string(),
  setup: z.string(),
  question: z.string(),
  answer: z.enum(["up", "down"]),
  moveValuePrefix: z.string(),
  moveValueNumber: z.number(),
  moveValueSuffix: z.string(),
  moveNote: z.string(),
  why: z.string(),
  glow: z.string(),
});
export type RevealProps = z.infer<typeof revealSchema>;

const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, dur - 12, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const TickerChip: React.FC<{ s: (f: number) => number; ticker: string; company: string }> = ({
  s,
  ticker,
  company,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: s(0.018),
      padding: `${s(0.012)}px ${s(0.03)}px`,
      borderRadius: s(0.06),
      background: COLORS.ink,
    }}
  >
    <span style={{ fontFamily: FONT.display, fontWeight: 900, color: COLORS.white, fontSize: s(0.032), letterSpacing: 1 }}>
      {ticker}
    </span>
    <span style={{ fontFamily: FONT.body, fontWeight: 700, color: COLORS.sandDeep, fontSize: s(0.028) }}>
      {company}
    </span>
  </div>
);

// Scene 1 — setup
const SetupScene: React.FC<{ dur: number; p: RevealProps }> = ({ dur, p }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", padding: `${s(0.12)}px ${s(0.09)}px` }}>
        <RiseIn delay={4}>
          <div style={{ marginBottom: s(0.05) }}>
            <TickerChip s={s} ticker={p.ticker} company={p.company} />
          </div>
        </RiseIn>
        <RiseIn delay={12} distance={70}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              color: COLORS.ink,
              fontSize: s(0.06),
              lineHeight: 1.24,
              letterSpacing: -1,
            }}
          >
            {p.setup}
          </div>
        </RiseIn>
      </AbsoluteFill>
      <KaiGuide pose="watchful" height={s(0.3)} delay={18} style={{ position: "absolute", right: s(0.02), bottom: s(0.03) }} />
    </SceneFade>
  );
};

// Scene 2 — question + prediction chips + suspense
const QuestionScene: React.FC<{ dur: number; p: RevealProps }> = ({ dur, p }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 7) * 0.04;
  const Chip: React.FC<{ label: string; dir: "up" | "down"; delay: number }> = ({ label, dir, delay }) => {
    const color = dir === "up" ? COLORS.up : COLORS.down;
    return (
      <RiseIn delay={delay} distance={50}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: s(0.02),
            padding: `${s(0.022)}px ${s(0.045)}px`,
            borderRadius: s(0.04),
            background: COLORS.card,
            border: `${s(0.006)}px solid ${color}`,
            boxShadow: `0 ${s(0.01)}px ${s(0.03)}px #211E1815`,
          }}
        >
          <span style={{ color, fontSize: s(0.05), fontWeight: 900, lineHeight: 1 }}>
            {dir === "up" ? "↑" : "↓"}
          </span>
          <span style={{ fontFamily: FONT.display, fontWeight: 900, color: COLORS.ink, fontSize: s(0.045), letterSpacing: 1 }}>
            {label}
          </span>
        </div>
      </RiseIn>
    );
  };
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: s(0.09) }}>
        <div style={{ transform: `scale(${pulse})`, marginBottom: s(0.06) }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 900,
              color: COLORS.ink,
              fontSize: s(0.085),
              letterSpacing: -1.5,
              textAlign: "center",
              lineHeight: 1.05,
            }}
          >
            {p.question}
          </div>
        </div>
        <div style={{ display: "flex", gap: s(0.05) }}>
          <Chip label="UP" dir="up" delay={14} />
          <Chip label="DOWN" dir="down" delay={22} />
        </div>
        <RiseIn delay={40}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 700,
              color: COLORS.inkSoft,
              fontSize: s(0.03),
              marginTop: s(0.06),
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Make your call…
          </div>
        </RiseIn>
      </AbsoluteFill>
    </SceneFade>
  );
};

// Scene 3 — reveal
const RevealScene: React.FC<{ dur: number; p: RevealProps }> = ({ dur, p }) => {
  const { width, height, fps } = useVideoConfig();
  const s = scaler(width, height);
  const frame = useCurrentFrame();
  const up = p.answer === "up";
  const color = up ? COLORS.up : COLORS.down;
  const pop = spring({ frame: frame - 6, fps, config: { damping: 12, mass: 0.8 } });
  const arrowY = interpolate(pop, [0, 1], [up ? s(0.15) : -s(0.15), 0]);
  const val = useCountUp(p.moveValueNumber, 18, 34);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: s(0.09) }}>
        <div
          style={{
            transform: `translateY(${arrowY}px) scale(${pop})`,
            color,
            fontSize: s(0.26),
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {up ? "↑" : "↓"}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 900,
            color,
            fontSize: s(0.16),
            letterSpacing: -3,
            marginTop: s(0.01),
          }}
        >
          {p.moveValuePrefix}
          {val.toFixed(1)}
          {p.moveValueSuffix}
        </div>
        <RiseIn delay={36}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 700,
              color: COLORS.ink,
              fontSize: s(0.036),
              marginTop: s(0.03),
              textAlign: "center",
              maxWidth: s(0.85),
            }}
          >
            {p.moveNote}
          </div>
        </RiseIn>
      </AbsoluteFill>
      <KaiGuide pose="celebrating" height={s(0.32)} delay={30} style={{ position: "absolute", left: s(0.02), bottom: s(0.03) }} />
    </SceneFade>
  );
};

// Scene 4 — why + brand footer
const WhyScene: React.FC<{ dur: number; p: RevealProps }> = ({ dur, p }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", padding: `${s(0.1)}px ${s(0.09)}px` }}>
        <RiseIn delay={4}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 800,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: COLORS.volt,
              fontSize: s(0.028),
              marginBottom: s(0.03),
            }}
          >
            Why it moved
          </div>
        </RiseIn>
        <RiseIn delay={12} distance={60}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              color: COLORS.ink,
              fontSize: s(0.052),
              lineHeight: 1.28,
              letterSpacing: -0.5,
            }}
          >
            {p.why}
          </div>
        </RiseIn>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: s(0.06) }}>
        <RiseIn delay={24}>
          <div style={{ display: "flex", alignItems: "center", gap: s(0.02) }}>
            <InfinityMark size={s(0.075)} color={COLORS.ink} />
            <span
              style={{
                fontFamily: FONT.display,
                fontWeight: 800,
                color: COLORS.ink,
                fontSize: s(0.032),
                letterSpacing: 0.5,
              }}
            >
              Smarter Together.
            </span>
          </div>
        </RiseIn>
      </AbsoluteFill>
    </SceneFade>
  );
};

export const AnswerReveal: React.FC<RevealProps> = (props) => {
  return (
    <AbsoluteFill>
      <Backdrop glow={props.glow} />
      <Sequence from={0} durationInFrames={145}>
        <SetupScene dur={145} p={props} />
      </Sequence>
      <Sequence from={140} durationInFrames={185}>
        <QuestionScene dur={185} p={props} />
      </Sequence>
      <Sequence from={320} durationInFrames={155}>
        <RevealScene dur={155} p={props} />
      </Sequence>
      <Sequence from={470} durationInFrames={130}>
        <WhyScene dur={130} p={props} />
      </Sequence>
    </AbsoluteFill>
  );
};
