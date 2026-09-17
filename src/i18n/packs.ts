// Localized names/taglines for verse packs and their group headers.
// The English source of truth lives in src/data (versePacksData / verseBackgrounds);
// these helpers look up a translation and fall back to that English original.
import { t } from "@/i18n";

export function packLabel(id: string, fallback: string): string {
  return t(`pk.${id}.label`, fallback);
}

export function packTagline(id: string, fallback: string): string {
  return t(`pk.${id}.tagline`, fallback);
}

export function packGroupTitle(id: string, fallback: string): string {
  return t(`pk.group.${id}.title`, fallback);
}

export function packGroupSubtitle(id: string, fallback: string): string {
  return t(`pk.group.${id}.subtitle`, fallback);
}
