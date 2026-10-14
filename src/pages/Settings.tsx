import { useState, useCallback, useEffect } from "react";
import { usePremium } from "@/hooks/usePremium";
import { PrayerAlarmToggles } from "@/components/prayer/PrayerAlarmToggles";

import { useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, ChevronRight, Shield, Share2, Star, Heart, BookOpen,
  ExternalLink, Info, FileText, Mail, Sun, Moon, Monitor, Trash2, SlidersHorizontal, User, Check, X, RotateCcw, Image as ImageIcon,
  Sunrise,
} from "lucide-react";
import { restorePurchases } from "@/services/revenuecat";
import { toast } from "sonner";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";


import { getUserName, setUserName } from "@/lib/userProfile";
import { useT } from "@/i18n";
import { LANGUAGES } from "@/i18n/config";

import { showPrivacyOptionsForm } from "@/services/ads";
import { Capacitor } from "@capacitor/core";
import promoLifeCalendar from "@/assets/promo-life-calendar.png";
import { reloadProJourneys } from "@/services/proJourneys";

const LIFE_CALENDAR_URL = "https://play.google.com/store/apps/details?id=com.mylifecalendar.app";

function SettingRow({ icon: Icon, label, desc, onClick, trailing, iconColor }: {
  icon: React.ElementType; label: string; desc?: string; onClick?: () => void; trailing?: React.ReactNode; iconColor?: string;
}) {
  return (
    <button
      onClick={() => { haptic("soft"); onClick?.(); }}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/30 transition-colors"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `${iconColor || "hsl(var(--muted-foreground))"}15`,
          backdropFilter: "blur(8px)",
        }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor || "hsl(var(--muted-foreground))" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        {desc && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>}
      </div>
      {trailing !== undefined ? trailing : <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
    </button>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-5 mb-1.5">{title}</p>
      <div
        className="rounded-[20px] overflow-hidden mx-3"
        style={{
          background: "hsl(var(--glass))",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid hsl(var(--glass-border))",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const divider = <div className="h-[0.5px] mx-4" style={{ background: "hsl(var(--border) / 0.15)" }} />;

const APP_VERSION_FALLBACK = "1.0";
const SUPPORT_EMAIL = "pranacodes@gmail.com";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app";

export default function Settings() {
  const { t, lang, setLang } = useT();
  const { isPremium, unlock } = usePremium();
  
  const navigate = useNavigate();
  const [premiumSheetOpen, setPremiumSheetOpen] = useState(false);
  
  const [showAbout, setShowAbout] = useState(false);
  const [dailyReminderOn, setDailyReminderOn] = useState(() => localStorage.getItem("prayly_daily_reminder_v1") !== "false");
  
  const [adPrefsAvailable, setAdPrefsAvailable] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(APP_VERSION_FALLBACK);
  const [otaVersion, setOtaVersion] = useState<string | null>(null);

  // Display name
  const [name, setName] = useState<string>(() => getUserName() ?? "");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState<string>(name);
  const saveName = useCallback(() => {
    const trimmed = nameDraft.trim().slice(0, 24);
    if (trimmed.length < 2) {
      toast.error(t("settings.profile.tooShort"));
      return;
    }
    setUserName(trimmed);
    setName(trimmed);
    setEditingName(false);
    haptic("medium");
    toast.success(t("settings.profile.updated"));
  }, [nameDraft, t]);


  // Pull real version + build number from the native Capacitor app at runtime.
  // Falls back to APP_VERSION_FALLBACK on web preview.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        // e.g. "1.0 (3)" — matches Play Store versionName + versionCode
        setAppVersion(info.build ? `${info.version} (${info.build})` : info.version);
      } catch {/* keep fallback */}
      try {
        const { getOtaVersion } = await import("@/services/ota");
        setOtaVersion(getOtaVersion());
      } catch {/* ignore */}
    })();
  }, []);



  useEffect(() => {
    if (isPremium) return; // Premium users see no ads
    // Always offer the option on native — Google requires users be able to
    // revisit consent at any time, even outside GDPR regions.
    setAdPrefsAvailable(Capacitor.isNativePlatform());
  }, [isPremium]);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(() => {
    const saved = localStorage.getItem("cw-theme");
    if (saved === "light" || saved === "dark") return saved;
    return "system";
  });

  const applyTheme = useCallback((mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("cw-theme", mode);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeLight = mode === "light" || (mode === "system" && !prefersDark);
    if (shouldBeLight) document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
    haptic("soft");
  }, []);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) document.documentElement.classList.remove("light");
      else document.documentElement.classList.add("light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  const handleShare = useCallback(async () => {
    const { nativeShare } = await import("@/utils/nativeShare");
    await nativeShare({
      title: t("share.title"),
      text: t("share.text"),
      url: PLAY_STORE_URL,
      dialogTitle: t("share.dialogTitle"),
    });
  }, [t]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto scroll-container pb-28">
        {/* Header */}
        <div
          className="px-5 pt-4 pb-5 safe-top"
          style={{
            background: "hsl(var(--glass))",
            backdropFilter: "blur(30px) saturate(180%)",
            WebkitBackdropFilter: "blur(30px) saturate(180%)",
            borderBottom: "1px solid hsl(var(--glass-border))",
          }}
        >
          <h1 className="text-2xl font-black tracking-tight text-foreground">{t("settings.title")}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("settings.subtitle")}</p>
        </div>

        {/* Premium Card */}
        <div className="px-3 mt-5 mb-5">
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic("medium"); if (!isPremium) setPremiumSheetOpen(true); }}
            className="rounded-[20px] p-4 relative overflow-hidden cursor-pointer"
            style={{
              background: isPremium
                ? "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))"
                : "hsl(var(--glass))",
              backdropFilter: "blur(20px) saturate(180%)",
              border: isPremium
                ? "1px solid hsl(var(--primary) / 0.25)"
                : "1px solid hsl(var(--glass-border))",
              boxShadow: isPremium ? "0 8px 32px hsl(var(--primary) / 0.15)" : undefined,
            }}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                  boxShadow: "0 4px 16px hsl(var(--primary) / 0.4)",
                }}
              >
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold" style={{ color: isPremium ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
                  {isPremium ? t("settings.premium.active") : t("settings.premium.go")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isPremium ? t("settings.premium.activeDesc") : t("settings.premium.goDesc")}
                </p>
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-[10px] font-extrabold"
                style={{
                  background: isPremium ? "hsl(var(--primary) / 0.12)" : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                  color: isPremium ? "hsl(var(--primary))" : "white",
                  border: isPremium ? "1px solid hsl(var(--primary) / 0.2)" : "none",
                }}
              >
                {isPremium ? t("settings.premium.badgePro") : t("settings.premium.badgeUpgrade")}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Profile */}
        <SettingSection title={t("settings.section.profile")}>
          <div className="px-4 py-3.5 flex items-center gap-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--primary) / 0.15)" }}
            >
              <User className="w-[18px] h-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("settings.profile.yourName")}
              </p>
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") { setEditingName(false); setNameDraft(name); }
                  }}
                  placeholder={t("settings.profile.placeholder")}
                  className="mt-1 w-full bg-transparent outline-none text-[14px] font-bold text-foreground border-b border-primary/40 pb-1"
                />
              ) : (
                <p className="mt-0.5 text-[14px] font-bold text-foreground truncate">
                  {name || t("settings.profile.notSet")}
                </p>
              )}
            </div>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setEditingName(false); setNameDraft(name); haptic("soft"); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/40"
                  aria-label={t("common.cancel")}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={saveName}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(var(--primary))" }}
                  aria-label={t("settings.profile.saveAria")}
                >
                  <Check className="w-4 h-4" style={{ color: "hsl(220 65% 8%)" }} strokeWidth={2.6} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { haptic("soft"); setNameDraft(name); setEditingName(true); }}
                className="text-[11px] font-bold text-primary px-3 py-1.5 rounded-full"
                style={{ background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.25)" }}
              >
                {t("settings.profile.edit")}
              </button>
            )}
          </div>
        </SettingSection>

        {/* Appearance */}
        <SettingSection title={t("settings.section.appearance")}>
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold text-foreground mb-2.5">{t("settings.theme")}</p>
            <div className="flex gap-2">
              {([
                { id: "system" as const, label: t("settings.theme.system"), icon: Monitor },
                { id: "light" as const, label: t("settings.theme.light"), icon: Sun },
                { id: "dark" as const, label: t("settings.theme.dark"), icon: Moon },
              ]).map((opt) => {
                const active = themeMode === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => applyTheme(opt.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[11px] font-bold transition-all duration-200 ${
                      active
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <opt.icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.5} />
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </SettingSection>

        {/* My Library */}
        {/* Language */}
        <SettingSection title={t("settings.section.language")}>
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold text-foreground">{t("settings.language")}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {t("settings.language.desc")}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {LANGUAGES.map((opt) => {
                const active = lang === opt.code;
                return (
                  <motion.button
                    key={opt.code}
                    whileTap={{ scale: 0.96 }}
                    onClick={async () => {
                      if (active) return;
                      haptic("soft");
                      await setLang(opt.code);
                      toast.success(t("settings.language.changed"));
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 ${
                      active
                        ? "bg-primary/15 ring-1 ring-primary/30"
                        : "bg-muted/30"
                    }`}
                  >
                    <span className="text-[15px] leading-none">{opt.flag}</span>
                    <span className={`flex-1 min-w-0 text-[11.5px] font-bold truncate ${active ? "text-primary" : "text-foreground/80"}`}>
                      {opt.native}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={2.8} />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </SettingSection>

        <SettingSection title={t("reminder.section")}>
          <SettingRow icon={Sunrise} label="Daily Prayer Reminder" desc="A quiet prayer card at 7 AM and 9 PM. No sound, no vibration." iconColor="hsl(var(--primary))"
            onClick={() => { const v = !dailyReminderOn; setDailyReminderOn(v); localStorage.setItem("prayly_daily_reminder_v1", v ? "true" : "false"); }}
            trailing={<span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${dailyReminderOn ? "bg-primary" : "bg-muted"}`}><span className={`block w-5 h-5 rounded-full bg-background transition-transform ${dailyReminderOn ? "translate-x-4" : ""}`} /></span>} />
        </SettingSection>

        <PrayerAlarmToggles />
        <SettingSection title={t("nav.prayscreen")}>
          <SettingRow icon={Shield} label={t("nav.prayscreen")} iconColor="hsl(var(--primary))" onClick={() => navigate("/prayscreen")} />
        </SettingSection>

        <SettingSection title={t("settings.section.library")}>
          <SettingRow icon={BookOpen} label={t("bible.read")} onClick={() => navigate("/bible")} />

          <SettingRow
            icon={Heart}
            label={t("settings.saved")}
            desc={t("settings.savedDesc")}
            iconColor="hsl(0 70% 60%)"
            onClick={() => navigate("/favorites")}
          />
        </SettingSection>



        {/* More from us — cross-promotion */}
        <SettingSection title={t("settings.section.more")}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic("medium"); window.open(LIFE_CALENDAR_URL, "_blank"); }}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/30 transition-colors"
          >
            <img
              src={promoLifeCalendar}
              alt="Life Calendar Live Wallpaper app icon"
              loading="lazy"
              width={44}
              height={44}
              className="w-11 h-11 rounded-2xl flex-shrink-0 object-cover"
              style={{ boxShadow: "0 4px 14px hsl(35 90% 55% / 0.35)" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-foreground truncate">{t("settings.promo.title")}</p>
                <span
                  className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md tracking-wider"
                  style={{ background: "hsl(35 90% 55% / 0.18)", color: "hsl(35 90% 55%)" }}
                >
                  {t("settings.promo.badge")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug truncate">
                {t("settings.promo.desc")}
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          </motion.button>
        </SettingSection>

        <SettingSection title={t("settings.section.support")}>
          <SettingRow icon={Star} label={t("settings.rate")} desc={t("settings.rateDesc")} iconColor="hsl(var(--primary))" onClick={() => window.open(PLAY_STORE_URL, "_blank")} trailing={<ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40" />} />
          {divider}
          <SettingRow icon={Share2} label={t("settings.share")} desc={t("settings.shareDesc")} iconColor="hsl(160 55% 45%)" onClick={handleShare} trailing={null} />
          {divider}
          <SettingRow
            icon={RotateCcw}
            label={t("settings.restore")}
            desc={t("settings.restoreDesc")}
            iconColor="hsl(45 90% 55%)"
            onClick={async () => {
              const toastId = toast.loading(t("settings.restore.loading"));
              try {
                const ok = await restorePurchases();
                toast.dismiss(toastId);
                if (ok) {
                  unlock();
                  toast.success(t("settings.restore.success"));
                } else {
                  toast.message(t("settings.restore.none"));
                }
              } catch {
                toast.dismiss(toastId);
                toast.error(t("settings.restore.error"));
              }

            }}
          />
          {divider}
          <SettingRow icon={Mail} label={t("settings.contact")} desc={t("settings.contactDesc")} iconColor="hsl(200 65% 50%)" onClick={() => window.open(`mailto:${SUPPORT_EMAIL}`, "_blank")} trailing={<ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40" />} />
        </SettingSection>

        <SettingSection title={t("settings.section.legal")}>
          <SettingRow icon={Shield} label={t("settings.privacy")} iconColor="hsl(var(--muted-foreground))" onClick={() => navigate("/privacy-policy")} />
          {divider}
          <SettingRow icon={FileText} label={t("settings.terms")} iconColor="hsl(var(--muted-foreground))" onClick={() => navigate("/terms-of-service")} />
          {adPrefsAvailable && (
            <>
              {divider}
              <SettingRow
                icon={SlidersHorizontal}
                label={t("settings.adPrefs")}
                desc={t("settings.adPrefsDesc")}
                iconColor="hsl(200 65% 50%)"
                onClick={async () => {
                  const shown = await showPrivacyOptionsForm();
                  if (!shown) toast.error(t("settings.adPrefs.error"));
                }}
              />
            </>
          )}
          {divider}
          <SettingRow
            icon={Trash2}
            label={t("settings.delete")}
            desc={t("settings.deleteDesc")}
            iconColor="hsl(0 65% 55%)"
            onClick={() => {
              const confirmed = window.confirm(t("settings.delete.confirm"));
              if (!confirmed) return;
              try {
                // Preserve theme preference; wipe everything else.
                const theme = localStorage.getItem("cw-theme");
                localStorage.clear();
                if (theme) localStorage.setItem("cw-theme", theme);
                reloadProJourneys();
                toast.success(t("settings.delete.success"));
              } catch {
                toast.error(t("settings.delete.error"));
              }
              window.open(
                `mailto:${SUPPORT_EMAIL}?subject=Data%20Deletion%20Request&body=Please%20delete%20any%20anonymous%20identifiers%20associated%20with%20my%20device.`,
                "_blank"
              );
            }}
            trailing={<ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
          />
        </SettingSection>

        <SettingSection title={t("settings.section.about")}>
          <SettingRow
            icon={Info}
            label={t("settings.about")}
            desc={t("settings.version", { version: appVersion })}
            iconColor="hsl(var(--primary))"
            onClick={() => setShowAbout(!showAbout)}
            trailing={<motion.div animate={{ rotate: showAbout ? 90 : 0 }}><ChevronRight className="w-4 h-4 text-muted-foreground/40" /></motion.div>}
          />
          <AnimatePresence>
            {showAbout && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-1">
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    {t("settings.aboutBody")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SettingSection>


        <div className="flex flex-col items-center gap-1.5 py-6 pb-8">
          <p className="text-[10px] font-medium text-muted-foreground/30 select-none">
            Prayly v{appVersion}{otaVersion ? ` · ${otaVersion}` : ""}
          </p>



          <div className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-primary/20" />
            <p className="text-[10px] font-semibold tracking-wide text-primary/60">
              {t("settings.madeBy")}
            </p>
            <span className="text-primary/70 text-[10px]">✝︎</span>
            <span className="h-px w-4 bg-primary/20" />
          </div>
          <p className="text-[9px] text-muted-foreground/25 italic">{t("settings.tagline")}</p>
        </div>
      </div>

      <PremiumSheet isOpen={premiumSheetOpen} onClose={() => setPremiumSheetOpen(false)} onUnlock={unlock} trigger="settings" />
    </div>
  );
}

