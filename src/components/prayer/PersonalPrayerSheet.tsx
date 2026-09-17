import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Copy, Share2, Heart, Loader2, Crown } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { nativeShare } from "@/utils/nativeShare";
import {
  consumePastoral,
  getPastoralRemaining,
  savePrayer,
} from "@/lib/aiPastoralStore";
import { usePremium } from "@/hooks/usePremium";
import { PremiumSheet } from "@/components/PremiumSheet";
import { useT, getLang } from "@/i18n";

const TOPICS = [
  { key: "pr.topic.anxiety", emoji: "😟" },
  { key: "pr.topic.healing", emoji: "🌿" },
  { key: "pr.topic.family", emoji: "🏡" },
  { key: "pr.topic.work", emoji: "💼" },
  { key: "pr.topic.grief", emoji: "🕊️" },
  { key: "pr.topic.gratitude", emoji: "✨" },
  { key: "pr.topic.guidance", emoji: "🧭" },
  { key: "pr.topic.strength", emoji: "🔥" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PersonalPrayerSheet({ open, onClose }: Props) {
  const { t } = useT();
  const { isPremium, unlock } = usePremium();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [prayer, setPrayer] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(getPastoralRemaining());
  const [showPremium, setShowPremium] = useState(false);

  const reset = () => {
    setSelected([]);
    setText("");
    setPrayer(null);
  };

  const handleClose = () => {
    haptic("soft");
    onClose();
    setTimeout(reset, 300);
  };

  const toggleTopic = (t: string) => {
    haptic("soft");
    setSelected((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const topicText = () => {
    const parts: string[] = [];
    if (selected.length) parts.push(selected.join(", ").toLowerCase());
    if (text.trim()) parts.push(text.trim());
    return parts.join(". ");
  };

  const canGenerate = (selected.length > 0 || text.trim().length >= 2) && !loading;

  const generate = async () => {
    if (!canGenerate) return;
    if (!isPremium && remaining <= 0) {
      haptic("medium");
      setShowPremium(true);
      return;
    }
    haptic("medium");
    setLoading(true);
    const topic = topicText();
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-pastoral`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ kind: "prayer", text: topic, lang: getLang() }),
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || t("pr.personal.toast.genError"));
        setLoading(false);
        return;
      }
      const { content } = await resp.json();
      setPrayer(content);
      savePrayer(topic, content);
      if (!isPremium) setRemaining(consumePastoral());
      haptic("heavy");
    } catch {
      toast.error(t("pr.personal.toast.connError"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!prayer) return;
    haptic("soft");
    try {
      await navigator.clipboard.writeText(prayer);
      toast.success(t("pr.personal.toast.copied"));
    } catch {
      toast.error(t("pr.personal.toast.copyError"));
    }
  };

  const handleShare = async () => {
    if (!prayer) return;
    haptic("soft");
    await nativeShare({
      title: t("pr.personal.shareTitle"),
      text: `${prayer}\n\n━━━━━━━\n✝️ Made with Prayly: Bible Prayer & Verse\nhttps://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app`,
      dialogTitle: t("pr.personal.shareDialogTitle"),
    });
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[81] rounded-t-[28px] overflow-hidden flex flex-col"
              style={{
                maxHeight: "92vh",
                background:
                  "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)",
                borderTop: "1px solid hsl(var(--primary) / 0.25)",
                boxShadow:
                  "0 -20px 60px -20px rgba(0,0,0,0.4), 0 0 0 1px hsl(var(--primary) / 0.1)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: "hsl(var(--foreground) / 0.25)" }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-1 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(42 95% 55%), hsl(38 100% 50%))",
                      boxShadow: "0 6px 16px -6px hsl(42 90% 50% / 0.5)",
                    }}
                  >
                    <Star
                      className="w-4.5 h-4.5"
                      style={{ color: "hsl(222 55% 14%)" }}
                      strokeWidth={2.4}
                      fill="hsl(222 55% 14%)"
                    />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-black tracking-[-0.01em] text-foreground leading-none">
                      {t("pr.personal.title")}
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/55 mt-1">
                      {isPremium
                        ? t("pr.personal.badge.unlimited")
                        : remaining > 0
                          ? t("pr.personal.badge.free")
                          : t("pr.personal.badge.unlock")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "hsl(var(--glass))",
                    border: "1px solid hsl(var(--glass-border))",
                  }}
                >
                  <X className="w-4 h-4 text-foreground" strokeWidth={2.4} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto scroll-container px-5 pb-5">
                {!prayer ? (
                  <>
                    <p className="text-[13px] text-foreground/75 leading-relaxed mb-4">
                      {t("pr.personal.intro")}
                    </p>

                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-foreground/55 mb-2.5">
                      {t("pr.personal.whatNeed")}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {TOPICS.map((topic) => {
                        const label = t(topic.key);
                        const on = selected.includes(label);
                        return (
                          <button
                            key={topic.key}
                            onClick={() => toggleTopic(label)}
                            className="px-3 py-1.5 rounded-full text-[12.5px] font-bold flex items-center gap-1.5 transition-all"
                            style={
                              on
                                ? {
                                    background:
                                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
                                    color: "hsl(var(--primary-foreground))",
                                    boxShadow:
                                      "0 4px 12px -4px hsl(var(--primary) / 0.5)",
                                    border: "1px solid transparent",
                                  }
                                : {
                                    background: "hsl(var(--primary) / 0.08)",
                                    color: "hsl(var(--foreground) / 0.85)",
                                    border: "1px solid hsl(var(--primary) / 0.22)",
                                  }
                            }
                          >
                            <span>{topic.emoji}</span>
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-foreground/55 mb-2.5">
                      {t("pr.personal.orShare")}
                    </p>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, 500))}
                      placeholder={t("pr.personal.placeholder")}
                      rows={4}
                      className="w-full p-3.5 rounded-2xl text-[14px] text-foreground placeholder:text-foreground/40 outline-none resize-none"
                      style={{
                        background: "hsl(var(--glass))",
                        backdropFilter: "blur(20px)",
                        border: "1px solid hsl(var(--glass-border))",
                        lineHeight: 1.5,
                      }}
                    />
                    <p className="text-right text-[10px] text-foreground/40 mt-1">
                      {t("pr.personal.charCount", { count: text.length })}
                    </p>

                    <button
                      onClick={generate}
                      disabled={!canGenerate}
                      className="w-full mt-4 rounded-2xl py-3.5 text-[15px] font-extrabold tracking-tight flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(var(--primary)), hsl(42 95% 55%))",
                        color: "hsl(var(--primary-foreground))",
                        boxShadow:
                          "0 12px 28px -10px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                          {t("pr.personal.writing")}
                        </>
                      ) : (
                        <>
                          <Star className="w-4 h-4" strokeWidth={2.5} />
                          {t("pr.personal.write")}
                        </>
                      )}
                    </button>

                    {!isPremium && remaining === 0 && (
                      <button
                        onClick={() => {
                          haptic("soft");
                          setShowPremium(true);
                        }}
                        className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
                        style={{
                          color: "hsl(var(--primary))",
                          background: "hsl(var(--primary) / 0.08)",
                          border: "1px solid hsl(var(--primary) / 0.25)",
                        }}
                      >
                        <Crown className="w-3.5 h-3.5" strokeWidth={2.5} />
                        {t("pr.personal.unlockUnlimited")}
                      </button>
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div
                      className="relative rounded-3xl p-5 mb-4 overflow-hidden"
                      style={{
                        background:
                          "linear-gradient(160deg, hsl(var(--primary) / 0.08), transparent 50%), hsl(var(--glass))",
                        backdropFilter: "blur(20px)",
                        border: "1px solid hsl(var(--primary) / 0.28)",
                        boxShadow: "0 12px 32px -12px hsl(var(--primary) / 0.3)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="absolute -top-2 left-3 text-[80px] leading-none font-serif select-none pointer-events-none"
                        style={{
                          color: "hsl(var(--primary) / 0.3)",
                          fontFamily: "Georgia, serif",
                        }}
                      >
                        “
                      </span>
                      <p
                        className="relative text-[15.5px] leading-[1.7] text-foreground/95 whitespace-pre-line pl-3"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {prayer}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <ActionBtn icon={Copy} label={t("pr.personal.action.copy")} onClick={handleCopy} />
                      <ActionBtn icon={Share2} label={t("pr.personal.action.share")} onClick={handleShare} />
                      <ActionBtn
                        icon={Heart}
                        label={t("pr.personal.action.saved")}
                        onClick={() => {
                          haptic("soft");
                          toast.success(t("pr.personal.toast.saved"));
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        haptic("soft");
                        reset();
                      }}
                      className="w-full py-3 rounded-2xl text-[13px] font-bold"
                      style={{
                        background: "hsl(var(--primary) / 0.08)",
                        color: "hsl(var(--primary))",
                        border: "1px solid hsl(var(--primary) / 0.25)",
                      }}
                    >
                      {t("pr.personal.writeAnother")}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PremiumSheet
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onUnlock={unlock}
        trigger="personal_prayer"
      />
    </>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl"
      style={{
        background: "hsl(var(--glass))",
        backdropFilter: "blur(20px)",
        border: "1px solid hsl(var(--glass-border))",
      }}
    >
      <Icon
        className="w-4 h-4"
        style={{ color: "hsl(var(--primary))" }}
        strokeWidth={2.2}
      />
      <span className="text-[10.5px] font-bold text-foreground/85">{label}</span>
    </button>
  );
}
