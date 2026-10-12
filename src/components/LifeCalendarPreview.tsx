import { Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT, getLang } from "@/i18n";
import { toAbsoluteAssetUrl } from "@/utils/assetUrl";
import wallpaper from "@/assets/life-calendar-wallpaper.webp.asset.json";
import icon from "@/assets/life-calendar-preview.webp.asset.json";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.mylifecalendar.app";
const INSTALL: Record<string, string> = { en: "Install on Google Play", hi: "Google Play से इंस्टॉल करें", es: "Instalar en Google Play", pt: "Instalar no Google Play", fil: "I-install sa Google Play", id: "Instal di Google Play", fr: "Installer sur Google Play", de: "Bei Google Play installieren" };

export function LifeCalendarPreview({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useT();
  const storeUrl = Capacitor.getPlatform() === "android"
    ? `intent://details?id=com.mylifecalendar.app#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`
    : PLAY_URL;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-24px)] max-w-sm max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto rounded-2xl border-border p-0">
        <div className="flex items-center gap-3 px-5 pb-3 pt-5 pr-12">
          <img src={toAbsoluteAssetUrl(icon.url)} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold tracking-normal">Life Calendar</DialogTitle>
            <DialogDescription className="mt-1 text-xs">{t("settings.promo.title")}</DialogDescription>
          </div>
        </div>
        <img src={toAbsoluteAssetUrl(wallpaper.url)} alt="Life Calendar live wallpaper on a lock screen" className="mx-auto h-[min(42dvh,320px)] w-full object-contain" />
        <div className="sticky bottom-0 border-t border-border bg-background px-5 pb-5 pt-3">
          <p className="mb-3 text-center text-sm leading-relaxed text-muted-foreground">{t("settings.promo.desc")}</p>
          <Button asChild className="h-12 w-full rounded-full text-sm font-semibold whitespace-normal text-center">
            <a href={storeUrl} target="_blank" rel="noopener noreferrer"><Download />{INSTALL[getLang()] ?? INSTALL.en}</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}