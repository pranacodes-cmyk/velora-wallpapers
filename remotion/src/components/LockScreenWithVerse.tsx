import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

export type VerseEntry = {
  text: string;
  reference: string;
  weekday: string;
  date: string;
};

type Props = {
  verses: VerseEntry[];
  framesPerVerse: number;
};

// iOS-style lock screen mockup with a verse card that swaps each cycle.
export const LockScreenWithVerse: React.FC<Props> = ({ verses, framesPerVerse }) => {
  const f = useCurrentFrame();
  const idx = Math.min(verses.length - 1, Math.floor(f / framesPerVerse));
  const verse = verses[idx];
  const localF = f - idx * framesPerVerse;

  const cardO = interpolate(localF, [0, 12, framesPerVerse - 10, framesPerVerse], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(localF, [0, 14], [18, 0], { extrapolateRight: "clamp" });
  const clockO = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 360,
      }}
    >
      {/* Date + clock */}
      <div style={{ opacity: clockO, textAlign: "center", color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.55)" }}>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 3, opacity: 0.92, textTransform: "uppercase" }}>
          {verse.weekday}, {verse.date}
        </div>
        <div style={{ fontSize: 200, fontWeight: 200, letterSpacing: -6, lineHeight: 1, marginTop: 6 }}>
          7:14
        </div>
      </div>

      {/* Verse card */}
      <div
        style={{
          marginTop: 90,
          width: 880,
          padding: "44px 44px 48px",
          borderRadius: 36,
          background: "rgba(10,15,36,0.62)",
          border: "1.5px solid rgba(212,170,80,0.55)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          opacity: cardO,
          transform: `translateY(${cardY}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgba(212,170,80,0.18)",
            border: "1px solid rgba(212,170,80,0.55)",
            color: "#f0c36a",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          ✦ Today's Verse
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 50,
            lineHeight: 1.22,
            fontWeight: 600,
            letterSpacing: -0.5,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          &ldquo;{verse.text}&rdquo;
        </div>
        <div style={{ marginTop: 22, color: "#f0c36a", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
          — {verse.reference}
        </div>
      </div>
    </div>
  );
};
