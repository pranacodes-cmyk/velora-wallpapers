import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";

import { PARALLAX_SCENES, sceneFgCard, type ParallaxScene } from "@/data/parallaxScenes";
import { useEffect, useRef, useState } from "react";
import { useRenderCost } from "@/services/perf-attribution";

import {
  getPersonalName,
  getPersonalVerse,
  PERSONAL_CROSS_EVENT,
  type PersonalVerse,
} from "@/lib/personalCross";
import { EngravedOverlay } from "@/components/PersonalizeCrossSheet";
import { useT } from "@/i18n";
import { OneEuro, Spring } from "@/lib/parallaxPhysics";
import { isAndroidPerfMode } from "@/lib/androidPerf";





function haptic(_kind: "light" | "soft" = "light") {

  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(_kind === "soft" ? 6 : 12);
    }
  } catch { /* noop */ }
}

/**
 * Full-width "3D Live Wallpaper" hero card. With only one curated scene we
 * skip the horizontal rail entirely and show one taller card that fills the
 * viewport so the depth actually reads like a real live wallpaper preview.
 */
function ParallaxHero({
  scene,
  onOpen,
  personalName,
  personalVerse,
  loadImage = true,
}: {
  scene: ParallaxScene;
  onOpen: () => void;
  /** Only the active + neighbouring cards load their image (memory-safe). */
  loadImage?: boolean;
  personalName: string;
  personalVerse: PersonalVerse;
}) {
  const { t } = useT();

  const bgRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLButtonElement>(null);
  const pointerActive = useRef(false);
  const pointerXY = useRef({ x: 0, y: 0 });
  const gyroActive = useRef(false);
  const gyroXY = useRef({ x: 0, y: 0 });
  const visibleRef = useRef(true);
  const rebaseRef = useRef(true);
  const lastGyroAtRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const swipingRef = useRef(false);

  // Detect low-end / reduced-motion once. Low-end devices get a lighter loop
  // (~30fps + smaller displacement, no drop-shadow) so we don't cook the GPU.
  // Keep the conversion preview alive, but Android always uses the bounded
  // 30fps path so it cannot compete with scrolling at display refresh rate.
  const [isLowEnd] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    return cores <= 4 || mem <= 3;
  });
  const freezeParallax = false;
  const constrainedMotion = isLowEnd || isAndroidPerfMode();

  // Idle drift + pointer-follow + device-orientation gyro so it feels alive
  // both untouched and while tilting the phone. Loop pauses when the card is
  // off-screen or the tab is hidden — that's the main win for battery/GPU.
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion || freezeParallax) return;

    let raf = 0;
    let lastPaintMs = 0;
    let lastFrameMs = performance.now();
    const start = lastFrameMs;
    // Home preview only: keep the depth effect, but reduce all layer travel by
    // 20% so the cross feels steadier. The full preview/wallpaper is untouched.
    // The real lock-screen output is the native service and is untouched.
    const displacement = (constrainedMotion ? 0.72 : 1) * 1.056;

    // One-euro filters smooth noisy gyro input without adding perceptible lag.
    // Tuned soft: min cutoff 1.0Hz, beta 0.015 — kills jitter, keeps intent.
    const fx = new OneEuro(1.0, 0.015, 1);
    const fy = new OneEuro(1.0, 0.015, 1);

    // Per-layer springs. bg = heavy (low stiffness, high damping) so it drifts.
    // fg = crisp (high stiffness, medium damping) so it snaps with the tilt.
    // halo sits in between. This is what actually sells the depth.
    const bgSx = new Spring(55, 13);
    const bgSy = new Spring(55, 13);
    const fgSx = new Spring(150, 16);
    const fgSy = new Spring(150, 16);
    const haSx = new Spring(95, 14);
    const haSy = new Spring(95, 14);

    const loop = (now: number) => {
      // Time-based 30fps cap behaves correctly on 60/90/120Hz Android panels.
      if (constrainedMotion && now - lastPaintMs < 31) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastPaintMs = now;
      const dt = Math.max(0.001, (now - lastFrameMs) / 1000);
      lastFrameMs = now;
      const t = (now - start) / 1000;

      // Gentle sine idle drift so it never looks frozen on desktop.
      const idleX = Math.sin(t * 0.25) * 0.46;
      const idleY = Math.sin(t * 0.18 + 1.1) * 0.32;
      let targetX = idleX;
      let targetY = idleY;
      const gyroFresh = gyroActive.current && now - lastGyroAtRef.current < 900;
      if (gyroFresh) {
        targetX = gyroXY.current.x + idleX * 0.15;
        targetY = gyroXY.current.y + idleY * 0.15;
      } else if (pointerActive.current) {
        targetX = pointerXY.current.x;
        targetY = pointerXY.current.y;
      }

      // Integrate each layer's spring toward the target.
      const bgX = bgSx.step(targetX, dt);
      const bgY = bgSy.step(targetY, dt);
      const fgX = fgSx.step(targetX, dt);
      const fgY = fgSy.step(targetY, dt);
      const haX = haSx.step(targetX, dt);
      const haY = haSy.step(targetY, dt);

      const d = displacement;
      if (scene.wholeMove) {
        // Whole-composition scene (e.g. Calvary Sunrise) — keep vertical fit
        // intact so Android-sized previews don't crop, but let it breathe
        // horizontally so motion is still obvious.
        if (bgRef.current) bgRef.current.style.transform = `translate3d(${bgX * 24 * d}px, ${bgY * 7 * d}px, 0) scale(1.02)`;
        if (haloRef.current) haloRef.current.style.transform = `translate3d(${haX * 24 * d}px, ${haY * 7 * d}px, 0)`;
      } else {
        if (bgRef.current) bgRef.current.style.transform = `translate3d(${bgX * 8 * d}px, ${bgY * 7 * d}px, 0) scale(1.07)`;
        if (fgRef.current) fgRef.current.style.transform = `translate3d(${fgX * 24 * d}px, ${fgY * 16 * d}px, 0) scale(1.025)`;
        if (haloRef.current) haloRef.current.style.transform = `translate3d(${haX * 14 * d}px, ${haY * 12 * d}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (raf) return;
      lastFrameMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Pause when scrolled off-screen.
    let io: IntersectionObserver | null = null;
    if (rootRef.current && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting ?? true;
          visibleRef.current = visible;
          if (visible) {
            rebaseRef.current = true;
            fx.reset();
            fy.reset();
            startLoop();
          } else {
            stopLoop();
          }
        },
        { threshold: 0.05 }
      );
      io.observe(rootRef.current);
    } else {
      startLoop();
    }

    // Pause when tab hidden.
    const onVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else if (visibleRef.current) {
        rebaseRef.current = true;
        fx.reset();
        fy.reset();
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Nested home scroller events do not bubble, so capture them. Stop the
    // animation while the compositor is handling a scroll and resume once it
    // settles; the still frame preserves the visual without dropped frames.
    let scrollTimer = 0;
    const onScroll = () => {
      stopLoop();
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (!document.hidden && visibleRef.current) startLoop();
      }, 140);
    };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });

    // Gyro. Re-baseline on returning to view so the "resting" tilt is wherever
    // the phone is right now — fixes the "sometimes it looks flat" bug.
    let baseGamma: number | null = null;
    let baseBeta: number | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      if (rebaseRef.current) {
        baseGamma = e.gamma;
        baseBeta = e.beta;
        rebaseRef.current = false;
        fx.reset();
        fy.reset();
        return;
      }
      const tSec = performance.now() / 1000;
      const rawX = (e.gamma - (baseGamma ?? 0)) / 20;
      const rawY = (e.beta - (baseBeta ?? 0)) / 20;
      const smoothedX = fx.filter(rawX, tSec);
      const smoothedY = fy.filter(rawY, tSec);
      gyroXY.current = {
        x: Math.max(-1, Math.min(1, smoothedX)),
        y: Math.max(-1, Math.min(1, smoothedY)),
      };
      gyroActive.current = true;
      lastGyroAtRef.current = performance.now();
    };
    window.addEventListener("deviceorientation", onOrient, true);

    return () => {
      stopLoop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("scroll", onScroll, true);
      window.clearTimeout(scrollTimer);
      window.removeEventListener("deviceorientation", onOrient, true);
    };
  }, [freezeParallax, isLowEnd, constrainedMotion]);

  const requestGyroIfNeeded = () => {
    // iOS 13+ gated permission.
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().catch(() => { /* denied — idle drift still runs */ });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    // Touch taps/scrolls used to leave pointerActive stuck, which then overrode
    // gyro and made the card feel frozen. Touch only drives parallax while held.
    if (e.pointerType === "touch" && activePointerIdRef.current !== e.pointerId) return;
    if (e.pointerType === "touch") {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      // Horizontal intent = the user is paging the rail. Hand the gesture back
      // to the scroller instead of hijacking it for tilt.
      if (swipingRef.current || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))) {
        swipingRef.current = true;
        pointerActive.current = false;
        return;
      }
    }
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerXY.current = { x: nx, y: ny };
    pointerActive.current = true;
  };
  const releasePointer = (e?: React.PointerEvent) => {
    pointerActive.current = false;
    activePointerIdRef.current = null;
    rebaseRef.current = true;
    if (e && rootRef.current?.hasPointerCapture?.(e.pointerId)) {
      rootRef.current.releasePointerCapture(e.pointerId);
    }
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") releasePointer(e);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    requestGyroIfNeeded();
    activePointerIdRef.current = e.pointerId;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipingRef.current = false;
    // Never capture touch pointers — capture swallows the horizontal pan so the
    // snap scroller could not page between scenes.
    if (e.pointerType !== "touch") {
      rootRef.current?.setPointerCapture?.(e.pointerId);
      onPointerMove(e);
    }
  };


  return (
    <button
      ref={rootRef}
      onClick={() => {
        // Suppress the tap that ends a horizontal swipe.
        if (swipingRef.current) { swipingRef.current = false; return; }
        haptic("light");
        onOpen();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      className="relative w-full rounded-[28px] overflow-hidden bg-black active:scale-[0.99] transition-transform"
      style={{
        aspectRatio: "9 / 13",
        maxHeight: "49vh",
          perspective: freezeParallax ? undefined : "1000px",
        touchAction: "pan-x pan-y",

        boxShadow:
          "0 30px 60px -24px hsl(0 0% 0% / 0.95), 0 8px 22px -12px hsl(42 60% 40% / 0.35), 0 0 0 1px hsl(42 55% 55% / 0.22)",
      }}
      aria-label={t("px.previewSceneAria", { name: scene.name })}
    >
      <div
        ref={bgRef}
          className={`absolute ${scene.wholeMove ? "-inset-2.5" : "-inset-7"} ${freezeParallax ? "" : "will-change-transform"}`}
        style={{
          backgroundImage: loadImage ? `url(${scene.bgCard || scene.bg})` : undefined,
          // Rail card is a small preview — always fill (cover) so no side
          // black bars ever show, even on whole-composition scenes.
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {!scene.wholeMove && (
        <div ref={fgRef} className={`absolute inset-0 pointer-events-none ${freezeParallax ? "" : "will-change-transform"}`}>
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              height: `${scene.fgHeight}%`,
              bottom: "0%",
              aspectRatio: "832 / 1472",
              WebkitMaskImage: "linear-gradient(180deg, #000 90%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 90%, transparent 100%)",
              filter: constrainedMotion ? undefined : "drop-shadow(0 16px 22px rgba(0,0,0,0.6))",
            }}
          >
            <img
              src={sceneFgCard(scene)}
              alt={scene.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Top vignette — makes the top chip float over darker glass */}
      <div
        className="absolute inset-x-0 top-0 h-[18%] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, hsl(0 0% 0% / 0.55) 0%, transparent 100%)" }}
      />

      {/* Bottom vignette for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-[36%] pointer-events-none"
        style={{ background: "linear-gradient(to top, hsl(0 0% 0% / 0.82) 0%, hsl(0 0% 0% / 0.28) 55%, transparent 100%)" }}
      />

      {/* Inner hairline ring — cinematic frame, GPU-free */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[28px] pointer-events-none"
        style={{
          boxShadow: "inset 0 0 0 1px hsl(42 70% 70% / 0.14), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
        }}
      />

      {/* Corner brackets — subtle "viewfinder" cue */}
      {(["tl","tr","bl","br"] as const).map((c) => (
        <span
          key={c}
          aria-hidden
          className="absolute w-4 h-4 pointer-events-none"
          style={{
            top: c.startsWith("t") ? 10 : undefined,
            bottom: c.startsWith("b") ? 10 : undefined,
            left: c.endsWith("l") ? 10 : undefined,
            right: c.endsWith("r") ? 10 : undefined,
            borderTop: c.startsWith("t") ? "1px solid hsl(42 75% 68% / 0.55)" : undefined,
            borderBottom: c.startsWith("b") ? "1px solid hsl(42 75% 68% / 0.55)" : undefined,
            borderLeft: c.endsWith("l") ? "1px solid hsl(42 75% 68% / 0.55)" : undefined,
            borderRight: c.endsWith("r") ? "1px solid hsl(42 75% 68% / 0.55)" : undefined,
            borderTopLeftRadius: c === "tl" ? 8 : undefined,
            borderTopRightRadius: c === "tr" ? 8 : undefined,
            borderBottomLeftRadius: c === "bl" ? 8 : undefined,
            borderBottomRightRadius: c === "br" ? 8 : undefined,
          }}
        />
      ))}

      {/* Top-left "LIVE" glass chip */}
      <div
        className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 h-6 rounded-full pointer-events-none"
        style={{
          background: "hsl(0 0% 0% / 0.42)",
          backdropFilter: constrainedMotion ? undefined : "blur(8px)",
          WebkitBackdropFilter: constrainedMotion ? undefined : "blur(8px)",
          boxShadow: "inset 0 0 0 1px hsl(42 70% 65% / 0.28)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "hsl(140 70% 55%)",
            boxShadow: "0 0 6px hsl(140 70% 55% / 0.9)",
            animation: constrainedMotion ? "none" : "prayly-live-pulse 1.8s ease-in-out infinite",
          }}
        />
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/90">{t("wp.reel.live")}</span>
      </div>

      {/* Top-right "Tilt" hint chip */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 px-2.5 h-6 rounded-full pointer-events-none"
        style={{
          background: "hsl(0 0% 0% / 0.42)",
          backdropFilter: constrainedMotion ? undefined : "blur(8px)",
          WebkitBackdropFilter: constrainedMotion ? undefined : "blur(8px)",
          boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.12)",
        }}
      >
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/80">{t("px.tiltDepth")}</span>
      </div>

      {/* "Tap to preview" pill removed — was overlapping the personalized name engraving. */}

      {/* Personalized engraving — identical component used by the
          ParallaxPreview so what you see here is exactly what gets applied. */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <EngravedOverlay name={personalName} verse={personalVerse} compact />
      </div>

      {/* Keyframes — one small block, GPU-cheap */}
      <style>{`
        @keyframes prayly-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.82); }
        }
        .prayly-whole-scene-fit { background-size: auto 100%; }
        @media (min-aspect-ratio: 2 / 3) {
          .prayly-whole-scene-fit { background-size: 100% auto; }
        }
      `}</style>
    </button>
  );
}





export function ParallaxRail() {
  useRenderCost("today.parallax_rail");
  const { t, version } = useT();
  const navigate = useNavigate();
  const scenes = PARALLAX_SCENES;
  const [activeIdx, setActiveIdx] = useState(0);
  // Cards keep their image once seen; distant cards never load one.
  const [loadedIdx, setLoadedIdx] = useState<Set<number>>(() => new Set([0, 1]));
  useEffect(() => {
    setLoadedIdx((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const i of [activeIdx - 1, activeIdx, activeIdx + 1]) {
        if (i >= 0 && !next.has(i)) { next.add(i); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [activeIdx]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [personalName, setPersonalName] = useState<string>("");
  const [personalVerse, setPersonalVerse] = useState<PersonalVerse>(getPersonalVerse());

  useEffect(() => {
    const sync = () => {
      setPersonalName(getPersonalName());
      setPersonalVerse(getPersonalVerse());
    };
    sync();
    window.addEventListener(PERSONAL_CROSS_EVENT, sync);
    return () => window.removeEventListener(PERSONAL_CROSS_EVENT, sync);
  }, [version]);

  const stageRef = useRef<HTMLDivElement>(null);


  // Track which card is snapped into view so the CTA + dots reflect it.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const w = el.clientWidth;
        if (w <= 0) return;
        const idx = Math.round(el.scrollLeft / w);
        setActiveIdx((prev) => {
          const next = Math.max(0, Math.min(scenes.length - 1, idx));
          // Soft tick on each snap — same feedback as the Flutter rail.
          if (prev !== next) haptic("soft");
          return next;
        });
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scenes.length]);


  const hasPersonalized = personalName.length > 0;
  const activeScene = scenes[activeIdx] ?? scenes[0];

  const openPreview = (scene: ParallaxScene = activeScene) => {
    navigate(`/parallax?scene=${scene.id}`);
  };

  return (
    <div className="mx-3 mb-5">
      <div className="flex items-end justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="w-[3px] h-[14px] rounded-full"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.55))",
              boxShadow: "0 0 8px hsl(var(--primary) / 0.45)",
            }}
          />
          <p className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-foreground/85 truncate">
            {t("px.railHeader")}
          </p>
        </div>
        {hasPersonalized ? (
          <span
            className="flex items-center gap-1 px-2 h-5 rounded-full text-[9.5px] font-bold tracking-[0.14em] uppercase"
            style={{
              color: "hsl(42 90% 70%)",
              background: "hsl(42 60% 20% / 0.35)",
              boxShadow: "inset 0 0 0 1px hsl(42 70% 55% / 0.4)",
            }}
          >
            ✓ {t("px.personalBadge")}
          </span>
        ) : (
          <span
            className="flex items-center px-2 h-5 rounded-full text-[9.5px] font-bold tracking-[0.14em] uppercase text-foreground/60"
            style={{
              background: "hsl(0 0% 100% / 0.04)",
              boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.08)",
            }}
          >
            {t("px.newBadge")}
          </span>
        )}
      </div>

      {/* Horizontal snap pager — one scene per page. ParallaxHero's own
          IntersectionObserver pauses animation for the off-screen card so
          only the visible scene actually renders frames (ANR-safe). */}
      <div className="relative" ref={stageRef}>
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-1 px-1"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {scenes.map((s, i) => (
            <div key={s.id} className="min-w-full snap-center pr-0">
              <ParallaxHero
                scene={s}
                personalName={personalName}
                personalVerse={personalVerse}
                loadImage={loadedIdx.has(i)}
                onOpen={() => openPreview(s)}
              />
            </div>
          ))}
        </div>

        {scenes.length > 1 && activeIdx < scenes.length - 1 && (
          <button
            type="button"
            onClick={() => {
              const el = scrollerRef.current;
              if (el) el.scrollTo({ left: (activeIdx + 1) * el.clientWidth, behavior: "smooth" });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 h-9 rounded-full active:scale-95 transition-transform prayly-rail-next-cue"
            style={{
              color: "hsl(0 0% 100%)",
              background: "hsl(0 0% 0% / 0.58)",
              backdropFilter: "blur(14px) saturate(160%)",
              WebkitBackdropFilter: "blur(14px) saturate(160%)",
              boxShadow: "0 8px 22px -8px hsl(0 0% 0% / 0.72), inset 0 0 0 1px hsl(42 70% 65% / 0.42)",
            }}
            aria-label={t("px.nextSceneAria")}
          >
            <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase">{t("wp.parallax.swipe")}</span>
            <span className="text-base leading-none">›</span>
          </button>
        )}

      </div>


      {/* Pagination dots */}
      {scenes.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                const el = scrollerRef.current;
                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
              }}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIdx ? 18 : 6,
                background:
                  i === activeIdx
                    ? "linear-gradient(90deg, hsl(42 85% 60%), hsl(38 85% 48%))"
                    : "hsl(0 0% 100% / 0.22)",
                boxShadow: i === activeIdx ? "0 0 8px hsl(42 80% 55% / 0.55)" : undefined,
              }}
              aria-label={t("px.showSceneAria", { name: s.name })}
            />
          ))}
        </div>
      )}

      {/* CTA — gold pill, opens whichever scene is currently in view */}
      <button
        onClick={() => openPreview()}
        className="relative w-full mt-3 overflow-hidden flex items-center justify-center gap-2 rounded-2xl h-12 font-bold text-[14px] tracking-[0.02em] active:scale-[0.985] transition-transform"
        style={{
          background:
            "linear-gradient(180deg, hsl(42 80% 54%) 0%, hsl(38 82% 42%) 100%)",
          color: "hsl(var(--background))",
          boxShadow:
            "0 12px 26px -8px hsl(var(--primary) / 0.65), inset 0 1px 0 hsl(0 0% 100% / 0.36), inset 0 -1px 0 hsl(0 0% 0% / 0.18)",
        }}
      >
        <Crown className="w-4 h-4 relative z-10" strokeWidth={2.6} />
        <span className="relative z-10">{t("px.setSceneWallpaper", { name: activeScene.name })}</span>
      </button>

      <p className="mt-2 text-center text-[10.5px] font-semibold tracking-[0.14em] uppercase text-foreground/45">
        {hasPersonalized ? t("px.reopenRetune") : t("px.personalizeHint")}
      </p>

      <style>{`
        @keyframes prayly-rail-next-cue {
          0%, 100% { transform: translate(0, -50%); }
          50% { transform: translate(-4px, -50%); }
        }
        .prayly-rail-next-cue { animation: prayly-rail-next-cue 1800ms ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .prayly-rail-next-cue { animation: none; }
        }

      `}</style>
    </div>
  );
}



export default ParallaxRail;
