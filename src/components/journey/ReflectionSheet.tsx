import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, Check, X, Crown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { haptic } from "@/utils/haptics";
import { useT, getLang } from "@/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { PremiumSheet } from "@/components/PremiumSheet";
import { canUseJourneyReflection } from "@/lib/journeyReflectionQuota";

/**
 * Post-chapter reflection.
 * Free users get Day 1 of every journey free; Day 2+ requires Premium.
 */

interface Props {
  open: boolean;
  context: string;        // e.g. "Anxiety to Peace · Day 2"
  hue: number;
  day?: number;           // journey day (for free-tier gating)
  onClose: () => void;    // fires journey completion when dismissed
}

const PROMPTS = [
  "What touched my heart today",
  "A worry I want to give to God",
  "Something I'm grateful for",
  "A question I'm sitting with",
];

export function ReflectionSheet({ open, context, hue, day = 1, onClose }: Props) {
  const { t } = useT();
  const { isPremium, unlock } = usePremium();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const allowed = canUseJourneyReflection(day, isPremium);

  // Reset on each open
  useEffect(() => {
    if (open) {
      setText("");
      setReply(null);
      setLoading(false);
      // Soft focus delay so the sheet animation finishes first
      setTimeout(() => textareaRef.current?.focus(), 350);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (!allowed) {
      haptic("medium");
      setShowPremium(true);
      return;
    }
    haptic("medium");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pastoral", {
        body: { kind: "reflection", text: trimmed, context, lang: getLang() },
      });
      if (error) throw error;
      const content = (data as { content?: string })?.content;
      if (!content) throw new Error("Empty response");
      setReply(content);
      haptic("soft");
    } catch (e) {
      console.error(e);
      toast.error(t("jn.reflect.error"));
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    haptic("soft");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) finish();
      }}
    >
      <SheetContent
        side="bottom"
        className="h-[88vh] p-0 border-0 rounded-t-[28px] overflow-hidden"
        style={{
          background: `radial-gradient(120% 70% at 50% 0%, hsl(${hue} 55% 18% / 0.65), transparent 60%), hsl(var(--background))`,
        }}
      >
        <div className="h-full flex flex-col">
          {/* Grabber */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-foreground/15" />
          </div>

          {/* Close */}
          <button
            onClick={finish}
            className="absolute top-3 right-3 w-9 h-9 rounded-2xl flex items-center justify-center z-10"
            style={{
              background: "hsl(var(--glass))",
              border: "1px solid hsl(var(--glass-border))",
            }}
            aria-label={t("jn.reflect.skipAria")}
          >
            <X className="w-4 h-4 text-foreground/70" strokeWidth={2.4} />
          </button>

          {/* Header */}
          <div className="px-6 pt-2 pb-4 flex-shrink-0 text-center">
            <div
              className="w-14 h-14 mx-auto rounded-3xl flex items-center justify-center mb-3"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)), hsl(45 90% 55%))",
                boxShadow: "0 10px 28px -8px hsl(var(--primary) / 0.55)",
              }}
            >
              <Star className="w-6 h-6 text-background" strokeWidth={2.2} />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-foreground/55 mb-1">
              {context}
            </p>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-foreground leading-tight">
              Sit with it for a moment
            </h2>
            <p className="text-[13px] text-foreground/65 mt-1.5 leading-relaxed max-w-[280px] mx-auto">
              Write one honest line. He'll meet you with a verse.
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-2 min-h-0">
            <AnimatePresence mode="wait">
              {!reply ? (
                <motion.div
                  key="compose"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {!allowed && (
                    <button
                      onClick={() => { haptic("soft"); setShowPremium(true); }}
                      className="w-full mb-3 px-3.5 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-[12px] font-extrabold"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(45 90% 55% / 0.14))",
                        color: "hsl(var(--primary))",
                        border: "1px solid hsl(var(--primary) / 0.35)",
                      }}
                    >
                      <Crown className="w-3.5 h-3.5" strokeWidth={2.6} />
                      Unlock reflections for every day
                    </button>
                  )}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[t("jn.reflect.prompts.0"), t("jn.reflect.prompts.1"), t("jn.reflect.prompts.2"), t("jn.reflect.prompts.3")].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          haptic("soft");
                          setText((cur) => (cur ? cur : `${p}: `));
                          textareaRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-full text-[11.5px] font-bold"
                        style={{
                          background: "hsl(var(--primary) / 0.1)",
                          color: "hsl(var(--primary))",
                          border: "1px solid hsl(var(--primary) / 0.22)",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Textarea card */}
                  <div
                    className="rounded-[22px] p-4"
                    style={{
                      background: "hsl(var(--glass))",
                      backdropFilter: "blur(20px)",
                      border: "1px solid hsl(var(--glass-border))",
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={600}
                      rows={6}
                      placeholder="What's on your heart after today's reading?"
                      className="w-full bg-transparent resize-none outline-none text-[15px] leading-[1.55] text-foreground placeholder:text-foreground/40"
                      disabled={loading}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground/40">
                        {text.length}/600
                      </span>
                      <button
                        onClick={finish}
                        className="text-[11.5px] font-bold text-foreground/55 px-2 py-1"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="reply"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {/* User's own line — quiet, italic */}
                  <div
                    className="rounded-2xl p-3.5 mb-3 italic"
                    style={{
                      background: "hsl(var(--muted) / 0.4)",
                      color: "hsl(var(--foreground) / 0.7)",
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                    }}
                  >
                    "{text}"
                  </div>

                  {/* Companion reply */}
                  <div
                    className="rounded-[22px] p-4"
                    style={{
                      background: "hsl(var(--glass))",
                      backdropFilter: "blur(20px)",
                      border: "1px solid hsl(var(--glass-border))",
                    }}
                  >
                    <div className="companion-md text-[14.5px] leading-[1.65] text-foreground">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          blockquote: ({ children }) => (
                            <blockquote
                              className="my-3 px-4 py-3 rounded-2xl italic"
                              style={{
                                background: "hsl(var(--primary) / 0.08)",
                                borderLeft: "3px solid hsl(var(--primary))",
                                fontFamily: "Georgia, 'Times New Roman', serif",
                              }}
                            >
                              {children}
                            </blockquote>
                          ),
                          strong: ({ children }) => (
                            <strong style={{ color: "hsl(var(--primary))" }} className="font-bold">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-foreground/85">{children}</em>
                          ),
                        }}
                      >
                        {reply}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer action */}
          <div
            className="flex-shrink-0 px-5 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
          >
            {!reply ? (
              <button
                onClick={submit}
                disabled={loading || !text.trim()}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(45 90% 55%))",
                  color: "hsl(var(--background))",
                  boxShadow: "0 10px 24px -10px hsl(var(--primary) / 0.55)",
                }}
              >
                {loading ? (
                  <>
                    <motion.span
                      className="w-4 h-4 rounded-full border-2 border-background/30 border-t-background"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="text-[14.5px] font-black tracking-tight">
                      Listening…
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={2.4} />
                    <span className="text-[14.5px] font-black tracking-tight">
                      Share with Him
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={finish}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-2"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(45 90% 55%))",
                  color: "hsl(var(--background))",
                  boxShadow: "0 10px 24px -10px hsl(var(--primary) / 0.55)",
                }}
              >
                <Check className="w-4 h-4" strokeWidth={2.6} />
                <span className="text-[14.5px] font-black tracking-tight">Amen — continue</span>
              </button>
            )}
          </div>
        </div>
      </SheetContent>
      <PremiumSheet
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onUnlock={unlock}
        trigger="journey_reflection"
      />
    </Sheet>
  );
}
