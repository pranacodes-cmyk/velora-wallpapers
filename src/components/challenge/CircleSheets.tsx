import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JourneyAvatar } from "./JourneyAvatar";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import {
  AVATARS, CIRCLE_EMOJIS, createCircle, ensureIdentity, getIdentity, joinCircle,
} from "@/services/challengeCircle";
import { BottomSheet } from "./BottomSheet";

// Local error mapper: the crew helpers this used to import are gone.
const circleErrorKey = (err: unknown): string =>
  typeof err === "object" && err && "code" in (err as Record<string, unknown>)
    ? `ch.circle.error.${String((err as Record<string, unknown>).code)}`
    : "ch.circle.error.unknown";

export type CircleFlow = "create" | "join" | "profile" | null;

type Props = {
  flow: CircleFlow;
  initialCode?: string;
  onClose: () => void;
  onDone: (circleId: string, created: boolean) => void;
};

const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-extrabold text-[hsl(var(--paywall-cta-foreground))] shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.9)] transition-transform active:scale-[0.98] disabled:opacity-50";
const field =
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/**
 * Create / join flow. First time, it asks how the circle should see you
 * (name + mascot avatar), then continues straight into create or join.
 */
export function CircleSheets({ flow, initialCode = "", onClose, onDone }: Props) {
  const { t, lang } = useT();
  const identity = getIdentity();
  const [step, setStep] = useState<"profile" | "form">(identity ? "form" : "profile");
  const [name, setName] = useState(identity?.name ?? "");
  const [avatar, setAvatar] = useState(identity?.avatar ?? AVATARS[0]);
  const [circleName, setCircleName] = useState("");
  const [emoji, setEmoji] = useState(CIRCLE_EMOJIS[0]);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flow) return;
    const id = getIdentity();
    setStep(flow === "profile" || !id ? "profile" : "form");
    setError(null);
    setBusy(false);
    if (initialCode) setCode(initialCode.toUpperCase());
  }, [flow, initialCode]);

  if (!flow) return null;

  const saveProfile = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      await ensureIdentity(clean, avatar, lang);
      track("challenge_circle_profile_saved");
      haptic("soft");
      if (flow === "profile") onDone("", false);
      else setStep("form");
    } catch (err) {
      setError(circleErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (flow === "create") {
        const res = await createCircle(circleName.trim() || t("ch.circle.namePlaceholder"), emoji);
        track("challenge_circle_created");
        haptic("heavy");
        onDone(res.circleId, true);
      } else {
        const res = await joinCircle(code);
        track("challenge_circle_joined");
        haptic("heavy");
        onDone(res.circleId, false);
      }
    } catch (err) {
      haptic("error");
      setError(circleErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.toUpperCase().match(/\b[A-Z0-9]{6}\b/g);
      if (match) setCode(match[match.length - 1]);
    } catch { /* clipboard blocked */ }
  };

  const title = step === "profile" ? t("ch.profile.title") : flow === "create" ? t("ch.circle.newTitle") : t("ch.buddy.joinTitle");

  return (
    <BottomSheet open title={title} onClose={onClose} closeLabel={t("ch.back")}>
      {step === "profile" ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-4">
            <JourneyAvatar avatar={avatar} className="h-12 w-12 ring-2 ring-primary/50 ring-offset-4 ring-offset-card" />
            <div className="min-w-0"><p className="break-words text-lg font-semibold text-foreground">{name.trim() || t("ch.circle.yourName")}</p><p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("ch.profile.sub")}</p></div>
          </div>
          <label className="block">
            <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.circle.yourName")}</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t("ch.circle.yourNamePlaceholder")} className={field} />
          </label>
          <div>
            <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.circle.avatar")}</span>
            <div className="mx-auto grid max-w-[240px] grid-cols-4 gap-2.5">
              {AVATARS.map((a, i) => (
                <Button
                  variant="ghost"
                  key={a}
                  type="button"
                  onClick={() => { haptic("light"); setAvatar(a); }}
                  aria-pressed={avatar === a}
                  aria-label={`${t("ch.circle.avatar")} ${i + 1}`}
                  className={`relative aspect-square h-auto w-full rounded-full p-1 transition-transform active:scale-95 ${avatar === a ? "bg-primary/15 ring-2 ring-primary ring-offset-2" : "bg-card ring-1 ring-border/60"}`}
                >
                  <JourneyAvatar avatar={a} />
                  {avatar === a && <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                </Button>
              ))}
            </div>
          </div>
          <p className="flex gap-2 rounded-xl bg-muted/50 p-2 text-[11.5px] leading-snug text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t("ch.profile.privacy")}
          </p>
          {error && <p className="text-[13px] font-semibold text-destructive">{t(error)}</p>}
          <Button type="button" disabled={!name.trim() || busy} onClick={saveProfile} className={`${primaryBtn} h-auto`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("ch.circle.continue")}
          </Button>
        </div>
      ) : flow === "create" ? (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.circle.nameLabel")}</span>
            <input value={circleName} maxLength={32} onChange={(e) => setCircleName(e.target.value)} placeholder={t("ch.circle.namePlaceholder")} className={field} autoFocus />
          </label>
          <div>
            <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.circle.emojiLabel")}</span>
            <div className="grid grid-cols-8 gap-2">
              {CIRCLE_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { haptic("light"); setEmoji(e); }}
                  aria-pressed={emoji === e}
                  className={`flex h-11 items-center justify-center rounded-2xl text-[21px] ${emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/60"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[13px] font-semibold text-destructive">{t(error)}</p>}
          <button type="button" disabled={busy} onClick={submit} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("ch.circle.create")}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.circle.codeLabel")}</span>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="K7P2QX"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                className={`${field} text-center font-mono text-[22px] font-bold tracking-[0.4em]`}
                autoFocus
              />
              <button type="button" onClick={paste} className="shrink-0 rounded-2xl border border-border px-4 text-[13px] font-bold text-foreground">
                {t("ch.circle.paste")}
              </button>
            </div>
          </label>
          {error && <p className="text-[13px] font-semibold text-destructive">{t(error)}</p>}
          <button type="button" disabled={code.length !== 6 || busy} onClick={submit} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("ch.circle.join")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
