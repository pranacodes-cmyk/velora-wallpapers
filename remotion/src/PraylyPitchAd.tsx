import {
  AbsoluteFill,
  Audio,
  Loop as AudioLoop,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { LockScreenWithVerse, VerseEntry } from "./components/LockScreenWithVerse";

loadInter("normal", { weights: ["300", "400", "500", "600", "700", "800", "900"], subsets: ["latin"] });

export const praylyPitchSchema = z.object({
  verses: z.array(z.object({
    text: z.string(),
    reference: z.string(),
    weekday: z.string(),
    date: z.string(),
  })).optional(),
  backgrounds: z.array(z.string()).optional(),
  audioTrack: z.string().optional(),
});

const FALLBACK_VERSES: VerseEntry[] = [
  { text: "Cast all your anxiety on Him because He cares for you.", reference: "1 Peter 5:7", weekday: "Monday", date: "Mar 3" },
  { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13", weekday: "Tuesday", date: "Mar 4" },
  { text: "The Lord is my light and my salvation.", reference: "Psalm 27:1", weekday: "Wednesday", date: "Mar 5" },
  { text: "Be still, and know that I am God.", reference: "Psalm 46:10", weekday: "Thursday", date: "Mar 6" },
];

const FALLBACK_BGS = ["daily-verse-bg/bg-03.jpg", "daily-verse-bg/bg-12.jpg", "daily-verse-bg/bg-18.jpg", "daily-verse-bg/bg-07.jpg"];

// ---------- Helpers ----------
const useFadeIn = (start: number, dur = 14) => {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

// ---------- Part 1: Dark hook ----------
const Part1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f - 4, fps, config: { damping: 18 } });
  const subtitleO = interpolate(f, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #0a0e1f 0%, #000 80%)" }}>
      {/* Dim phone glow */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 620,
            height: 1240,
            borderRadius: 80,
            background: "linear-gradient(180deg, #0d1226 0%, #05070f 100%)",
            border: "2px solid #1a1f33",
            boxShadow: "0 60px 140px rgba(80,90,160,0.18), inset 0 0 0 6px #000",
            transform: `scale(${0.92 + enter * 0.06}) rotate(${-2 + enter * 1.5}deg)`,
            opacity: 0.95,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* faint clock */}
          <div style={{ position: "absolute", top: 240, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.22)", fontSize: 130, fontWeight: 200, letterSpacing: -3 }}>
            7:14
          </div>
          <div style={{ position: "absolute", top: 200, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 26, fontWeight: 500, letterSpacing: 2 }}>
            TUESDAY, MAR 4
          </div>
          {/* notification stubs */}
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              position: "absolute",
              left: 40, right: 40,
              top: 600 + i * 110,
              height: 92,
              borderRadius: 22,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
            }} />
          ))}
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <div style={{
        position: "absolute",
        bottom: 280,
        left: 80, right: 80,
        textAlign: "center",
        opacity: subtitleO,
      }}>
        <div style={{
          display: "inline-block",
          padding: "22px 36px",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          color: "#fff",
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: -1,
          maxWidth: 920,
        }}>
          We open our phone…<br />before we even pray.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Part 2: The Reveal ----------
const Part2Reveal: React.FC<{ verse: VerseEntry; bg: string }> = ({ verse, bg }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lightRise = spring({ frame: f, fps, config: { damping: 200, mass: 0.8 } });
  const captionO = interpolate(f, [12, 28], [0, 1], { extrapolateRight: "clamp" });
  const captionY = interpolate(f, [12, 28], [24, 0], { extrapolateRight: "clamp" });
  const kenBurns = interpolate(f, [0, 150], [1.0, 1.08]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: lightRise, transform: `scale(${kenBurns})` }}>
        <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.7) 100%)", opacity: lightRise }} />

      {/* Top caption */}
      <div style={{
        position: "absolute",
        top: 140,
        left: 70, right: 70,
        textAlign: "center",
        opacity: captionO,
        transform: `translateY(${captionY}px)`,
      }}>
        <div style={{
          display: "inline-block",
          padding: "22px 32px",
          background: "rgba(10,15,36,0.78)",
          border: "1px solid rgba(212,170,80,0.55)",
          borderRadius: 22,
          color: "#fff",
          fontSize: 54,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: 1.18,
        }}>
          What if the first thing you saw<br />was <span style={{ color: "#f0c36a" }}>God&apos;s Word?</span>
        </div>
      </div>

      {/* Verse card centered */}
      <div style={{
        position: "absolute",
        top: 720,
        left: 90, right: 90,
        padding: "50px 50px 56px",
        borderRadius: 38,
        background: "rgba(10,15,36,0.65)",
        border: "1.5px solid rgba(212,170,80,0.6)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
        opacity: lightRise,
        transform: `translateY(${interpolate(lightRise, [0, 1], [40, 0])}px)`,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 22px", borderRadius: 999,
          background: "rgba(212,170,80,0.18)", border: "1px solid rgba(212,170,80,0.55)",
          color: "#f0c36a", fontSize: 22, fontWeight: 800, letterSpacing: 3,
          textTransform: "uppercase", marginBottom: 28,
        }}>
          ✦ Today&apos;s Verse
        </div>
        <div style={{ color: "#fff", fontSize: 56, lineHeight: 1.22, fontWeight: 600, letterSpacing: -0.5, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
          &ldquo;{verse.text}&rdquo;
        </div>
        <div style={{ marginTop: 26, color: "#f0c36a", fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
          — {verse.reference}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Part 3: Feature — lockscreen mockup cycling ----------
const Part3Feature: React.FC<{ verses: VerseEntry[]; backgrounds: string[] }> = ({ verses, backgrounds }) => {
  const f = useCurrentFrame();
  const enter = useFadeIn(0, 16);
  const captionO = interpolate(f, [4, 22], [0, 1], { extrapolateRight: "clamp" });
  const framesPerVerse = 70;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Backgrounds crossfade with verse cycle */}
      {backgrounds.map((bg, i) => {
        const start = i * framesPerVerse;
        const o = interpolate(
          f,
          [start - 10, start + 6, start + framesPerVerse - 6, start + framesPerVerse + 10],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <AbsoluteFill key={i} style={{ opacity: o }}>
            <Img src={staticFile(bg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.75) 100%)" }} />

      {/* Lockscreen verse, cycling */}
      <AbsoluteFill style={{ opacity: enter }}>
        <LockScreenWithVerse verses={verses} framesPerVerse={framesPerVerse} />
      </AbsoluteFill>

      {/* Top caption */}
      <div style={{
        position: "absolute",
        top: 110, left: 60, right: 60,
        textAlign: "center",
        opacity: captionO,
      }}>
        <div style={{
          display: "inline-block",
          padding: "18px 28px",
          background: "#FFE94A",
          color: "#0a0a0a",
          fontSize: 50,
          fontWeight: 900,
          letterSpacing: -1,
          lineHeight: 1.1,
          borderRadius: 14,
          boxShadow: "0 14px 36px rgba(0,0,0,0.45)",
        }}>
          A new verse, every day.
        </div>
        <div style={{ height: 12 }} />
        <div style={{
          display: "inline-block",
          padding: "16px 26px",
          background: "rgba(10,15,36,0.85)",
          color: "#fff",
          fontSize: 36,
          fontWeight: 700,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          Auto-updates on your lock screen
        </div>
      </div>

      {/* Bottom pulse */}
      <div style={{
        position: "absolute", bottom: 110, left: 0, right: 0, textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "16px 28px", borderRadius: 999,
          background: "rgba(10,15,36,0.85)",
          border: "1px solid rgba(212,170,80,0.6)",
          color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 1.5,
        }}>
          <span style={{ color: "#f0c36a" }}>✦</span> Set &amp; forget — Prayly handles it
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Part 4: Impact typography ----------
const Part4Impact: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Line 1: "One verse changes your perspective."
  // Line 2 (delayed): "And perspective changes your day."

  const line1O = spring({ frame: f - 4, fps, config: { damping: 18 } });
  const line1Y = interpolate(line1O, [0, 1], [40, 0]);
  const line2O = spring({ frame: f - 80, fps, config: { damping: 18 } });
  const line2Y = interpolate(line2O, [0, 1], [40, 0]);

  // Background pan
  const pan = interpolate(f, [0, 210], [1.0, 1.06]);

  return (
    <AbsoluteFill style={{ background: "#03060f" }}>
      <AbsoluteFill style={{ transform: `scale(${pan})` }}>
        <Img src={staticFile("daily-verse-bg/bg-15.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,6,15,0.55) 0%, rgba(3,6,15,0.85) 100%)" }} />

      <AbsoluteFill style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div style={{ opacity: line1O, transform: `translateY(${line1Y}px)`, textAlign: "center", marginBottom: 60 }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 28, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 18 }}>
            One verse
          </div>
          <div style={{ color: "#fff", fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            changes your<br />
            <span style={{ color: "#f0c36a" }}>perspective.</span>
          </div>
        </div>

        <div style={{ opacity: line2O, transform: `translateY(${line2Y}px)`, textAlign: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 28, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", marginBottom: 18 }}>
            And perspective
          </div>
          <div style={{ color: "#fff", fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            changes your<br />
            <span style={{ color: "#f0c36a" }}>day.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- CTA ----------
const PartCta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bgO = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const iconScale = spring({ frame: f - 2, fps, config: { damping: 12 } });
  const titleO = spring({ frame: f - 8, fps, config: { damping: 18 } });
  const subO = spring({ frame: f - 18, fps, config: { damping: 18 } });
  const btnO = spring({ frame: f - 28, fps, config: { damping: 16 } });
  const arrowBob = Math.sin((f / 30) * Math.PI * 2) * 6;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at center, #1a2654 0%, #0a0f24 60%, #03060f 100%)",
        opacity: bgO,
      }} />
      <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <div style={{
          transform: `scale(${iconScale})`,
          width: 260, height: 260, borderRadius: 60, overflow: "hidden",
          boxShadow: "0 30px 80px rgba(212,170,80,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
        }}>
          <Img src={staticFile("images/app-icon.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{
          marginTop: 44, opacity: titleO, color: "#fff",
          fontWeight: 900, fontSize: 100, letterSpacing: -1, textAlign: "center", lineHeight: 1,
        }}>
          Download Prayly
        </div>
        <div style={{
          marginTop: 18, opacity: subO, color: "#f0c36a",
          fontWeight: 700, fontSize: 38, letterSpacing: 6, textTransform: "uppercase",
        }}>
          Today. Free.
        </div>
        <div style={{
          marginTop: 52, opacity: btnO,
          transform: `scale(${interpolate(btnO, [0, 1], [0.92, 1])})`,
          padding: "28px 60px", borderRadius: 999,
          background: "linear-gradient(135deg, #f0c36a 0%, #d4aa50 100%)",
          color: "#0a0f24", fontWeight: 900, fontSize: 42, letterSpacing: 2,
          boxShadow: "0 20px 50px rgba(212,170,80,0.5)",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          GET IT ON GOOGLE PLAY
          <span style={{ fontSize: 46, transform: `translateY(${arrowBob}px)`, display: "inline-block" }}>↓</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- Main ----------
// Total ~20s (600 frames @ 30fps)
const P1 = 78;   // 2.6s hook (covers user's vo-hook audio ~2.5s)
const P2 = 120;  // 4s reveal
const P3 = 210;  // 7s feature (3 verses x 70f)
const P4 = 120;  // 4s impact
const PC = 72;   // 2.4s CTA
export const PRAYLY_PITCH_DURATION = P1 + P2 + P3 + P4 + PC; // 600 frames = 20s

export const PraylyPitchAd: React.FC<z.infer<typeof praylyPitchSchema>> = ({ verses, backgrounds, audioTrack }) => {
  const VERSES = verses && verses.length >= 3 ? verses.slice(0, 3) : FALLBACK_VERSES.slice(0, 3);
  const BGS = backgrounds && backgrounds.length >= 3 ? backgrounds.slice(0, 3) : FALLBACK_BGS.slice(0, 3);
  const music = audioTrack ?? "ReelAudio-1283.mp3";

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Voiceover hook plays at the very start */}
      <Sequence from={0} durationInFrames={P1}>
        <Audio src={staticFile("audio/vo-hook.wav")} volume={1} />
      </Sequence>

      {/* Background music ducks under VO, then comes up */}
      <AudioLoop durationInFrames={PRAYLY_PITCH_DURATION}>
        <Audio
          src={staticFile(`audio/${music}`)}
          volume={(f) => {
            if (f < P1 - 8) return 0.15;
            if (f < P1 + 10) return 0.15 + ((f - (P1 - 8)) / 18) * 0.4;
            return 0.55;
          }}
        />
      </AudioLoop>

      <Sequence from={0} durationInFrames={P1}>
        <Part1Hook />
      </Sequence>

      <Sequence from={P1} durationInFrames={P2}>
        <Part2Reveal verse={VERSES[0]} bg={BGS[0]} />
      </Sequence>

      <Sequence from={P1 + P2} durationInFrames={P3}>
        <Part3Feature verses={VERSES} backgrounds={BGS} />
      </Sequence>

      <Sequence from={P1 + P2 + P3} durationInFrames={P4}>
        <Part4Impact />
      </Sequence>

      <Sequence from={P1 + P2 + P3 + P4} durationInFrames={PC}>
        <PartCta />
      </Sequence>
    </AbsoluteFill>
  );
};
