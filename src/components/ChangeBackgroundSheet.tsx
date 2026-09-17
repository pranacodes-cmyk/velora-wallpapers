import { useState, useEffect, useSyncExternalStore, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, Download, Crown, Lock } from "lucide-react";
import {
  readActiveMoodPack,
  setActiveMoodPack,
  subscribeActiveMoodPack,
} from "@/data/verseMoodPacks";
import {
  VERSE_PACK_GROUPS,
  getPacksByGroup,
  getVersePack,
  isValidVersePackId,
  VERSE_PACKS,
  type VersePack,
} from "@/data/versePacks";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";
import {
  packLabel,
  packGroupTitle,
  packGroupSubtitle,
} from "@/i18n/packs";

interface Props {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
  onProUpsell: () => void;
  /** Fires after a pack is activated/downloaded so the parent can auto-launch
   *  the live-wallpaper apply flow — user expects the picker to pop up right
   *  after download so they SEE the verses rendered on their lockscreen. */
  onPackReadyToApply?: (packId: string) => void;
}

const DOWNLOADED_PACKS_KEY = "jwbp_downloaded_mood_packs_v1";

function readDownloaded(): Set<string> {
  try {
    const raw = localStorage.getItem(DOWNLOADED_PACKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch { return new Set(); }
}
function persistDownloaded(set: Set<string>) {
  try { localStorage.setItem(DOWNLOADED_PACKS_KEY, JSON.stringify([...set])); } catch { /* */ }
}

const DEFAULT_PACK_ID = VERSE_PACKS[0]?.id ?? "peace";

export function ChangeBackgroundSheet({ open, onClose, isPremium, onProUpsell, onPackReadyToApply }: Props) {
  const { t } = useT();
  const stored = useSyncExternalStore(subscribeActiveMoodPack, readActiveMoodPack, () => null);
  const activePackId = isValidVersePackId(stored) ? stored : null;

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PACK_ID);
  const [downloaded, setDownloaded] = useState<Set<string>>(() => readDownloaded());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;
    setDownloaded(readDownloaded());
    setBusy(false);
    setProgress(0);
    if (activePackId) setSelectedId(activePackId);
    track("verse_packs_sheet_opened", { is_premium: isPremium });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pack: VersePack = useMemo(
    () => getVersePack(selectedId) || getVersePack(DEFAULT_PACK_ID)!,
    [selectedId],
  );
  const previewVerses = pack.verses.slice(0, 2);
  const isActive = activePackId === pack.id;
  const isDownloaded = downloaded.has(pack.id);

  const pushPackToNative = async (packId: string, clear = false) => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const DailyVerseWallpaper = (await import("@/plugins/daily-verse-wallpaper")).default;
      if (clear) {
        await DailyVerseWallpaper.setMoodPackVerses({ mood: "", verses: [] });
        return;
      }
      const p = getVersePack(packId);
      if (!p) return;
      const verses = p.verses.map((v) => ({ text: v.text, reference: v.reference }));
      await DailyVerseWallpaper.setMoodPackVerses({ mood: packId, verses });
    } catch { /* native bridge missing in web preview is fine */ }
  };

  const handleCTA = async () => {
    haptic("medium");
    if (busy) return;

    // Active → turn off (also clears the native override)
    if (isActive) {
      setActiveMoodPack(null);
      await pushPackToNative(pack.id, true);
      track("verse_pack_deactivated", { mood: pack.id });
      return;
    }

    if (!isPremium) {
      track("verse_pack_paywall_triggered", { mood: pack.id });
      onProUpsell();
      return;
    }

    if (isDownloaded) {
      setActiveMoodPack(pack.id);
      await pushPackToNative(pack.id);
      track("verse_pack_activated", { mood: pack.id, just_downloaded: false });
      onPackReadyToApply?.(pack.id);
      onClose();
      return;
    }

    setBusy(true);
    setProgress(0);
    track("verse_pack_download_started", { mood: pack.id });
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, 30));
      setProgress(Math.round((i / steps) * 100));
    }
    const next = new Set(downloaded);
    next.add(pack.id);
    setDownloaded(next);
    persistDownloaded(next);
    setActiveMoodPack(pack.id);
    await pushPackToNative(pack.id);
    track("verse_pack_activated", { mood: pack.id, just_downloaded: true });
    haptic("heavy");
    setBusy(false);
    onPackReadyToApply?.(pack.id);
    onClose();
    import("@/services/rating").then((m) => {
      setTimeout(() => m.maybeRequestRating(), 5000);
    }).catch(() => {});

  };

  const ctaLabel = isActive
    ? t("wp.packs.ctaTurnOff")
    : !isPremium
      ? t("wp.packs.ctaUnlock", { label: packLabel(pack.id, pack.label) })
      : isDownloaded
        ? t("wp.packs.ctaUse", { label: packLabel(pack.id, pack.label) })
        : t("wp.packs.ctaGet", { label: packLabel(pack.id, pack.label) });

  const CtaIcon = isActive ? Check : !isPremium ? Crown : isDownloaded ? Sparkles : Download;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/75"
            style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="fixed left-0 right-0 bottom-0 z-[81] rounded-t-[28px] overflow-hidden flex flex-col"
            style={{
              maxHeight: "92vh",
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.65)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <div className="w-9" />
              <div className="flex-1 text-center">
                <div className="mx-auto w-10 h-1 rounded-full bg-foreground/15 mb-3" />
                <div className="inline-flex items-center gap-1.5">
                  <h2 className="text-[17px] font-black tracking-tight">
                    {t("wp.packs.title")}
                  </h2>
                  {!isPremium && (
                    <span
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-black tracking-wider text-white"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                      }}
                    >
                      <Crown className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-foreground/70 font-semibold mt-1 leading-snug">
                  {t("wp.packs.subtitle")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: "hsl(var(--foreground) / 0.08)",
                  border: "1px solid hsl(var(--foreground) / 0.1)",
                }}
                aria-label={t("px.close")}
              >
                <X className="w-4 h-4 text-foreground/80" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {VERSE_PACK_GROUPS.map((group) => {
                const groupPacks = getPacksByGroup(group.id);
                const selectedInGroup = groupPacks.some((p) => p.id === selectedId);
                return (
                <section key={group.id} className="mt-3">
                  <h3 className="text-[13px] font-black tracking-tight text-foreground px-1">
                    {packGroupTitle(group.id, group.title)}
                  </h3>
                  <p className="text-[10.5px] text-foreground/60 font-semibold px-1 mt-0.5 mb-2">
                    {packGroupSubtitle(group.id, group.subtitle)}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {groupPacks.map((p) => {
                      const selected = p.id === selectedId;
                      const activeHere = activePackId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { haptic("soft"); setSelectedId(p.id); }}
                          className="relative rounded-2xl p-2.5 flex flex-col items-center text-center transition-colors min-h-[112px]"
                          style={{
                            background: selected
                              ? "hsl(var(--primary) / 0.14)"
                              : "hsl(var(--foreground) / 0.05)",
                            border: selected
                              ? "1.5px solid hsl(var(--primary) / 0.55)"
                              : "1px solid hsl(var(--foreground) / 0.08)",
                          }}
                        >
                          {/* Status corner badge */}
                          <span className="absolute top-1.5 right-1.5 flex items-center justify-center">
                            {activeHere ? (
                              <span
                                className="px-1.5 py-0.5 rounded-md text-[7.5px] font-black tracking-wider"
                                style={{
                                  background: "hsl(var(--accent))",
                                  color: "hsl(var(--accent-foreground, 0 0% 100%))",
                                }}
                              >
                                {t("wp.packs.on")}
                              </span>
                            ) : !isPremium ? (
                              <Lock className="w-3 h-3 text-foreground/35" />
                            ) : selected ? (
                              <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
                            ) : null}
                          </span>

                          <span
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[21px] flex-shrink-0 mb-1.5"
                            style={{
                              background: selected
                                ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))"
                                : "hsl(var(--foreground) / 0.07)",
                            }}
                          >
                            {p.emoji}
                          </span>
                          <span className="text-[12px] font-black tracking-tight text-foreground leading-tight line-clamp-2 w-full">
                            {packLabel(p.id, p.label)}
                          </span>
                          <span className="text-[9px] text-foreground/50 font-bold tracking-wide mt-1">
                            {t("wp.packs.daily")}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Preview panel for the selected pack — full width under its group */}
                  <AnimatePresence initial={false}>
                    {selectedInGroup && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2.5 pb-1 px-1 space-y-1.5">
                          <p className="text-[10px] font-black tracking-wider uppercase text-primary px-0.5">
                            {t("wp.packs.preview", { label: packLabel(pack.id, pack.label) })}
                          </p>
                          {previewVerses.map((v, i) => (
                            <div
                              key={`${pack.id}-${i}`}
                              className="rounded-xl p-2.5"
                              style={{
                                background: "hsl(var(--foreground) / 0.045)",
                                border: "1px solid hsl(var(--foreground) / 0.07)",
                              }}
                            >
                              <p className="text-[11.5px] italic text-foreground/90 leading-snug">
                                "{v.text}"
                              </p>
                              <p className="text-[9.5px] font-black tracking-wider text-primary mt-1">
                                — {v.reference.toUpperCase()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
                );
              })}

              {!isPremium && (
                <div
                  className="mt-4 rounded-2xl p-3 flex items-start gap-2"
                  style={{
                    background: "hsl(var(--primary) / 0.1)",
                    border: "1px dashed hsl(var(--primary) / 0.45)",
                  }}
                >
                  <Crown className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-[10.5px] text-foreground/80 font-semibold leading-snug">
                    {t("wp.packs.proUnlock", { count: VERSE_PACKS.length })}
                  </p>
                </div>
              )}

              {/* Progress bar (download) */}
              {busy && (
                <div className="mt-3 px-1">
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ background: "hsl(var(--foreground) / 0.08)" }}
                  >
                    <motion.div
                      className="h-full"
                      style={{
                        background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                      }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear", duration: 0.05 }}
                    />
                  </div>
                  <p className="text-[10px] text-foreground/65 font-semibold tracking-wide mt-1.5 text-center">
                    {t("wp.packs.gettingProgress", { label: packLabel(pack.id, pack.label), p: progress })}
                  </p>
                </div>
              )}
            </div>

            {/* Sticky CTA */}
            <div
              className="flex-shrink-0 px-4 pt-3 pb-5"
              style={{
                background: "linear-gradient(to top, hsl(var(--background)) 70%, hsl(var(--background) / 0))",
                borderTop: "1px solid hsl(var(--foreground) / 0.06)",
              }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCTA}
                disabled={busy}
                className="w-full relative overflow-hidden rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-80"
                style={{
                  background: isActive
                    ? "hsl(var(--foreground) / 0.08)"
                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.82))",
                  color: isActive ? "hsl(var(--foreground) / 0.85)" : "hsl(var(--primary-foreground))",
                  border: isActive ? "1px solid hsl(var(--foreground) / 0.12)" : "none",
                  boxShadow: isActive ? undefined : "0 14px 32px -10px hsl(var(--primary) / 0.6)",
                }}
              >
                {!isPremium && !isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 right-0 h-full w-16"
                    style={{
                      background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)",
                      animation: "ctaShimmer 2.4s ease-in-out infinite",
                    }}
                  />
                )}
                <CtaIcon className="w-5 h-5" strokeWidth={isActive ? 3 : 2.5} />
                <span className="text-[14px] font-black tracking-tight">
                  {busy ? t("wp.packs.gettingReady", { p: progress }) : ctaLabel}
                </span>
                {!isPremium && !isActive && !busy && (
                  <Lock className="w-3.5 h-3.5 ml-1 opacity-90" />
                )}
              </motion.button>
              {!isPremium && !isActive && !busy && (
                <p className="text-[10.5px] text-foreground/60 text-center mt-2 font-semibold tracking-wide">
                  <Crown className="inline w-3 h-3 text-primary -mt-0.5 mr-1" />
                  {t("wp.packs.trial")}
                </p>
              )}
              {isActive && (
                <p className="text-[10.5px] text-foreground/60 text-center mt-2 font-semibold">
                  {t("wp.packs.dailyVerseTip", { label: packLabel(pack.id, pack.label) })}
                </p>
              )}
            </div>

            <style>{`
              @keyframes ctaShimmer {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(220%); }
              }
            `}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
