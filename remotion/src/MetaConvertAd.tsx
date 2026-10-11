// Meta CONVERT ad — direct-response, UGC-style.
// 15s @ 30fps = 450 frames, 1080×1920.
// Built for the scroll: 1s hard hook → demo → social proof → hammer CTA.
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
  weights: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const metaConvertSchema = z.object({
  variant: z.enum(["pov-lockscreen", "stop-scroll", "testimonial", "before-after"]).optional(),
  audioTrack: z.string().optional(),
  hook: z.string().optional(),
  hookSub: z.string().optional(),
  verse: z.object({ text: z.string(), reference: z.string() }).optional(),
  bg: z.string().optional(),
  testimonials: z.array(z.object({ name: z.string(), handle: z.string(), text: z.string() })).optional(),
});

export const META_CONVERT_DURATION = 450; // 15s

const GOLD = "#f0c36a";
const GOLD_DEEP = "#d4aa50";
const BG_DEEP = "#0a0f24";

// ───────────── Phone frame (vertical iPhone) ─────────────
const PhoneFrame: React.FC<{ children: React.ReactNode; scale?: number; yOffset?: number; tilt?: number }> = ({
  children, scale = 1, yOffset = 0, tilt = 0,
}) => {
  const W = 720, H = 1480;
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: W, height: H, borderRadius: 80, background: "#0a0a12", padding: 14,
        boxShadow: "0 60px 140px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(240,195,106,0.22), inset 0 0 0 1px rgba(255,255,255,0.05)",
        transform: `translateY(${yOffset}px) scale(${scale}) rotate(${tilt}deg)`,
        position: "relative",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 68, overflow: "hidden", position: "relative", background: "#000" }}>
          {children}
          <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", width: 200, height: 36, borderRadius: 22, background: "#000", zIndex: 50 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StatusBar: React.FC = () => (
  <div style={{
    position: "absolute", top: 24, left: 0, right: 0, height: 36,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 50px", color: "#fff", fontFamily: INTER, fontSize: 22, fontWeight: 600, zIndex: 60,
  }}>
    <span>9:41</span>
    <span style={{ letterSpacing: 3, fontSize: 18, opacity: 0.9 }}>5G  100%</span>
  </div>
);

// ───────────── Lockscreen with verse card ─────────────
const Lockscreen: React.FC<{ bg: string; verse: { text: string; reference: string }; localF: number }> = ({ bg, verse, localF }) => {
  const cardO = interpolate(localF, [6, 28], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(localF, [6, 28], [30, 0], { extrapolateRight: "clamp" });
  const kb = 1 + Math.min(localF, 240) / 240 * 0.08;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.85) 100%)" }} />
      <StatusBar />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: "#fff", fontFamily: INTER }}>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: 3, opacity: 0.9, textTransform: "uppercase" }}>Monday, March 3</div>
        <div style={{ fontSize: 170, fontWeight: 200, letterSpacing: -6, lineHeight: 1, marginTop: 4 }}>7:14</div>
      </div>
      <div style={{
        position: "absolute", left: 40, right: 40, bottom: 200,
        padding: "32px 32px 36px", borderRadius: 28,
        background: "rgba(10,15,36,0.65)",
        border: "1.5px solid rgba(212,170,80,0.6)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        opacity: cardO, transform: `translateY(${cardY}px)`, fontFamily: INTER,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 999,
          background: "rgba(212,170,80,0.2)", border: "1px solid rgba(212,170,80,0.55)",
          color: GOLD, fontSize: 16, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", marginBottom: 18,
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

// ───────────── Big arrow + handwritten label pointing at phone ─────────────
const PointerLabel: React.FC<{ text: string; opacity: number; x: number; y: number; rotate?: number }> = ({ text, opacity, x, y, rotate = -6 }) => (
  <div style={{
    position: "absolute", left: x, top: y, opacity, transform: `rotate(${rotate}deg)`, zIndex: 70,
    fontFamily: INTER, fontWeight: 900, color: "#fff7e0", fontSize: 56, lineHeight: 1.05,
    textShadow: "0 4px 18px rgba(0,0,0,0.85), 0 0 30px rgba(240,195,106,0.4)",
    background: "rgba(240,195,106,0.95)", color2: "#0a0f24",
    padding: "16px 26px", borderRadius: 18, color: "#0a0f24",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
    border: "3px solid #fff",
  }}>{text}</div>
);

// ───────────── HUGE thumb-stopping caption ─────────────
const BigCaption: React.FC<{
  line1: string; line2?: string; opacity: number; yOffset?: number; highlight?: string;
}> = ({ line1, line2, opacity, yOffset = 0, highlight }) => (
  <AbsoluteFill style={{
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    paddingTop: 140, padding: "140px 60px 0", zIndex: 75, opacity,
    transform: `translateY(${yOffset}px)`,
  }}>
    <div style={{ textAlign: "center", color: "#fff", fontFamily: INTER }}>
      <div style={{
        fontWeight: 900, fontSize: 110, lineHeight: 0.98, letterSpacing: -3,
        textShadow: "0 6px 24px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)",
        textTransform: "uppercase",
      }}>
        {line1}
      </div>
      {line2 && (
        <div style={{
          marginTop: 18,
          fontWeight: 800, fontSize: 64, lineHeight: 1.08, letterSpacing: -1,
          color: highlight ? GOLD : "#fff7e0",
          textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        }}>
          {line2}
        </div>
      )}
    </div>
  </AbsoluteFill>
);

// ───────────── Testimonial card (UGC tweet-style) ─────────────
const TestimonialCard: React.FC<{ name: string; handle: string; text: string; delay: number; localF: number }> = ({
  name, handle, text, delay, localF,
}) => {
  const sp = spring({ frame: localF - delay, fps: 30, config: { damping: 14, stiffness: 130 } });
  const o = interpolate(localF, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(sp, [0, 1], [40, 0]);
  return (
    <div style={{
      opacity: o, transform: `translateY(${y}px)`,
      background: "#fff", borderRadius: 28, padding: "26px 28px",
      boxShadow: "0 24px 60px rgba(0,0,0,0.5)", fontFamily: INTER,
      border: "1px solid rgba(0,0,0,0.06)", marginBottom: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#0a0f24", fontWeight: 900, fontSize: 28,
        }}>{name[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#0a0f24", fontWeight: 800, fontSize: 28 }}>{name}</div>
          <div style={{ color: "#7b8aa3", fontWeight: 500, fontSize: 20 }}>{handle}</div>
        </div>
        <div style={{ color: "#f4b400", fontSize: 28, letterSpacing: 2 }}>★★★★★</div>
      </div>
      <div style={{ color: "#1a2342", fontSize: 30, lineHeight: 1.35, fontWeight: 500 }}>
        {text}
      </div>
    </div>
  );
};

// ───────────── Final CTA card (Play Store hammer) ─────────────
const CTACard: React.FC<{ localF: number }> = ({ localF }) => {
  const sp = spring({ frame: localF, fps: 30, config: { damping: 12, stiffness: 110 } });
  const scale = interpolate(sp, [0, 1], [0.85, 1]);
  const o = interpolate(localF, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(localF / 8) * 0.025;
  return (
    <AbsoluteFill style={{
      background: "radial-gradient(ellipse at 50% 40%, #1a2452 0%, #06091a 70%, #000 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      padding: 80,
    }}>
      {/* radial gold glow */}
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 38%, rgba(240,195,106,${0.25 + Math.sin(localF / 12) * 0.06}) 0%, transparent 55%)`,
      }} />

      {/* App icon */}
      <div style={{
        opacity: o, transform: `scale(${scale * pulse})`,
        width: 280, height: 280, borderRadius: 64,
        background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
        boxShadow: "0 40px 100px rgba(240,195,106,0.55), inset 0 2px 0 rgba(255,255,255,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: INTER, fontWeight: 900, color: "#0a0f24", fontSize: 180, marginBottom: 50,
        position: "relative",
      }}>
        ✝
      </div>

      <div style={{
        opacity: o, fontFamily: INTER, fontWeight: 900, color: "#fff",
        fontSize: 96, letterSpacing: -2, lineHeight: 0.95, textAlign: "center",
        textShadow: "0 4px 18px rgba(0,0,0,0.6)",
      }}>
        Prayly
      </div>
      <div style={{
        opacity: o, fontFamily: INTER, fontWeight: 500, color: "#e8d9b8",
        fontSize: 34, letterSpacing: 1, marginTop: 14, textAlign: "center",
      }}>
        Bible Prayer & Verse
      </div>

      {/* Stars + count */}
      <div style={{
        opacity: o, marginTop: 32, display: "flex", alignItems: "center", gap: 18,
        fontFamily: INTER,
      }}>
        <span style={{ color: "#f4b400", fontSize: 44, letterSpacing: 3 }}>★★★★★</span>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 36 }}>4.9</span>
        <span style={{ color: "#9caac4", fontWeight: 500, fontSize: 28 }}>· 1M+ believers</span>
      </div>

      {/* Free CTA pill */}
      <div style={{
        opacity: o, marginTop: 60,
        background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
        padding: "30px 64px", borderRadius: 999,
        boxShadow: "0 24px 60px rgba(240,195,106,0.55), inset 0 2px 0 rgba(255,255,255,0.4)",
        fontFamily: INTER, fontWeight: 900, color: "#0a0f24", fontSize: 52,
        letterSpacing: 2, textTransform: "uppercase",
        transform: `scale(${pulse})`,
      }}>
        Download Free ↓
      </div>
      <div style={{
        opacity: o, marginTop: 24, fontFamily: INTER, color: "#9caac4",
        fontWeight: 600, fontSize: 28, letterSpacing: 3, textTransform: "uppercase",
      }}>
        On Google Play
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Doom-scroll fake feed (for before-after) ─────────────
const DoomScroll: React.FC<{ localF: number }> = ({ localF }) => {
  const shake = Math.sin(localF / 1.5) * 6;
  const scroll = -localF * 28;
  const posts = [
    { color: "#ff4d6d", h: 280 }, { color: "#3a86ff", h: 320 }, { color: "#8338ec", h: 260 },
    { color: "#fb5607", h: 340 }, { color: "#06d6a0", h: 290 }, { color: "#ef476f", h: 310 },
    { color: "#118ab2", h: 270 }, { color: "#ffd166", h: 300 },
  ];
  return (
    <AbsoluteFill style={{ background: "#0a0a12" }}>
      <StatusBar />
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, padding: "0 24px", transform: `translateY(${scroll}px) translateX(${shake}px)` }}>
        {posts.map((p, i) => (
          <div key={i} style={{
            marginBottom: 24, padding: 22, borderRadius: 28,
            background: "#15162b", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, background: p.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 18, width: 180, background: "rgba(255,255,255,0.18)", borderRadius: 6 }} />
                <div style={{ marginTop: 8, height: 14, width: 110, background: "rgba(255,255,255,0.08)", borderRadius: 6 }} />
              </div>
            </div>
            <div style={{ height: p.h, borderRadius: 20, background: `linear-gradient(135deg, ${p.color}40, ${p.color}80)` }} />
            <div style={{ marginTop: 16, height: 14, background: "rgba(255,255,255,0.1)", borderRadius: 6, width: "80%" }} />
            <div style={{ marginTop: 8, height: 14, background: "rgba(255,255,255,0.1)", borderRadius: 6, width: "60%" }} />
          </div>
        ))}
      </div>
      {/* Red flash anxiety overlay */}
      <AbsoluteFill style={{
        background: "radial-gradient(circle, transparent 30%, rgba(220,30,30,0.18) 100%)",
        opacity: 0.5 + Math.sin(localF / 6) * 0.3,
      }} />
    </AbsoluteFill>
  );
};

// ───────────── Stars background ─────────────
const Stars: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const f = useCurrentFrame();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const x = random(`sx${i}`) * 1080;
        const y = random(`sy${i}`) * 1920;
        const s = random(`ss${i}`) * 2.2 + 0.8;
        const tw = 0.25 + Math.abs(Math.sin(f / 14 + i)) * 0.55;
        return <div key={i} style={{
          position: "absolute", left: x, top: y, width: s, height: s,
          borderRadius: 999, background: "#fff", opacity: tw,
        }} />;
      })}
    </>
  );
};

// ───────────── Audio with fades ─────────────
const Music: React.FC<{ track?: string }> = ({ track }) => {
  if (!track) return null;
  const { durationInFrames, fps } = useVideoConfig();
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return <Audio src={staticFile(`audio/${track}`)} volume={Math.min(fadeIn, fadeOut) * 0.7} />;
};

// ============================================================
// MAIN
// ============================================================
export const MetaConvertAd: React.FC<z.infer<typeof metaConvertSchema>> = (props) => {
  const variant = props.variant ?? "pov-lockscreen";
  const bg = props.bg ?? "daily-verse-bg/bg-jesus-mountain-sunrise.jpg";
  const verse = props.verse ?? { text: "Be still, and know that I am God.", reference: "Psalm 46:10" };
  const hook = props.hook ?? "STOP SCROLLING.";
  const hookSub = props.hookSub ?? "God has a word for you today.";
  const testimonials = props.testimonials ?? [
    { name: "Sarah M.", handle: "@sarah_m", text: "Wakes me up to a verse every morning. Game changer for my walk with God." },
    { name: "Marcus T.", handle: "@marcust", text: "I open my phone 100x a day. Now I see scripture every time. Highly recommend." },
    { name: "Grace K.", handle: "@gracek", text: "The Bible chat helped me through my hardest night this year. Free too." },
  ];

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: INTER }}>
      <Music track={props.audioTrack} />

      {variant === "pov-lockscreen" && <PovLockscreen bg={bg} verse={verse} hook={hook} hookSub={hookSub} />}
      {variant === "stop-scroll" && <StopScroll bg={bg} verse={verse} hook={hook} hookSub={hookSub} />}
      {variant === "testimonial" && <TestimonialReel bg={bg} verse={verse} testimonials={testimonials} />}
      {variant === "before-after" && <BeforeAfter bg={bg} verse={verse} />}
    </AbsoluteFill>
  );
};

// ───────────── Variant 1: POV Lockscreen ─────────────
const PovLockscreen: React.FC<{ bg: string; verse: any; hook: string; hookSub: string }> = ({ bg, verse, hook, hookSub }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ background: BG_DEEP }}>
          <Stars />
          <PhoneTilt bg={bg} verse={verse} />
          <HookOverlay hook={hook} sub={hookSub} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={90} durationInFrames={210}>
        <PhoneSettleScene bg={bg} verse={verse} />
      </Sequence>
      <Sequence from={300} durationInFrames={150}>
        <CTAWrapper />
      </Sequence>
    </>
  );
};

const CTAWrapper: React.FC = () => {
  const f = useCurrentFrame();
  return <CTACard localF={f} />;
};

const useCurrentFrameSafe = () => useCurrentFrame();

const PhoneTilt: React.FC<{ bg: string; verse: any }> = ({ bg, verse }) => {
  const f = useCurrentFrame();
  const tilt = interpolate(f, [0, 60], [-6, -4]);
  const scale = interpolate(f, [0, 60], [0.88, 0.92]);
  return (
    <PhoneFrame scale={scale} yOffset={20} tilt={tilt}>
      <Lockscreen bg={bg} verse={verse} localF={f} />
    </PhoneFrame>
  );
};

const HookOverlay: React.FC<{ hook: string; sub: string }> = ({ hook, sub }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [4, 14, 78, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const sp = spring({ frame: f - 4, fps: 30, config: { damping: 14, stiffness: 140 } });
  const scale = interpolate(sp, [0, 1], [1.15, 1]);
  return (
    <AbsoluteFill style={{ zIndex: 90, opacity: o, transform: `scale(${scale})` }}>
      <BigCaption line1={hook} line2={sub} opacity={1} highlight />
    </AbsoluteFill>
  );
};

const PhoneSettleScene: React.FC<{ bg: string; verse: any }> = ({ bg, verse }) => {
  const f = useCurrentFrame();
  const tilt = interpolate(f, [0, 30], [-4, 0], { extrapolateRight: "clamp" });
  const scale = interpolate(f, [0, 30], [0.92, 1], { extrapolateRight: "clamp" });
  const labelO = interpolate(f, [40, 60, 170, 200], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: BG_DEEP }}>
      <Stars count={40} />
      <PhoneFrame scale={scale} tilt={tilt}>
        <Lockscreen bg={bg} verse={verse} localF={f + 30} />
      </PhoneFrame>
      {/* Floating label */}
      <div style={{
        position: "absolute", top: 200, left: 60, zIndex: 80,
        opacity: labelO, transform: `rotate(-5deg)`,
        background: GOLD, color: "#0a0f24",
        padding: "18px 28px", borderRadius: 20,
        fontFamily: INTER, fontWeight: 900, fontSize: 42, letterSpacing: 1,
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)", border: "3px solid #fff",
      }}>
        on your lock screen ↓
      </div>
      <div style={{
        position: "absolute", bottom: 80, right: 60, zIndex: 80,
        opacity: labelO, transform: `rotate(4deg)`,
        background: "#fff", color: "#0a0f24",
        padding: "16px 26px", borderRadius: 20,
        fontFamily: INTER, fontWeight: 900, fontSize: 36, letterSpacing: 0.5,
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)", border: `3px solid ${GOLD}`,
      }}>
        auto-updates daily ✦
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Variant 2: STOP SCROLLING pattern interrupt ─────────────
const StopScroll: React.FC<{ bg: string; verse: any; hook: string; hookSub: string }> = ({ bg, verse, hook, hookSub }) => (
  <>
    {/* 0-30: WHITE flash + STOP */}
    <Sequence from={0} durationInFrames={30}>
      <FlashStop />
    </Sequence>
    {/* 30-120: Hook on dark + phone enters */}
    <Sequence from={30} durationInFrames={90}>
      <AbsoluteFill style={{ background: BG_DEEP }}>
        <Stars />
        <HookEnter hook={hook} sub={hookSub} />
      </AbsoluteFill>
    </Sequence>
    {/* 120-300: Phone demo */}
    <Sequence from={120} durationInFrames={180}>
      <PhoneShowcase bg={bg} verse={verse} />
    </Sequence>
    {/* 300-450 CTA */}
    <Sequence from={300} durationInFrames={150}>
      <CTAWrapper />
    </Sequence>
  </>
);

const FlashStop: React.FC = () => {
  const f = useCurrentFrame();
  const bgC = interpolate(f, [0, 6, 18, 30], [255, 255, 30, 10]);
  return (
    <AbsoluteFill style={{ background: `rgb(${bgC},${bgC},${bgC})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily: INTER, fontWeight: 900, fontSize: 200, color: "#0a0f24",
        letterSpacing: -6, transform: `scale(${interpolate(f, [0, 8], [0.7, 1])})`,
      }}>
        WAIT.
      </div>
    </AbsoluteFill>
  );
};

const HookEnter: React.FC<{ hook: string; sub: string }> = ({ hook, sub }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f, fps: 30, config: { damping: 14, stiffness: 130 } });
  const y = interpolate(sp, [0, 1], [40, 0]);
  const o = interpolate(f, [0, 12, 75, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px)` }}>
      <BigCaption line1={hook} line2={sub} opacity={1} highlight />
    </AbsoluteFill>
  );
};

const PhoneShowcase: React.FC<{ bg: string; verse: any }> = ({ bg, verse }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f, fps: 30, config: { damping: 16, stiffness: 110 } });
  const scale = interpolate(sp, [0, 1], [0.7, 0.95]);
  const labelO = interpolate(f, [30, 50, 150, 180], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: BG_DEEP }}>
      <Stars count={30} />
      <PhoneFrame scale={scale}>
        <Lockscreen bg={bg} verse={verse} localF={f} />
      </PhoneFrame>
      <div style={{
        position: "absolute", top: 90, left: "50%", transform: `translateX(-50%) rotate(-2deg)`,
        opacity: labelO, zIndex: 80,
        background: GOLD, color: "#0a0f24",
        padding: "20px 36px", borderRadius: 22,
        fontFamily: INTER, fontWeight: 900, fontSize: 48, letterSpacing: 1,
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)", border: "4px solid #fff",
        textTransform: "uppercase",
      }}>
        A new verse every day
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Variant 3: Testimonial Reel ─────────────
const TestimonialHook: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG_DEEP, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Stars />
      <div style={{ textAlign: "center", padding: "0 80px" }}>
        <div style={{
          fontFamily: INTER, fontWeight: 900, fontSize: 110, color: "#fff",
          letterSpacing: -3, lineHeight: 0.98, textShadow: "0 4px 18px rgba(0,0,0,0.8)",
          opacity: interpolate(f, [0, 10, 55, 60], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
        }}>
          1,000,000+
        </div>
        <div style={{
          marginTop: 18, fontFamily: INTER, fontWeight: 700, fontSize: 56, color: GOLD,
          opacity: interpolate(f, [10, 22, 55, 60], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
        }}>
          believers love Prayly
        </div>
        <div style={{
          marginTop: 8, fontFamily: INTER, fontWeight: 700, fontSize: 56, color: GOLD,
          opacity: interpolate(f, [14, 26, 55, 60], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
        }}>
          here's why ↓
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TestimonialReel: React.FC<{ bg: string; verse: any; testimonials: any[] }> = ({ bg, verse, testimonials }) => (
  <>
    <Sequence from={0} durationInFrames={60}><TestimonialHook /></Sequence>
    <Sequence from={60} durationInFrames={210}><TestimonialsScene testimonials={testimonials} /></Sequence>
    <Sequence from={260} durationInFrames={70}><PhoneShowcase bg={bg} verse={verse} /></Sequence>
    <Sequence from={330} durationInFrames={120}><CTAWrapper /></Sequence>
  </>
);


const TestimonialsScene: React.FC<{ testimonials: any[] }> = ({ testimonials }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0f24 0%, #131a3d 50%, #0a0f24 100%)", padding: "100px 60px 80px" }}>
      <Stars count={20} />
      {testimonials.slice(0, 3).map((t, i) => (
        <TestimonialCard key={i} {...t} delay={i * 38} localF={f} />
      ))}
    </AbsoluteFill>
  );
};

// ───────────── Variant 4: Before/After ─────────────
const BeforeAfter: React.FC<{ bg: string; verse: any }> = ({ bg, verse }) => (
  <>
    {/* 0-120 BEFORE: chaos */}
    <Sequence from={0} durationInFrames={120}>
      <BeforeScene />
    </Sequence>
    {/* 120-150 Transition flash */}
    <Sequence from={120} durationInFrames={30}>
      <TransitionFlash />
    </Sequence>
    {/* 150-330 AFTER: peace */}
    <Sequence from={150} durationInFrames={180}>
      <AfterScene bg={bg} verse={verse} />
    </Sequence>
    {/* 330-450 CTA */}
    <Sequence from={330} durationInFrames={120}>
      <CTAWrapper />
    </Sequence>
  </>
);

const BeforeScene: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0a0a12" }}>
      <PhoneFrame scale={0.85}>
        <DoomScroll localF={f} />
      </PhoneFrame>
      <div style={{
        position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", zIndex: 80,
        fontFamily: INTER, fontWeight: 900, fontSize: 100, color: "#ff4d6d",
        letterSpacing: -2, textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        opacity: interpolate(f, [4, 16, 110, 120], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
      }}>
        BEFORE
      </div>
      <div style={{
        position: "absolute", bottom: 110, left: 60, right: 60, textAlign: "center", zIndex: 80,
        fontFamily: INTER, fontWeight: 700, fontSize: 48, color: "#fff",
        textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        opacity: interpolate(f, [20, 32, 110, 120], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
      }}>
        Endless scroll. Empty heart.
      </div>
    </AbsoluteFill>
  );
};

const TransitionFlash: React.FC = () => {
  const f = useCurrentFrame();
  const b = interpolate(f, [0, 8, 22, 30], [10, 255, 240, 10]);
  return <AbsoluteFill style={{ background: `rgb(${b},${b * 0.95},${b * 0.7})` }} />;
};

const AfterScene: React.FC<{ bg: string; verse: any }> = ({ bg, verse }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG_DEEP }}>
      <Stars />
      <PhoneFrame scale={0.95}>
        <Lockscreen bg={bg} verse={verse} localF={f} />
      </PhoneFrame>
      <div style={{
        position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", zIndex: 80,
        fontFamily: INTER, fontWeight: 900, fontSize: 100, color: GOLD,
        letterSpacing: -2, textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        opacity: interpolate(f, [4, 16, 170, 180], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
      }}>
        AFTER
      </div>
      <div style={{
        position: "absolute", bottom: 90, left: 60, right: 60, textAlign: "center", zIndex: 80,
        fontFamily: INTER, fontWeight: 700, fontSize: 46, color: "#fff",
        textShadow: "0 4px 18px rgba(0,0,0,0.9)",
        opacity: interpolate(f, [20, 32, 170, 180], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
      }}>
        God's Word — first thing you see.
      </div>
    </AbsoluteFill>
  );
};
