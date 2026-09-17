import { useEffect, useState } from "react";
import { Bell, Cross } from "lucide-react";

/**
 * Web-only visual mock of the two native Android alarm surfaces:
 *   1. Heads-up notification banner (phone in use)
 *   2. Full-screen lock-screen takeover (phone asleep/locked)
 *
 * Pure CSS replica — no native code involved. Open /alarm-preview to view.
 */
export default function AlarmPreview() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time12 = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  const timeShort = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false });
  const dateLong = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });

  return (
    <div
      className="min-h-screen bg-[#070A18] text-white pb-40 overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
    >
      <header className="px-6 pt-12 pb-6 text-center">
        <p className="text-[10px] tracking-[0.25em] text-[#E8C56B] font-bold">PRAYER ALARM — VISUAL PREVIEW</p>
        <h1 className="text-2xl mt-2 font-semibold">How the alarm looks on your phone</h1>
        <p className="text-sm text-[#9FAACB] mt-2 max-w-md mx-auto">
          Two surfaces, picked automatically by Android based on whether your screen is on.
        </p>
      </header>

      {/* ─── Mock 1: heads-up notification ─── */}
      <section className="px-5 mt-4">
        <SectionLabel
          step="1"
          title="Heads-up banner"
          subtitle="Shown when your phone is unlocked & in use — slides in from the top, then settles."
        />
        <PhoneFrame label="Phone in use">
          <HomescreenBackdrop />
          <div className="absolute inset-x-3 top-3 z-10 animate-[slideDown_0.5s_ease-out]">
            <HeadsUpNotification time={timeShort} />
          </div>
        </PhoneFrame>
      </section>

      {/* ─── Mock 2: full-screen takeover ─── */}
      <section className="px-5 mt-12">
        <SectionLabel
          step="2"
          title="Full-screen takeover"
          subtitle="Shown when the screen is off or locked — wakes the phone with the bell."
        />
        <PhoneFrame label="Phone locked / asleep">
          <FullScreenAlarm timeShort={timeShort} dateLong={dateLong} />
        </PhoneFrame>
      </section>

      <footer className="text-center text-xs text-[#6B7595] mt-12 px-6">
        Drop your alarm tone as <code className="text-[#E8C56B]">divine_bell.mp3</code> into{" "}
        <code>android/app/src/main/res/raw/</code>
      </footer>

      <style>{`
        @keyframes slideDown { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes haloPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.08); opacity: 0.55; }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @keyframes bellShake {
          0%, 100% { transform: rotate(0); }
          15%  { transform: rotate(-12deg); }
          30%  { transform: rotate(10deg); }
          45%  { transform: rotate(-8deg); }
          60%  { transform: rotate(6deg); }
          75%  { transform: rotate(-3deg); }
        }
      `}</style>
    </div>
  );
}

function SectionLabel({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4 max-w-md mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A2244] border border-[#2E3A66]">
        <span className="text-[10px] font-bold text-[#E8C56B]">STEP {step}</span>
      </div>
      <h2 className="text-lg font-semibold mt-2">{title}</h2>
      <p className="text-xs text-[#9FAACB] mt-1">{subtitle}</p>
    </div>
  );
}

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="mx-auto" style={{ maxWidth: 360 }}>
      <div
        className="relative rounded-[44px] overflow-hidden border-[10px] border-[#1A1F33] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        style={{ aspectRatio: "9/19.5", background: "#000" }}
      >
        {children}
      </div>
      <p className="text-[11px] text-[#6B7595] text-center mt-2">{label}</p>
    </div>
  );
}

/* ───────────────────────── Heads-up notification ───────────────────────── */

function HeadsUpNotification({ time }: { time: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: "rgba(20, 27, 54, 0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(232, 197, 107, 0.25)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#F4D279,#C9A24A)" }}
        >
          <Cross className="w-3 h-3" style={{ color: "#1A1306" }} strokeWidth={3} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[#E8C56B] font-semibold">
          Prayly
        </span>
        <span className="ml-auto text-[10px] text-[#9FAACB]">now</span>
      </div>

      {/* Body */}
      <div className="px-3 pb-2 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "radial-gradient(circle at 30% 30%, #2A3563, #0E1430)",
            border: "1px solid rgba(232, 197, 107, 0.5)",
          }}
        >
          <Bell className="w-6 h-6" style={{ color: "#E8C56B" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-white">Morning Prayer</p>
          <p className="text-[12px] text-[#C9D2EC] leading-tight mt-0.5 truncate">
            🙏 Tap to enter a moment of prayer
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="flex border-t border-white/5">
        <button
          className="flex-1 py-3 text-[13px] font-medium text-[#C9D2EC] hover:bg-white/5 transition"
          style={{ letterSpacing: 0.3 }}
        >
          Snooze
        </button>
        <div className="w-px bg-white/5" />
        <button
          className="flex-1 py-3 text-[13px] font-semibold transition"
          style={{ color: "#E8C56B", letterSpacing: 0.3 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function HomescreenBackdrop() {
  // Quick faux "home screen" look so the banner has context
  const apps = ["🎨", "📖", "📷", "🎵", "🗺", "📅", "💬", "⚙️"];
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 20%, #3a2a18 0%, #1a1208 40%, #050402 100%)",
      }}
    >
      <div className="absolute top-2 left-3 right-3 flex justify-between text-[10px] text-white/80">
        <span>9:41</span>
        <span>● ● ●</span>
      </div>
      <div className="absolute inset-x-4 top-24 grid grid-cols-4 gap-4 opacity-70 pointer-events-none">
        {apps.map((a, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-white/10 flex items-center justify-center text-xl">
            {a}
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 inset-x-6 h-14 rounded-2xl bg-white/10 backdrop-blur-md" />
    </div>
  );
}

/* ───────────────────────── Full-screen alarm ───────────────────────── */

function FullScreenAlarm({ timeShort, dateLong }: { timeShort: string; dateLong: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center px-7 py-10"
      style={{
        background:
          "linear-gradient(180deg, #050714 0%, #0A0E1F 30%, #141B36 60%, #070A18 100%)",
      }}
    >
      {/* Top eyebrow */}
      <div className="flex items-center gap-1.5 mt-2">
        <Cross className="w-3 h-3" style={{ color: "#E8C56B" }} strokeWidth={3} />
        <span className="text-[10px] font-bold tracking-[0.22em] text-[#E8C56B]">
          PRAYLY
        </span>
      </div>

      {/* Halo dial */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="relative" style={{ width: 230, height: 230 }}>
          {/* Outer pulsing glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(232,197,107,0.35) 0%, rgba(232,197,107,0.08) 55%, transparent 75%)",
              animation: "haloPulse 3.2s ease-in-out infinite",
            }}
          />
          {/* Middle ring */}
          <div
            className="absolute rounded-full"
            style={{
              top: 15, left: 15, right: 15, bottom: 15,
              background: "rgba(232,197,107,0.06)",
              border: "1.5px solid rgba(232,197,107,0.4)",
              animation: "ringPulse 3.2s ease-in-out infinite",
            }}
          />
          {/* Inner dial */}
          <div
            className="absolute flex flex-col items-center justify-center rounded-full"
            style={{
              top: 30, left: 30, right: 30, bottom: 30,
              background: "radial-gradient(circle at 50% 30%, #1C2647 0%, #0E1430 80%)",
              border: "1.2px solid rgba(232,197,107,0.55)",
              boxShadow: "inset 0 2px 20px rgba(232,197,107,0.1)",
            }}
          >
            <Bell
              className="w-7 h-7 mb-1"
              style={{ color: "#E8C56B", animation: "bellShake 2.6s ease-in-out infinite", transformOrigin: "50% 10%" }}
            />
            <div className="text-[44px] font-extralight leading-none tracking-tight text-white">
              {timeShort}
            </div>
            <div className="text-[11px] text-[#C9D2EC] mt-1">{dateLong}</div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-center -mt-2">
        <h3 className="text-[22px] font-medium text-white">Morning Prayer</h3>
      </div>

      {/* Teaser prayer card — half revealed, fades into "Read full prayer" */}
      <div
        className="w-full mt-4 rounded-2xl px-5 pt-4 pb-3 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(28,38,71,0.65), rgba(14,20,48,0.65))",
          border: "1px solid rgba(232,197,107,0.18)",
          backdropFilter: "blur(8px)",
        }}
      >
        <p className="text-[10px] tracking-[0.2em] text-[#E8C56B] font-bold mb-2">
          ✦ TODAY'S PRAYER
        </p>
        <p className="text-[13.5px] leading-[1.65] text-[#E6EAF7]">
          Heavenly Father, as this new day awakens, I lift my heart to You.
          Quiet the noise within me and let Your peace settle over every worry.
          Walk beside me through every hour, and let Your light shine through
          everything I…
        </p>
        {/* Bottom fade */}
        <div
          className="absolute bottom-9 left-0 right-0 h-14 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(14,20,48,0), rgba(14,20,48,0.95) 80%)",
          }}
        />
        <button className="relative mt-1 text-[12.5px] font-semibold text-[#E8C56B] flex items-center gap-1.5">
          Read full prayer
          <span style={{ fontSize: 14 }}>→</span>
        </button>
      </div>

      {/* Buttons */}
      <div className="w-full mt-4 space-y-2.5">
        <button
          className="w-full py-4 rounded-full text-[15px] font-semibold flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(90deg, #F4D279, #E8C56B 50%, #C9A24A)",
            color: "#1A1306",
            boxShadow: "0 10px 30px -10px rgba(232,197,107,0.6)",
          }}
        >
          <Cross className="w-4 h-4" strokeWidth={3} /> Open Prayer
        </button>
        <button
          className="w-full py-4 rounded-full text-[15px] font-medium"
          style={{
            background: "transparent",
            border: "1.4px solid #3A4576",
            color: "#E6EAF7",
          }}
        >
          Close
        </button>
        <button
          className="w-full py-2 text-[13px] underline text-[#B8C2DB]"
          style={{ textUnderlineOffset: 4 }}
        >
          Snooze 10 min
        </button>
      </div>
    </div>
  );
}
