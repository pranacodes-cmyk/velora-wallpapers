import { Cross, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { haptic } from "@/utils/haptics";

export function PrayScreenFeatureCard() {
  const navigate = useNavigate();
  const selected = (() => {
    try { return JSON.parse(localStorage.getItem("ps_guarded_apps") || "[]").length; }
    catch { return 0; }
  })();
  const active = localStorage.getItem("ps_enabled") === "true";

  return (
    <div className="px-3 pb-4">
      <Button
        variant="ghost"
        onClick={() => { haptic("soft"); navigate("/prayscreen"); }}
        className="h-auto w-full flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-[22px] p-0 text-left"
        style={{
          /* Clean surface, royal-blue frame — no gold wash behind the card. */
          background: "var(--tile-grad-soft)",
          border: "1.4px solid hsl(222 60% 34% / 0.38)",
          boxShadow: "0 10px 26px -16px hsl(222 60% 24% / 0.35)",
        }}
      >
        {/* thin royal-blue crest line */}
        <div
          className="h-[2.5px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(222 60% 34% / 0.55), transparent)",
          }}
        />

        <div className="flex w-full items-center px-4 pt-3.5">
          <span className="text-[10px] font-black tracking-[0.16em] text-primary/70">PRAYSCREEN</span>
          <span className="ml-auto rounded-full border border-accent/30 bg-accent/10 px-2 py-[3px] text-[8px] font-black tracking-wide text-accent">
            ★ STAR FEATURE
          </span>
        </div>

        <div className="flex w-full items-start gap-3.5 px-4 pb-3.5 pt-3">
          <div
            className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[hsl(222_62%_22%)] dark:bg-[#050505]"
            style={{
              boxShadow:
                "0 6px 16px -6px hsl(222 60% 12% / 0.55), inset 0 1px 0 hsl(45 90% 70% / 0.10)",
            }}
          >
            {/* soft gold halo behind the cross */}
            <span
              className="pointer-events-none absolute inset-[5px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, hsl(43 92% 58% / 0.30) 0%, transparent 72%)",
              }}
            />
            {/* thin gold ring */}
            <span
              className="pointer-events-none absolute inset-[4px] rounded-full border"
              style={{ borderColor: "hsl(43 92% 60% / 0.30)" }}
            />
            <Cross
              className="relative h-[25px] w-[25px]"
              strokeWidth={2.2}
              style={{
                color: "hsl(43 94% 62%)",
                filter: "drop-shadow(0 1px 4px hsl(43 92% 55% / 0.55))",
              }}
            />
          </div>

          <h2 className="min-w-0 flex-1 text-[16.5px] font-black leading-[1.25] tracking-normal text-foreground">
            Pause the scroll. Choose God first.
          </h2>
          <ChevronRight className="mt-3 h-[18px] w-[18px] shrink-0 text-primary/40" />
        </div>

        <div className="h-px w-full bg-primary/10" />

        <div className="flex w-full items-center gap-2 px-4 py-3">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-[#16A34A]" : "bg-primary/30"}`}
          />
          <p className="text-[11.5px] font-semibold leading-snug text-foreground/55">
            {active ? `${selected} apps guarded · Shield active` : "Guard distracting apps with a sacred pause"}
          </p>
        </div>
      </Button>
    </div>
  );
}