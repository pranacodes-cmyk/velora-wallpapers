import { useState } from "react";
import { BookOpen, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";
import { BlockerBible } from "./BlockerBible";

/** Localized, free Bible/Prayer pause. Switching never completes the handoff. */
export function ScriptureGate({ preview = false, onDone, initialBible = true, prayer }: { preview?: boolean; onDone: () => void; onUpgrade?: () => void; initialBible?: boolean; prayer?: { verse: string; reference: string; prayer: string } }) {
  const { t } = useT();
  const [bible, setBible] = useState(initialBible);
  const select = (value: boolean) => {
    setBible(value);
    try { localStorage.setItem("ps_bible_enabled", String(value)); } catch { /* Device storage unavailable. */ }
    track("scripture_gate_mode_changed", { mode: value ? "bible" : "prayer" });
  };
  return <div className="fixed inset-0 z-[200] flex flex-col bg-background pt-[max(env(safe-area-inset-top),16px)] text-foreground">
    <div role="tablist" className="mx-6 mb-2 grid shrink-0 grid-cols-2 gap-1 rounded-full border border-border bg-muted/40 p-1">
      <Button role="tab" aria-selected={bible} variant={bible ? "secondary" : "ghost"} onClick={() => select(true)} className="rounded-full"><BookOpen className="h-4 w-4" />{t("bible.title")}</Button>
      <Button role="tab" aria-selected={!bible} variant={!bible ? "secondary" : "ghost"} onClick={() => select(false)} className="rounded-full"><Heart className="h-4 w-4" />{t("ps.mode.prayer")}</Button>
    </div>
    <div className={`${bible ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}><BlockerBible /></div>
    {!bible && <div className="min-h-0 flex-1 overflow-y-auto px-7 py-8 text-center">
      <p className="text-xs font-semibold text-primary">{t("ps.prayer.kicker")}</p>
      <p className="mt-6 text-[26px] leading-relaxed">“{prayer?.verse || t("ps.pause1.verse") }”</p>
      <p className="mt-4 text-xs font-semibold text-primary">{prayer?.reference || t("ps.pause1.ref")}</p>
      <p className="mt-8 text-base leading-relaxed text-muted-foreground">{prayer?.prayer || t("ps.pause1.prayer")}</p>
    </div>}
    <footer className="shrink-0 px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
      <Button onClick={() => { track("scripture_gate_completed", { mode: bible ? "bible" : "prayer" }); onDone(); }} className="h-auto min-h-12 w-full whitespace-normal rounded-full py-3 text-sm">{preview ? t("bible.close") : t(bible ? "ps.bible.done" : "ps.prayer.done")}</Button>
    </footer>
  </div>;
}
