import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Pencil, Smartphone, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PARALLAX_SCENES, sceneFg } from "@/data/parallaxScenes";
import { useParallaxTilt } from "@/hooks/useParallaxTilt";
import { applyParallaxWallpaper, isNativeParallaxWallpaperSupported } from "@/lib/native/parallaxWallpaper";
import { EngravedOverlay, PersonalizeCrossSheet } from "@/components/PersonalizeCrossSheet";
import { PremiumSheet } from "@/components/PremiumSheet";
import { usePremium } from "@/hooks/usePremium";
import { getGlowColor, getPersonalName, getPersonalVerse, PERSONAL_CROSS_EVENT, type GlowChoice, type PersonalVerse } from "@/lib/personalCross";
import { Spring } from "@/lib/parallaxPhysics";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { isAndroidPerfMode } from "@/lib/androidPerf";
import { useT } from "@/i18n";



export default function ParallaxPreview() {
  const navigate = useNavigate();
  const { t, version } = useT();
  const [params, setParams] = useSearchParams();
  const initialIdx = (() => {
    const id = params.get("scene");
    const idx = PARALLAX_SCENES.findIndex((s) => s.id === id);
    return idx >= 0 ? idx : 0;
  })();
  const [sceneIdx, setSceneIdx] = useState(initialIdx);
  const scene = PARALLAX_SCENES[sceneIdx];
  const [swipeAnim, setSwipeAnim] = useState<"in-left" | "in-right" | null>(null);

  const bgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  const { current } = useParallaxTilt();

  const [applying, setApplying] = useState(false);
  const [appliedOk, setAppliedOk] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const canApplyNative = isNativeParallaxWallpaperSupported();
  const { isPremium } = usePremium();
  // Parallax preview is the star conversion feature — never freeze it,
  // even on Android perf mode. Other ANR mitigations still apply globally.
  const freezePreview = false;

  useAndroidBack(() => navigate(-1));

  // Personalization state (name + verse). Reflected as engraving on the
  // preview and edited via a bottom sheet triggered from the top-right pencil.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [personalName, setPersonalName] = useState<string>("");
  const [personalVerse, setPersonalVerse] = useState<PersonalVerse>(getPersonalVerse());
  const [glow, setGlow] = useState<GlowChoice>(getGlowColor());
  useEffect(() => {
    const sync = () => {
      setPersonalName(getPersonalName());
      setPersonalVerse(getPersonalVerse());
      setGlow(getGlowColor());
    };
    sync();
    window.addEventListener(PERSONAL_CROSS_EVENT, sync);
    return () => window.removeEventListener(PERSONAL_CROSS_EVENT, sync);
  }, [version]);
  const hasPersonalized = personalName.length > 0;

  // The personalize sheet never opens on its own — the user taps
  // "Personalize / Edit" when they want it.


  // Hide the global BottomNav while the immersive preview is mounted so the
  // Apply button is never covered by the tab bar.
  useEffect(() => {
    const prev = document.body.dataset.hideNav;
    document.body.dataset.hideNav = "true";
    return () => {
      if (prev === undefined) delete document.body.dataset.hideNav;
      else document.body.dataset.hideNav = prev;
    };
  }, []);

  useEffect(() => {
    if (freezePreview || sheetOpen) return;
    let raf = 0;
    let lastFrameMs = performance.now();
    const startTs = lastFrameMs;
    const whole = !!scene.wholeMove;

    // Spring integrators per layer — bg heavy, fg crisp, glow/shadow between.
    const bgSx = new Spring(55, 16), bgSy = new Spring(55, 16);
    const fgSx = new Spring(150, 20), fgSy = new Spring(150, 20);
    const glSx = new Spring(95, 18), glSy = new Spring(95, 18);
    const shSx = new Spring(110, 19), shSy = new Spring(110, 19);
    const whSx = new Spring(90, 18), whSy = new Spring(90, 18);

    const loop = (nowTs: number) => {
      const dt = Math.max(0.001, (nowTs - lastFrameMs) / 1000);
      lastFrameMs = nowTs;
      const { x: tiltX, y: tiltY } = current.current;
      const t = (nowTs - startTs) / 1000;
      const driftX = Math.sin(t * 0.35) * 0.18;
      const driftY = Math.sin(t * 0.28 + 1.2) * 0.12;
      const targetX = tiltX + driftX;
      const targetY = tiltY + driftY;

      if (whole) {
        const wx = whSx.step(targetX, dt);
        const wy = whSy.step(targetY, dt);
        // Whole-frame scenes need strong sideways motion, but only a tiny
        // vertical crop so tall Android lock screens don't cut the artwork.
        const px = wx * 46, py = wy * 12;
        if (bgRef.current) bgRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) scale(1.025)`;
        if (glowRef.current) glowRef.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        if (fgRef.current) fgRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) scale(1.015)`;
        if (shadowRef.current) shadowRef.current.style.transform = `translate3d(${px}px, ${py * 0.7}px, 0)`;
      } else {
        const bx = bgSx.step(targetX, dt), by = bgSy.step(targetY, dt);
        const gx = glSx.step(targetX, dt), gy = glSy.step(targetY, dt);
        const fx = fgSx.step(targetX, dt), fy = fgSy.step(targetY, dt);
        const sx = shSx.step(targetX, dt), sy = shSy.step(targetY, dt);
        if (bgRef.current) bgRef.current.style.transform = `translate3d(${bx * 14}px, ${by * 14}px, 0) scale(1.14)`;
        if (glowRef.current) glowRef.current.style.transform = `translate3d(${gx * 23}px, ${gy * 23}px, 0)`;
        if (fgRef.current) fgRef.current.style.transform = `translate3d(${fx * 42}px, ${fy * 42}px, 0) scale(1.05)`;
        if (shadowRef.current) shadowRef.current.style.transform = `translate3d(${sx * 34}px, ${sy * 26}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [current, freezePreview, scene.wholeMove, sheetOpen]);

  const handleApply = async () => {
    if (applying) return;
    const trackParallax = (event: string, props: Record<string, unknown> = {}) => {
      import("@/services/analytics")
        .then((a) => a.track(event, { scene_id: scene.id, ...props }))
        .catch(() => {});
    };
    trackParallax("parallax_apply_tapped", { is_premium: isPremium });
    if (!isPremium) {
      setShowPremium(true);
      return;
    }
    setApplyError(null);
    setAppliedOk(false);
    setApplying(true);

    try {
      const res = await applyParallaxWallpaper(scene);
      if (res.applied) {
        setAppliedOk(true);
        trackParallax("parallax_applied");
        import("@/services/analytics")
          .then((a) => a.track("wallpaper_applied", { wallpaper_id: scene.id, type: "parallax" }))
          .catch(() => {});
      } else {
        trackParallax("parallax_apply_unconfirmed");
        setApplyError(t("wp.parallax.errorConfirm"));
      }
    } catch (e: any) {
      trackParallax("parallax_apply_failed", { message: e?.message ?? "unknown" });
      setApplyError(e?.message ?? t("wp.parallax.errorFailed"));
    } finally {
      setApplying(false);
      setTimeout(() => setAppliedOk(false), 2400);
    }
  };


  // Horizontal swipe to move between scenes. Only the current scene is
  // mounted, so we never render two parallax stages at once (ANR-safe).
  const swipeStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const goToScene = (nextIdx: number, direction: "left" | "right") => {
    if (nextIdx < 0 || nextIdx >= PARALLAX_SCENES.length || nextIdx === sceneIdx) return;
    setSwipeAnim(direction === "left" ? "in-right" : "in-left");
    setSceneIdx(nextIdx);
    const next = PARALLAX_SCENES[nextIdx];
    setParams((p) => {
      const np = new URLSearchParams(p);
      np.set("scene", next.id);
      return np;
    }, { replace: true });
    try { navigator.vibrate?.(6); } catch { /* noop */ }
    setTimeout(() => setSwipeAnim(null), 380);
  };
  const onStageDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onStageUp = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goToScene(sceneIdx + 1, "left");
    else goToScene(sceneIdx - 1, "right");
  };

  const hasNextScene = sceneIdx < PARALLAX_SCENES.length - 1;
  const hasPrevScene = sceneIdx > 0;

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden select-none touch-none"
      onPointerDown={onStageDown}
      onPointerUp={onStageUp}
      onPointerCancel={() => { swipeStartRef.current = null; }}
    >
      {/* Top back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-[max(env(safe-area-inset-top),16px)] left-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
        aria-label={t("px.back")}
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>

      {/* Top-right: Personalize / Edit engraving — Apple-style glass pill */}
      <button
        onClick={() => setSheetOpen(true)}
        className="absolute top-[max(env(safe-area-inset-top),16px)] right-4 z-50 flex items-center gap-1.5 h-10 px-4 rounded-full active:scale-[0.96] transition-transform"
        style={{
          background: "hsla(0, 0%, 100%, 0.14)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid hsla(0, 0%, 100%, 0.22)",
          color: "hsl(0 0% 100%)",
          boxShadow: "0 8px 24px -8px hsla(0, 0%, 0%, 0.5), inset 0 1px 0 hsla(0, 0%, 100%, 0.18)",
        }}
        aria-label={hasPersonalized ? t("px.editPersonalizationAria") : t("px.personalizeAria")}
      >
        <Pencil className="w-3.5 h-3.5" strokeWidth={2.4} />
        <span className="text-[12px] font-semibold tracking-[-0.01em]">
          {hasPersonalized ? t("wp.parallax.edit") : t("wp.parallax.personalize")}
        </span>
      </button>

      {/* Parallax stage — keyed by sceneIdx so React fully swaps the layer
          tree when swiping, guaranteeing only one scene is ever animating. */}
      <div key={scene.id} className={`absolute inset-0 ${swipeAnim ? `prayly-scene-${swipeAnim}` : ""}`} style={{ perspective: "1200px" }}>
        <div
          ref={bgRef}
          className={`absolute ${scene.wholeMove ? "-inset-4" : "-inset-9"} ${freezePreview ? "" : "will-change-transform"}`}
          style={{
            backgroundImage: `url(${scene.bg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {!scene.wholeMove && (
          <>
            <div
              ref={shadowRef}
              className={`absolute inset-x-0 pointer-events-none z-20 ${freezePreview ? "" : "will-change-transform"}`}
              style={{ bottom: "6%", height: "60px" }}
            >
              <div className="mx-auto"
                style={{
                  width: "55%",
                  height: "100%",
                  background: "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)",
                  filter: "blur(10px)",
                }}
              />
            </div>
            <div ref={fgRef} className={`absolute inset-0 pointer-events-none z-30 ${freezePreview ? "" : "will-change-transform"}`}>
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  height: `${scene.fgHeight}%`,
                  bottom: scene.variant === "bust" ? "0" : "1%",
                  aspectRatio: "832 / 1472",
                  WebkitMaskImage:
                    scene.variant === "bust"
                      ? "linear-gradient(180deg, #000 78%, transparent 100%)"
                      : "linear-gradient(180deg, #000 88%, transparent 100%)",
                  maskImage:
                    scene.variant === "bust"
                      ? "linear-gradient(180deg, #000 78%, transparent 100%)"
                      : "linear-gradient(180deg, #000 88%, transparent 100%)",
                  filter:
                    "drop-shadow(0 30px 40px rgba(0,0,0,0.55)) drop-shadow(0 0 40px rgba(0,0,0,0.35))",
                }}
              >
                <img src={sceneFg(scene)} alt={t(`px.scene.${scene.id}`, scene.name)} className="absolute inset-0 w-full h-full object-contain" />
                {/* wrap overlay removed — the bright radial-over-overlay
                    on the cross figure created a white hotspot in the
                    middle of the Holy Cross. The wash + grade layers
                    already carry the color story cleanly. */}
              </div>
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-40" />



        {/* Personalized engraving — positioned to mirror the native lockscreen
            layout exactly: header sits ~30% from top (below the system clock
            safe zone) and the verse sits above the bottom CTA. */}
        {hasPersonalized && (
          <div
            className="absolute inset-x-0 z-40 pointer-events-none"
            style={{ bottom: "150px" }}
          >
            <EngravedOverlay name={personalName} verse={personalVerse} />
          </div>
        )}
      </div>

      {/* Always-visible scene cue so users discover the second wallpaper. */}
      {hasPrevScene && (
        <button
          type="button"
          onClick={() => goToScene(sceneIdx - 1, "right")}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-[55] flex items-center gap-1.5 px-2.5 h-10 rounded-full active:scale-95 transition-transform"
          style={{
            background: "hsla(0, 0%, 0%, 0.55)",
            backdropFilter: "blur(14px) saturate(160%)",
            WebkitBackdropFilter: "blur(14px) saturate(160%)",
            boxShadow: "0 8px 22px -8px hsla(0,0%,0%,0.6), inset 0 0 0 1px hsla(42, 70%, 65%, 0.35)",
          }}
          aria-label={t("px.prevSceneAria")}
        >
          <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.8} />
        </button>
      )}

      {hasNextScene && (
        <button
          type="button"
          onClick={() => goToScene(sceneIdx + 1, "left")}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-[55] flex items-center gap-2 px-3 h-10 rounded-full active:scale-95 transition-transform prayly-next-cue"
          style={{
            background: "hsla(0, 0%, 0%, 0.58)",
            backdropFilter: "blur(14px) saturate(160%)",
            WebkitBackdropFilter: "blur(14px) saturate(160%)",
            boxShadow: "0 8px 22px -8px hsla(0,0%,0%,0.65), inset 0 0 0 1px hsla(42, 70%, 65%, 0.42)",
          }}
          aria-label={t("px.nextSceneAria")}
        >
          <span className="text-[11px] font-bold tracking-[0.05em] text-white/95">{t("wp.parallax.swipe")}</span>
          <ChevronRight className="w-4 h-4 text-white prayly-swipe-arrow" strokeWidth={2.8} />
        </button>
      )}


      {/* Bottom controls */}
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),16px)] inset-x-0 z-50 flex flex-col items-center gap-3 px-4">
        {/* Scene dots — one tap to jump, or swipe left/right on the stage */}
        {PARALLAX_SCENES.length > 1 && (
          <div className="flex items-center gap-2">
            {PARALLAX_SCENES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToScene(i, i > sceneIdx ? "left" : "right")}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === sceneIdx ? 22 : 7,
                  background:
                    i === sceneIdx
                      ? "linear-gradient(90deg, hsl(42 90% 65%), hsl(38 88% 50%))"
                      : "hsl(0 0% 100% / 0.28)",
                  boxShadow: i === sceneIdx ? "0 0 10px hsl(42 85% 55% / 0.7)" : undefined,
                }}
                aria-label={t("px.showSceneAria", { name: t(`px.scene.${s.id}`, s.name) })}
              />
            ))}
          </div>
        )}
        <div className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md">
          <p className="text-[11px] font-semibold text-white/90 tracking-wide">
            {PARALLAX_SCENES.length > 1 ? t("wp.parallax.instructions", { name: t(`px.scene.${scene.id}`, scene.name) }) : t("wp.parallax.tilt")}
          </p>
        </div>


        {/* Apply as wallpaper — matches Daily Verse gold pill exactly */}
        <button
          onClick={handleApply}
          disabled={applying}
          className="w-full max-w-sm flex items-center justify-center gap-2 rounded-2xl h-12 font-bold text-[14px] tracking-[0.02em] active:scale-[0.985] transition-transform"
          style={{
            background: appliedOk
              ? "linear-gradient(180deg, hsl(140 60% 45%) 0%, hsl(150 65% 40%) 100%)"
              : "linear-gradient(180deg, hsl(42 78% 52%) 0%, hsl(38 80% 42%) 100%)",
            color: "hsl(var(--background))",
            boxShadow: appliedOk
              ? "0 10px 22px -6px hsl(150 65% 40% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.32)"
              : "0 10px 22px -6px hsl(var(--primary) / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.32)",
            opacity: applying ? 0.85 : 1,
          }}
        >
          {applying ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t("px.preparing")}</>
          ) : appliedOk ? (
            <><CheckCircle2 className="w-4 h-4" strokeWidth={2.6} /> {t("px.applied")}</>
          ) : canApplyNative ? (
            <><Crown className="w-4 h-4" strokeWidth={2.6} /> {t("px.setWallpaper")}</>
          ) : (
            <><Smartphone className="w-4 h-4" strokeWidth={2.6} /> {t("px.openAndroidApp")}</>
          )}
        </button>
        {applyError && (
          <p className="text-[11px] text-red-300/90 text-center max-w-sm px-2">{applyError}</p>
        )}
      </div>


      <PersonalizeCrossSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <PremiumSheet
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        trigger="parallax_preview"
      />

      <style>{`
        @keyframes prayly-scene-in-left { from { transform: translateX(6%); opacity: 0.55; } to { transform: translateX(0); opacity: 1; } }
        @keyframes prayly-scene-in-right { from { transform: translateX(-6%); opacity: 0.55; } to { transform: translateX(0); opacity: 1; } }
        .prayly-scene-in-left { animation: prayly-scene-in-left 340ms cubic-bezier(.22,.61,.36,1) both; }
        .prayly-scene-in-right { animation: prayly-scene-in-right 340ms cubic-bezier(.22,.61,.36,1) both; }
        .prayly-whole-scene-fit { background-size: auto 100%; }
        @media (min-aspect-ratio: 2 / 3) {
          .prayly-whole-scene-fit { background-size: 100% auto; }
        }
        @keyframes prayly-next-cue {
          0%, 100% { transform: translate(0, -50%); }
          50% { transform: translate(-4px, -50%); }
        }
        .prayly-next-cue { animation: prayly-next-cue 1800ms ease-in-out infinite; }
        @keyframes prayly-swipe-arrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        .prayly-swipe-arrow { animation: prayly-swipe-arrow 900ms ease-in-out infinite; }
      `}</style>
    </div>
  );
}


