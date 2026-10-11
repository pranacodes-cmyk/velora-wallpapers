import { useT } from "@/i18n";
import { PrayerAlarmToggles } from "@/components/prayer/PrayerAlarmToggles";
import { PrayerPreviewMockup } from "./OnboardingLateSlides";

export function PrayerAlarmSlide({ active }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;
  return (
    <section className="absolute inset-0 overflow-y-auto overscroll-contain bg-background text-foreground">
      <div className="mx-auto flex max-w-[440px] flex-col items-center px-5 pt-10 pb-40">
        <p className="text-xs font-bold uppercase text-primary">{t("onb.time.eyebrowPick")}</p>
        <h2 className="mt-2 mb-5 text-center text-2xl font-bold">{t("onb.time.titlePick")}</h2>
        <PrayerPreviewMockup />
        <div className="mt-4 w-full"><PrayerAlarmToggles /></div>
      </div>
    </section>
  );
}