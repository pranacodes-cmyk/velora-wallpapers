import { useMemo, useSyncExternalStore } from "react";
import { getDailyVerse, type DailyVerse } from "@/data/dailyVerses";
import {
  readActiveMoodPack,
  subscribeActiveMoodPack,
} from "@/data/verseMoodPacks";
import { getVersePackVerse, isValidVersePackId } from "@/data/versePacks";
import { useT } from "@/i18n";
import { localizeVerse } from "@/i18n/content";

/**
 * Returns the verse to render today. If the user has activated a verse pack
 * (life-situation or mood), it rotates through that pack's verses daily and
 * loops. Otherwise falls back to the default 365-day rotation.
 *
 * The verse text/reference are localized when a content pack is loaded;
 * `verse.refKey` keeps the English reference as the stable lookup id.
 */
export function useDailyVerse(date?: Date): { verse: DailyVerse; activeMood: string | null } {
  const stored = useSyncExternalStore(
    subscribeActiveMoodPack,
    readActiveMoodPack,
    () => null,
  );
  const activeMood = isValidVersePackId(stored) ? stored : null;
  const { lang, version } = useT();

  const verse = useMemo(() => {
    if (activeMood) {
      const v = getVersePackVerse(activeMood, date);
      if (v) return localizeVerse(v);
    }
    return localizeVerse(getDailyVerse(date));
  }, [activeMood, date?.getTime(), lang, version]);

  return { verse, activeMood };
}

/** Non-reactive variant for use outside React (e.g. notifications). */
export function getActiveDailyVerse(date?: Date): DailyVerse {
  const packId = readActiveMoodPack();
  if (packId) {
    const v = getVersePackVerse(packId, date);
    if (v) return localizeVerse(v);
  }
  return localizeVerse(getDailyVerse(date));
}

