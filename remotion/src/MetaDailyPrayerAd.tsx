// Whispered Prayer ad — tender, candlelit, ASMR-style.
// 22s @ 30fps = 660 frames. Vertical 9:16.
// Story: silence → hook ("when you have no words left…") → "let this pray for you" →
//        prayer fades in line by line over candlelit Bible → promise → wordmark.
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  random,
} from "remotion";
import { z } from "zod";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: SERIF } = loadCormorant("italic", {
  weights: ["300", "400", "500", "600"],
  subsets: ["latin"],
});
const { fontFamily: SERIF_REG } = loadCormorant("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metaDailyPrayerSchema = z.object({
  audioTrack: z.string().optional(),
  backgrounds: z.array(z.string()).optional(),
  copy: z
    .object({
      hookLine1: z.string(),
      hookLine2: z.string(),
      prayerLines: z.array(z.string()),
      amen: z.string(),
      promiseLine1: z.string(),
      promiseLine2: z.string(),
    })
    .optional(),
});

export const DEFAULT_PRAYER_COPY = {
  hookLine1: "When you have no words left\u2026",
  hookLine2: "let this pray for you.",
  prayerLines: [
    "Lord, You see this heart, even now.",
    "You hear what I cannot say.",
    "Quiet the noise, hold what is heavy,",
    "and let Your peace rest over me tonight.",
  ],
  amen: "In Jesus' name, Amen.",
  promiseLine1: "A new prayer, written for you.",
  promiseLine2: "Every morning. Every night.",
};

const DEFAULT_BGS = [
  "daily-verse-bg/bg-prayer-candle-bedside.jpg",
  "daily-verse-bg/bg-prayer-folded-hands.jpg",
  "daily-verse-bg/bg-prayer-bible-candle.jpg",
  "daily-verse-bg/bg-prayer-moon-window.jpg",
];

// ── Scene durations (frames @ 30fps) ──
const S_HOOK = 90;     // 3.0s
const S_HOLD = 90;     // 3.0s
const S_PRAYER = 360;  // 12s
const S_PROMISE = 120; // 4.0s
export const META_DAILY_PRAYER_DURATION = S_HOOK + S_HOLD + S_PRAYER + S_PROMISE; // 660

// ────────── Visual chrome ──────────

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.08 }}>
      <svg width="100%" height="100%">
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.75 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(120% 90% at 50% 55%, transparent 35%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

const CandleFlicker: React.FC<{ frame: number; baseOpacity?: number }> = ({
  frame,
  baseOpacity = 0.18,
}) => {
  // Sinusoidal flicker layered with a smaller higher-freq sin to feel candle-like.
  const flicker =
    Math.sin(frame * 0.18) * 0.04 +
    Math.sin(frame * 0.43 + 1.2) * 0.025 +
    Math.sin(frame * 0.07) * 0.03;
  const opacity = Math.max(0, baseOpacity + flicker);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(60% 50% at 50% 70%, rgba(255,180,110,1) 0%, rgba(255,160,80,0.5) 30%, transparent 70%)",
        mixBlendMode: "soft-light",
        opacity,
      }}
    />
  );
};

const DustMotes: React.FC = () => {
  const f = useCurrentFrame();
  const motes = Array.from({ length: 22 }).map((_, i) => {
    const sx = random(`mx${i}`) * 100;
    const sy = random(`my${i}`) * 100;
    const speed = 0.05 + random(`ms${i}`) * 0.15;
    const drift = Math.sin(f * speed + i) * 6;
    const y = (sy + (f * (0.05 + random(`mv${i}`) * 0.08))) % 100;
    const size = 1.5 + random(`mz${i}`) * 2.5;
    const op = 0.15 + random(`mo${i}`) * 0.35;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${(sx + drift + 100) % 100}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(255, 210, 150, 0.9)",
          filter: "blur(0.5px)",
          opacity: op,
          boxShadow: "0 0 6px rgba(255, 200, 130, 0.6)",
        }}
      />
    );
  });
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{motes}</AbsoluteFill>;
};

// Ken-Burns background that very slowly zooms.
const KenBurnsBg: React.FC<{
  src: string;
  scaleFrom?: number;
  scaleTo?: number;
  durationFrames: number;
  startFrame?: number;
}> = ({ src, scaleFrom = 1.04, scaleTo = 1.16, durationFrames, startFrame = 0 }) => {
  const frame = useCurrentFrame() - startFrame;
  const scale = interpolate(frame, [0, durationFrames], [scaleFrom, scaleTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center 60%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(2,4,12,0.55) 0%, rgba(2,4,12,0.25) 45%, rgba(2,4,12,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ────────── Typography helpers ──────────

const HookLine: React.FC<{
  text: string;
  startFrame: number;
  size?: number;
  italic?: boolean;
  weight?: number;
  y?: string;
  letterSpacing?: number;
}> = ({ text, startFrame, size = 72, italic = true, weight = 400, y = "50%", letterSpacing = -0.5 }) => {
  const f = useCurrentFrame() - startFrame;
  const opacity = interpolate(f, [0, 24, 70, 90], [0, 1, 1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(f, [0, 28], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(f, [0, 30], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        textAlign: "center",
        transform: `translateY(${ty}px)`,
        opacity,
        filter: `blur(${blur}px)`,
        padding: "0 80px",
      }}
    >
      <p
        style={{
          fontFamily: italic ? SERIF : SERIF_REG,
          fontStyle: italic ? "italic" : "normal",
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.18,
          color: "rgba(255, 244, 220, 0.96)",
          letterSpacing,
          textShadow:
            "0 2px 24px rgba(0,0,0,0.65), 0 0 60px rgba(255, 180, 110, 0.25)",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
};

// Prayer line that fades in word-by-word breath rhythm.
const PrayerLine: React.FC<{
  text: string;
  startFrame: number;
  size?: number;
  italic?: boolean;
  weight?: number;
  emphasized?: boolean;
}> = ({ text, startFrame, size = 50, italic = true, weight = 400, emphasized = false }) => {
  const f = useCurrentFrame() - startFrame;
  const opacity = interpolate(f, [0, 26, 999], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(f, [0, 36], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(f, [0, 24], [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <p
      style={{
        fontFamily: italic ? SERIF : SERIF_REG,
        fontStyle: italic ? "italic" : "normal",
        fontWeight: emphasized ? 500 : weight,
        fontSize: emphasized ? size + 4 : size,
        lineHeight: 1.42,
        margin: "0 0 18px 0",
        color: emphasized ? "rgba(255, 230, 180, 0.98)" : "rgba(255, 246, 228, 0.94)",
        letterSpacing: -0.2,
        textAlign: "center",
        opacity,
        transform: `translateY(${ty}px)`,
        filter: `blur(${blur}px)`,
        textShadow:
          "0 2px 18px rgba(0,0,0,0.7), 0 0 40px rgba(255, 180, 110, 0.18)",
      }}
    >
      {text}
    </p>
  );
};

// ────────── Scenes ──────────

const SceneHook: React.FC<{ bg: string; line1: string; line2: string }> = ({
  bg,
  line1,
  line2,
}) => {
  return (
    <AbsoluteFill>
      <KenBurnsBg src={bg} durationFrames={S_HOOK + 30} scaleFrom={1.06} scaleTo={1.16} />
      <DustMotes />
      <CandleFlicker frame={useCurrentFrame()} baseOpacity={0.22} />
      <Vignette strength={0.78} />
      <HookLine text={line1} startFrame={6} size={68} y="42%" italic />
      <HookLine text={line2} startFrame={44} size={68} y="52%" italic />
      <Grain />
    </AbsoluteFill>
  );
};

const SceneHold: React.FC<{ bg: string; line: string }> = ({ bg, line }) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <KenBurnsBg src={bg} durationFrames={S_HOLD + 30} scaleFrom={1.05} scaleTo={1.13} />
      <DustMotes />
      <CandleFlicker frame={f} baseOpacity={0.2} />
      <Vignette strength={0.8} />
      <HookLine text={line} startFrame={8} size={74} y="46%" italic weight={500} />
      <Grain />
    </AbsoluteFill>
  );
};

const ScenePrayer: React.FC<{
  bg: string;
  lines: string[];
  amen: string;
}> = ({ bg, lines, amen }) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Stagger each line ~62 frames apart, starting at frame 18.
  const lineStart = (i: number) => 18 + i * 62;
  const amenStart = 18 + lines.length * 62 + 24;

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <KenBurnsBg src={bg} durationFrames={S_PRAYER + 60} scaleFrom={1.02} scaleTo={1.1} />
      <DustMotes />
      <CandleFlicker frame={f} baseOpacity={0.24} />

      {/* Soft glass card behind the prayer to lift it off the bg */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: 880,
            padding: "70px 56px 60px",
            borderRadius: 36,
            background:
              "linear-gradient(180deg, rgba(20,16,28,0.32) 0%, rgba(20,16,28,0.18) 100%)",
            border: "1px solid rgba(255, 210, 150, 0.10)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.55), inset 0 0 60px rgba(255,180,110,0.05)",
          }}
        >
          {/* Tiny brand chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 34,
              opacity: interpolate(f, [10, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(255, 200, 130, 0.9)",
                boxShadow: "0 0 10px rgba(255,180,110,0.9)",
              }}
            />
            <span
              style={{
                fontFamily: INTER,
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "rgba(255, 220, 180, 0.78)",
              }}
            >
              Tonight's Prayer
            </span>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(255, 200, 130, 0.9)",
                boxShadow: "0 0 10px rgba(255,180,110,0.9)",
              }}
            />
          </div>

          {lines.map((text, i) => (
            <PrayerLine key={i} text={text} startFrame={lineStart(i)} size={46} italic />
          ))}

          <div style={{ height: 18 }} />
          <PrayerLine text={amen} startFrame={amenStart} size={42} italic emphasized />
        </div>
      </AbsoluteFill>

      <Vignette strength={0.7} />
      <Grain />
    </AbsoluteFill>
  );
};

const ScenePromise: React.FC<{ bg: string; line1: string; line2: string }> = ({
  bg,
  line1,
  line2,
}) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [S_PROMISE - 22, S_PROMISE], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Wordmark spring
  const markSpring = spring({
    frame: f - 50,
    fps: 30,
    config: { damping: 22, stiffness: 90 },
  });
  const markOpacity = interpolate(markSpring, [0, 1], [0, 1]);
  const markY = interpolate(markSpring, [0, 1], [12, 0]);

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <KenBurnsBg src={bg} durationFrames={S_PROMISE + 30} scaleFrom={1.04} scaleTo={1.12} />
      <DustMotes />
      <CandleFlicker frame={f} baseOpacity={0.18} />
      <Vignette strength={0.82} />

      <HookLine text={line1} startFrame={6} size={62} y="40%" italic weight={500} />
      <HookLine text={line2} startFrame={26} size={56} y="50%" italic={false} weight={400} />

      {/* Wordmark */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: markOpacity,
          transform: `translateY(${markY}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 32px",
            borderRadius: 999,
            background: "rgba(255, 244, 220, 0.06)",
            border: "1px solid rgba(255, 210, 150, 0.18)",
            backdropFilter: "blur(6px)" as any,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,210,130,1) 0%, rgba(255,170,80,1) 60%, rgba(255,140,40,0) 100%)",
              boxShadow: "0 0 14px rgba(255,180,90,0.9)",
            }}
          />
          <span
            style={{
              fontFamily: SERIF_REG,
              fontWeight: 500,
              fontSize: 42,
              letterSpacing: 1.5,
              color: "rgba(255, 244, 220, 0.96)",
            }}
          >
            Prayly
          </span>
        </div>
        <p
          style={{
            marginTop: 14,
            fontFamily: INTER,
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "rgba(255, 220, 180, 0.7)",
          }}
        >
          Bible Prayer &amp; Verse
        </p>
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ────────── Root ──────────

export const MetaDailyPrayerAd: React.FC<z.infer<typeof metaDailyPrayerSchema>> = ({
  audioTrack,
  backgrounds,
  copy,
}) => {
  const c = copy ?? DEFAULT_PRAYER_COPY;
  const bgs = backgrounds && backgrounds.length >= 4 ? backgrounds : DEFAULT_BGS;

  return (
    <AbsoluteFill style={{ background: "#020410" }}>
      {audioTrack ? <Audio src={staticFile(`audio/${audioTrack}`)} volume={0.85} /> : null}

      <Sequence from={0} durationInFrames={S_HOOK}>
        <SceneHook bg={bgs[0]} line1={c.hookLine1} line2={c.hookLine2} />
      </Sequence>

      <Sequence from={S_HOOK} durationInFrames={S_HOLD}>
        <SceneHold bg={bgs[1]} line={c.hookLine2} />
      </Sequence>

      <Sequence from={S_HOOK + S_HOLD} durationInFrames={S_PRAYER}>
        <ScenePrayer bg={bgs[2]} lines={c.prayerLines} amen={c.amen} />
      </Sequence>

      <Sequence from={S_HOOK + S_HOLD + S_PRAYER} durationInFrames={S_PROMISE}>
        <ScenePromise bg={bgs[3]} line1={c.promiseLine1} line2={c.promiseLine2} />
      </Sequence>
    </AbsoluteFill>
  );
};
