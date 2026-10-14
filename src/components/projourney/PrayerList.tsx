// Prayer Warrior — private prayer list with answered prayers.
// Flutter mirror: `flutter_app/lib/screens/projourney/prayer_list.dart`.
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useT } from "@/i18n";
import { addPrayer, answeredCount, PRAYER_LIST_MAX, removePrayer, toggleAnswered } from "@/services/proJourneys";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useProJourneys } from "./useProJourneys";

export function PrayerList({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const store = useProJourneys();
  const [name, setName] = useState("");
  const [need, setNeed] = useState("");
  const items = store.prayers;
  const full = items.length >= PRAYER_LIST_MAX;
  const answered = answeredCount(store);

  const add = () => {
    if (!name.trim() || full) return;
    if (addPrayer(name, need)) {
      haptic("light");
      track("pro_journey_prayer_added", { count: items.length + 1 });
      setName(""); setNeed("");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.pl.title")}</p>
        {items.length > 0 && (
          <p className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {t("pj.pl.count", { n: items.length })}{answered > 0 ? ` · ${t("pj.pl.answeredN", { n: answered })}` : ""}
          </p>
        )}
      </div>
      {!compact && <p className="mt-1 text-[13px] text-muted-foreground">{t("pj.pl.sub")}</p>}

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">{t("pj.pl.empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl bg-background/60 ring-1 ring-border/60">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${p.answered ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                {p.answered ? <Check className="h-4 w-4" strokeWidth={3} /> : p.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14.5px] font-semibold ${p.answered ? "text-muted-foreground line-through decoration-primary/60" : "text-foreground"}`}>{p.name}</span>
                {p.need && <span className="block truncate text-[12.5px] text-muted-foreground">{p.need}</span>}
              </span>
              <button
                type="button"
                onClick={() => { haptic(p.answered ? "light" : "medium"); toggleAnswered(p.id); if (!p.answered) track("pro_journey_prayer_answered"); }}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors ${p.answered ? "bg-primary/15 text-primary" : "text-muted-foreground ring-1 ring-border"}`}
              >
                {t(p.answered ? "pj.pl.answered" : "pj.pl.markAnswered")}
              </button>
              {!compact && (
                <button type="button" aria-label={t("pj.pl.remove")} onClick={() => { haptic("light"); removePrayer(p.id); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground/70 active:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">{t("pj.pl.full")}</p>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder={t("pj.pl.name")}
              aria-label={t("pj.pl.name")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border/70 bg-background/60 px-3 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-bold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} />{t("pj.pl.add")}
            </button>
          </div>
          <input
            value={need}
            onChange={(e) => setNeed(e.target.value.slice(0, 120))}
            placeholder={t("pj.pl.need")}
            aria-label={t("pj.pl.need")}
            className="h-11 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
          />
        </form>
      )}
      <p className="mt-2 text-[11.5px] text-muted-foreground">{t("pj.pl.private")}</p>
    </div>
  );
}
