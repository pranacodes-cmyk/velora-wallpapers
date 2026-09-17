import { useSyncExternalStore } from "react";
import { Check, Crown, Lock } from "lucide-react";
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
} from "@/data/versePacks";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { toast } from "sonner";
import { useT } from "@/i18n";
import {
  packLabel,
  packTagline,
  packGroupTitle,
  packGroupSubtitle,
} from "@/i18n/packs";

interface Props {
  isPremium: boolean;
  onProUpsell: () => void;
  /** Fired after a pack is activated so the parent can launch the apply flow. */
  onPackActivated?: (packId: string) => void;
}

async function pushPackToNative(packId: string, clear = false) {
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
    await DailyVerseWallpaper.setMoodPackVerses({
      mood: packId,
      verses: p.verses.map((v) => ({ text: v.text, reference: v.reference })),
    });
  } catch { /* web preview has no native bridge */ }
}

/**
 * Every verse pack, mapped out right on the setup page — no hidden sheet.
 * Deliberately plain DOM (no per-tile animation) so tapping is instant on
 * low-end Android.
 */
export function VersePackPicker({ isPremium, onProUpsell, onPackActivated }: Props) {
  const { t } = useT();
  const stored = useSyncExternalStore(subscribeActiveMoodPack, readActiveMoodPack, () => null);
  const activePackId = isValidVersePackId(stored) ? stored : null;

  const handleTap = async (packId: string) => {
    haptic("soft");
    if (!isPremium) {
      track("verse_pack_paywall_triggered", { mood: packId });
      onProUpsell();
      return;
    }
    if (activePackId === packId) {
      setActiveMoodPack(null);
      await pushPackToNative(packId, true);
      track("verse_pack_deactivated", { mood: packId });
      toast.success(t("wp.packs.deactivatedToast"));
      return;
    }
    setActiveMoodPack(packId);
    await pushPackToNative(packId);
    track("verse_pack_activated", { mood: packId, just_downloaded: false });
    const p = getVersePack(packId);
    toast.success(
      t("wp.packs.activatedToast", {
        label: p ? packLabel(p.id, p.label) : "Pack",
      })
    );
    onPackActivated?.(packId);
    import("@/services/rating").then((m) => {
      setTimeout(() => m.maybeRequestRating(), 4000);
    }).catch(() => {});

  };

  return (
    <section className="mt-2 px-3">
      <div
        className="rounded-[22px] p-3.5"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.13) 0%, hsl(var(--accent) / 0.09) 55%, hsl(var(--primary) / 0.06) 100%)",
          border: `1.5px solid hsl(var(--primary) / ${isPremium ? 0.5 : 0.4})`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[14px] font-black tracking-tight text-foreground leading-tight">
              {t("wp.packs.headerTitle")}
            </h3>
            <p className="text-[10.5px] text-foreground/70 font-semibold mt-0.5">
              {t("px.packs.countSub", { count: VERSE_PACKS.length })}
            </p>

          </div>
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.82))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {isPremium ? <><Check className="w-2.5 h-2.5" strokeWidth={3} /> {t("wp.packs.unlocked")}</> : <><Crown className="w-2.5 h-2.5" /> PRO</>}
          </span>
        </div>

        {VERSE_PACK_GROUPS.map((group) => (
          <div key={group.id} className="mt-3.5">
            <p className="text-[11.5px] font-black tracking-tight text-foreground/90 px-0.5">
              {packGroupTitle(group.id, group.title)}
            </p>
            <p className="text-[10px] text-foreground/55 font-semibold px-0.5 mt-0.5 mb-2">
              {packGroupSubtitle(group.id, group.subtitle)}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {getPacksByGroup(group.id).map((p) => {
                const active = activePackId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleTap(p.id)}
                    className="relative rounded-2xl p-2.5 text-left flex flex-col active:opacity-70"
                    style={{
                      background: active
                        ? "hsl(var(--primary) / 0.16)"
                        : "hsl(var(--foreground) / 0.05)",
                      border: active
                        ? "1.5px solid hsl(var(--primary) / 0.6)"
                        : "1px solid hsl(var(--foreground) / 0.08)",
                    }}
                  >
                    <span className="absolute top-2 right-2">
                      {active ? (
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[7.5px] font-black tracking-wider"
                          style={{
                            background: "hsl(var(--primary))",
                            color: "hsl(var(--primary-foreground))",
                          }}
                        >
                          {t("wp.packs.on")}
                        </span>
                      ) : !isPremium ? (
                        <Lock className="w-3 h-3 text-foreground/35" />
                      ) : null}
                    </span>

                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] mb-1.5"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))"
                          : "hsl(var(--foreground) / 0.07)",
                      }}
                      aria-hidden
                    >
                      {p.emoji}
                    </span>
                    <span className="text-[12px] font-black tracking-tight text-foreground leading-tight pr-6">
                      {packLabel(p.id, p.label)}
                    </span>
                    <span className="text-[9.5px] text-foreground/60 font-semibold leading-snug mt-0.5 line-clamp-2">
                      {packTagline(p.id, p.tagline)}
                    </span>
                    <span className="text-[9px] text-foreground/45 font-bold tracking-wide mt-1">
                      {t("wp.packs.daily")}
                    </span>

                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!isPremium && (
          <button
            type="button"
            onClick={() => { haptic("medium"); onProUpsell(); }}
            className="w-full mt-3.5 rounded-2xl py-3 flex items-center justify-center gap-2 active:opacity-80"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.82))",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 8px 22px -10px hsl(var(--primary) / 0.7)",
            }}
          >
            <Crown className="w-4 h-4" />
            <span className="text-[13px] font-black tracking-tight">{t("px.packs.unlockAllCta", { count: VERSE_PACKS.length })}</span>
          </button>
        )}
      </div>
    </section>
  );
}
