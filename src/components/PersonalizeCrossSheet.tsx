import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, Pencil } from "lucide-react";
import {
  PERSONAL_VERSES,
  getPersonalName,
  getPersonalVerse,
  getPersonalVerses,
  setPersonal,
  type PersonalVerse,
} from "@/lib/personalCross";
import { PARALLAX_SCENES, sceneFgCard } from "@/data/parallaxScenes";
import { useT } from "@/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Personalize Cross sheet — name + verse pick with a live-preview cross tile
 * on top. Saves to localStorage so the Today hero updates instantly.
 */
export function PersonalizeCrossSheet({ open, onClose }: Props) {
  const { t, version } = useT();
  const scene = PARALLAX_SCENES[0]; // holy cross
  const [name, setName] = useState("");
  const [verseId, setVerseId] = useState<string>(PERSONAL_VERSES[0].id);

  useEffect(() => {
    if (!open) return;
    setName(getPersonalName());
    setVerseId(getPersonalVerse().id);
  }, [open]);

  // Localized list + selection so the engraved line follows the app language.
  const verses = useMemo(() => getPersonalVerses(), [version]);
  const verse: PersonalVerse = verses.find((v) => v.id === verseId) || verses[0];

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    setPersonal(name, verseId);
    try { navigator.vibrate?.(12); } catch { /* noop */ }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[101] max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-8"
            style={{
              background: "hsl(var(--background))",
              borderTop: "1px solid hsl(var(--glass-border))",
              boxShadow: "0 -24px 60px -12px hsl(0 0% 0% / 0.7)",
              paddingTop: "0.5rem",
            }}
          >
            {/* Grip */}
            <div className="flex justify-center pt-1.5 pb-2">
              <div className="w-10 h-1 rounded-full bg-foreground/25" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                    boxShadow: "0 4px 12px hsl(var(--primary) / 0.4)",
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: "hsl(220 40% 10%)" }} strokeWidth={2.6} />
                </div>
                <div>
                  <h2 className="text-[15px] font-black tracking-tight text-foreground">{t("px.sheet.title")}</h2>
                  <p className="text-[10.5px] font-semibold text-muted-foreground tracking-wide">
                    {t("px.sheet.subtitle")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-foreground/8 active:opacity-70"
              >
                <X className="w-4 h-4 text-foreground/70" strokeWidth={2.4} />
              </button>
            </div>

            {/* Live preview tile removed — kept edit sheet lightweight and lag-free.
                Users see the true preview on the ParallaxPreview page behind the sheet. */}

            {/* Name input */}
            <div className="px-5 mb-5">
              <label className="text-[10px] font-black tracking-[0.18em] uppercase text-primary/80 flex items-center gap-1.5 mb-2">
                <Pencil className="w-3 h-3" strokeWidth={2.6} /> {t("px.sheet.nameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 22))}
                placeholder={t("px.sheet.namePlaceholder")}
                maxLength={22}
                autoFocus={!name}
                className="w-full px-4 py-3 rounded-2xl text-[15px] font-bold text-foreground placeholder:text-foreground/30 outline-none"
                style={{
                  background: "hsl(var(--secondary) / 0.5)",
                  border: "1.5px solid hsl(var(--primary) / 0.35)",
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                {t("px.sheet.namePrivacy", { count: name.length })}
              </p>
            </div>

            {/* Verse picker */}
            <div className="px-5 mb-5">
              <label className="text-[10px] font-black tracking-[0.18em] uppercase text-primary/80 mb-2 block">
                {t("px.sheet.verseLabel")}
              </label>
              <div className="grid gap-2">
                {verses.map((v) => {
                  const active = v.id === verseId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVerseId(v.id)}
                      className="text-left px-3.5 py-3 rounded-2xl transition-all active:scale-[0.99]"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))"
                          : "hsl(var(--secondary) / 0.4)",
                        border: active
                          ? "1.5px solid hsl(var(--primary) / 0.7)"
                          : "1px solid hsl(var(--glass-border))",
                        boxShadow: active
                          ? "0 4px 14px hsl(var(--primary) / 0.2)"
                          : "none",
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0"
                          style={{
                            background: active ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.1)",
                            border: active ? "none" : "1px solid hsl(var(--foreground) / 0.2)",
                          }}
                        >
                          {active && <Check className="w-2.5 h-2.5" style={{ color: "hsl(220 40% 10%)" }} strokeWidth={3.5} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold italic text-foreground leading-snug" style={{ fontFamily: "'Georgia', serif" }}>
                            "{v.text}"
                          </p>
                          <p className="text-[10px] font-black tracking-[0.14em] uppercase mt-1" style={{ color: "hsl(var(--primary) / 0.9)" }}>
                            — {v.reference}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save + secondary "use original" */}
            <div className="px-5 sticky bottom-0 pt-2 pb-1 space-y-2" style={{ background: "linear-gradient(to top, hsl(var(--background)) 60%, transparent)" }}>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="w-full py-3.5 rounded-2xl text-[14px] font-black tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background: canSave
                    ? "linear-gradient(135deg, hsl(0 85% 58%), hsl(0 75% 42%))"
                    : "hsl(var(--secondary))",
                  color: canSave ? "hsl(30 40% 98%)" : "hsl(var(--muted-foreground))",
                  boxShadow: canSave ? "0 10px 26px -8px hsl(0 85% 45% / 0.6)" : "none",
                }}
              >
                <Sparkles className="w-4 h-4" strokeWidth={2.8} />
                {canSave ? t("px.sheet.saveCta") : t("px.sheet.saveCtaDisabled")}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl text-[12px] font-bold tracking-wide text-foreground/70 active:opacity-60"
                style={{ background: "hsl(var(--secondary) / 0.5)", border: "1px solid hsl(var(--glass-border))" }}
              >
                {t("px.sheet.skipCta")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Compact static preview of the cross with engraved name + verse. */
function PreviewCross({
  scene,
  name,
  verse,
}: {
  scene: typeof PARALLAX_SCENES[number];
  name: string;
  verse: PersonalVerse;
}) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "4 / 5",
        borderRadius: "22px",
        background: "hsl(var(--secondary) / 0.4)",
        border: "1px solid hsl(var(--primary) / 0.4)",
        boxShadow: "0 18px 36px -18px hsl(0 0% 0% / 0.7), 0 0 20px hsl(var(--primary) / 0.15)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${scene.bgCard || scene.bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: scene.grade, mixBlendMode: "multiply" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: scene.halo, mixBlendMode: "screen" }} />
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            height: `${scene.fgHeight}%`,
            bottom: "0%",
            aspectRatio: "832 / 1472",
            WebkitMaskImage: "linear-gradient(180deg, #000 90%, transparent 100%)",
            maskImage: "linear-gradient(180deg, #000 90%, transparent 100%)",
            filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.55))",
          }}
        >
          <img src={sceneFgCard(scene)} alt={scene.name} className="absolute inset-0 w-full h-full object-contain" />
        </div>
      </div>

      <EngravedOverlay name={name} verse={verse} />
    </div>
  );
}

/** Shared engraved overlay — used in preview and in the live tile.
 *  Palette is tuned for the crimson-neon Holy Cross image: warm ivory name
 *  with a red-glow drop shadow, cream verse, and neon-crimson reference so
 *  everything reads like it belongs to the same stained-glass composition. */
export function EngravedOverlay({
  name,
  verse,
  compact = false,
}: {
  name: string;
  verse: PersonalVerse;
  compact?: boolean;
}) {
  const { t } = useT();
  const displayName = name.trim() || t("px.yourNamePlaceholder");
  const isPlaceholder = !name.trim();

  const verseSize = compact ? "9px" : "10.5px";
  const labelSize = compact ? "7px" : "8px";
  const nameSize = compact
    ? displayName.length > 14
      ? "14px"
      : displayName.length > 9
        ? "16px"
        : "18px"
    : displayName.length > 14
      ? "18px"
      : displayName.length > 9
        ? "21px"
        : "24px";

  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none z-10 px-4 gap-2.5 ${compact ? "pb-4" : "pb-6"}`}>
      {/* Verse block first */}
      <div className={`text-center ${compact ? "max-w-[88%]" : "max-w-[82%]"}`}>
        <p
          className="italic leading-[1.4]"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontWeight: 500,
            color: "hsl(38 60% 99%)",
            fontSize: verseSize,
            textShadow: "0 2px 6px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)",
            opacity: isPlaceholder ? 0.7 : 1,
          }}
        >
          "{verse.text}"
        </p>
      </div>

      {/* "Jesus loves ___" — sits below the verse as the signature line */}
      <div className={`text-center ${compact ? "max-w-[88%]" : "max-w-[82%]"}`}>
        <p
          className="mb-1 uppercase tracking-[0.32em]"
          style={{
            fontSize: labelSize,
            fontWeight: 800,
            color: "hsl(42 96% 70%)",
            textShadow:
              "0 1px 3px rgba(0,0,0,0.95), 0 0 10px hsl(42 90% 45% / 0.55)",
            opacity: isPlaceholder ? 0.75 : 1,
          }}
        >
          {t("px.jesusLoves")}
        </p>
        <p
          className="tracking-[0.02em] leading-none"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontWeight: 700,
            fontStyle: "italic",
            fontSize: nameSize,
            color: "hsl(38 55% 97%)",
            textShadow:
              "0 2px 5px rgba(0,0,0,0.95), 0 0 16px hsl(42 90% 45% / 0.55), 0 0 26px rgba(0,0,0,0.7)",
            opacity: isPlaceholder ? 0.7 : 1,
          }}
        >
          {displayName}
        </p>
      </div>
    </div>
  );
}

