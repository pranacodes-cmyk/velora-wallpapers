// Prayly "Wow" ad — cinematic trailer, kinetic typography, beat-locked phone reel.
// 23s @ 30fps = 690 frames. 1080×1920. Synced to ReelAudio-10281.mp3.
import {
  AbsoluteFill, Audio, Sequence, Img, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from "remotion";
import { z } from "zod";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: INTER } = loadInter("normal", { weights: ["300","400","500","600","700","800","900"], subsets: ["latin"] });
const { fontFamily: SERIF } = loadPlayfair("normal", { weights: ["400","600","700","800","900"], subsets: ["latin"] });

export const metaWowSchema = z.object({ audioTrack: z.string().optional() });
export const META_WOW_DURATION = 690;

const GOLD = "#f0c36a";
const GOLD_DEEP = "#d4aa50";
const GOLD_WARM = "#ffd98a";
const INK = "#070b1c";
const DEEP = "#0a0f24";

// Detected beats (absolute frames @ 30fps) for ReelAudio-10281.mp3
const BEATS = [407,449,467,479,490,496,506,514,520,530,539,550,560,566,572,577,584,590,599,605,613,619,626,633,638,646,653,672];

// ───────────── Shared chrome ─────────────
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.10 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity, zIndex: 90 }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const GoldVignette: React.FC = () => (
  <AbsoluteFill style={{
    background: "radial-gradient(120% 90% at 50% 35%, rgba(240,195,106,0.12) 0%, rgba(10,15,36,0) 50%), radial-gradient(140% 100% at 50% 110%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%)",
    pointerEvents: "none", zIndex: 80,
  }} />
);

const Letterbox: React.FC<{ phase: "in"|"hold"|"out"|"none" }> = ({ phase }) => {
  const f = useCurrentFrame();
  let h = 0;
  if (phase === "in")   h = interpolate(f, [0, 20], [0, 180], { extrapolateRight: "clamp" });
  if (phase === "hold") h = 180;
  if (phase === "out")  h = interpolate(f, [0, 14], [180, 0], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left:0, right:0, top:0, height: h, background: "#000", zIndex: 95 }} />
      <div style={{ position: "absolute", left:0, right:0, bottom:0, height: h, background: "#000", zIndex: 95 }} />
    </>
  );
};

function beatPunch(absFrame: number, fps: number) {
  let best = 0;
  for (const b of BEATS) {
    const dt = (absFrame - b) / fps;
    if (dt < -0.02 || dt > 0.45) continue;
    const v = Math.exp(-dt * 11);
    if (v > best) best = v;
  }
  return best;
}

// ───────────── ACT 1 — Opening (0..120) ─────────────
const Act1: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 120], [1.06, 1.14]);
  const chipO = interpolate(f, [30, 50, 100, 118], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const lbPhase = f < 24 ? "in" : f > 100 ? "out" : "hold";
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={staticFile("daily-verse-bg/bg-jesus-mountain-sunrise.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.25) 0%, rgba(7,11,28,0.55) 100%)" }} />
      <GoldVignette />
      <Letterbox phase={lbPhase as any} />
      {/* Editorial chip */}
      <div style={{
        position: "absolute", bottom: 250, left: 60, opacity: chipO,
        color: "rgba(255,255,255,0.85)", fontFamily: INTER, zIndex: 96,
      }}>
        <div style={{ width: 56, height: 2, background: GOLD, marginBottom: 14 }} />
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", color: GOLD }}>A Prayly Film</div>
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5, fontFamily: SERIF, marginTop: 4 }}>A new way to meet Him.</div>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

// ───────────── ACT 2 — Kinetic typography (120..270) ─────────────
const KineticWord: React.FC<{ text: string; delay: number; bgImg: string }> = ({ text, delay, bgImg }) => {
  const f = useCurrentFrame() - delay;
  const dur = 38;
  if (f < -6 || f > dur + 6) return null;
  const s = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 130 } });
  const scale = interpolate(s, [0, 1], [1.6, 1]);
  const o = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blur = interpolate(f, [dur - 8, dur], [0, 16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underline = interpolate(f, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // background parallax
  const bgX = interpolate(f, [0, dur], [-30, 30]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: o, transform: `translateX(${bgX}px) scale(1.12)` }}>
        <Img src={staticFile(bgImg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.55), rgba(7,11,28,0.85))" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          opacity: o, transform: `scale(${scale})`, filter: `blur(${blur}px)`,
          fontFamily: SERIF, fontWeight: 900, fontSize: 280, color: "#fff",
          letterSpacing: -8, lineHeight: 1, textShadow: "0 20px 60px rgba(0,0,0,0.7)",
          position: "relative",
        }}>
          {text}
          <div style={{
            position: "absolute", left: 14, right: 14, bottom: 32, height: 10,
            background: GOLD, transform: `scaleX(${underline})`, transformOrigin: "left",
            boxShadow: `0 0 30px ${GOLD}`,
          }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Act2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: INK }}>
      <KineticWord text="Verses."  delay={0}   bgImg="daily-verse-bg/bg-open-bible-glow.jpg" />
      <KineticWord text="Prayers." delay={38}  bgImg="daily-verse-bg/bg-prayer-folded-hands.jpg" />
      <KineticWord text="Presence." delay={76} bgImg="daily-verse-bg/bg-jesus-clouds.jpg" />
      <KineticWord text="Power."   delay={114} bgImg="daily-verse-bg/bg-jesus-risen-angels.jpg" />
      <Grain />
    </AbsoluteFill>
  );
};

// ───────────── PHONE FRAME ─────────────
const PhoneFrame: React.FC<{ children: React.ReactNode; w?: number; h?: number }> = ({ children, w = 620, h = 1280 }) => (
  <div style={{
    width: w, height: h, borderRadius: 86,
    background: "linear-gradient(180deg,#1a1f33 0%, #0a0d18 100%)",
    padding: 14,
    boxShadow: "0 60px 120px rgba(0,0,0,0.75), 0 0 0 2px rgba(240,195,106,0.22), inset 0 0 0 2px rgba(255,255,255,0.06)",
    position: "relative",
  }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 72, overflow: "hidden", position: "relative", background: "#000" }}>
      {children}
      <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 180, height: 36, background: "#000", borderRadius: 22, zIndex: 50 }} />
    </div>
  </div>
);

// ───────────── ACT 3 — Hook (270..407) phone rising ─────────────
const Act3: React.FC = () => {
  const f = useCurrentFrame();
  const enter = spring({ frame: f - 10, fps: 30, config: { damping: 22, stiffness: 80 } });
  const y = interpolate(enter, [0, 1], [1100, 240]); // rises from bottom into view
  const lineO = (delay: number) => interpolate(f, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, #16213f 0%, ${INK} 70%)` }}>
      {/* Subtle moving sky bg */}
      <AbsoluteFill style={{ opacity: 0.35 }}>
        <Img src={staticFile("daily-verse-bg/bg-jesus-dawn-prayer.jpg")} style={{ width:"100%", height:"100%", objectFit:"cover", transform: `scale(${1.1 + f*0.0003})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.6), rgba(7,11,28,0.92))" }} />

      {/* Two lines */}
      <div style={{ position: "absolute", top: 220, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontWeight: 700, color: "#fff", letterSpacing: -1.5, lineHeight: 1.05 }}>
        <div style={{ fontSize: 96, opacity: lineO(20), transform: `translateY(${interpolate(f, [20,45], [16,0], { extrapolateRight:"clamp" })}px)` }}>Your phone</div>
        <div style={{ fontSize: 96, color: GOLD, opacity: lineO(55), transform: `translateY(${interpolate(f, [55,80], [16,0], { extrapolateRight:"clamp" })}px)` }}>becomes holy ground.</div>
      </div>

      {/* Rising phone */}
      <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center" }}>
        <PhoneFrame>
          <ScreenDailyVerse />
        </PhoneFrame>
      </div>
      <GoldVignette />
      <Grain />
    </AbsoluteFill>
  );
};

// ═════════════ APP SCREENS (mini-UIs) ═════════════

const ScreenDailyVerse: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Img src={staticFile("daily-verse-bg/bg-jesus-mountain-sunrise.jpg")} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.6))" }} />
      <div style={{ position: "absolute", top: 110, left:0, right:0, textAlign:"center", color:"#fff", fontFamily: INTER, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 20, letterSpacing: 3, opacity: 0.92, textTransform: "uppercase", fontWeight: 600 }}>Tuesday, Jun 16</div>
        <div style={{ fontSize: 140, fontWeight: 200, letterSpacing: -5, lineHeight: 1, marginTop: 4 }}>7:14</div>
      </div>
      <div style={{ position:"absolute", left: 28, right: 28, top: 540, padding: "28px 28px 30px", borderRadius: 28,
        background: "rgba(10,15,36,0.62)", border: "1.2px solid rgba(240,195,106,0.55)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)", opacity: o, transform: `translateY(${interpolate(o,[0,1],[18,0])}px)` }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap: 8, padding:"5px 12px", borderRadius: 999,
          background:"rgba(240,195,106,0.18)", border:"1px solid rgba(240,195,106,0.55)",
          color: GOLD, fontSize: 14, fontWeight: 800, letterSpacing: 2.4, textTransform:"uppercase", marginBottom: 14, fontFamily: INTER }}>
          ✦ Today's Verse
        </div>
        <div style={{ color:"#fff", fontSize: 32, lineHeight: 1.25, fontWeight: 600, fontFamily: SERIF, letterSpacing: -0.2 }}>
          &ldquo;Be still, and know that I am God.&rdquo;
        </div>
        <div style={{ marginTop: 14, color: GOLD, fontSize: 18, fontWeight: 800, letterSpacing: 1.6, fontFamily: INTER }}>— Psalm 46:10</div>
      </div>
    </div>
  );
};

const ScreenLiveWallpaper: React.FC = () => {
  const f = useCurrentFrame();
  const shimmerX = interpolate(f, [0, 60], [-100, 700]);
  return (
    <div style={{ position:"absolute", inset:0 }}>
      <Img src={staticFile("daily-verse-bg/bg-jesus-risen-angels.jpg")} style={{ width:"100%", height:"100%", objectFit:"cover", transform: `scale(${1.05 + f*0.001})` }} />
      <div style={{ position:"absolute", inset:0, background: "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.5))" }} />
      <div style={{ position:"absolute", inset:0, background: `linear-gradient(110deg, transparent 40%, rgba(255,217,138,0.35) 50%, transparent 60%)`, transform: `translateX(${shimmerX}px)` }} />
      <div style={{ position:"absolute", bottom: 90, left: 28, right: 28 }}>
        <div style={{ display:"inline-flex", padding:"8px 16px", borderRadius: 999, background: GOLD, color: INK, fontFamily: INTER, fontSize: 16, fontWeight: 900, letterSpacing: 1.5, textTransform:"uppercase" }}>LIVE</div>
        <div style={{ color:"#fff", fontFamily: SERIF, fontSize: 44, fontWeight: 700, lineHeight: 1.1, marginTop: 12, textShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>Risen King</div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontFamily: INTER, fontSize: 18, marginTop: 4 }}>Animated wallpaper · Tap to set</div>
      </div>
    </div>
  );
};

const ScreenPrayerAlarm: React.FC = () => {
  const f = useCurrentFrame();
  const ringRot = Math.sin(f / 4) * 8;
  const pulse = 1 + Math.sin(f / 6) * 0.04;
  return (
    <div style={{ position:"absolute", inset:0, background: `radial-gradient(circle at 50% 35%, #1a2447 0%, ${INK} 75%)`, display:"flex", flexDirection:"column", alignItems:"center", paddingTop: 100 }}>
      <div style={{ color: GOLD, fontFamily: INTER, fontSize: 18, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>Prayer Bell · Morning</div>
      <div style={{ color: "#fff", fontFamily: INTER, fontSize: 130, fontWeight: 200, letterSpacing: -4, marginTop: 8 }}>6:00</div>
      <div style={{ marginTop: 30, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}33 0%, transparent 70%)`, display:"flex", alignItems:"center", justifyContent:"center", transform: `scale(${pulse})` }}>
        <div style={{ width: 220, height: 220, borderRadius: "50%", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow: `0 20px 60px ${GOLD}66`, transform: `rotate(${ringRot}deg)`, fontSize: 130, color: INK }}>
          ❀
        </div>
      </div>
      <div style={{ color: "#fff", fontFamily: SERIF, fontSize: 38, fontWeight: 700, marginTop: 36, textAlign:"center", lineHeight: 1.1, padding: "0 30px" }}>
        "Pray without<br/>ceasing."
      </div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: INTER, fontSize: 16, marginTop: 8 }}>1 Thess 5:17</div>
      <div style={{ marginTop: 36, display:"flex", gap: 14 }}>
        <div style={{ padding: "14px 28px", borderRadius: 999, background: GOLD, color: INK, fontFamily: INTER, fontWeight: 900, fontSize: 18 }}>Pray now</div>
        <div style={{ padding: "14px 28px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", fontFamily: INTER, fontWeight: 700, fontSize: 18, border: "1px solid rgba(255,255,255,0.18)" }}>Snooze</div>
      </div>
    </div>
  );
};

const ScreenCompanion: React.FC = () => {
  const f = useCurrentFrame();
  const userIn = interpolate(f, [4, 18], [0, 1], { extrapolateRight: "clamp" });
  const aiIn   = interpolate(f, [22, 36], [0, 1], { extrapolateRight: "clamp" });
  // Typewriter on AI line
  const aiText = "Father, quiet the noise in this heart. Remind them You are near, even now.";
  const visibleChars = Math.floor(interpolate(f, [38, 80], [0, aiText.length], { extrapolateRight: "clamp" }));
  return (
    <div style={{ position:"absolute", inset:0, background: `linear-gradient(180deg, #0d1430 0%, ${INK} 100%)`, padding: 28, display: "flex", flexDirection: "column" }}>
      <div style={{ display:"flex", alignItems:"center", gap: 12, paddingBottom: 18, borderBottom: "1px solid rgba(240,195,106,0.18)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`, display:"flex", alignItems:"center", justifyContent:"center", color: INK, fontFamily: SERIF, fontWeight: 900, fontSize: 22 }}>✦</div>
        <div>
          <div style={{ color: "#fff", fontFamily: INTER, fontWeight: 800, fontSize: 22 }}>Bible Companion</div>
          <div style={{ color: GOLD, fontFamily: INTER, fontSize: 14, letterSpacing: 1 }}>Pastoral AI · online</div>
        </div>
      </div>

      {/* User bubble */}
      <div style={{ alignSelf: "flex-end", marginTop: 30, maxWidth: "78%", opacity: userIn, transform: `translateY(${interpolate(userIn,[0,1],[12,0])}px)` }}>
        <div style={{ padding: "16px 20px", borderRadius: "22px 22px 4px 22px", background: GOLD, color: INK, fontFamily: INTER, fontSize: 22, fontWeight: 600, lineHeight: 1.35 }}>
          I'm anxious tonight. I can't sleep.
        </div>
      </div>

      {/* AI bubble */}
      <div style={{ alignSelf: "flex-start", marginTop: 18, maxWidth: "84%", opacity: aiIn, transform: `translateY(${interpolate(aiIn,[0,1],[12,0])}px)` }}>
        <div style={{ padding: "18px 22px", borderRadius: "22px 22px 22px 4px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(240,195,106,0.25)", color: "#fff", fontFamily: INTER, fontSize: 22, fontWeight: 500, lineHeight: 1.4 }}>
          {aiText.slice(0, visibleChars)}
          <span style={{ color: GOLD, opacity: f % 16 < 8 ? 1 : 0 }}>▍</span>
        </div>
      </div>
    </div>
  );
};

const ScreenJourney: React.FC = () => {
  const f = useCurrentFrame();
  const fill = interpolate(f, [0, 50], [0, 0.32], { extrapolateRight: "clamp" });
  return (
    <div style={{ position:"absolute", inset:0 }}>
      <Img src={staticFile("daily-verse-bg/bg-mountain-dawn.jpg")} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      <div style={{ position:"absolute", inset:0, background: "linear-gradient(180deg, rgba(7,11,28,0.55), rgba(7,11,28,0.92))" }} />
      <div style={{ position:"absolute", inset: 28, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
        <div style={{ color: GOLD, fontFamily: INTER, fontSize: 16, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>30-Day Journey</div>
        <div style={{ color:"#fff", fontFamily: SERIF, fontSize: 64, fontWeight: 700, lineHeight: 1.05, marginTop: 8, letterSpacing: -1 }}>Walking with<br/>Christ</div>
        <div style={{ color:"rgba(255,255,255,0.8)", fontFamily: INTER, fontSize: 20, marginTop: 14 }}>Day 10 of 30 · Today's reflection</div>
        <div style={{ marginTop: 16, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", overflow:"hidden" }}>
          <div style={{ width: `${fill*100}%`, height:"100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_WARM})`, boxShadow: `0 0 20px ${GOLD}` }} />
        </div>
        <div style={{ marginTop: 26, padding:"18px 24px", borderRadius: 20, background: GOLD, color: INK, fontFamily: INTER, fontWeight: 900, fontSize: 22, textAlign:"center", boxShadow: `0 10px 30px ${GOLD}55` }}>
          Continue today ▸
        </div>
      </div>
    </div>
  );
};

const ScreenQuiz: React.FC = () => {
  const f = useCurrentFrame();
  const opts = ["Moses", "Joshua", "Aaron", "Caleb"];
  return (
    <div style={{ position:"absolute", inset:0, background: `linear-gradient(180deg, #0d1430 0%, ${INK} 100%)`, padding: 28 }}>
      <div style={{ color: GOLD, fontFamily: INTER, fontWeight: 800, fontSize: 16, letterSpacing: 3, textTransform: "uppercase", textAlign:"center", paddingTop: 60 }}>Bible Quiz · Question 5 / 10</div>
      <div style={{ marginTop: 24, padding: "30px 26px", borderRadius: 28, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(240,195,106,0.3)" }}>
        <div style={{ color:"#fff", fontFamily: SERIF, fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>
          Who led Israel into the Promised Land?
        </div>
      </div>
      <div style={{ marginTop: 24, display:"flex", flexDirection:"column", gap: 14 }}>
        {opts.map((o, i) => {
          const reveal = interpolate(f, [10 + i*6, 22 + i*6], [0, 1], { extrapolateRight: "clamp" });
          const highlight = i === 1 && f > 60;
          return (
            <div key={i} style={{
              opacity: reveal, transform: `translateY(${interpolate(reveal,[0,1],[14,0])}px)`,
              padding: "20px 22px", borderRadius: 18,
              background: highlight ? GOLD : "rgba(255,255,255,0.06)",
              color: highlight ? INK : "#fff", border: highlight ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.1)",
              fontFamily: INTER, fontSize: 22, fontWeight: highlight ? 900 : 600,
              boxShadow: highlight ? `0 0 30px ${GOLD}88` : "none",
              display:"flex", alignItems:"center", gap: 14,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: highlight ? "rgba(0,0,0,0.15)" : "rgba(240,195,106,0.15)", color: highlight ? INK : GOLD, display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 900, fontSize: 16 }}>
                {String.fromCharCode(65+i)}
              </div>
              {o}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScreenDevotional: React.FC = () => {
  const f = useCurrentFrame();
  const playFill = interpolate(f, [0, 70], [0.18, 0.62]);
  return (
    <div style={{ position:"absolute", inset:0 }}>
      <Img src={staticFile("daily-verse-bg/bg-prayer-bible-candle.jpg")} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      <div style={{ position:"absolute", inset:0, background: "linear-gradient(180deg, rgba(7,11,28,0.5), rgba(7,11,28,0.95))" }} />
      <div style={{ position:"absolute", inset: 28, display:"flex", flexDirection:"column", justifyContent:"flex-end", paddingBottom: 40 }}>
        <div style={{ color: GOLD, fontFamily: INTER, fontWeight: 800, fontSize: 16, letterSpacing: 3, textTransform:"uppercase" }}>Devotional · Day 16</div>
        <div style={{ color:"#fff", fontFamily: SERIF, fontSize: 56, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>Morning Prayer</div>
        <div style={{ color:"rgba(255,255,255,0.75)", fontFamily: INTER, fontSize: 20, marginTop: 6 }}>Narrated · 4:12</div>

        <div style={{ marginTop: 28, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.16)", overflow:"hidden" }}>
          <div style={{ width: `${playFill*100}%`, height:"100%", background: GOLD, boxShadow: `0 0 14px ${GOLD}` }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", color:"rgba(255,255,255,0.7)", fontFamily: INTER, fontSize: 14, marginTop: 6 }}>
          <span>2:34</span><span>4:12</span>
        </div>

        <div style={{ marginTop: 28, display:"flex", justifyContent:"center", alignItems:"center", gap: 30 }}>
          <div style={{ color:"#fff", fontSize: 36 }}>⏮</div>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: GOLD, color: INK, display:"flex", alignItems:"center", justifyContent:"center", fontSize: 40, fontWeight: 900, boxShadow: `0 10px 40px ${GOLD}66` }}>▶</div>
          <div style={{ color:"#fff", fontSize: 36 }}>⏭</div>
        </div>
      </div>
    </div>
  );
};

const ScreenStreaks: React.FC = () => {
  const f = useCurrentFrame();
  const flameScale = 1 + Math.sin(f/3)*0.06;
  return (
    <div style={{ position:"absolute", inset:0, background: `radial-gradient(circle at 50% 35%, #2a1d10 0%, ${INK} 75%)`, display:"flex", flexDirection:"column", alignItems:"center", paddingTop: 120 }}>
      <div style={{ fontSize: 240, transform: `scale(${flameScale})`, filter: `drop-shadow(0 0 40px ${GOLD})` }}>🔥</div>
      <div style={{ color:"#fff", fontFamily: SERIF, fontWeight: 800, fontSize: 100, marginTop: 10, letterSpacing: -2 }}>7-Day</div>
      <div style={{ color: GOLD, fontFamily: SERIF, fontWeight: 700, fontSize: 80, marginTop: -10 }}>Streak</div>
      <div style={{ color:"rgba(255,255,255,0.8)", fontFamily: INTER, fontSize: 22, marginTop: 18, textAlign:"center", padding:"0 40px", lineHeight: 1.4 }}>
        He honors the faithful.<br/>Keep walking with Him.
      </div>
      {/* Confetti dots */}
      {Array.from({length: 18}).map((_,i) => {
        const px = (i*47)%560 + 30;
        const py = ((i*83)%900) - (f*4)%900;
        return <div key={i} style={{ position:"absolute", left: px, top: py, width: 8, height: 8, borderRadius: 2, background: i%2? GOLD : GOLD_WARM, opacity: 0.8 }} />;
      })}
    </div>
  );
};

const ScreenFavorites: React.FC = () => {
  const imgs = [
    "daily-verse-bg/bg-jesus-clouds.jpg",
    "daily-verse-bg/bg-jesus-water-moon.jpg",
    "daily-verse-bg/bg-cross-crown.jpg",
    "daily-verse-bg/bg-shepherd-sheep.jpg",
    "daily-verse-bg/bg-jesus-halo-sunset.jpg",
    "daily-verse-bg/bg-golden-sky.jpg",
  ];
  const f = useCurrentFrame();
  return (
    <div style={{ position:"absolute", inset:0, background: `linear-gradient(180deg, #0d1430 0%, ${INK} 100%)`, padding: 28 }}>
      <div style={{ color: GOLD, fontFamily: INTER, fontWeight: 800, fontSize: 16, letterSpacing: 3, textTransform:"uppercase", paddingTop: 50 }}>Your Favorites</div>
      <div style={{ color:"#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 44, marginTop: 6 }}>Keep what speaks.</div>
      <div style={{ marginTop: 24, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14 }}>
        {imgs.map((src, i) => {
          const o = interpolate(f, [i*4, i*4+14], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${interpolate(o,[0,1],[14,0])}px) scale(${interpolate(o,[0,1],[0.94,1])})`, aspectRatio: "9/16", borderRadius: 18, overflow:"hidden", border:"1px solid rgba(240,195,106,0.25)", position:"relative" }}>
              <Img src={staticFile(src)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              <div style={{ position:"absolute", top: 8, right: 8, width: 28, height: 28, borderRadius:"50%", background: GOLD, display:"flex", alignItems:"center", justifyContent:"center", color: INK, fontSize: 14, fontWeight: 900 }}>♥</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────────── ACT 4 — Drop (407..645) ─────────────
// Phone full-frame; screen swaps on every beat.
const DROP_SCREENS: { key: string; label: string; comp: React.FC }[] = [
  { key: "verse",      label: "Daily Verse",       comp: ScreenDailyVerse },
  { key: "live",       label: "Live Wallpapers",   comp: ScreenLiveWallpaper },
  { key: "alarm",      label: "Prayer Bells",      comp: ScreenPrayerAlarm },
  { key: "companion",  label: "Bible Companion",   comp: ScreenCompanion },
  { key: "journey",    label: "Journeys",          comp: ScreenJourney },
  { key: "quiz",       label: "Bible Quiz",        comp: ScreenQuiz },
  { key: "devo",       label: "Devotionals",       comp: ScreenDevotional },
  { key: "streak",     label: "Streaks",           comp: ScreenStreaks },
  { key: "favs",       label: "Favorites",         comp: ScreenFavorites },
];

// Map beat index → screen index, holding each screen for 3 beats where possible.
function screenForBeat(beatIdx: number) {
  const groups = [
    [0,1,2,3],          // verse
    [4,5,6],            // live
    [7,8,9],            // alarm
    [10,11,12],         // companion
    [13,14,15],         // journey
    [16,17,18],         // quiz
    [19,20,21],         // devo
    [22,23,24],         // streak
    [25,26,27],         // favs
  ];
  for (let i = 0; i < groups.length; i++) if (groups[i].includes(beatIdx)) return i;
  return DROP_SCREENS.length - 1;
}

const Act4: React.FC = () => {
  const f = useCurrentFrame();
  const absF = f + 407;
  const { fps } = useVideoConfig();
  const punch = beatPunch(absF, fps);

  // Current beat index
  let beatIdx = -1;
  for (let i = 0; i < BEATS.length; i++) if (absF >= BEATS[i]) beatIdx = i;
  if (beatIdx < 0) beatIdx = 0;
  const screenIdx = screenForBeat(beatIdx);
  const Screen = DROP_SCREENS[screenIdx].comp;
  const label = DROP_SCREENS[screenIdx].label;

  // Background: rotate every 3 beats with subtle zoom + parallax
  const bgImg = [
    "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
    "daily-verse-bg/bg-jesus-clouds.jpg",
    "daily-verse-bg/bg-prayer-candle-bedside.jpg",
    "daily-verse-bg/bg-hands-holding-bible.jpg",
    "daily-verse-bg/bg-mountain-dawn.jpg",
    "daily-verse-bg/bg-cross-crown.jpg",
    "daily-verse-bg/bg-prayer-bible-candle.jpg",
    "daily-verse-bg/bg-golden-sky.jpg",
    "daily-verse-bg/bg-jesus-clouds.jpg",
  ][screenIdx];

  // Phone tilt — alternate per screen
  const tilt = (screenIdx % 2 === 0 ? -1 : 1) * 2.5;
  const phoneScale = 1 + punch * 0.04;

  // Flash on heavy beats (every other)
  const flash = (beatIdx % 2 === 0 ? punch : punch * 0.4) * 0.28;

  // Chromatic aberration on heaviest 6 beats
  const heavyBeats = [407, 449, 530, 599, 626, 672];
  let chroma = 0;
  for (const b of heavyBeats) {
    const dt = (absF - b) / fps;
    if (dt >= 0 && dt < 0.25) chroma = Math.max(chroma, Math.exp(-dt*14) * 8);
  }

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill key={screenIdx + "-bg"} style={{ transform: `scale(${1.1 + punch*0.04})` }}>
        <Img src={staticFile(bgImg)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,28,0.6), rgba(7,11,28,0.92))" }} />
      <AbsoluteFill style={{ background: `rgba(255,235,180,${flash})`, mixBlendMode:"screen" }} />
      <GoldVignette />

      {/* Phone (re-keyed each screen so the screen remounts and replays its sub-animations) */}
      <AbsoluteFill style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{
          transform: `rotate(${tilt}deg) scale(${phoneScale})`,
          filter: chroma > 0.1 ? `drop-shadow(${chroma}px 0 0 #ff003a55) drop-shadow(-${chroma}px 0 0 #00d4ff55)` : "none",
        }}>
          <div key={screenIdx}>
            <PhoneFrame>
              <Screen />
            </PhoneFrame>
          </div>
        </div>
      </AbsoluteFill>

      {/* Micro caption bottom-left */}
      <div key={"cap-"+screenIdx} style={{
        position:"absolute", bottom: 110, left: 60, fontFamily: INTER, color: GOLD,
        fontSize: 22, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase",
        opacity: interpolate(f%30, [0, 10], [0, 1], { extrapolateRight:"clamp" }),
      }}>
        <div style={{ width: 36, height: 2, background: GOLD, marginBottom: 8 }} />
        {label}
      </div>

      {/* Top kicker */}
      <div style={{ position:"absolute", top: 100, left:0, right:0, textAlign:"center", fontFamily: INTER, fontSize: 20, fontWeight: 800, letterSpacing: 6, color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
        Prayly
      </div>

      <Grain />
    </AbsoluteFill>
  );
};

// ───────────── ACT 5 — Outro (645..690) ─────────────
const Act5: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(f, [0, 6, 14], [1, 0.4, 0], { extrapolateRight: "clamp" });
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 130 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #1a234a 0%, ${INK} 70%)`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div style={{
        width: 240, height: 240, borderRadius: 60, overflow:"hidden",
        boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 0 3px ${GOLD}55, 0 0 80px ${GOLD}55`,
        transform: `scale(${0.82 + 0.18 * s})`,
      }}>
        <Img src={staticFile("images/app-icon.png")} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </div>
      <div style={{ marginTop: 32, color:"#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 120, letterSpacing: -2 }}>Prayly</div>
      <div style={{ marginTop: 4, color: GOLD, fontFamily: INTER, fontSize: 26, fontWeight: 700, letterSpacing: 4, textTransform:"uppercase" }}>Bible · Prayer · Verse</div>
      <div style={{ marginTop: 32, padding:"18px 36px", borderRadius: 999, background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, color: INK, fontFamily: INTER, fontSize: 28, fontWeight: 900, letterSpacing: 1, boxShadow: `0 20px 50px ${GOLD}55` }}>
        Free on Google Play ▸
      </div>
      <AbsoluteFill style={{ background: `rgba(255,235,180,${flash})`, pointerEvents:"none" }} />
      <Grain opacity={0.14} />
    </AbsoluteFill>
  );
};

// ───────────── Root ─────────────
export const MetaWowAd: React.FC<z.infer<typeof metaWowSchema>> = ({ audioTrack }) => {
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence from={0}   durationInFrames={120}><Act1 /></Sequence>
      <Sequence from={120} durationInFrames={150}><Act2 /></Sequence>
      <Sequence from={270} durationInFrames={137}><Act3 /></Sequence>
      <Sequence from={407} durationInFrames={238}><Act4 /></Sequence>
      <Sequence from={645} durationInFrames={45}><Act5 /></Sequence>
      {audioTrack && <Audio src={staticFile(`audio/${audioTrack}`)} />}
    </AbsoluteFill>
  );
};
