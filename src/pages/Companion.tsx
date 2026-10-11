import { useT, getLang } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Crown,
  Trash2,
  Wind,
  HeartHandshake,
  Sparkle,
  BookOpenText,
  HandHeart,
  Moon,
  BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { haptic } from "@/utils/haptics";
import { usePremium } from "@/hooks/usePremium";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { consumeMessage, getRemaining, getDailyLimit } from "@/lib/companionQuota";
import { toast } from "sonner";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { useIsLightTheme } from "@/hooks/useIsLightTheme";

type Msg = { role: "user" | "assistant"; content: string };

const HISTORY_KEY = "jw_companion_history_v1";
const MAX_HISTORY = 40;
const STARTER_PROMPTS = [
  { icon: Wind, id: "anxious" },
  { icon: HandHeart, id: "someone" },
  { icon: HeartHandshake, id: "grace" },
  { icon: BookOpenText, id: "verse" },
  { icon: Sparkle, id: "forgive" },
  { icon: Moon, id: "empty" },
];

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.slice(-MAX_HISTORY);
  } catch {}
  return [];
}

function saveHistory(msgs: Msg[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {}
}

export default function Companion() {
  const navigate = useNavigate();
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPremium, unlock } = usePremium();
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(getRemaining());
  const [showPremium, setShowPremium] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);
  const isLight = useIsLightTheme();

  // Theme-aware surface tokens. Dark = original glass-on-midnight. Light = ivory glass.
  const surfaceBg = isLight ? "hsl(40 30% 99% / 0.85)" : "hsl(222 25% 7% / 0.72)";
  const composerBg = isLight ? "hsl(40 30% 99% / 0.92)" : "hsl(222 25% 7% / 0.78)";
  const surfaceBorder = isLight ? "1px solid hsl(222 30% 25% / 0.10)" : "1px solid hsl(42 50% 50% / 0.16)";
  const surfaceShadow = isLight
    ? "0 8px 28px -14px hsl(222 30% 20% / 0.22), inset 0 1px 0 hsl(0 0% 100% / 0.6)"
    : "0 8px 28px -10px rgba(0,0,0,0.6), inset 0 1px 0 hsl(0 0% 100% / 0.05)";
  const composerShadowIdle = isLight
    ? "0 10px 32px -16px hsl(222 30% 20% / 0.28), 0 0 0 1px hsl(42 40% 45% / 0.18)"
    : "0 10px 32px -12px rgba(0,0,0,0.55), 0 0 0 1px hsl(42 40% 30% / 0.18)";
  const composerShadowFocus = isLight
    ? "0 14px 40px -18px hsl(var(--primary) / 0.35), 0 0 0 1px hsl(var(--primary) / 0.45), 0 0 22px -6px hsl(var(--primary) / 0.25)"
    : "0 14px 40px -14px rgba(0,0,0,0.7), 0 0 0 1px hsl(var(--primary) / 0.35), 0 0 22px -6px hsl(var(--primary) / 0.35)";
  const statusRing = isLight ? "hsl(40 30% 99%)" : "hsl(222 25% 7%)";
  const iconButtonBg = isLight ? "hsl(222 25% 15% / 0.06)" : "hsl(0 0% 100% / 0.04)";
  const sendIdleBg = isLight ? "hsl(40 20% 90%)" : "hsl(222 18% 13%)";


  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (autoSentRef.current) return;
    const q = searchParams.get("q");
    if (!q) return;
    autoSentRef.current = true;
    const sp = new URLSearchParams(searchParams);
    sp.delete("q");
    setSearchParams(sp, { replace: true });
    setTimeout(() => send(q), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    if (!isPremium && remaining <= 0) {
      haptic("medium");
      setShowPremium(true);
      return;
    }

    haptic("soft");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    if (!isPremium) {
      setRemaining(consumeMessage());
      import("@/lib/paywallScheduler").then((m) => m.firePaywallTrigger("companion_message")).catch(() => {});
    }

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      import("@/services/analytics").then((a) => a.track("companion_message_sent", { message_count: next.length })).catch(() => {});
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bible-companion`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, lang: getLang() }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast.error(t("chat.toast.busy"));
        } else if (resp.status === 402) {
          toast.error(t("chat.toast.noCredits"));
        } else {
          toast.error(t("chat.toast.error"));
        }
        setMessages(next);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(t("chat.toast.error"));
    } finally {
      setLoading(false);
      haptic("soft");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasMessages = messages.length > 0;

  const handleBack = useCallback(() => {
    haptic("soft");
    navigate(-1);
  }, [navigate]);

  const handleClearChat = useCallback(() => {
    if (messages.length === 0) return;
    haptic("medium");
    if (!confirm(t("chat.confirm.clear"))) return;
    setMessages([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    toast.success(t("chat.toast.cleared"));
  }, [messages.length]);

  useAndroidBack(handleBack);

  return (
    <div
      className="flex flex-col fixed inset-0 overflow-hidden"
      style={{
        height: "100dvh",
        background: "hsl(var(--background))",
      }}
    >
      {/* Ambient luminous backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(70% 45% at 50% -5%, hsl(var(--primary) / 0.20), transparent 60%), radial-gradient(60% 40% at 90% 10%, hsl(220 80% 55% / 0.10), transparent 60%), radial-gradient(50% 35% at 5% 30%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 20%, white, transparent), radial-gradient(1px 1px at 70% 35%, white, transparent), radial-gradient(1px 1px at 40% 70%, white, transparent), radial-gradient(1px 1px at 85% 80%, white, transparent)",
        }}
      />

      {/* Header — floating island */}
      <header
        className="flex-shrink-0 px-3 pt-2 pb-2 relative z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <div
          className="flex items-center gap-2 rounded-[22px] pl-1.5 pr-1.5 py-1.5"
          style={{
            background: surfaceBg,
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            border: surfaceBorder,
            boxShadow: surfaceShadow,
          }}
        >
          {/* Identity */}
          <div className="flex-1 min-w-0 flex items-center gap-2.5 pl-1.5">
            <div className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(120% 120% at 30% 20%, hsl(45 95% 70%), hsl(42 85% 45%) 70%)",
                  boxShadow:
                    "inset 0 1px 0 hsl(48 100% 88% / 0.6), 0 6px 16px -6px hsl(var(--primary) / 0.55)",
                }}
              >
                <BookOpen className="w-[17px] h-[17px]" style={{ color: "hsl(222 55% 12%)" }} strokeWidth={2.4} />
              </div>
              <motion.span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{
                  background: "hsl(140 70% 55%)",
                  boxShadow: `0 0 0 2px ${statusRing}, 0 0 8px hsl(140 70% 55% / 0.7)`,
                }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <h1
                className="text-[15.5px] font-semibold tracking-[-0.01em] text-foreground truncate"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
              >
                {t("chat.header.title")}
              </h1>
              <p className="text-[10.5px] font-semibold text-foreground/55 truncate">
                {isPremium
                  ? t("chat.header.unlimited")
                  : remaining > 0
                    ? t("chat.header.remaining", { remaining, total: getDailyLimit() })
                    : t("chat.header.limitReached")}
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              aria-label={t("chat.nav.clear")}
              className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: iconButtonBg }}
            >
              <Trash2 className="w-[15px] h-[15px] text-foreground/65" strokeWidth={2.2} />
            </button>
          )}
          {!isPremium && (
            <button
              onClick={() => {
                haptic("soft");
                setShowPremium(true);
              }}
              className="h-9 pl-2 pr-2.5 rounded-2xl flex items-center gap-1 active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, hsl(45 95% 65%), hsl(42 85% 48%))",
                boxShadow: "0 4px 14px -4px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(48 100% 88% / 0.55)",
              }}
            >
              <Crown className="w-3.5 h-3.5" style={{ color: "hsl(222 55% 12%)" }} strokeWidth={2.6} />
              <span className="text-[11px] font-black" style={{ color: "hsl(222 55% 12%)" }}>Pro</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-container px-4 pb-2 relative z-10">
        {!hasMessages && <EmptyState onPick={(t) => send(t)} />}

        <div className="max-w-2xl mx-auto space-y-3 pb-4 pt-1">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
          </AnimatePresence>
          {loading && messages[messages.length - 1]?.role === "user" && <TypingBubble />}
        </div>
      </div>

      {/* Composer — floating pill */}
      <div
        className="flex-shrink-0 px-3 pt-2 relative z-20"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        <motion.div
          animate={{
            boxShadow: focused ? composerShadowFocus : composerShadowIdle,
          }}
          transition={{ duration: 0.25 }}
          className="flex items-end gap-2 rounded-[26px] p-1.5 pl-4"
          style={{
            background: composerBg,
            backdropFilter: "blur(30px) saturate(140%)",
            WebkitBackdropFilter: "blur(30px) saturate(140%)",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={1}
            placeholder={t("chat.input.placeholder")}
            className="flex-1 bg-transparent resize-none outline-none text-[15px] text-foreground placeholder:text-foreground/40 py-2.5 max-h-32"
            style={{ lineHeight: 1.5 }}
            disabled={loading}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label={t("chat.nav.send")}
            className="flex-shrink-0 w-11 h-11 rounded-[20px] flex items-center justify-center transition-all disabled:opacity-40"
            style={{
              background: input.trim()
                ? "linear-gradient(135deg, hsl(45 95% 68%) 0%, hsl(42 90% 50%) 60%, hsl(38 95% 45%) 100%)"
                : sendIdleBg,
              boxShadow: input.trim()
                ? "0 8px 18px -6px hsl(var(--primary) / 0.6), inset 0 1px 0 hsl(48 100% 88% / 0.55)"
                : "inset 0 1px 0 hsl(0 0% 100% / 0.04)",
            }}
          >
            <Send
              className={`w-[17px] h-[17px] ${input.trim() ? "" : "text-foreground/35"}`}
              style={input.trim() ? { color: "hsl(222 55% 12%)" } : undefined}
              strokeWidth={2.6}
            />
          </motion.button>
        </motion.div>
      </div>

      <PremiumSheet
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onUnlock={unlock}
        trigger="companion"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────


function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useT();
  const isLight = useIsLightTheme();
  const cardBg = isLight ? "hsl(40 30% 99% / 0.9)" : "hsl(222 22% 8% / 0.7)";
  const cardBorder = isLight ? "1px solid hsl(222 30% 25% / 0.10)" : "1px solid hsl(42 40% 30% / 0.16)";
  const cardShadow = isLight
    ? "0 4px 14px -8px hsl(222 30% 20% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.5)"
    : "inset 0 1px 0 hsl(0 0% 100% / 0.03)";
  return (
    <div className="max-w-md mx-auto pt-2 pb-3 px-0.5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-5 relative"
      >
        {/* Halo */}
        <div className="relative w-[68px] h-[68px] mx-auto mb-3.5">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.45) 0%, hsl(var(--primary) / 0.1) 45%, transparent 70%)",
              filter: "blur(8px)",
            }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div
            className="absolute inset-0 m-auto w-[56px] h-[56px] rounded-[22px] flex items-center justify-center"
            style={{
              background:
                "radial-gradient(120% 120% at 30% 20%, hsl(45 95% 72%), hsl(42 85% 45%) 70%)",
              boxShadow:
                "inset 0 1px 0 hsl(48 100% 90% / 0.7), 0 14px 32px -12px hsl(var(--primary) / 0.55)",
            }}
          >
            <BookOpen className="w-7 h-7" style={{ color: "hsl(222 55% 12%)" }} strokeWidth={2.2} />
          </div>
        </div>

        <h2
          className="fluid-h2 tracking-[-0.02em] text-foreground"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
        >
          {t("chat.empty.title")}
        </h2>
        <p className="fluid-small text-foreground/60 mt-2 leading-relaxed max-w-[85%] mx-auto px-2">
          {t("chat.empty.subtitle")}
        </p>
      </motion.div>


      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary) / 0.25), transparent)" }} />
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-foreground/45">
          {t("chat.empty.beginWith")}
        </p>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary) / 0.25), transparent)" }} />
      </div>

      <div className="space-y-1.5">
        {STARTER_PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onPick(t(`chat.starter.${p.id}.text`))}
              className="w-full text-left rounded-2xl px-2.5 py-2.5 flex items-center gap-2.5 group"
              style={{
                background: cardBg,
                backdropFilter: "blur(20px)",
                border: cardBorder,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    "radial-gradient(120% 120% at 30% 20%, hsl(var(--primary) / 0.28), hsl(var(--primary) / 0.06) 75%)",
                  border: "1px solid hsl(var(--primary) / 0.28)",
                }}
              >
                <Icon className="w-[14px] h-[14px]" style={{ color: "hsl(var(--primary))" }} strokeWidth={2.1} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground/95 leading-[1.25]">
                  {t(`chat.starter.${p.id}.label`)}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/40 mt-0.5">
                  {t(`chat.starter.${p.id}.meta`)}
                </p>
              </div>
              <span
                className="text-[15px] font-light text-foreground/35 group-active:translate-x-0.5 transition-transform pr-0.5"
              >
                ›
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  const isLight = useIsLightTheme();
  const quoteText = isLight ? "hsl(222 40% 18%)" : "hsl(40 30% 92%)";
  const quoteBg = isLight
    ? "linear-gradient(135deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.06))"
    : "linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0.04))";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end"
      >
        <div
          className="max-w-[84%] px-4 py-2.5 rounded-[20px] rounded-br-[6px]"
          style={{
            background: "linear-gradient(135deg, hsl(45 95% 65%) 0%, hsl(42 88% 50%) 100%)",
            color: "hsl(222 55% 10%)",
            boxShadow:
              "0 8px 20px -8px hsl(var(--primary) / 0.5), inset 0 1px 0 hsl(48 100% 88% / 0.55)",
          }}
        >
          <p className="text-[14.5px] leading-[1.45] font-semibold whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </motion.div>
    );
  }

  // Assistant — no bubble background, refined typography
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-2.5 items-start"
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background:
            "radial-gradient(120% 120% at 30% 20%, hsl(45 95% 70%), hsl(42 85% 45%) 75%)",
          boxShadow:
            "inset 0 1px 0 hsl(48 100% 88% / 0.55), 0 4px 10px -4px hsl(var(--primary) / 0.45)",
        }}
      >
        <BookOpen className="w-[14px] h-[14px]" style={{ color: "hsl(222 55% 12%)" }} strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="companion-md text-[15px] leading-[1.7] text-foreground/92">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
              blockquote: ({ children }) => (
                <blockquote
                  className="my-3 px-4 py-3 rounded-2xl italic relative overflow-hidden"
                  style={{
                    background: quoteBg,
                    borderLeft: "2.5px solid hsl(var(--primary))",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "16px",
                    lineHeight: 1.55,
                    color: quoteText,
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
                <em className="italic text-foreground/80">{children}</em>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-2.5 items-center pl-0.5"
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background:
            "radial-gradient(120% 120% at 30% 20%, hsl(45 95% 70%), hsl(42 85% 45%) 75%)",
          boxShadow: "inset 0 1px 0 hsl(48 100% 88% / 0.55)",
        }}
      >
        <BookOpen className="w-[14px] h-[14px]" style={{ color: "hsl(222 55% 12%)" }} strokeWidth={2.4} />
      </div>
      <motion.span
        className="text-[13.5px] font-medium italic"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          backgroundImage:
            "linear-gradient(90deg, hsl(40 15% 55%) 0%, hsl(var(--primary)) 50%, hsl(40 15% 55%) 100%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
        animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
      >
        {t("chat.status.thinking")}
      </motion.span>
    </motion.div>
  );
}
