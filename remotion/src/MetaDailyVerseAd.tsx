// Meta ad — Nolan / Interstellar "Mountains" cut v2.
// 22s @ 30fps = 660 frames. Full-bleed (no letterbox). Centered captions.
// Story: silence → glint → boring lockscreen → reason → cosmic reveal (Jesus) →
//        verse mornings → promise → CTA.
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
import { LockScreenWithVerse, VerseEntry } from "./components/LockScreenWithVerse";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const metaDailyVerseSchema = z.object({
  verses: z.array(z.object({
    text: z.string(),
    reference: z.string(),
    weekday: z.string(),
    date: z.string(),
  })).optional(),
  backgrounds: z.array(z.string()).optional(),
  audioTrack: z.string().optional(),
  copy: z.object({
    glintLine1: z.string(),
    glintLine2: z.string(),
    boringLine1: z.string(),
    boringLine2: z.string(),
    reasonKicker: z.string(),
    reasonLine1: z.string(),
    reasonLine2: z.string(),
    promiseLine1: z.string(),
    promiseLine2: z.string(),
  }).optional(),
});

const DEFAULT_COPY = {
  glintLine1: "Every morning,",
  glintLine2: "you wake up…",
  boringLine1: "The same screen.",
  boringLine2: "The same empty routine.",
  reasonKicker: "What if…",
  reasonLine1: "…it started with Jesus?",
  reasonLine2: "A Bible verse on your lock screen.",
  promiseLine1: "Let God's Word be the first thing you see.",
  promiseLine2: "One verse can change the way you face your day.",
};

const FALLBACK_VERSES: VerseEntry[] = [
  { text: "Cast all your anxiety on Him because He cares for you.", reference: "1 Peter 5:7", weekday: "Monday", date: "Mar 3" },
  { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13", weekday: "Tuesday", date: "Mar 4" },
  { text: "The Lord is my light and my salvation.", reference: "Psalm 27:1", weekday: "Wednesday", date: "Mar 5" },
  { text: "Be still, and know that I am God.", reference: "Psalm 46:10", weekday: "Thursday", date: "Mar 6" },
];
// Hero reveal + 3 gallery backgrounds — all ultra HD, Jesus & spiritual context.
const FALLBACK_BGS = [
  "daily-verse-bg/bg-jesus-water-moon.jpg",
  "daily-verse-bg/bg-jesus-clouds.jpg",
  "daily-verse-bg/bg-cross-crown.jpg",
  "daily-verse-bg/bg-shepherd-sheep.jpg",
];

// ───────────── Cinematic chrome ─────────────

// Subtle film grain
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.12, zIndex: 49 }}>
      <svg width="100%" height="100%">
        <filter id={`n${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#n${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ opacity?: number }> = ({ opacity = 0.6 }) => (
  <AbsoluteFill style={{
    background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)",
    pointerEvents: "none", opacity, zIndex: 48,
  }} />
);

// Centered cinematic caption — sits dead-center of the screen with a
// soft darkening halo so it's always readable over any background.
const CenterCaption: React.FC<{
  kicker?: string;
  line1: string;
  line2?: string;
  opacity: number;
  accent?: boolean;
}> = ({ kicker, line1, line2, opacity, accent }) => (
  <AbsoluteFill style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 80px", zIndex: 60, opacity,
  }}>
    {/* soft halo for legibility */}
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse 70% 35% at center, rgba(0,0,0,0.55), transparent 70%)",
    }} />
    <div style={{ position: "relative", textAlign: "center", color: "#fff" }}>
      {kicker && (
        <div style={{
          fontFamily: INTER, fontWeight: 500, fontSize: 26,
          letterSpacing: 10, textTransform: "uppercase",
          color: "#f0c36a", marginBottom: 28,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}>
          {kicker}
        </div>
      )}
      <div style={{
        fontFamily: INTER, fontWeight: 700,
        fontSize: 88, lineHeight: 1.08, letterSpacing: -1.5,
        color: accent ? "#f0c36a" : "#fff",
        textShadow: "0 6px 30px rgba(0,0,0,0.85)",
      }}>
        {line1}
      </div>
      {line2 && (
        <div style={{
          marginTop: 18,
          fontFamily: INTER, fontWeight: 300,
          fontSize: 44, lineHeight: 1.25, letterSpacing: 0,
          color: "#e8d9b8",
          textShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}>
          {line2}
        </div>
      )}
    </div>
  </AbsoluteFill>
);

// iOS-style status bar
const StatusBar: React.FC = () => (
  <div style={{
    position: "absolute", top: 60, left: 0, right: 0, height: 50,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 80px", color: "#fff", fontFamily: INTER, fontSize: 28, fontWeight: 600,
    textShadow: "0 2px 8px rgba(0,0,0,0.5)", zIndex: 40,
  }}>
    <span>9:41</span>
    <span style={{ letterSpacing: 4, fontSize: 24 }}>5G  100%</span>
  </div>
);

const LockBottom: React.FC = () => (
  <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, zIndex: 40, pointerEvents: "none" }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0 110px 50px" }}>
      {["⚡", "📷"].map((g, i) => (
        <div key={i} style={{
          width: 86, height: 86, borderRadius: 999,
          background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 36,
        }}>{g}</div>
      ))}
    </div>
    <div style={{ display: "flex", justifyContent: "center", paddingBottom: 20 }}>
      <div style={{ width: 340, height: 7, borderRadius: 6, background: "rgba(255,255,255,0.85)" }} />
    </div>
  </div>
);

// ───────────── Scene 1 (0–3s, 90f): The glint in the void ─────────────
const SceneGlint: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const f = useCurrentFrame();
  const dotO = interpolate(f, [0, 20, 70, 90], [0, 1, 1, 0.6], { extrapolateRight: "clamp" });
  const dotSize = interpolate(f, [0, 90], [4, 28]);
  const lineW = interpolate(f, [40, 90], [0, 1100], { extrapolateLeft: "clamp" });
  const capO = interpolate(f, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 50%, rgba(240,195,106,${interpolate(f, [0, 90], [0.04, 0.18])}) 0%, transparent 50%)`,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: lineW, height: 1.5, background: "linear-gradient(90deg, transparent, #f0c36a, transparent)",
        boxShadow: "0 0 30px rgba(240,195,106,0.8)",
        opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: dotSize, height: dotSize, borderRadius: 999,
        background: "#fff5d8",
        boxShadow: "0 0 60px 20px rgba(240,195,106,0.7), 0 0 120px 40px rgba(240,195,106,0.4)",
        opacity: dotO * 0.55,
      }} />
      <CenterCaption line1={line1} line2={line2} opacity={capO} />
    </AbsoluteFill>
  );
};

// ───────────── Scene 2 (3–6s, 90f): The boring lockscreen ─────────────
const SceneBoring: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const f = useCurrentFrame();
  const enter = interpolate(f, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const drift = interpolate(f, [0, 90], [1.0, 1.04]);
  const subO = interpolate(f, [20, 40, 70, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: enter, transform: `scale(${drift})` }}>
        <AbsoluteFill style={{
          background: "linear-gradient(180deg, #1c2535 0%, #2a3550 35%, #3a3548 70%, #4a3a48 100%)",
        }} />
        <StatusBar />
        <LockBottom />
        <div style={{
          position: "absolute", top: 240, left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          color: "#fff", textAlign: "center", fontFamily: INTER,
          textShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}>
          <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: 3, opacity: 0.85, textTransform: "uppercase" }}>
            Monday, March 3
          </div>
          <div style={{ fontSize: 240, fontWeight: 200, letterSpacing: -8, lineHeight: 1, marginTop: 4 }}>
            7:14
          </div>
        </div>
      </AbsoluteFill>
      <Vignette opacity={0.7} />
      <CenterCaption line1={line1} line2={line2} opacity={subO} />
    </AbsoluteFill>
  );
};

// ───────────── Scene 3 (6–10s, 120f): The reason — connect with Him ─────────────
const SceneReason: React.FC<{ kicker: string; line1: string; line2: string }> = ({ kicker, line1, line2 }) => {
  const f = useCurrentFrame();
  const o1 = interpolate(f, [0, 12, 30, 42], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const o2 = interpolate(f, [42, 60, 108, 120], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const pulse = interpolate(f, [0, 120], [0.1, 0.26]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 50%, rgba(240,195,106,${pulse}) 0%, rgba(20,15,40,0.4) 50%, #000 100%)`,
      }} />
      <CenterCaption line1={kicker} opacity={o1} accent />
      <CenterCaption line1={line1} line2={line2} opacity={o2} />
    </AbsoluteFill>
  );
};

// ───────────── Scene 4 (9–12s, 90f): The cosmic reveal — Jesus ─────────────
const SceneReveal: React.FC<{ verse: VerseEntry; bg: string }> = ({ verse, bg }) => {
  const f = useCurrentFrame();

  const bloomR = interpolate(f, [0, 30], [0, 2400]);
  const bloomO = interpolate(f, [0, 14, 30, 45], [0, 1, 1, 0]);

  const verseO = interpolate(f, [22, 50], [0, 1], { extrapolateRight: "clamp" });
  const verseScale = interpolate(f, [22, 120], [1.08, 1.0]);

  const flareX = interpolate(f, [10, 50], [-200, 1280]);
  const flareO = interpolate(f, [10, 22, 50], [0, 0.8, 0]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: verseO, transform: `scale(${verseScale})` }}>
        <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.85) 100%)" }} />
        <StatusBar />
        <LockBottom />
        <LockScreenWithVerse verses={[verse]} framesPerVerse={9999} />
      </AbsoluteFill>

      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 50%, rgba(255,245,220,${bloomO}) 0%, rgba(240,195,106,${bloomO * 0.6}) 30%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: bloomR, height: bloomR, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,220,160,0.3) 30%, transparent 70%)",
        opacity: bloomO, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 700, left: flareX, width: 800, height: 3,
        background: "linear-gradient(90deg, transparent, #fff5d8, transparent)",
        boxShadow: "0 0 30px #fff5d8",
        opacity: flareO, pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};

// ───────────── Scene 5 (12–21s, 270f): Morning gallery — 3 verses, 90f each ─────────────
const SceneGallery: React.FC<{ verses: VerseEntry[]; backgrounds: string[] }> = ({ verses, backgrounds }) => {
  const f = useCurrentFrame();
  const framesPerVerse = 90; // 3 × 90 = 270

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {backgrounds.slice(0, 3).map((bg, i) => {
        const start = i * framesPerVerse;
        const o = interpolate(
          f,
          [start - 14, start + 18, start + framesPerVerse - 18, start + framesPerVerse + 14],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const s = interpolate(f - start, [0, framesPerVerse], [1.0, 1.08]);
        const yPan = interpolate(f - start, [0, framesPerVerse], [0, -40]);
        return (
          <AbsoluteFill key={i} style={{ opacity: o, transform: `scale(${s}) translateY(${yPan}px)` }}>
            <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.8) 100%)" }} />

      <StatusBar />
      <LockBottom />
      <LockScreenWithVerse verses={verses.slice(0, 3)} framesPerVerse={framesPerVerse} />
    </AbsoluteFill>
  );
};

// ───────────── Scene 6: The promise ─────────────
const ScenePromise: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 18, 90, 105], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const glow = interpolate(f, [0, 105], [0.12, 0.22]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 50%, rgba(240,195,106,${glow}) 0%, transparent 60%)`,
      }} />
      <CenterCaption line1={line1} line2={line2} opacity={o} accent />
    </AbsoluteFill>
  );
};

// ───────────── Scene 7 (19–22s, 90f): CTA ─────────────
const SceneCta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgO = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const iconScale = spring({ frame: f - 2, fps, config: { damping: 14, stiffness: 90 } });
  const titleO = interpolate(f, [14, 34], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(f, [26, 46], [0, 1], { extrapolateRight: "clamp" });
  const btnO = interpolate(f, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(f / 8) * 0.015;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at center, #16213e 0%, #0a0f24 50%, #000 100%)",
        opacity: bgO,
      }} />
      <AbsoluteFill style={{ opacity: bgO * 0.7 }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const x = random(`x${i}`) * 1080;
          const y = random(`y${i}`) * 1920;
          const s = random(`s${i}`) * 2 + 1;
          const tw = 0.4 + Math.sin(f / 12 + i) * 0.3;
          return <div key={i} style={{
            position: "absolute", left: x, top: y, width: s, height: s,
            borderRadius: 999, background: "#fff", opacity: tw,
          }} />;
        })}
      </AbsoluteFill>

      <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <div style={{
          transform: `scale(${iconScale * pulse})`,
          width: 260, height: 260, borderRadius: 60, overflow: "hidden",
          boxShadow: "0 30px 80px rgba(240,195,106,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
        }}>
          <Img src={staticFile("images/app-icon.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{
          marginTop: 40, opacity: titleO, color: "#fff",
          fontWeight: 800, fontSize: 130, letterSpacing: 8, textAlign: "center", lineHeight: 1,
        }}>
          PRAYLY
        </div>
        <div style={{
          marginTop: 14, opacity: subO, color: "#e8d9b8",
          fontWeight: 400, fontSize: 26, letterSpacing: 8, textTransform: "uppercase", textAlign: "center",
        }}>
          Bible Prayer &amp; Verse
        </div>
        <div style={{
          marginTop: 48, opacity: btnO,
          transform: `scale(${interpolate(btnO, [0, 1], [0.94, 1])})`,
          padding: "26px 60px", borderRadius: 999,
          background: "linear-gradient(135deg, #f0c36a 0%, #d4aa50 100%)",
          color: "#0a0f24", fontWeight: 800, fontSize: 38, letterSpacing: 3,
          boxShadow: "0 20px 50px rgba(240,195,106,0.5)",
        }}>
          DOWNLOAD FREE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────── Timing — 28 seconds @ 30fps = 840 frames ─────────────
const S1 = 90;  // glint
const S2 = 90;  // boring
const S3 = 120; // reason — give "it started with Jesus" room to land
const S4 = 120; // reveal (Jesus) — 4s breathing room
const S5 = 270; // gallery — 3 verses × 90f
const S6 = 105; // promise — longer copy needs more time to read
const S7 = 90;  // cta
export const META_DAILY_VERSE_DURATION = S1 + S2 + S3 + S4 + S5 + S6 + S7; // 840

export const MetaDailyVerseAd: React.FC<z.infer<typeof metaDailyVerseSchema>> = ({ verses, backgrounds, audioTrack, copy }) => {
  const VERSES = verses && verses.length >= 4 ? verses.slice(0, 4) : FALLBACK_VERSES.slice(0, 4);
  const BGS = backgrounds && backgrounds.length >= 4 ? backgrounds.slice(0, 4) : FALLBACK_BGS.slice(0, 4);
  const music = audioTrack ?? "ReelAudio-10281.mp3";
  const C = { ...DEFAULT_COPY, ...(copy ?? {}) };

  let cursor = 0;
  const at = (dur: number) => { const v = cursor; cursor += dur; return v; };

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: INTER }}>
      <Audio
        src={staticFile(`audio/${music}`)}
        volume={(fr) => {
          if (fr < 8) return interpolate(fr, [0, 8], [0, 0.85]);
          if (fr > META_DAILY_VERSE_DURATION - 30) return interpolate(fr, [META_DAILY_VERSE_DURATION - 30, META_DAILY_VERSE_DURATION], [0.85, 0]);
          return 0.85;
        }}
      />

      <Sequence from={at(S1)} durationInFrames={S1}><SceneGlint line1={C.glintLine1} line2={C.glintLine2} /></Sequence>
      <Sequence from={at(S2)} durationInFrames={S2}><SceneBoring line1={C.boringLine1} line2={C.boringLine2} /></Sequence>
      <Sequence from={at(S3)} durationInFrames={S3}><SceneReason kicker={C.reasonKicker} line1={C.reasonLine1} line2={C.reasonLine2} /></Sequence>
      <Sequence from={at(S4)} durationInFrames={S4}><SceneReveal verse={VERSES[0]} bg={BGS[0]} /></Sequence>
      <Sequence from={at(S5)} durationInFrames={S5}><SceneGallery verses={[VERSES[1], VERSES[2], VERSES[3]]} backgrounds={[BGS[1], BGS[2], BGS[3]]} /></Sequence>
      <Sequence from={at(S6)} durationInFrames={S6}><ScenePromise line1={C.promiseLine1} line2={C.promiseLine2} /></Sequence>
      <Sequence from={at(S7)} durationInFrames={S7}><SceneCta /></Sequence>

      <Grain />
    </AbsoluteFill>
  );
};
