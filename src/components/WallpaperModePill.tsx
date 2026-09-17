import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clapperboard, ImageIcon, Layers, ChevronDown, Check } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

export type WallpaperMode = "live" | "photos" | "both";

function useOptions(): { id: WallpaperMode; label: string; Icon: typeof ImageIcon }[] {
  const { t } = useT();
  return [
    { id: "live", label: t("wp.mode.live"), Icon: Clapperboard },
    { id: "photos", label: t("wp.mode.photos"), Icon: ImageIcon },
    { id: "both", label: t("wp.mode.both"), Icon: Layers },
  ];
}

interface Props {
  mode: WallpaperMode;
  onChange: (m: WallpaperMode) => void;
}

export function WallpaperModePill({ mode, onChange }: Props) {
  const OPTIONS = useOptions();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find((o) => o.id === mode) ?? OPTIONS[0];
  const ActiveIcon = active.Icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => { haptic("soft"); setOpen((v) => !v); }}
        className="h-9 pl-2.5 pr-2 flex items-center gap-1.5 rounded-full text-[11px] font-extrabold tracking-[0.04em] text-foreground/85"
        style={{
          background: "hsl(var(--primary) / 0.12)",
          border: "1px solid hsl(var(--primary) / 0.35)",
          boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.18)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ActiveIcon className="w-3.5 h-3.5 text-primary" strokeWidth={2.4} />
        <span className="leading-none">{active.label}</span>
        <ChevronDown
          className={`w-3 h-3 text-foreground/55 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.4}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute right-0 mt-2 w-[160px] rounded-2xl p-1.5 z-50 overflow-hidden"
            style={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow:
                "0 18px 40px -10px hsl(0 0% 0% / 0.45), 0 0 0 1px hsl(var(--primary) / 0.08)",
              backdropFilter: "blur(28px) saturate(180%)",
              WebkitBackdropFilter: "blur(28px) saturate(180%)",
            }}
          >
            {OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const isActive = opt.id === mode;
              return (
                <button
                  key={opt.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    haptic("soft");
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-left transition-colors ${
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-foreground/80 hover:bg-foreground/5"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-primary" : "text-foreground/55"}`}
                    strokeWidth={2.4}
                  />
                  <span className="flex-1">{opt.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
