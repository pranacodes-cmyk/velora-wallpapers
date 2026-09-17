// Meta App-Features ad — phone-mockup driven showcase of Prayly's three
// core features (Daily Verse on Lockscreen, Bible Companion Chat, Live Wallpapers).
// 22s @ 30fps = 660 frames. 1080×1920 vertical.
//
// Each variant chooses which feature to lead with; copy + scene order changes.
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

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// ───────────── Schema ─────────────
export const metaAppFeaturesSchema = z.object({
  variant: z.enum(["daily-verse", "bible-chat", "live-wallpaper", "combo"]).optional(),
  audioTrack: z.string().optional(),
  copy: z.object({
    hookLine1: z.string(),
    hookLine2: z.string(),
    featureKicker: z.string(),
    featureLine1: z.string(),
    featureLine2: z.string(),
    promiseLine1: z.string(),
    promiseLine2: z.string(),
  }).optional(),
  wallpapers: z.array(z.string()).optional(),
  verse: z.object({ text: z.string(), reference: z.string() }).optional(),
  chat: z.array(z.object({ role: z.enum(["user","ai"]), text: z.string() })).optional(),
});

const DEFAULTS = {
  copy: {
    hookLine1: "Three ways God",
    hookLine2: "meets you on your phone.",
    featureKicker: "Inside Prayly",
    featureLine1: "Verses. Prayers. His presence —",
    featureLine2: "every time you pick up your phone.",
    promiseLine1: "Let Him be the first thing you see.",
    promiseLine2: "And the last voice you hear tonight.",
  },
  verse: {
    text: "Cast all your anxiety on Him because He cares for you.",
    reference: "1 Peter 5:7",
  },
  chat: [
    { role: "user" as const, text: "I'm anxious tonight. I can't sleep." },
    { role: "ai" as const,   text: "Let's pray. Father, quiet the noise in this heart. Remind them You are near, even now. \"Be still, and know that I am God.\" — Psalm 46:10" },
  ],
  wallpapers: [
    "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
    "daily-verse-bg/bg-cross-dawn-rays.jpg",
    "daily-verse-bg/bg-jesus-water-moon.jpg",
    "daily-verse-bg/bg-jesus-risen-angels.jpg",
  ],
};

// ───────────── Chrome ─────────────
const GOLD = "#f0c36a";
const GOLD_DEEP = "#d4aa50";
const BG_DEEP = "#0a0f24";

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.1, zIndex: 90 }}>
      <svg width="100%" height="100%">
        <filter id={`gn${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#gn${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ opacity?: number }> = ({ opacity = 0.55 }) => (
  <AbsoluteFill style={{
    background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.9) 100%)",
    pointerEvents: "none", opacity, zIndex: 80,
  }} />
);

const CenterCaption: React.FC<{
  kicker?: string;
  line1: string;
  line2?: string;
  opacity: number;
  accent?: boolean;
}> = ({ kicker, line1, line2, opacity, accent }) => (
  <AbsoluteFill style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 80px", zIndex: 70, opacity,
  }}>
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse 75% 35% at center, rgba(0,0,0,0.6), transparent 70%)",
    }} />
    <div style={{ position: "relative", textAlign: "center", color: "#fff" }}>
      {kicker && (
        <div style={{
          fontFamily: INTER, fontWeight: 500, fontSize: 26,
          letterSpacing: 10, textTransform: "uppercase",
          color: GOLD, marginBottom: 26,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}>
          {kicker}
        </div>
      )}
      <div style={{
        fontFamily: INTER, fontWeight: 700,
        fontSize: 84, lineHeight: 1.1, letterSpacing: -1.5,
        color: accent ? GOLD : "#fff",
        textShadow: "0 6px 30px rgba(0,0,0,0.85)",
      }}>
        {line1}
      </div>
      {line2 && (
        <div style={{
          marginTop: 18,
          fontFamily: INTER, fontWeight: 300,
          fontSize: 40, lineHeight: 1.28, color: "#e8d9b8",
          textShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}>
          {line2}
        </div>
      )}
    </div>
  </AbsoluteFill>
);

// ───────────── Phone Frame ─────────────
// A centered iPhone-ish frame at 720×1480, rounded, with a dynamic island.
const PhoneFrame: React.FC<{
  children: React.ReactNode;
  scale?: number;
  yOffset?: number;
  showHand?: boolean;
}> = ({ children, scale = 1, yOffset = 0 }) => {
  const W = 720;
  const H = 1480;
  return (
    <AbsoluteFill style={{
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: W, height: H, borderRadius: 80,
        background: "#0a0a12",
        padding: 14,
        boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(240,195,106,0.18), inset 0 0 0 1px rgba(255,255,255,0.05)",
        transform: `translateY(${yOffset}px) scale(${scale})`,
        position: "relative",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 68,
          overflow: "hidden", position: "relative",
          background: "#000",
        }}>
          {children}
          {/* Dynamic island */}
          <div style={{
            position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
            width: 200, height: 36, borderRadius: 22, background: "#000",
            zIndex: 50,
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PhoneStatusBar: React.FC = () => (
  <div style={{
    position: "absolute", top: 24, left: 0, right: 0, height: 36,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 50px", color: "#fff", fontFamily: INTER, fontSize: 22, fontWeight: 600,
    zIndex: 60,
  }}>
    <span>9:41</span>
    <span style={{ letterSpacing: 3, fontSize: 18, opacity: 0.9 }}>5G  100%</span>
  </div>
);

// ───────────── Scene: Hook (3s, 90f) ─────────────
const SceneHook: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [6, 24, 75, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const glow = interpolate(f, [0, 90], [0.12, 0.22]);
  return (
    <AbsoluteFill style={{ background: BG_DEEP }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 45%, rgba(240,195,106,${glow}) 0%, rgba(20,15,40,0.4) 45%, #000 100%)`,
      }} />
      {/* tiny stars */}
      {Array.from({ length: 50 }).map((_, i) => {
        const x = random(`hx${i}`) * 1080;
        const y = random(`hy${i}`) * 1920;
        const s = random(`hs${i}`) * 2 + 1;
        const tw = 0.3 + Math.sin(f / 14 + i) * 0.25;
        return <div key={i} style={{
          position: "absolute", left: x, top: y, width: s, height: s,
          borderRadius: 999, background: "#fff", opacity: tw,
        }} />;
      })}
      <CenterCaption line1={line1} line2={line2} opacity={o} />
    </AbsoluteFill>
  );
};

// ───────────── Phone Screen: Daily Verse Lockscreen ─────────────
const DailyVerseScreen: React.FC<{ bg: string; verse: { text: string; reference: string }; localF: number }> = ({ bg, verse, localF }) => {
  const cardO = interpolate(localF, [10, 36], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(localF, [10, 36], [22, 0], { extrapolateRight: "clamp" });
  const kb = 1 + Math.min(localF, 180) / 180 * 0.06;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.85) 100%)" }} />
      <PhoneStatusBar />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: "#fff", fontFamily: INTER }}>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: 3, opacity: 0.9, textTransform: "uppercase" }}>
          Monday, March 3
        </div>
        <div style={{ fontSize: 170, fontWeight: 200, letterSpacing: -6, lineHeight: 1, marginTop: 4 }}>
          7:14
        </div>
      </div>
      {/* Verse card */}
      <div style={{
        position: "absolute", left: 40, right: 40, bottom: 180,
        padding: "32px 32px 36px",
        borderRadius: 28,
        background: "rgba(10,15,36,0.62)",
        border: "1.5px solid rgba(212,170,80,0.55)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        opacity: cardO, transform: `translateY(${cardY}px)`,
        fontFamily: INTER,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 999,
          background: "rgba(212,170,80,0.18)",
          border: "1px solid rgba(212,170,80,0.55)",
          color: GOLD, fontSize: 16, fontWeight: 800, letterSpacing: 3,
          textTransform: "uppercase", marginBottom: 18,
        }}>✦ Today's Verse</div>
        <div style={{ color: "#fff", fontSize: 38, lineHeight: 1.22, fontWeight: 600, letterSpacing: -0.3 }}>
          &ldquo;{verse.text}&rdquo;
        </div>
        <div style={{ marginTop: 16, color: GOLD, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>
          — {verse.reference}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Phone Screen: Bible Companion Chat ─────────────
const ChatScreen: React.FC<{ messages: { role: "user"|"ai"; text: string }[]; localF: number }> = ({ messages, localF }) => {
  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0e1530 0%, #181227 100%)",
    }}>
      <PhoneStatusBar />
      {/* Header */}
      <div style={{
        position: "absolute", top: 80, left: 0, right: 0,
        padding: "20px 32px",
        display: "flex", alignItems: "center", gap: 16,
        borderBottom: "1px solid rgba(240,195,106,0.18)",
        fontFamily: INTER,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999,
          background: "linear-gradient(135deg, #f0c36a, #d4aa50)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, boxShadow: "0 0 24px rgba(240,195,106,0.5)",
        }}>✦</div>
        <div>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>Bible Companion</div>
          <div style={{ color: GOLD, fontSize: 18, fontWeight: 500, letterSpacing: 1 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "#7cd992", marginRight: 8 }} />
            Always with you
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ position: "absolute", top: 200, left: 0, right: 0, padding: "0 28px", fontFamily: INTER }}>
        {messages.map((m, i) => {
          const start = 12 + i * 60; // staggered
          const o = interpolate(localF, [start, start + 18], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const y = interpolate(localF, [start, start + 18], [16, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const isUser = m.role === "user";
          return (
            <div key={i} style={{
              display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
              marginBottom: 22, opacity: o, transform: `translateY(${y}px)`,
            }}>
              <div style={{
                maxWidth: "82%",
                padding: "20px 24px",
                borderRadius: 26,
                background: isUser
                  ? "linear-gradient(135deg, #f0c36a, #d4aa50)"
                  : "rgba(255,255,255,0.06)",
                border: isUser ? "none" : "1px solid rgba(240,195,106,0.22)",
                color: isUser ? "#0a0f24" : "#fff",
                fontSize: 26, lineHeight: 1.4, fontWeight: isUser ? 600 : 400,
                boxShadow: isUser ? "0 10px 30px rgba(240,195,106,0.35)" : "0 6px 20px rgba(0,0,0,0.4)",
              }}>
                {m.text}
              </div>
            </div>
          );
        })}

        {/* Typing indicator after last user msg before AI msg */}
        {(() => {
          const aiStart = 12 + 1 * 60;
          const typingO = interpolate(localF, [aiStart - 24, aiStart - 8, aiStart, aiStart + 6], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div style={{ display: "flex", justifyContent: "flex-start", opacity: typingO, marginTop: -8 }}>
              <div style={{
                padding: "16px 22px", borderRadius: 22,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(240,195,106,0.22)",
                display: "flex", gap: 8,
              }}>
                {[0, 1, 2].map((i) => {
                  const bo = 0.4 + Math.sin((localF + i * 6) / 4) * 0.4;
                  return <div key={i} style={{ width: 10, height: 10, borderRadius: 999, background: GOLD, opacity: bo }} />;
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Input bar */}
      <div style={{
        position: "absolute", bottom: 50, left: 28, right: 28,
        padding: "18px 22px", borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(240,195,106,0.25)",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: INTER, color: "rgba(255,255,255,0.5)", fontSize: 22,
      }}>
        <span style={{ flex: 1 }}>Tell Him what's on your heart…</span>
        <div style={{
          width: 50, height: 50, borderRadius: 999,
          background: "linear-gradient(135deg, #f0c36a, #d4aa50)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#0a0f24", fontSize: 22, fontWeight: 800,
        }}>↑</div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Phone Screen: Live Wallpaper Feed ─────────────
const LiveFeedScreen: React.FC<{ wallpapers: string[]; localF: number }> = ({ wallpapers, localF }) => {
  // 3 wallpapers, swipe through one per ~60 frames
  const perWp = 70;
  const idx = Math.min(wallpapers.length - 1, Math.floor(localF / perWp));
  const within = localF - idx * perWp;
  const trans = interpolate(within, [0, 18], [80, 0], { extrapolateRight: "clamp" });
  const o = interpolate(within, [0, 14, perWp - 12, perWp], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kb = 1 + within / perWp * 0.05;

  // Heart pop when settling
  const heartPop = spring({ frame: Math.max(0, within - 22), fps: 30, config: { damping: 9, stiffness: 180 } });
  const heartO = interpolate(within, [22, 32, perWp - 6, perWp], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bg = wallpapers[idx] ?? wallpapers[0];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${trans}px) scale(${kb})`, opacity: o }}>
        <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.85) 100%)" }} />
      </AbsoluteFill>

      <PhoneStatusBar />

      {/* Top "LIVE" pill */}
      <div style={{
        position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)",
        padding: "8px 22px", borderRadius: 999,
        background: "rgba(10,15,36,0.55)",
        border: "1px solid rgba(240,195,106,0.5)",
        color: GOLD, fontFamily: INTER, fontWeight: 800, fontSize: 18,
        letterSpacing: 3, textTransform: "uppercase",
        backdropFilter: undefined,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: 999, background: "#ff5b5b",
          boxShadow: "0 0 12px #ff5b5b",
        }} /> Live · Jesus
      </div>

      {/* Right action rail */}
      <div style={{
        position: "absolute", right: 30, bottom: 240,
        display: "flex", flexDirection: "column", gap: 28, alignItems: "center",
        fontFamily: INTER,
      }}>
        {[
          { icon: "♡", label: "Save", pop: heartPop, fill: heartO > 0.3 },
          { icon: "✦", label: "Apply" },
          { icon: "↗", label: "Share" },
        ].map((b, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 70, height: 70, borderRadius: 999,
              background: b.fill ? "linear-gradient(135deg, #ff6b8a, #ff4d6d)" : "rgba(10,15,36,0.55)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 32,
              transform: b.pop !== undefined ? `scale(${1 + b.pop * 0.25})` : undefined,
              boxShadow: b.fill ? "0 0 24px rgba(255,90,120,0.55)" : "none",
            }}>{b.icon}</div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{b.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom caption */}
      <div style={{
        position: "absolute", left: 32, right: 130, bottom: 90,
        color: "#fff", fontFamily: INTER,
        textShadow: "0 2px 12px rgba(0,0,0,0.8)",
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>Risen King ✦</div>
        <div style={{ fontSize: 20, fontWeight: 400, opacity: 0.85, marginTop: 6 }}>
          A living wallpaper for your screen.
        </div>
      </div>

      {/* Swipe-up hint */}
      {idx < wallpapers.length - 1 && within > perWp - 22 && (
        <div style={{
          position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.65)", fontFamily: INTER, fontSize: 18, letterSpacing: 2,
        }}>↑ swipe</div>
      )}
    </AbsoluteFill>
  );
};

// ───────────── Phone scene wrapper ─────────────
const PhoneScene: React.FC<{
  kicker: string;
  caption: string;
  children: (localF: number) => React.ReactNode;
}> = ({ kicker, caption, children }) => {
  const f = useCurrentFrame();
  const enter = spring({ frame: f, fps: 30, config: { damping: 18, stiffness: 90 } });
  const scale = interpolate(enter, [0, 1], [0.88, 0.7]); // phone sits a bit smaller to leave caption room
  const drift = Math.sin(f / 60) * 6;
  const capO = interpolate(f, [12, 32], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG_DEEP }}>
      {/* atmosphere */}
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at 50% 50%, rgba(240,195,106,0.18) 0%, rgba(20,15,40,0.4) 45%, #000 100%)",
      }} />
      <PhoneFrame scale={scale} yOffset={drift - 60}>
        {children(f)}
      </PhoneFrame>

      {/* Caption above phone */}
      <div style={{
        position: "absolute", top: 90, left: 0, right: 0, textAlign: "center",
        fontFamily: INTER, opacity: capO, zIndex: 70, padding: "0 60px",
      }}>
        <div style={{
          color: GOLD, fontSize: 24, fontWeight: 600, letterSpacing: 8,
          textTransform: "uppercase", marginBottom: 12,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}>{kicker}</div>
        <div style={{
          color: "#fff", fontSize: 50, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5,
          textShadow: "0 4px 20px rgba(0,0,0,0.85)",
        }}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Promise + CTA ─────────────
const ScenePromise: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 18, 75, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const glow = interpolate(f, [0, 90], [0.12, 0.22]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 50%, rgba(240,195,106,${glow}) 0%, transparent 60%)`,
      }} />
      <CenterCaption line1={line1} line2={line2} opacity={o} accent />
    </AbsoluteFill>
  );
};

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
          const x = random(`cx${i}`) * 1080;
          const y = random(`cy${i}`) * 1920;
          const s = random(`cs${i}`) * 2 + 1;
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
          fontFamily: INTER,
        }}>
          PRAYLY
        </div>
        <div style={{
          marginTop: 14, opacity: subO, color: "#e8d9b8",
          fontWeight: 400, fontSize: 26, letterSpacing: 8, textTransform: "uppercase", textAlign: "center",
          fontFamily: INTER,
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
          fontFamily: INTER,
        }}>
          DOWNLOAD FREE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────── Timing ─────────────
// 22s total: hook 75f, feat1 165f, feat2 165f, feat3 135f, promise 75f, cta 45f = 660
const S_HOOK = 75;
const S_F1 = 165;
const S_F2 = 165;
const S_F3 = 135;
const S_PROMISE = 75;
const S_CTA = 45;
export const META_APP_FEATURES_DURATION = S_HOOK + S_F1 + S_F2 + S_F3 + S_PROMISE + S_CTA; // 660

// ───────────── Main ─────────────
type Variant = "daily-verse" | "bible-chat" | "live-wallpaper" | "combo";

export const MetaAppFeaturesAd: React.FC<z.infer<typeof metaAppFeaturesSchema>> = (props) => {
  const variant: Variant = props.variant ?? "combo";
  const C = { ...DEFAULTS.copy, ...(props.copy ?? {}) };
  const verse = props.verse ?? DEFAULTS.verse;
  const chat = props.chat ?? DEFAULTS.chat;
  const wallpapers = props.wallpapers ?? DEFAULTS.wallpapers;
  const music = props.audioTrack ?? "ReelAudio-10281.mp3";

  // Build the 3 feature scenes in an order determined by variant
  const verseScene = {
    key: "verse" as const,
    kicker: "Daily Verse",
    caption: "Wake up to His Word.",
    render: (lf: number) => <DailyVerseScreen bg={wallpapers[0]} verse={verse} localF={lf} />,
  };
  const chatScene = {
    key: "chat" as const,
    kicker: "Bible Companion",
    caption: "Tell Him anything. He'll answer with Scripture.",
    render: (lf: number) => <ChatScreen messages={chat} localF={lf} />,
  };
  const liveScene = {
    key: "live" as const,
    kicker: "Live Wallpapers",
    caption: "A moving testimony — right on your home screen.",
    render: (lf: number) => <LiveFeedScreen wallpapers={wallpapers.slice(0, 3)} localF={lf} />,
  };

  const order =
    variant === "daily-verse" ? [verseScene, chatScene, liveScene] :
    variant === "bible-chat"  ? [chatScene, verseScene, liveScene] :
    variant === "live-wallpaper" ? [liveScene, verseScene, chatScene] :
    [verseScene, chatScene, liveScene];

  let cursor = 0;
  const at = (dur: number) => { const v = cursor; cursor += dur; return v; };

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: INTER }}>
      <Audio
        src={staticFile(`audio/${music}`)}
        volume={(fr) => {
          if (fr < 8) return interpolate(fr, [0, 8], [0, 0.85]);
          if (fr > META_APP_FEATURES_DURATION - 30) return interpolate(fr, [META_APP_FEATURES_DURATION - 30, META_APP_FEATURES_DURATION], [0.85, 0]);
          return 0.85;
        }}
      />

      <Sequence from={at(S_HOOK)} durationInFrames={S_HOOK}>
        <SceneHook line1={C.hookLine1} line2={C.hookLine2} />
      </Sequence>

      <Sequence from={at(S_F1)} durationInFrames={S_F1}>
        <PhoneScene kicker={order[0].kicker} caption={order[0].caption}>
          {(lf) => order[0].render(lf)}
        </PhoneScene>
      </Sequence>

      <Sequence from={at(S_F2)} durationInFrames={S_F2}>
        <PhoneScene kicker={order[1].kicker} caption={order[1].caption}>
          {(lf) => order[1].render(lf)}
        </PhoneScene>
      </Sequence>

      <Sequence from={at(S_F3)} durationInFrames={S_F3}>
        <PhoneScene kicker={order[2].kicker} caption={order[2].caption}>
          {(lf) => order[2].render(lf)}
        </PhoneScene>
      </Sequence>

      <Sequence from={at(S_PROMISE)} durationInFrames={S_PROMISE}>
        <ScenePromise line1={C.promiseLine1} line2={C.promiseLine2} />
      </Sequence>

      <Sequence from={at(S_CTA)} durationInFrames={S_CTA}>
        <SceneCta />
      </Sequence>

      <Vignette opacity={0.45} />
      <Grain />
    </AbsoluteFill>
  );
};
