import { useState } from "react";
import { Link } from "react-router-dom";

type Kind = "verse" | "quiz" | "companion" | "journey";

const VARIANTS: Record<Kind, { kindLabel: string; title: string; body: string; cta: string; route: string; icon: string }> = {
  verse: {
    kindLabel: "Morning Verse",
    title: "Today's verse is ready",
    body: "A word from God to start your day.",
    cta: "Read",
    route: "/daily-verse",
    icon: "✝️",
  },
  quiz: {
    kindLabel: "Daily Bible Quiz",
    title: "Today's Bible Quiz is live",
    body: "Beat yesterday's streak — one question to start.",
    cta: "Play",
    route: "/quiz",
    icon: "⚡",
  },
  companion: {
    kindLabel: "Bible Companion",
    title: "Open the Word with me",
    body: "A 30-second Bible chat is waiting.",
    cta: "Open",
    route: "/companion",
    icon: "📖",
  },
  journey: {
    kindLabel: "Evening Journey",
    title: "Continue your Bible journey",
    body: "Tonight's chapter is short and powerful.",
    cta: "Continue",
    route: "/journeys",
    icon: "🌿",
  },
};

function NotificationCard({ kind }: { kind: Kind }) {
  const v = VARIANTS[kind];
  return (
    <div
      className="w-full rounded-[18px] overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #10182F 0%, #13203F 50%, #1A2A52 100%)",
        border: "1px solid rgba(232,197,107,0.24)",
        padding: "14px 16px",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-[26px] h-[26px] rounded-[12px] flex items-center justify-center text-[14px]"
          style={{ background: "linear-gradient(135deg, #E8C56B, #B8923D)" }}
        >
          {v.icon}
        </div>
        <span className="text-[12px] font-bold tracking-wide" style={{ color: "#E8C56B" }}>
          Prayly
        </span>
        <span className="text-[12px]" style={{ color: "#9DB0DA" }}>·</span>
        <span className="text-[12px] truncate" style={{ color: "#9DB0DA" }}>
          {v.kindLabel}
        </span>
      </div>

      {/* Title */}
      <div
        className="mt-[10px] text-[17px] font-bold leading-[1.2]"
        style={{ color: "#FFF8E6" }}
      >
        {v.title}
      </div>

      {/* Body */}
      <div
        className="mt-1 text-[13px] leading-[1.35]"
        style={{ color: "#C9D2E8" }}
      >
        {v.body}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 py-[10px] rounded-[18px] text-[14px] font-bold"
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(232,197,107,0.5)",
            color: "#F6E7B8",
          }}
        >
          Close
        </button>
        <button
          className="flex-1 py-[10px] rounded-[10px] text-[14px] font-bold"
          style={{
            background: "linear-gradient(90deg, #F2D87B, #D9B055)",
            color: "#10182F",
          }}
        >
          {v.cta}
        </button>
      </div>
    </div>
  );
}

export default function NotificationPreview() {
  const [playing, setPlaying] = useState<Kind | null>(null);

  const playBell = (kind: Kind) => {
    setPlaying(kind);
    const audio = new Audio("/cathedral_bell.mp3");
    audio.play().catch(() => {});
    audio.onended = () => setPlaying(null);
  };

  const kinds: Kind[] = ["verse", "quiz", "companion", "journey"];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <Link to="/" className="text-xs text-primary">← Back</Link>
          <h1 className="text-2xl font-bold mt-2">Notification Preview</h1>
          <p className="text-sm text-muted-foreground">
            Exact rendering of the 4 lockscreen banners on Android.
          </p>
        </div>

        {kinds.map((k) => (
          <div key={k} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {VARIANTS[k].kindLabel}
              </span>
              <button
                onClick={() => playBell(k)}
                className="text-[11px] text-primary font-semibold"
              >
                {playing === k ? "♪ Playing..." : "▶ Play bell"}
              </button>
            </div>
            <NotificationCard kind={k} />
            <div className="text-[10px] text-muted-foreground px-1">
              Tap → routes to <code>{VARIANTS[k].route}</code>
            </div>
          </div>
        ))}

        <div className="text-[11px] text-muted-foreground text-center pt-4 border-t border-border">
          All four use the same <strong>cathedral_bell</strong> sound. Prayer alarms still use divine_bell.
        </div>
      </div>
    </div>
  );
}
