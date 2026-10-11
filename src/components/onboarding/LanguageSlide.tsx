import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { LANGUAGES, type LangCode } from "@/i18n/config";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";

export const ONB_LANG_PICKED_KEY = "onb-lang-picked";

/** Native-language greeting shown under the app name for the pre-selected row. */
const NATIVE_PROMPT: Record<LangCode, string> = {
  en: "Choose your language",
  es: "Elige tu idioma",
  pt: "Escolha seu idioma",
  fil: "Piliin ang iyong wika",
  hi: "अपनी भाषा चुनें",
  id: "Pilih bahasa Anda",
  fr: "Choisissez votre langue",
  de: "Wähle deine Sprache",
};

/** Continue CTA label in each language. */
const NATIVE_CONTINUE: Record<LangCode, string> = {
  en: "Continue",
  es: "Continuar",
  pt: "Continuar",
  fil: "Magpatuloy",
  hi: "आगे बढ़ें",
  id: "Lanjutkan",
  fr: "Continuer",
  de: "Weiter",
};

/** Sub-line under the title, in each language. */
const NATIVE_HINT: Record<LangCode, string> = {
  en: "You can change this any time in Settings.",
  es: "Puedes cambiarlo cuando quieras en Ajustes.",
  pt: "Você pode mudar isso quando quiser nos Ajustes.",
  fil: "Mababago mo ito anumang oras sa Settings.",
  hi: "आप इसे कभी भी सेटिंग्स में बदल सकते हैं।",
  id: "Anda bisa mengubahnya kapan saja di Pengaturan.",
  fr: "Vous pouvez le changer à tout moment dans les Réglages.",
  de: "Du kannst das jederzeit in den Einstellungen ändern.",
};

/**
 * Onboarding Step 0 — full-screen language picker.
 * Device language is pre-selected; the user confirms with the Continue button.
 */
export default function LanguageSlide({ onDone }: { onDone: () => void }) {
  const { lang, setLang } = useT();
  const [picked, setPicked] = useState<LangCode>(lang);
  const [busy, setBusy] = useState(false);

  // Tapping a language only moves the selection (instant, zero re-render of the
  // whole app). The real language switch happens once, on Continue — swapping
  // dicts on every tap was what made this screen feel glitchy.
  const choose = (code: LangCode) => {
    if (busy || code === picked) return;
    setPicked(code);
    haptic("soft");
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    haptic("medium");
    try {
      localStorage.setItem(ONB_LANG_PICKED_KEY, picked);
    } catch {}
    import("@/services/analytics")
      .then((a) => a.track("onboarding_language_picked", { lang: picked }))
      .catch(() => {});
    try {
      if (picked !== lang) await setLang(picked);
    } catch {}
    onDone();
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: "hsl(220 65% 4%)" }}
    >
      {/* Soft royal-gold glow behind the header */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          top: "-18%",
          width: "150%",
          aspectRatio: "1 / 1",
          background:
            "radial-gradient(circle at 50% 50%, hsl(42 85% 55% / 0.16) 0%, transparent 62%)",
        }}
      />

      <div
        className="relative flex-1 flex flex-col px-6 overflow-y-auto"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 18px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
        }}
      >
        <div className="mt-[clamp(18px,5svh,54px)] text-center">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.34em]"
            style={{ color: "hsl(42 85% 60%)" }}
          >
            Prayly
          </p>
          <h1
            className="mt-2 text-[clamp(20px,3.1svh,27px)] font-bold leading-tight"
            style={{ color: "hsl(40 30% 96%)" }}
          >
            {NATIVE_PROMPT[picked] ?? NATIVE_PROMPT.en}
          </h1>
          <p
            className="mt-1.5 text-[12.5px] leading-relaxed"
            style={{ color: "hsl(40 15% 70%)" }}
          >
            {NATIVE_HINT[picked] ?? NATIVE_HINT.en}
          </p>
        </div>

        {/* One single fade for the whole grid — 8 staggered per-card animations
            were the stutter on low-end Androids. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="mt-[clamp(14px,3.4svh,30px)] grid grid-cols-2 gap-[clamp(8px,2vw,12px)] pb-2"
        >
          {LANGUAGES.map((opt, i) => {
            const active = picked === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => choose(opt.code as LangCode)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center transition-transform active:scale-[0.97] ${
                  LANGUAGES.length % 2 === 1 && i === LANGUAGES.length - 1
                    ? "col-span-2"
                    : ""
                }`}
                style={{
                  minHeight: "clamp(76px, 11svh, 104px)",
                  paddingTop: "clamp(10px, 1.4svh, 16px)",
                  paddingBottom: "clamp(10px, 1.4svh, 16px)",
                  background: active
                    ? "linear-gradient(150deg, hsl(42 85% 50% / 0.18), hsl(38 100% 65% / 0.06))"
                    : "hsl(220 40% 10% / 0.9)",
                  border: active
                    ? "1px solid hsl(42 85% 58% / 0.6)"
                    : "1px solid hsl(220 30% 26% / 0.6)",
                  boxShadow: active
                    ? "0 10px 26px -14px hsl(42 85% 50% / 0.6)"
                    : "none",
                }}
              >
                {active && (
                  <span
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(42 85% 52%), hsl(38 100% 66%))",
                    }}
                  >
                    <Check
                      className="w-3 h-3"
                      strokeWidth={3}
                      style={{ color: "hsl(220 65% 8%)" }}
                    />
                  </span>
                )}
                <span className="text-[clamp(20px,2.9svh,26px)] leading-none">{opt.flag}</span>
                <span
                  className="block w-full text-[clamp(12.5px,3.6vw,14px)] font-semibold leading-tight truncate"
                  style={{ color: "hsl(40 30% 96%)" }}
                >
                  {opt.native}
                </span>
                <span
                  className="block w-full text-[clamp(10px,2.8vw,11px)] leading-tight truncate"
                  style={{ color: "hsl(40 15% 62%)" }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.97 }}
          onClick={confirm}
          disabled={busy}
          className="mt-auto pt-4 mb-1 w-full shrink-0 rounded-2xl text-[clamp(14.5px,4.2vw,15.5px)] font-bold tracking-[0.01em] disabled:opacity-70"
          style={{
            paddingTop: "clamp(13px, 1.9svh, 17px)",
            paddingBottom: "clamp(13px, 1.9svh, 17px)",
            background: "linear-gradient(135deg, hsl(42 85% 52%), hsl(38 100% 66%))",
            color: "hsl(220 65% 8%)",
            boxShadow: "0 14px 34px -16px hsl(42 85% 50% / 0.75)",
          }}
        >
          {NATIVE_CONTINUE[picked] ?? NATIVE_CONTINUE.en}
        </motion.button>

      </div>
    </motion.div>
  );
}
