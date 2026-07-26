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
import {
  Backdrop,
  RiseIn,
  VoltUnderline,
  KaiGuide,
  BrandOutro,
  InfinityMark,
  useCountUp,
} from "./lib/components";

export const conceptSchema = z.object({
  title: z.string(),
  definition: z.string(),
  exampleCompany: z.string(),
  exampleTicker: z.string(),
  exampleValuePrefix: z.string(),
  exampleValueNumber: z.number(),
  exampleValueSuffix: z.string(),
  exampleNote: z.string(),
  glow: z.string(),
});
export type ConceptProps = z.infer<typeof conceptSchema>;

// Fade a scene in/out at its edges to avoid hard cuts
const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, dur - 12, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Eyebrow: React.FC<{ label: string; s: (f: number) => number }> = ({ label, s }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: s(0.02),
      marginBottom: s(0.035),
    }}
  >
    <InfinityMark size={s(0.08)} color={COLORS.kai} />
    <span
      style={{
        fontFamily: FONT.body,
        fontWeight: 800,
        letterSpacing: 4,
        textTransform: "uppercase",
        color: COLORS.kai,
        fontSize: s(0.026),
      }}
    >
      {label}
    </span>
  </div>
);

// ---------- Scene 1: animated headline ----------
const TitleScene: React.FC<{ dur: number; title: string }> = ({ dur, title }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: s(0.1) }}>
        <RiseIn delay={4}>
          <Eyebrow label="Concept" s={s} />
        </RiseIn>
        <RiseIn delay={10} distance={80}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 900,
              color: COLORS.ink,
              fontSize: s(0.13),
              lineHeight: 1.02,
              letterSpacing: -2,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
        </RiseIn>
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <VoltUnderline delay={24} height={s(0.03)} width={s(0.5)} />
        </div>
      </AbsoluteFill>
      <KaiGuide
        pose="teaching"
        height={s(0.5)}
        delay={16}
        style={{ position: "absolute", right: -s(0.04), bottom: 0 }}
      />
    </SceneFade>
  );
};

// ---------- Scene 2: definition ----------
const DefinitionScene: React.FC<{ dur: number; definition: string }> = ({ dur, definition }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", padding: `${s(0.12)}px ${s(0.09)}px` }}>
        <RiseIn delay={4}>
          <Eyebrow label="Definition" s={s} />
        </RiseIn>
        <RiseIn delay={12} distance={70}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              color: COLORS.ink,
              fontSize: s(0.062),
              lineHeight: 1.22,
              letterSpacing: -1,
            }}
          >
            {definition}
          </div>
        </RiseIn>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ---------- Scene 3: illustrated flow ----------
const Node: React.FC<{
  s: (f: number) => number;
  label: string;
  color: string;
  delay: number;
  icon: React.ReactNode;
}> = ({ s, label, color, delay, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ transform: `scale(${sp})`, opacity: sp, textAlign: "center" }}>
      <div
        style={{
          width: s(0.24),
          height: s(0.24),
          borderRadius: s(0.05),
          background: COLORS.card,
          boxShadow: `0 ${s(0.014)}px ${s(0.04)}px #211E1818`,
          border: `${s(0.006)}px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: FONT.body,
          fontWeight: 800,
          color: COLORS.ink,
          fontSize: s(0.03),
          marginTop: s(0.02),
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const FlowScene: React.FC<{ dur: number; glow: string }> = ({ dur, glow }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  const frame = useCurrentFrame();
  const vertical = height > width;
  // moving coins along the connectors
  const coinShift = (frame * s(0.006)) % s(0.12);
  const connector = (delay: number) => {
    const f = interpolate(frame, [delay, delay + 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <div
        style={{
          flex: 1,
          height: s(0.018),
          minWidth: vertical ? undefined : s(0.06),
          margin: vertical ? `${s(0.01)}px 0` : `0 ${s(0.01)}px`,
          borderRadius: s(0.02),
          background: `repeating-linear-gradient(${vertical ? 180 : 90}deg, ${COLORS.volt} 0 ${s(
            0.03
          )}px, ${COLORS.volt}00 ${s(0.03)}px ${s(0.06)}px)`,
          backgroundPositionX: coinShift,
          backgroundPositionY: coinShift,
          transform: `scale${vertical ? "Y" : "X"}(${f})`,
          transformOrigin: vertical ? "top" : "left",
        }}
      />
    );
  };
  const cartIcon = (
    <svg width={s(0.12)} height={s(0.12)} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6"
        stroke={COLORS.kai}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="20" r="1.6" fill={COLORS.kai} />
      <circle cx="17.5" cy="20" r="1.6" fill={COLORS.kai} />
    </svg>
  );
  const bldgIcon = (
    <svg width={s(0.12)} height={s(0.12)} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="1.5" stroke={COLORS.teal} strokeWidth={2} />
      <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" stroke={COLORS.teal} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
  const revIcon = (
    <div style={{ fontFamily: FONT.display, fontWeight: 900, color: COLORS.volt, fontSize: s(0.1) }}>$</div>
  );
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", padding: s(0.09) }}>
        <RiseIn delay={4}>
          <Eyebrow label="How it flows" s={s} />
        </RiseIn>
        <RiseIn delay={8}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 900,
              color: COLORS.ink,
              fontSize: s(0.06),
              letterSpacing: -1,
              textAlign: "center",
              marginBottom: s(0.05),
            }}
          >
            Every sale adds to revenue.
          </div>
        </RiseIn>
        <div
          style={{
            display: "flex",
            flexDirection: vertical ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(0.005),
            width: "100%",
          }}
        >
          <Node s={s} label="Customers" color={COLORS.kai} delay={16} icon={cartIcon} />
          {connector(26)}
          <Node s={s} label="The Company" color={COLORS.teal} delay={34} icon={bldgIcon} />
          {connector(44)}
          <Node s={s} label="Revenue" color={COLORS.volt} delay={52} icon={revIcon} />
        </div>
      </AbsoluteFill>
      <KaiGuide
        pose="thinking"
        height={s(0.34)}
        delay={20}
        style={{ position: "absolute", left: s(0.01), bottom: s(0.02) }}
      />
    </SceneFade>
  );
};

// ---------- Scene 4: big stat ----------
const StatScene: React.FC<{ dur: number; p: ConceptProps }> = ({ dur, p }) => {
  const { width, height } = useVideoConfig();
  const s = scaler(width, height);
  const val = useCountUp(p.exampleValueNumber, 18, 40);
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: s(0.09) }}>
        <RiseIn delay={4}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: s(0.02),
              padding: `${s(0.014)}px ${s(0.035)}px`,
              borderRadius: s(0.06),
              background: COLORS.ink,
              marginBottom: s(0.05),
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontWeight: 900,
                color: COLORS.white,
                fontSize: s(0.035),
                letterSpacing: 1,
              }}
            >
              {p.exampleTicker}
            </span>
            <span
              style={{
                fontFamily: FONT.body,
                fontWeight: 700,
                color: COLORS.sandDeep,
                fontSize: s(0.03),
              }}
            >
              {p.exampleCompany}
            </span>
          </div>
        </RiseIn>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 900,
            color: COLORS.ink,
            fontSize: s(0.19),
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          {p.exampleValuePrefix}
          {val.toFixed(1)}
          {p.exampleValueSuffix}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <VoltUnderline delay={30} height={s(0.028)} width={s(0.42)} color={COLORS.teal} />
        </div>
        <RiseIn delay={40}>
          <div
            style={{
              fontFamily: FONT.body,
              fontWeight: 700,
              color: COLORS.inkSoft,
              fontSize: s(0.034),
              marginTop: s(0.04),
              textAlign: "center",
            }}
          >
            {p.exampleNote}
          </div>
        </RiseIn>
      </AbsoluteFill>
      <KaiGuide
        pose="celebrating"
        height={s(0.36)}
        delay={44}
        style={{ position: "absolute", right: s(0.02), bottom: s(0.03) }}
      />
    </SceneFade>
  );
};

export const ConceptExplainer: React.FC<ConceptProps> = (props) => {
  return (
    <AbsoluteFill>
      <Backdrop glow={props.glow} />
      <Sequence from={0} durationInFrames={110}>
        <TitleScene dur={110} title={props.title} />
      </Sequence>
      <Sequence from={105} durationInFrames={165}>
        <DefinitionScene dur={165} definition={props.definition} />
      </Sequence>
      <Sequence from={265} durationInFrames={220}>
        <FlowScene dur={220} glow={props.glow} />
      </Sequence>
      <Sequence from={480} durationInFrames={210}>
        <StatScene dur={210} p={props} />
      </Sequence>
      <Sequence from={685} durationInFrames={215}>
        <BrandOutro enterAt={6} />
      </Sequence>
    </AbsoluteFill>
  );
};
