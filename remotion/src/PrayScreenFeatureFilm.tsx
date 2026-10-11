import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: SERIF } = loadCormorant("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

export const PRAYSCREEN_FEATURE_DURATION = 450;

const C = {
  midnight: "#070b18",
  navy: "#0d1429",
  panel: "#121a31",
  gold: "#e9c46a",
  goldSoft: "#f6dfa2",
  ivory: "#f9f4e8",
  muted: "#aab2c7",
  green: "#6ad59b",
  red: "#ff453a",
};

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const fadeRange = (frame: number, start: number, end: number, outStart: number, outEnd: number) =>
  interpolate(frame, [start, end, outStart, outEnd], [0, 1, 1, 0], clamp);

const ShieldMark: React.FC<{ size?: number }> = ({ size = 70 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M50 7 84 20v27c0 23-13 38-34 47C29 85 16 70 16 47V20L50 7Z" fill="rgba(233,196,106,.12)" stroke={C.gold} strokeWidth="4" />
    <path d="M50 27v43M35 43h30" stroke={C.goldSoft} strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const StatusBar: React.FC<{ dark?: boolean }> = ({ dark = true }) => (
  <div style={{ position: "absolute", top: 19, left: 34, right: 34, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 80, color: dark ? C.ivory : "#101114", fontFamily: INTER, fontWeight: 700, fontSize: 18 }}>
    <span>9:41</span><span style={{ fontSize: 15, letterSpacing: 2 }}>● ◒ ▰</span>
  </div>
);

const TapPulse: React.FC<{ x: number; y: number; opacity: number; press: number }> = ({ x, y, opacity, press }) => (
  <div style={{ position: "absolute", left: x - 36, top: y - 36, width: 72, height: 72, opacity, zIndex: 100, pointerEvents: "none" }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `3px solid ${C.gold}`, transform: `scale(${interpolate(press, [0, 1], [.68, 1.35])})`, opacity: 1 - press * .72, boxShadow: `0 0 26px rgba(233,196,106,${.28 + press * .32})` }} />
    <div style={{ position: "absolute", left: 22, top: 22, width: 28, height: 28, borderRadius: 999, background: C.goldSoft, border: `4px solid ${C.midnight}`, transform: `scale(${interpolate(press, [0, .55, 1], [1, .72, .88])})`, boxShadow: "0 3px 12px rgba(0,0,0,.38)" }} />
  </div>
);

const AppIcon: React.FC<{ id: string; label: string; badge?: string }> = ({ id, label, badge }) => (
  <div style={{ width: 120, textAlign: "center", position: "relative", fontFamily: INTER }}>
    <div style={{ width: 78, height: 78, borderRadius: 19, overflow: "hidden", margin: "0 auto", boxShadow: "0 10px 28px rgba(0,0,0,.38)" }}>
      <Img src={staticFile(`social/${id}.svg`)} style={{ width: "100%", height: "100%" }} />
    </div>
    {badge && <div style={{ position: "absolute", top: -8, right: 10, minWidth: 31, height: 31, borderRadius: 999, background: C.red, border: `3px solid ${C.navy}`, color: "white", fontSize: 15, lineHeight: "25px", fontWeight: 900 }}>{badge}</div>}
    <div style={{ marginTop: 10, color: C.ivory, fontSize: 16, fontWeight: 600 }}>{label}</div>
  </div>
);

const Launcher: React.FC = () => {
  const frame = useCurrentFrame();
  const tap = spring({ frame: frame - 30, fps: 30, config: { damping: 20, stiffness: 210 }, durationInFrames: 18 });
  const fingerO = fadeRange(frame, 22, 28, 48, 56);
  const zoom = interpolate(frame, [40, 62], [1, 1.12], clamp);
  const apps = [["instagram", "Instagram", "12"], ["tiktok", "TikTok", "9"], ["youtube", "YouTube", ""], ["facebook", "Facebook", "4"], ["snapchat", "Snapchat", ""], ["x", "X", "18"]];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, #293454 0%, ${C.navy} 56%, #080b15 100%)`, transform: `scale(${zoom})` }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 75% 18%, rgba(233,196,106,.16), transparent 32%)" }} />
      <StatusBar />
      <div style={{ paddingTop: 110, textAlign: "center", color: C.ivory, fontFamily: INTER }}>
        <div style={{ fontSize: 64, fontWeight: 400, lineHeight: 1 }}>9:41</div>
        <div style={{ fontSize: 15, marginTop: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 3 }}>Wednesday · September 30</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: 62, padding: "105px 72px 0" }}>
        {apps.map(([id, label, badge], i) => <div key={id} style={{ transform: i === 0 ? `scale(${1 - tap * .08})` : undefined }}><AppIcon id={id} label={label} badge={badge || undefined} /></div>)}
      </div>
      <div style={{ position: "absolute", left: 54, right: 54, bottom: 48, height: 122, borderRadius: 38, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.1)", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
        {apps.slice(0, 4).map(([id]) => <Img key={id} src={staticFile(`social/${id}.svg`)} style={{ width: 66, height: 66, borderRadius: 16 }} />)}
      </div>
      <TapPulse x={128} y={330} opacity={fingerO} press={tap} />
    </AbsoluteFill>
  );
};

const GoldButton: React.FC<{ label: string; progress?: number }> = ({ label, progress = 0 }) => (
  <div style={{ height: 74, borderRadius: 38, border: `1.5px solid rgba(233,196,106,.75)`, background: progress > .5 ? C.gold : "rgba(7,11,24,.64)", boxShadow: "0 18px 45px rgba(0,0,0,.32)", color: progress > .5 ? C.midnight : C.goldSoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: INTER, fontWeight: 900, fontSize: 21, textTransform: "uppercase", letterSpacing: 2.5, position: "relative", overflow: "hidden" }}>
    {progress > 0 && <div style={{ position: "absolute", inset: 0, right: `${100 - progress * 100}%`, background: C.gold }} />}
    <span style={{ position: "relative" }}>{label}</span>
  </div>
);

const Blocker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 }, durationInFrames: 28 });
  const text = spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 24 });
  const tap = spring({ frame: frame - 38, fps, config: { damping: 18, stiffness: 220 }, durationInFrames: 16 });
  const fingerO = fadeRange(frame, 28, 34, 51, 58);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.navy}, ${C.midnight})`, fontFamily: INTER }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 30%, rgba(233,196,106,.18), transparent 40%)" }} />
      <StatusBar />
      <div style={{ margin: "auto", width: 500, textAlign: "center", color: C.ivory, transform: `translateY(${interpolate(enter, [0,1], [30,0])}px) scale(${.9 + enter * .1})`, opacity: enter }}>
        <div style={{ width: 146, height: 146, margin: "0 auto", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(233,196,106,.5)", background: "rgba(233,196,106,.07)", boxShadow: "0 0 70px rgba(233,196,106,.18)" }}><ShieldMark size={98}/></div>
        <div style={{ marginTop: 34, color: C.gold, fontSize: 18, fontWeight: 900, letterSpacing: 5, textTransform: "uppercase", opacity: text }}>Prayly Shield</div>
        <div style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.05, marginTop: 20, fontWeight: 600, opacity: text }}>Instagram can wait.</div>
        <div style={{ color: C.muted, fontSize: 22, lineHeight: 1.5, margin: "22px auto 0", width: 410, opacity: text }}>Before the feed takes over, give God one quiet moment.</div>
        <div style={{ marginTop: 54, transform: `scale(${1 - tap * .045})` }}><GoldButton label="Pray first" /></div>
      </div>
      <TapPulse x={306} y={846} opacity={fingerO} press={tap} />
    </AbsoluteFill>
  );
};

const Verse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 30 });
  return (
    <AbsoluteFill style={{ background: C.midnight, color: C.ivory }}>
      <Img src={staticFile("prayscreen/prayer-background.jpg")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, 70], [1.08, 1.02], clamp)})`, opacity: .62 }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,24,.35), rgba(7,11,24,.78) 44%, rgba(7,11,24,.97))" }} />
      <StatusBar />
      <div style={{ margin: "auto", width: 510, textAlign: "center", transform: `translateY(${interpolate(line,[0,1],[28,0])}px)`, opacity: line }}>
        <div style={{ color: C.gold, fontFamily: INTER, fontSize: 17, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase" }}>A word for this moment</div>
        <div style={{ fontFamily: SERIF, fontSize: 57, fontWeight: 600, lineHeight: 1.2, marginTop: 35, textShadow: "0 5px 25px rgba(0,0,0,.5)" }}>“Be still, and know that I am God.”</div>
        <div style={{ width: 58, height: 2, background: C.gold, margin: "34px auto 25px" }} />
        <div style={{ fontFamily: INTER, color: C.goldSoft, fontSize: 20, fontWeight: 800, letterSpacing: 3 }}>PSALM 46:10</div>
      </div>
    </AbsoluteFill>
  );
};

const Prayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 32 });
  const tap = spring({ frame: frame - 98, fps, config: { damping: 18, stiffness: 210 }, durationInFrames: 17 });
  const fingerO = fadeRange(frame, 85, 92, 114, 121);
  const complete = interpolate(frame, [99, 116], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.midnight, color: C.ivory }}>
      <Img src={staticFile("prayscreen/prayer-background.jpg")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, 145], [1.03, 1.0], clamp)})`, opacity: .72 }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,11,24,.3), rgba(7,11,24,.7) 36%, rgba(7,11,24,.98) 100%)" }} />
      <StatusBar />
      <div style={{ position: "absolute", left: 48, right: 48, top: 126, bottom: 54, display: "flex", flexDirection: "column", opacity: enter, transform: `translateY(${interpolate(enter,[0,1],[24,0])}px)` }}>
        <div style={{ textAlign: "center", color: C.gold, fontFamily: INTER, fontSize: 17, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase" }}>Pray with me</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: SERIF, fontSize: 43, fontWeight: 600, fontStyle: "italic", lineHeight: 1.35, textAlign: "center", textShadow: "0 5px 24px rgba(0,0,0,.65)" }}>“Jesus, settle the noise within me. Turn my attention toward Your presence. Give me wisdom over impulse, and let what I choose next bring peace—not emptiness.”</div>
        </div>
        <div style={{ transform: `scale(${1 - tap * .04})` }}><GoldButton label={complete > .65 ? "✓  Prayer complete" : "Amen · Open with intention"} progress={complete} /></div>
      </div>
      <TapPulse x={306} y={1187} opacity={fingerO} press={tap} />
    </AbsoluteFill>
  );
};

const InstagramFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 22, stiffness: 150 }, durationInFrames: 26 });
  const imageY = interpolate(frame, [0, 70], [22, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#fcfcfc", color: "#111", fontFamily: INTER, opacity: enter, transform: `scale(${1.06 - enter * .06})` }}>
      <StatusBar dark={false} />
      <div style={{ position: "absolute", top: 64, left: 0, right: 0, height: 78, borderBottom: "1px solid #e8e8e8", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, fontStyle: "italic" }}>Instagram</div>
        <div style={{ display: "flex", gap: 22, fontSize: 29 }}>♡　⌁</div>
      </div>
      <div style={{ position: "absolute", top: 142, left: 0, right: 0, height: 132, display: "flex", gap: 18, alignItems: "center", padding: "0 22px", borderBottom: "1px solid #ededed", overflow: "hidden" }}>
        {["You","Maya","Noah","Aanya","David"].map((n,i)=><div key={n} style={{ width: 82, textAlign: "center", flexShrink: 0 }}><div style={{ width: 67, height: 67, margin: "0 auto", borderRadius: 999, background: `linear-gradient(145deg, ${i%2?"#ef496f":"#f4bd54"}, #a743bb)`, padding: 3 }}><div style={{ width: "100%", height: "100%", borderRadius: 999, background: ["#604f46","#b78d73","#4c625d","#8d5e69","#52617d"][i], border: "3px solid white" }} /></div><div style={{ fontSize: 12, marginTop: 5 }}>{n}</div></div>)}
      </div>
      <div style={{ position: "absolute", top: 274, left: 0, right: 0, height: 75, display: "flex", alignItems: "center", gap: 13, padding: "0 22px" }}><div style={{ width: 42, height: 42, borderRadius: 999, background: "#54665b" }}/><div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>still.and.seeking</div><div style={{ fontSize: 24 }}>•••</div></div>
      <div style={{ position: "absolute", top: 349, left: 0, right: 0, height: 700, overflow: "hidden", transform: `translateY(${imageY}px)` }}><Img src={staticFile("prayscreen/intentional-feed.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
      <div style={{ position: "absolute", top: 1049, left: 0, right: 0, padding: "20px 23px" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 33 }}><span>♡　○　⌁</span><span>⌑</span></div><div style={{ fontWeight: 800, fontSize: 15, marginTop: 16 }}>2,418 likes</div><div style={{ fontSize: 15, lineHeight: 1.35, marginTop: 8 }}><b>still.and.seeking</b> Some peace is found before the scroll begins.</div><div style={{ color: "#777", fontSize: 13, marginTop: 8 }}>View all 84 comments</div></div>
    </AbsoluteFill>
  );
};

const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const stage = frame < 62 ? "launcher" : frame < 118 ? "blocker" : frame < 188 ? "verse" : frame < 333 ? "prayer" : "feed";
  const local = stage === "launcher" ? frame : stage === "blocker" ? frame - 62 : stage === "verse" ? frame - 118 : stage === "prayer" ? frame - 188 : frame - 333;
  return (
    <div style={{ width: 640, height: 1320, borderRadius: 88, background: "linear-gradient(145deg,#252834,#06070b)", padding: 14, boxShadow: "0 75px 150px rgba(0,0,0,.62), 0 0 0 2px rgba(255,255,255,.12), 0 0 90px rgba(233,196,106,.08)", position: "relative" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 74, overflow: "hidden", background: C.midnight }}>
        <Sequence from={frame-local} durationInFrames={stage === "launcher" ? 62 : stage === "blocker" ? 56 : stage === "verse" ? 70 : stage === "prayer" ? 145 : 117} premountFor={12}>
          {stage === "launcher" ? <Launcher/> : stage === "blocker" ? <Blocker/> : stage === "verse" ? <Verse/> : stage === "prayer" ? <Prayer/> : <InstagramFeed/>}
        </Sequence>
        <div style={{ position: "absolute", top: 17, left: "50%", transform: "translateX(-50%)", width: 174, height: 34, borderRadius: 20, background: "#030407", zIndex: 90 }} />
        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", width: 190, height: 7, borderRadius: 99, background: stage === "feed" ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.7)", zIndex: 90 }} />
      </div>
    </div>
  );
};

const Headline: React.FC = () => {
  const f = useCurrentFrame();
  const lines = f < 62 ? ["Stop endless scrolling", "before it starts."] : f < 118 ? ["A sacred pause", "between urge and action."] : f < 188 ? ["First, Scripture", "that steadies you."] : f < 333 ? ["Then, a prayer", "that brings you back."] : ["Open with intention.", "Not on autopilot."];
  const starts = [0,62,118,188,333];
  const start = starts.filter((x)=>x<=f).at(-1) ?? 0;
  const nextStart = starts.find((x) => x > start) ?? 450;
  const o = fadeRange(f, start, start+10, nextStart-12, nextStart);
  const y = interpolate(f, [start,start+16], [22,0], clamp);
  return <div style={{ textAlign: "center", color: C.ivory, opacity: o, transform: `translateY(${y}px)`, fontFamily: INTER }}><div style={{ fontSize: 58, lineHeight: 1.06, fontWeight: 900 }}>{lines[0]}</div><div style={{ fontSize: 42, lineHeight: 1.18, fontWeight: 500, color: C.goldSoft, marginTop: 10 }}>{lines[1]}</div></div>;
};

export const PrayScreenFeatureFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const phoneEnter = spring({ frame, fps: 30, config: { damping: 200 }, durationInFrames: 32 });
  const phoneScale = .91 + phoneEnter * .09;
  const finishGlow = interpolate(frame, [333, 410], [.08, .2], clamp);
  return (
    <AbsoluteFill style={{ background: C.midnight, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 60% at 50% 52%, rgba(29,55,110,.4), transparent 68%), radial-gradient(circle at 50% 76%, rgba(233,196,106,${finishGlow}), transparent 38%)` }} />
      <div style={{ position: "absolute", top: 64, left: 0, right: 0, textAlign: "center", color: C.gold, fontFamily: INTER, fontWeight: 900, fontSize: 16, letterSpacing: 6, textTransform: "uppercase" }}>Prayly · PrayScreen</div>
      <div style={{ position: "absolute", top: 116, left: 70, right: 70 }}><Headline/></div>
      <div style={{ position: "absolute", top: 332, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${phoneScale}) translateY(${interpolate(phoneEnter,[0,1],[38,0])}px)`, opacity: phoneEnter }}><Phone/></div>
      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, textAlign: "center", color: C.muted, fontFamily: INTER, fontSize: 22, fontWeight: 600, opacity: interpolate(frame,[14,32],[0,1],clamp) }}>Pray first. Scroll second.</div>
    </AbsoluteFill>
  );
};
