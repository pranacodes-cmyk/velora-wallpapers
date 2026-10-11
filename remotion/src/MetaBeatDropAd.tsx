// Meta Beat-Drop ad — beautiful build + beat-synced feature reel for Prayly.
// 23s @ 30fps = 690 frames. 1080×1920 vertical.
// Music: ReelAudio-10281.mp3 (build 0–13.5s, drop 13.5s→end).
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
  Easing,
} from "remotion";
import { z } from "zod";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: SERIF } = loadPlayfair("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metaBeatDropSchema = z.object({
  audioTrack: z.string().optional(),
});

export const META_BEAT_DROP_DURATION = 690;

const GOLD = "#f0c36a";
const GOLD_DEEP = "#d4aa50";
const BG_DEEP = "#0a0f24";
const INK = "#070b1c";

// ───────────── Beats (frames @ 30fps) ─────────────
// Detected onsets from ReelAudio-10281.mp3.
const BEATS = [
  407, 449, 467, 479, 490, 496, 506, 514, 520, 530, 539, 550, 560, 566,
  572, 577, 584, 590, 599, 605, 613, 619, 626, 633, 638, 646, 653, 672,
];

// ───────────── Build phase backgrounds (cross-faded) ─────────────
const BUILD_BGS = [
  "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
  "daily-verse-bg/bg-jesus-dawn-prayer.jpg",
  "daily-verse-bg/bg-cross-dawn-rays.jpg",
];

// ───────────── Drop feature cards (one per beat region) ─────────────
type Feature = {
  title: string;
  sub: string;
  icon: string; // emoji-ish glyph
  bg: string;   // image path
  accent: string;
};
const FEATURES: Feature[] = [
  { title: "Daily Verse",       sub: "Live on your lockscreen", icon: "✦",  bg: "daily-verse-bg/bg-open-bible-glow.jpg",         accent: "#f0c36a" },
  { title: "Live Wallpapers",   sub: "Majestic. Moving.",       icon: "◈",  bg: "daily-verse-bg/bg-jesus-risen-angels.jpg",      accent: "#f8d27a" },
  { title: "Prayer Bells",      sub: "Gentle daily reminders",  icon: "❀",  bg: "daily-verse-bg/bg-prayer-candle-bedside.jpg",   accent: "#e8b65a" },
  { title: "Bible Companion",   sub: "Pastoral AI, anytime",    icon: "✧",  bg: "daily-verse-bg/bg-hands-holding-bible.jpg",     accent: "#ffd98a" },
  { title: "Devotionals",       sub: "Narrated mornings",       icon: "❋",  bg: "daily-verse-bg/bg-jesus-dawn-prayer.jpg",       accent: "#f0c36a" },
  { title: "Journeys",          sub: "Walk through Scripture",  icon: "✺",  bg: "daily-verse-bg/bg-mountain-dawn.jpg",           accent: "#f6c270" },
  { title: "Bible Quiz",        sub: "Faith, sharpened",        icon: "✪",  bg: "daily-verse-bg/bg-cross-crown.jpg",             accent: "#ffcf78" },
  { title: "Streaks",           sub: "Stay close to Him",       icon: "✦",  bg: "daily-verse-bg/bg-golden-sky.jpg",              accent: "#f0c36a" },
  { title: "Favorites",         sub: "Keep what speaks",        icon: "♥",  bg: "daily-verse-bg/bg-prayer-folded-hands.jpg",     accent: "#f4c682" },
  { title: "Share His Word",    sub: "One tap. One soul.",      icon: "➤",  bg: "daily-verse-bg/bg-jesus-clouds.jpg",            accent: "#ffd98a" },
];

// ───────────── Helpers ─────────────
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.08, zIndex: 90 }}>
      <svg width="100%" height="100%">
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const GoldVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 90% at 50% 35%, rgba(240,195,106,0.10) 0%, rgba(10,15,36,0) 45%), radial-gradient(140% 100% at 50% 110%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%)",
      pointerEvents: "none",
      zIndex: 80,
    }}
  />
);

// Beat punch — returns 0..1 spike that decays.
function beatPunch(frame: number, fps: number) {
  let best = 0;
  for (const b of BEATS) {
    const dt = (frame - b) / fps;
    if (dt < -0.02 || dt > 0.45) continue;
    const v = Math.exp(-dt * 11);
    if (v > best) best = v;
  }
  return best;
}

// Pick which feature is active given frame in drop.
function activeFeatureIndex(frame: number) {
  let idx = -1;
  for (let i = 0; i < BEATS.length; i++) {
    if (frame >= BEATS[i]) idx = i;
  }
  if (idx < 0) return 0;
  return idx % FEATURES.length;
}

// ───────────── Build phase (0..407) ─────────────
const BuildPhase: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Cross-fade backgrounds across the build.
  const seg = 407 / BUILD_BGS.length;
  return (
    <AbsoluteFill>
      {BUILD_BGS.map((src, i) => {
        const start = i * seg;
        const o = interpolate(f, [start - 20, start + 30, start + seg - 10, start + seg + 30], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const z = interpolate(f, [start, start + seg + 40], [1.06, 1.18]);
        return (
          <AbsoluteFill key={i} style={{ opacity: o }}>
            <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.35) 0%, rgba(7,11,28,0.55) 55%, rgba(7,11,28,0.92) 100%)" }} />
      <GoldVignette />

      {/* Top kicker */}
      <BuildKicker />

      {/* Phone with verse card sliding up */}
      <BuildPhone />

      {/* Three breath lines */}
      <BuildLines />

      <Grain />
    </AbsoluteFill>
  );
};

const BuildKicker: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [10, 40, 360, 400], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [10, 40], [-12, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 28px", borderRadius: 999,
        background: "rgba(240,195,106,0.12)", border: "1.5px solid rgba(240,195,106,0.5)",
        color: GOLD, fontFamily: INTER, fontSize: 26, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase",
        backdropFilter: "blur(0px)",
      }}>
        ✦ &nbsp;Prayly&nbsp; ✦
      </div>
    </div>
  );
};

const BuildPhone: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Phone enters around f=60, sits, then ducks out before drop.
  const enterS = spring({ frame: f - 50, fps, config: { damping: 18, stiffness: 110, mass: 0.9 } });
  const exitO = interpolate(f, [380, 405], [1, 0], { extrapolateRight: "clamp" });
  const scale = interpolate(enterS, [0, 1], [0.86, 1]) * exitO + (1 - exitO) * 0.92;
  const o = enterS * exitO;
  // Floating breath
  const breath = Math.sin((f - 60) / 28) * 6;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", opacity: o, transform: `translateY(${30 + breath}px) scale(${scale})` }}>
      <PhoneFrame>
        <PhoneLockScreen />
      </PhoneFrame>
    </div>
  );
};

const BuildLines: React.FC = () => {
  const f = useCurrentFrame();
  const lines = [
    { text: "Begin the day", start: 90 },
    { text: "with His Word", start: 180 },
    { text: "every time you unlock.", start: 270 },
  ];
  const exitO = interpolate(f, [370, 400], [1, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 220, left: 0, right: 0, textAlign: "center", opacity: exitO }}>
      {lines.map((l, i) => {
        const o = interpolate(f, [l.start, l.start + 22, l.start + 80, l.start + 110], [0, 1, 1, 0.5], { extrapolateRight: "clamp" });
        const y = interpolate(f, [l.start, l.start + 22], [16, 0], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            opacity: o, transform: `translateY(${y}px)`,
            color: i === 1 ? GOLD : "#fff",
            fontFamily: SERIF, fontWeight: i === 1 ? 700 : 600,
            fontSize: i === 1 ? 78 : 64, lineHeight: 1.1, letterSpacing: -1,
            textShadow: "0 6px 30px rgba(0,0,0,0.6)",
            marginTop: i === 0 ? 0 : 6,
          }}>
            {l.text}
          </div>
        );
      })}
    </div>
  );
};

// ───────────── Phone Frame ─────────────
const PhoneFrame: React.FC<{ children: React.ReactNode; tint?: string }> = ({ children, tint }) => (
  <div style={{
    width: 620, height: 1280, borderRadius: 86,
    background: "linear-gradient(180deg,#1a1f33 0%, #0a0d18 100%)",
    padding: 14,
    boxShadow: "0 60px 120px rgba(0,0,0,0.7), 0 0 0 2px rgba(240,195,106,0.18), inset 0 0 0 2px rgba(255,255,255,0.05)",
    position: "relative",
  }}>
    <div style={{
      width: "100%", height: "100%", borderRadius: 72, overflow: "hidden", position: "relative",
      background: tint || "#000",
    }}>
      {children}
      {/* Notch */}
      <div style={{
        position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
        width: 180, height: 36, background: "#000", borderRadius: 22,
      }} />
    </div>
  </div>
);

const PhoneLockScreen: React.FC = () => {
  const f = useCurrentFrame();
  // Static bg
  const bg = "daily-verse-bg/bg-jesus-mountain-sunrise.jpg";
  const cardO = interpolate(f, [100, 140], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(f, [100, 140], [22, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)" }} />

      {/* Time */}
      <div style={{ position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", color: "#fff", fontFamily: INTER, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 20, letterSpacing: 3, opacity: 0.92, textTransform: "uppercase", fontWeight: 600 }}>Tuesday, Jun 16</div>
        <div style={{ fontSize: 140, fontWeight: 200, letterSpacing: -5, lineHeight: 1, marginTop: 4 }}>7:14</div>
      </div>

      {/* Verse card */}
      <div style={{
        position: "absolute", left: 28, right: 28, top: 540,
        padding: "28px 28px 30px", borderRadius: 28,
        background: "rgba(10,15,36,0.62)",
        border: "1.2px solid rgba(240,195,106,0.55)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        opacity: cardO, transform: `translateY(${cardY}px)`,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999,
          background: "rgba(240,195,106,0.18)", border: "1px solid rgba(240,195,106,0.55)",
          color: GOLD, fontSize: 14, fontWeight: 800, letterSpacing: 2.4, textTransform: "uppercase", marginBottom: 14, fontFamily: INTER,
        }}>✦ Today's Verse</div>
        <div style={{ color: "#fff", fontSize: 32, lineHeight: 1.25, fontWeight: 600, fontFamily: SERIF, letterSpacing: -0.2 }}>
          &ldquo;Be still, and know that I am God.&rdquo;
        </div>
        <div style={{ marginTop: 14, color: GOLD, fontSize: 18, fontWeight: 800, letterSpacing: 1.6, fontFamily: INTER }}>
          — Psalm 46:10
        </div>
      </div>
    </div>
  );
};

// ───────────── Drop phase (407..660) ─────────────
const DropPhase: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localF = f; // already inside Sequence
  const punch = beatPunch(localF + 407, fps); // BEATS are absolute frames
  const idx = activeFeatureIndex(localF + 407);
  const feat = FEATURES[idx];

  // Background swap, slight zoom punch per beat
  const bgScale = 1.08 + punch * 0.05;

  // Card scale punch
  const cardScale = 1 + punch * 0.06;
  const cardO = interpolate(localF, [0, 6], [0, 1], { extrapolateRight: "clamp" });

  // Flash on beat
  const flash = punch * 0.22;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill key={idx} style={{ transform: `scale(${bgScale})` }}>
        <Img src={staticFile(feat.bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.55) 0%, rgba(7,11,28,0.85) 100%)" }} />
      <AbsoluteFill style={{ background: `rgba(255,235,180,${flash})`, mixBlendMode: "screen" }} />
      <GoldVignette />

      {/* Top counter strip — App in motion */}
      <div style={{
        position: "absolute", top: 110, left: 0, right: 0, textAlign: "center",
        fontFamily: INTER, color: GOLD, fontSize: 22, fontWeight: 800, letterSpacing: 6, textTransform: "uppercase",
        opacity: cardO,
      }}>
        ✦ &nbsp;Inside Prayly&nbsp; ✦
      </div>

      {/* Center feature card */}
      <div key={`card-${idx}`} style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", opacity: cardO,
        transform: `scale(${cardScale})`,
      }}>
        <FeatureBigCard feat={feat} index={idx} />
      </div>

      {/* Bottom ticker of feature names */}
      <FeatureTicker idx={idx} />

      <Grain />
    </AbsoluteFill>
  );
};

const FeatureBigCard: React.FC<{ feat: Feature; index: number }> = ({ feat, index }) => {
  const f = useCurrentFrame();
  // Per-card entrance — reset each beat by keying off index
  const enter = interpolate(f % 30, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{
      width: 880, padding: "56px 48px 60px", borderRadius: 44,
      background: "rgba(10,15,36,0.66)",
      border: `2px solid ${feat.accent}66`,
      boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px ${feat.accent}33, 0 0 60px ${feat.accent}33`,
      textAlign: "center",
    }}>
      <div style={{
        width: 160, height: 160, margin: "0 auto 28px", borderRadius: 44,
        background: `linear-gradient(135deg, ${feat.accent} 0%, ${GOLD_DEEP} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: INK, fontSize: 96, fontWeight: 900, fontFamily: SERIF,
        boxShadow: `0 20px 50px ${feat.accent}55, inset 0 4px 0 rgba(255,255,255,0.4)`,
        transform: `scale(${0.92 + 0.08 * enter})`,
      }}>{feat.icon}</div>
      <div style={{ color: "#fff", fontFamily: SERIF, fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -1.5 }}>
        {feat.title}
      </div>
      <div style={{ marginTop: 20, color: feat.accent, fontFamily: INTER, fontSize: 34, fontWeight: 600, letterSpacing: 1 }}>
        {feat.sub}
      </div>
    </div>
  );
};

const FeatureTicker: React.FC<{ idx: number }> = ({ idx }) => {
  return (
    <div style={{
      position: "absolute", bottom: 220, left: 0, right: 0,
      display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", padding: "0 40px",
    }}>
      {FEATURES.map((feat, i) => {
        const active = i === idx;
        return (
          <div key={i} style={{
            padding: active ? "10px 18px" : "8px 14px",
            borderRadius: 999,
            background: active ? `${feat.accent}` : "rgba(255,255,255,0.06)",
            color: active ? INK : "rgba(255,255,255,0.7)",
            fontFamily: INTER, fontSize: 18, fontWeight: active ? 900 : 600, letterSpacing: 0.5,
            border: active ? `1px solid ${feat.accent}` : "1px solid rgba(255,255,255,0.12)",
            transform: active ? "scale(1.06)" : "scale(1)",
            boxShadow: active ? `0 8px 24px ${feat.accent}66` : "none",
          }}>{feat.title}</div>
        );
      })}
    </div>
  );
};

// ───────────── End Card (660..690) ─────────────
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const o = interpolate(f, [0, 10], [0, 1]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #1a234a 0%, ${INK} 70%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{
        width: 240, height: 240, borderRadius: 60, overflow: "hidden",
        boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 0 3px ${GOLD}55, 0 0 80px ${GOLD}55`,
        transform: `scale(${0.85 + 0.15 * s})`,
      }}>
        <Img src={staticFile("images/app-icon.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ marginTop: 36, color: "#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 120, letterSpacing: -2 }}>
        Prayly
      </div>
      <div style={{ marginTop: 6, color: GOLD, fontFamily: INTER, fontSize: 30, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
        Bible · Prayer · Verse
      </div>
      <div style={{
        marginTop: 38, padding: "18px 36px", borderRadius: 999,
        background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
        color: INK, fontFamily: INTER, fontSize: 28, fontWeight: 900, letterSpacing: 1,
        boxShadow: `0 20px 50px ${GOLD}55`,
      }}>
        Free on Google Play ▸
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Root ─────────────
export const MetaBeatDropAd: React.FC<z.infer<typeof metaBeatDropSchema>> = ({ audioTrack }) => {
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence from={0} durationInFrames={407}>
        <BuildPhase />
      </Sequence>
      <Sequence from={407} durationInFrames={253}>
        <DropPhase />
      </Sequence>
      <Sequence from={660} durationInFrames={30}>
        <EndCard />
      </Sequence>
      {audioTrack && <Audio src={staticFile(`audio/${audioTrack}`)} />}
    </AbsoluteFill>
  );
};
