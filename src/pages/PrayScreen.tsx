import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, BookOpen, Check, ChevronRight, Crown, Lock, Pause, Play, Search, Shield, ShieldAlert, Sparkles } from "lucide-react";
import { ScriptureGate } from "@/components/prayscreen/ScriptureGate";
import { bibleProgress } from "@/services/bibleGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePremium } from "@/hooks/usePremium";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { SocialAppIcon } from "@/components/prayscreen/SocialAppIcon";
import { useT } from "@/i18n";
import { usePrayerPauses } from "@/hooks/usePrayerPauses";

const APPS = [
  ["com.instagram.android", "Instagram", "IG"],
  ["com.zhiliaoapp.musically", "TikTok", "TT"],
  ["com.google.android.youtube", "YouTube", "YT"],
  ["com.facebook.katana", "Facebook", "FB"],
  ["com.twitter.android", "X", "X"],
  ["com.snapchat.android", "Snapchat", "SC"],
] as const;

type PreviewApp = { id: string; name: string; initials: string };
const previewApps: PreviewApp[] = APPS.map(([id, name, initials]) => ({ id, name, initials }));

/** Deliberate social priority for "Your top apps" — mirrors PrayScreenService.socialPriority in Flutter. */
const SOCIAL_PRIORITY = [
  "com.instagram.android",
  "com.zhiliaoapp.musically",
  "com.facebook.katana",
  "com.twitter.android",
  "com.snapchat.android",
  "com.google.android.youtube",
];
const topApps = (apps: PreviewApp[], count = 4): PreviewApp[] => {
  const picked = SOCIAL_PRIORITY.map((id) => apps.find((a) => a.id === id)).filter(Boolean) as PreviewApp[];
  const rest = apps.filter((a) => !picked.some((p) => p.id === a.id));
  return [...picked, ...rest].slice(0, count);
};

function readApps(): string[] {
  try { return JSON.parse(localStorage.getItem("ps_guarded_apps") || "[]"); }
  catch { return []; }
}

function nextReset(now = new Date()) {
  for (const hour of [0, 5, 12, 18]) {
    const candidate = new Date(now);
    candidate.setHours(hour, 0, 0, 0);
    if (candidate > now) return candidate;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

export default function PrayScreen() {
  const { isPremium } = usePremium();
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>(readApps);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("ps_enabled") === "true");
  const [usageAllowed, setUsageAllowed] = useState(() => localStorage.getItem("ps_preview_usage") === "true");
  const [overlayAllowed, setOverlayAllowed] = useState(() => localStorage.getItem("ps_preview_overlay") === "true");
  const [batteryOk, setBatteryOk] = useState(() => localStorage.getItem("ps_preview_battery") === "true");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  // Pause mode: Prayer (free, default for free users) or Bible (Pro). Same key as Flutter.
  const [bibleMode, setBibleMode] = useState(() => localStorage.getItem("ps_bible_enabled") !== "false");
  const [offerOpen, setOfferOpen] = useState(false);
  const [pauseIndex, setPauseIndex] = useState(() => new Date().getDate());
  // Prayers come from the backend so they can be updated without a release.
  const pauses = usePrayerPauses();
  const pause = pauses[pauseIndex % pauses.length];
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [gate, setGate] = useState<null | "live" | "preview">(null);
  const [bible, setBible] = useState(bibleProgress);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [unblockUntil, setUnblockUntil] = useState(() => Number(localStorage.getItem("ps_unblock_until") || 0));
  const unlocked = unblockUntil > Date.now();
  const suggested = topApps(previewApps);
  const filteredApps = previewApps.filter((app) => app.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => { track("pray_screen_viewed"); }, []);

  // A lapsed Pro user kept every app picked while subscribed — free tier is two.
  useEffect(() => {
    if (isPremium || selected.length <= 2) return;
    const trimmed = selected.slice(0, 2);
    setSelected(trimmed);
    localStorage.setItem("ps_guarded_apps", JSON.stringify(trimmed));
  }, [isPremium, selected]);

  const resetLabel = useMemo(() => nextReset().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), []);

  const setShield = (next: boolean) => {
    setEnabled(next);
    localStorage.setItem("ps_enabled", String(next));
    track(next ? "pray_screen_activated" : "pray_screen_paused", { app_count: selected.length, ok: true, is_premium: isPremium });
  };

  // Locking an app is the only step: permissions and the Shield follow on their own.
  const toggleApp = (id: string) => {
    haptic("soft");
    const adding = !selected.includes(id);
    let next: string[];
    if (!adding) next = selected.filter((item) => item !== id);
    else if (!isPremium && selected.length >= 2) {
      track("pray_screen_app_limit_hit", { app: id, package: id, app_count: selected.length });
      setUpgradeOpen(true);
      return;
    }
    else next = [...selected, id];
    setSelected(next);
    localStorage.setItem("ps_guarded_apps", JSON.stringify(next));
    track("pray_screen_app_toggled", {
      app: id,
      package: id,
      action: adding ? "locked" : "removed",
      app_count: next.length,
      is_premium: isPremium,
      permissions_ready: usageAllowed && overlayAllowed,
    });
    if (!adding) return;
    if (!usageAllowed || !overlayAllowed) {
      track("pray_screen_permission_sheet_shown", {
        usage_allowed: usageAllowed,
        overlay_allowed: overlayAllowed,
        app_count: next.length,
      });
      setPermissionOpen(true);
    }
    else if (!enabled) setShield(true);
  };

  const toggleShield = () => {
    haptic("medium");
    if (!selected.length) return;
    if (!usageAllowed || !overlayAllowed) {
      track("pray_screen_permission_sheet_shown", {
        usage_allowed: usageAllowed,
        overlay_allowed: overlayAllowed,
        app_count: selected.length,
      });
      setPermissionOpen(true);
      return;
    }
    setShield(!enabled);
  };

  // Free users see the watch-to-unlock sheet first; Pro pauses straight away.
  const startUnlock = () => {
    haptic("medium");
    track("pray_screen_unlock_started", { is_premium: isPremium, app_count: selected.length });
    if (!isPremium) {
      track("pray_screen_unlock_offer_shown");
      setOfferOpen(true);
      return;
    }
    unlock();
  };

  const unlock = () => {
    haptic("medium");
    setPauseIndex((index) => index + 1);
    const now = new Date();
    const scheduled = nextReset(now).getTime();
    const minimum = now.getTime() + 60 * 60 * 1000;
    const until = Math.max(scheduled, minimum);
    localStorage.setItem("ps_unblock_until", String(until));
    setUnblockUntil(until);
    // Pro pauses open the Scripture Gate (next KJV verses); free keeps the prayer.
    const useBible = isPremium && bibleMode;
    if (useBible) setGate("live");
    else setPrayerOpen(true);
    track("pray_screen_prayer_shown", { reference: pause.reference, lang: localStorage.getItem("app-lang") ?? "en", mode: useBible ? "scripture" : "prayer" });
    track("pray_screen_unlocked", { until: new Date(until).toISOString(), app_count: selected.length });
  };

  // Finishing a Sacred Pause is the most genuine "this app blessed me" moment
  // in the whole app — ask for the rating right here, then let the paywall
  // scheduler take its turn on later unlocks.
  const finishPrayer = () => {
    setPrayerOpen(false);
    setGate(null);
    setBible(bibleProgress());
    track("pray_screen_prayer_completed", { reference: pause.reference });
    import("@/services/rating")
      .then((m) => setTimeout(() => m.maybeRequestRating(), 900))
      .catch(() => {});
    import("@/lib/paywallScheduler")
      .then((m) => m.firePaywallTrigger("shield_unlocked"))
      .catch(() => {});
  };

  const forceGuard = () => {
    localStorage.setItem("ps_unblock_until", "0");
    setUnblockUntil(0);
    track("pray_screen_force_guarded");
  };

  return (
    <main className="h-full overflow-y-auto bg-background px-4 pb-32 pt-[max(env(safe-area-inset-top),18px)] text-foreground">
      <header className="flex items-center gap-3">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-primary/25 bg-primary/10">
          <Shield className="h-[22px] w-[22px] text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black">PrayScreen</h1>
          <p className="text-[11px] text-foreground/50">{t("ps.tagline")}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${enabled ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground"}`}>
          {enabled ? t("ps.active") : t("ps.paused")}
        </span>
      </header>

      <section className="mt-6 rounded-[20px] border p-5 text-center shadow-[var(--tile-shadow)]" style={{ background: "var(--tile-grad)", borderColor: "var(--tile-border)" }}>
        <div className="mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-full border border-primary/35 bg-primary/10">
          {unlocked ? <Check className="h-9 w-9 text-primary" /> : <Shield className="h-9 w-9 text-primary" />}
        </div>
        <h2 className="mt-4 text-[21px] font-black">{unlocked ? t("ps.hero.open.title") : enabled ? t("ps.hero.on.title") : t("ps.hero.off.title")}</h2>
        <p className="mx-auto mt-2 max-w-[310px] text-xs leading-relaxed text-foreground/55">
          {unlocked ? `${t("ps.hero.open.sub")} (${resetLabel})` : enabled ? t("ps.hero.on.sub") : t("ps.hero.off.sub")}
        </p>
        {unlocked && <Button variant="ghost" onClick={forceGuard} className="mt-2 font-extrabold text-primary">{t("ps.hero.guardAgain")}</Button>}
        {!!selected.length && (!usageAllowed || !overlayAllowed) && (
          <Button variant="ghost" onClick={() => setPermissionOpen(true)} className="mt-3 h-auto w-full justify-start rounded-[14px] border border-primary/30 bg-primary/10 p-3 text-left">
            <ShieldAlert className="text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-black">{t("ps.setup.title")}</span>
              <span className="block text-[10.5px] font-normal leading-snug text-foreground/60">{t("ps.setup.sub")}</span>
            </span>
            <ChevronRight className="text-primary" />
          </Button>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black tracking-[0.14em] text-foreground/65">{t("ps.apps.top")}</h2>
          {!isPremium && <span className="text-[9px] font-black text-primary">{t("ps.apps.free")}</span>}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {suggested.map(({ id, name }) => {
            const checked = selected.includes(id);
            const locked = !isPremium && !checked && selected.length >= 2;
            return (
              <Button key={id} variant="ghost" onClick={() => toggleApp(id)} className={`relative h-[98px] min-w-0 flex-col rounded-2xl border p-2 ${checked ? "border-primary/50 bg-primary/10" : "border-border bg-card/70"}`}>
                <SocialAppIcon id={id} name={name} />
                <span className="mt-2 max-w-full truncate text-[9px] font-bold">{name}</span>
                {checked && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary"><Lock className="h-2.5 w-2.5 text-primary-foreground" /></span>}
                {locked && <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/55"><Lock className="h-4 w-4 text-muted-foreground" /></span>}
              </Button>
            );
          })}
        </div>
        <Button variant="secondary" onClick={() => setPickerOpen(true)} className="mt-3 h-12 w-full justify-between rounded-xl border border-border px-4">
          <span className="flex items-center gap-2.5"><Search className="h-4 w-4 text-primary" />{t("ps.apps.choose")}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      </section>

      {/* Pause mode selector — Prayer is free; Bible is Pro. Sits below apps, above the CTA. */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black tracking-[0.14em] text-foreground/65">WHEN AN APP IS BLOCKED</h2>
          {isPremium && bibleMode && <span className="text-[9px] font-bold text-foreground/50">{bible.read} verses · {bible.percent.toFixed(1)}%</span>}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card/70 p-1">
          {([
            { id: "prayer", label: "Prayer", sub: "Free", icon: <Bell className="h-4 w-4" /> },
            { id: "bible", label: "Bible", sub: isPremium ? "KJV" : "PRO", icon: <BookOpen className="h-4 w-4" /> },
          ] as const).map((o) => {
            const active = o.id === "bible" ? isPremium && bibleMode : !(isPremium && bibleMode);
            return (
              <button
                key={o.id}
                onClick={() => {
                  haptic("light");
                  if (o.id === "bible" && !isPremium) { track("scripture_gate_card_tapped", { is_premium: false }); setGate("preview"); return; }
                  const on = o.id === "bible";
                  setBibleMode(on);
                  localStorage.setItem("ps_bible_enabled", String(on));
                  track("scripture_gate_mode_changed", { mode: on ? "bible" : "prayer" });
                }}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
              >
                {o.icon}{o.label}
                {o.sub === "PRO" ? <span className="rounded-full border border-primary/50 px-1.5 py-px text-[8.5px] font-black text-primary">PRO</span>
                  : <span className={`text-[9.5px] font-bold ${active ? "text-primary-foreground/70" : "text-foreground/40"}`}>{o.sub}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <ModeRow icon={<Bell />} title={t("ps.reset.title")} subtitle={t("ps.reset.times")} trailing={t("ps.reset.badge")} />
      </section>

      <Button variant={enabled ? "secondary" : "default"} onClick={toggleShield} disabled={!selected.length} className="mt-5 h-13 w-full rounded-xl py-6 font-black">
        {enabled ? <><Pause /> {t("ps.btn.off")}</> : <><Shield /> {t("ps.btn.on")}</>}
      </Button>
      {enabled && !unlocked && (
        <Button variant="ghost" onClick={startUnlock} className="mt-1 w-full font-extrabold text-primary">{t("ps.btn.preview")}</Button>
      )}

      {gate && (
        <ScriptureGate
          preview={gate === "preview"}
          onUpgrade={() => { setGate(null); setUpgradeOpen(true); }}
          onDone={() => { if (gate === "live") finishPrayer(); else setGate(null); }}
        />
      )}


      <Dialog open={permissionOpen} onOpenChange={setPermissionOpen}>
        <DialogContent className="max-w-[calc(100%-24px)] rounded-[24px] border-[hsl(var(--glass-border))] bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{t("ps.perm.title")}</DialogTitle>
            <DialogDescription className="leading-relaxed">{t("ps.perm.sub")} {t("ps.perm.hint")}</DialogDescription>
          </DialogHeader>
          <PermissionRow step="1" title={t("ps.perm.usage")} subtitle={t("ps.perm.usageSub")} done={usageAllowed} onClick={() => { setUsageAllowed(true); localStorage.setItem("ps_preview_usage", "true"); }} />
          <PermissionRow step="2" title={t("ps.perm.overlay")} subtitle={t("ps.perm.overlaySub")} done={overlayAllowed} onClick={() => { setOverlayAllowed(true); localStorage.setItem("ps_preview_overlay", "true"); }} />
          {usageAllowed && overlayAllowed && !batteryOk && (
            <PermissionRow step="3" title={t("ps.perm.battery")} subtitle={t("ps.perm.batterySub")} done={batteryOk} onClick={() => { setBatteryOk(true); localStorage.setItem("ps_preview_battery", "true"); }} />
          )}
          <Button disabled={!usageAllowed || !overlayAllowed} onClick={() => { setPermissionOpen(false); if (selected.length && !enabled) setShield(true); }} className="h-12 w-full rounded-xl font-black">{usageAllowed && overlayAllowed ? t("ps.perm.done") : t("ps.perm.waiting")}</Button>
          {(!usageAllowed || !overlayAllowed) && <p className="text-center text-[11px] text-foreground/50">{t("ps.perm.retry")}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-[calc(100%-24px)] rounded-[24px] border-primary/25 bg-card text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <DialogTitle className="text-[21px] font-black">{t("ps.offer.title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/70">{t("ps.offer.body")}</DialogDescription>
          <Button onClick={() => { setOfferOpen(false); unlock(); }} className="h-12 rounded-xl font-black"><Play /> {t("ps.offer.watch")}</Button>
          <Button variant="ghost" onClick={() => { setOfferOpen(false); setUpgradeOpen(true); }} className="text-xs font-black text-primary">{t("ps.offer.pro")}</Button>
        </DialogContent>
      </Dialog>

      {/* Full-screen Sacred Pause — nothing else on screen while praying. */}
      {prayerOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-300 flex-col bg-background bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.16),transparent_70%)] px-7 pb-6 pt-[max(env(safe-area-inset-top),20px)]">
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10"><Shield className="h-8 w-8 text-primary" /></div>
            <p className="mt-5 text-[12.5px] font-black uppercase tracking-[0.18em] text-primary">{t("ps.prayer.kicker")}</p>
            <p className="mt-6 font-serif text-[30px] font-bold leading-[1.24]">“{pause.verse}”</p>
            <p className="mt-3.5 text-[11px] font-black uppercase tracking-[0.14em] text-primary">{pause.reference}</p>
            <div className="my-7 h-px w-11 bg-primary/35" />
            <p className="text-[15px] leading-[1.7] text-foreground/75">{pause.prayer}</p>
          </div>
          <Button onClick={finishPrayer} className="h-14 w-full rounded-full text-[14.5px] font-black">{t("ps.prayer.done")}</Button>
        </div>
      )}

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-[calc(100%-24px)] rounded-[24px] border-primary/25 bg-card text-center">
          <Crown className="mx-auto h-9 w-9 text-primary" />
          <DialogTitle className="text-xl font-black">Guard every distraction</DialogTitle>
          <DialogDescription>Pro adds unlimited apps, ad-free sacred pauses, custom schedules, and Strict Focus.</DialogDescription>
          <Button className="h-12 rounded-xl font-black">Start 3-day free trial</Button>
          <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>Continue free with 2 apps</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[82vh] max-w-[calc(100%-24px)] overflow-hidden rounded-[24px] border-[hsl(var(--glass-border))] bg-card p-0">
          <DialogHeader className="px-5 pt-5"><DialogTitle className="text-xl font-black">{t("ps.apps.title")}</DialogTitle><DialogDescription>{t("ps.apps.subtitle")}</DialogDescription></DialogHeader>
          <label className="mx-5 flex h-11 items-center gap-2 rounded-xl border border-border bg-secondary px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("ps.apps.search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
          <div className="max-h-[52vh] overflow-y-auto px-3 pb-5 pt-3">
            {filteredApps.map(({ id, name }) => {
              const checked = selected.includes(id);
              return <Button key={id} variant="ghost" onClick={() => toggleApp(id)} className="h-14 w-full justify-start rounded-xl px-2.5"><SocialAppIcon id={id} name={name} size="sm" /><span className="ml-3 flex-1 text-left text-sm font-bold">{name}</span>{checked ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"><Check className="h-3.5 w-3.5 text-primary-foreground" /></span> : <span className="h-6 w-6 rounded-full border border-border" />}</Button>;
            })}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ModeRow({ icon, title, subtitle, trailing, onClick }: { icon: ReactNode; title: string; subtitle: string; trailing: string; onClick?: () => void }) {
  return <Button variant="ghost" onClick={onClick} className="h-auto w-full justify-start rounded-[14px] border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] p-3.5 text-left"><span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-extrabold">{title}</span><span className="block text-[10.5px] font-normal text-foreground/50">{subtitle}</span></span><span className="text-[9px] font-black text-primary">{trailing}</span></Button>;
}

function PermissionRow({ step, title, subtitle, done, onClick }: { step: string; title: string; subtitle: string; done: boolean; onClick: () => void }) {
  return <Button variant="secondary" onClick={onClick} className={`h-auto w-full justify-start whitespace-normal rounded-[14px] border p-3.5 text-left ${done ? "border-primary/40" : "border-border"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${done ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>{done ? <Check className="h-3.5 w-3.5" /> : step}</span><span className="min-w-0 flex-1"><span className="block font-extrabold">{title}</span><span className="block text-[11px] font-normal text-foreground/50">{subtitle}</span></span>{done ? <Check className="text-primary" /> : <ChevronRight />}</Button>;
}