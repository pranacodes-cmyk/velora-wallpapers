import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n";

export type PrayerPause = { verse: string; reference: string; prayer: string };

const BUNDLED_COUNT = 40;
const cache = new Map<string, PrayerPause[]>();

/**
 * Sacred Pause prayers, published from the backend (`pray_pauses`) so new
 * prayers go live without an app release. Mirrors the Flutter
 * `PrayerPauseStore`: server copy when available, bundled translations as the
 * offline fallback.
 */
export function usePrayerPauses(): PrayerPause[] {
  const { t, lang } = useT();
  const [remote, setRemote] = useState<PrayerPause[]>(() => cache.get(lang) ?? []);

  useEffect(() => {
    let alive = true;
    const cached = cache.get(lang);
    setRemote(cached ?? []);
    (async () => {
      const { data, error } = await supabase
        .from("pray_pauses")
        .select("slot, verse, reference, prayer")
        .eq("lang", lang)
        .eq("active", true)
        .order("slot", { ascending: true });
      if (error || !data?.length || !alive) return;
      const rows = data.map((r) => ({
        verse: r.verse ?? "",
        reference: r.reference ?? "",
        prayer: r.prayer ?? "",
      }));
      cache.set(lang, rows);
      setRemote(rows);
    })();
    return () => { alive = false; };
  }, [lang]);

  if (remote.length) return remote;
  return Array.from({ length: BUNDLED_COUNT }, (_, i) => ({
    verse: t(`ps.pause${i + 1}.verse`),
    reference: t(`ps.pause${i + 1}.ref`),
    prayer: t(`ps.pause${i + 1}.prayer`),
  }));
}
