import { useEffect, Suspense } from "react";
import { lazyPage, prefetch } from "@/lib/lazy-page";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import PerfProbe from "@/components/PerfProbe";
import { BottomNav } from "@/components/BottomNav";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
// Today is the landing route — keep it eager so first paint has zero waterfall.
import Today from "./pages/Today";
// Every other route is code-split: they used to ship inside the single 2.2 MB
// main bundle, so cold start had to parse Quiz/Journey/Devotional data before
// the home screen could paint (top source of long tasks + ANR risk).
const Wallpapers = lazyPage(() => import("./pages/Wallpapers"));
const PrayScreen = lazyPage(() => import("./pages/PrayScreen"));
const ExploreFeed = lazyPage(() => import("./pages/ExploreFeed"));
const Categories = lazyPage(() => import("./pages/Categories"));
const CategoryView = lazyPage(() => import("./pages/CategoryView"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const AdminLogin = lazyPage(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazyPage(() => import("./pages/admin/AdminDashboard"));
const FileManager = lazyPage(() => import("./pages/admin/FileManager"));
const Devotional = lazyPage(() => import("./pages/Devotional"));
const Settings = lazyPage(() => import("./pages/Settings"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyPage(() => import("./pages/TermsOfService"));
const Favorites = lazyPage(() => import("./pages/Favorites"));
const Quiz = lazyPage(() => import("./pages/Quiz"));
const DailyVerse = lazyPage(() => import("./pages/DailyVerse"));
const Challenge = lazyPage(() => import("./pages/Challenge"));
const ChallengeDay = lazyPage(() => import("./pages/ChallengeDay"));
const ProJourney = lazyPage(() => import("./pages/ProJourney"));
const ProJourneyDay = lazyPage(() => import("./pages/ProJourneyDay"));
const AlarmPreview = lazyPage(() => import("./pages/AlarmPreview"));
const Companion = lazyPage(() => import("./pages/Companion"));
const BibleReader = lazyPage(() => import("./pages/BibleReader"));
const NotificationPreview = lazyPage(() => import("./pages/NotificationPreview"));
const DebugLogs = lazyPage(() => import("./pages/DebugLogs"));
const ParallaxPreview = lazyPage(() => import("./pages/ParallaxPreview"));

import { DailyVerseSplash } from "@/components/DailyVerseSplash";
import { FavoriteLimitModal } from "@/components/FavoriteLimitModal";
import { RatingPrompt } from "@/components/RatingPrompt";
import { AdLoadingOverlay } from "@/components/AdLoadingOverlay";
import { NotificationPrimer } from "@/components/NotificationPrimer";
import { DailyPermissionNudge } from "@/components/DailyPermissionNudge";
import { PostOnboardingPremium } from "@/components/PostOnboardingPremium";
import { AutoPaywall } from "@/components/AutoPaywall";
import { OnboardingProvider } from "@/components/onboarding/OnboardingFlow";
import { PremiumBootstrap } from "@/components/PremiumBootstrap";
import { useIsOnboardingActive } from "@/contexts/OnboardingContext";
import FunnelHandoff from "@/components/today/FunnelHandoff";
import { AnrBreadcrumbs } from "@/components/AnrBreadcrumbs";
import { I18nProvider } from "@/i18n";

/**
 * Neutral, themed placeholder while a route chunk downloads. Chunks are local
 * (bundled in the APK / served from cache) so this is usually a single frame.
 */
const RouteFallback = () => (
  <div className="min-h-[60vh] w-full bg-background" aria-hidden />
);

/**
 * After the home screen is idle, warm the chunks a user is most likely to open
 * next. Keeps navigation instant without paying for them during cold start.
 */
function RoutePrefetch() {
  useEffect(() => {
    const warm = () => {
      prefetch(() => import("./pages/DailyVerse"));
      prefetch(() => import("./pages/Quiz"));
      prefetch(() => import("./pages/Challenge"));
      prefetch(() => import("./pages/Devotional"));
      prefetch(() => import("./pages/Wallpapers"));
      prefetch(() => import("./pages/PrayScreen"));
    };
    const ric = (window as any).requestIdleCallback;
    const handle = ric ? ric(warm, { timeout: 4000 }) : window.setTimeout(warm, 2500);
    return () => {
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else clearTimeout(handle as number);
    };
  }, []);
  return null;
}



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

function NativeSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const timers: number[] = [];
    const runAfterBoot = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        const ric = (window as any).requestIdleCallback;
        if (ric) ric(fn, { timeout: 5000 });
        else fn();
      }, delay);
      timers.push(timer);
    };
    const syncTheme = async () => {
      const isLight = document.documentElement.classList.contains("light");
      try {
        await StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: "#00000000" });
      } catch (e) {}
    };
    syncTheme();
    const observer = new MutationObserver(() => syncTheme());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Do NOT import/call Capacitor LocalNotifications during cold start. Legacy
    // notification cleanup now runs only from the permission primer path; the
    // real prayer bells/content pushes are scheduled by native plugins.
    runAfterBoot(() => {
      import("@/services/prayer-notifications").then((mod) => {
        mod.resetNotificationPrimerIfStale();
      }).catch(() => {});
    }, 4500);

    // Schedule daily content pushes - delayed to clear startup
    runAfterBoot(() => {
      import("@/plugins/content-push").then((mod) => {
        mod.ensureContentPushesScheduled();
      }).catch(() => {});
    }, 5500);

    // PremiumBootstrap performs the authoritative cold-start reconciliation
    // before onboarding can render. This deferred pass is only a safety sync.
    // The heavy lifting (localStorage flag, in-app event, native
    // daily-verse `setPremium`, parallax `clearIfActive` on downgrade)
    // lives in premium-sync.ts — called here on cold start and on every
    // app foreground, and also fired in real-time by RC's
    // CustomerInfoUpdateListener registered inside initRevenueCat().
    const reconcilePremium = async () => {
      try {
        const mod = await import("@/services/revenuecat");
        if (!mod.isRevenueCatAvailable()) return;
        await mod.initRevenueCat();
        let status = await mod.resolvePremiumStatus();
        // Fresh install / reinstall: RC's new anonymous user has no history,
        // so a "free" answer may be wrong while the Play account still owns
        // the sub. Ask Play once (silently) before trusting "free".
        if (status === "free") {
          const recovered = await mod.recoverEntitlementIfNeeded();
          if (recovered !== "unknown") status = recovered;
        }
        // "unknown" = RevenueCat never answered (offline / SDK not ready).
        // Never downgrade on that — leave the local entitlement untouched
        // so paying users keep Pro and their applied wallpaper.
        if (status === "unknown") return;
        const { syncPremiumState } = await import("@/services/premium-sync");
        await syncPremiumState(status === "premium");
      } catch {}
    };


    runAfterBoot(() => { reconcilePremium(); }, 12_000);

    // Re-reconcile on app resume (catches Play Store cancellations / refunds).
    // Delay the native App plugin import too; importing it during first paint
    // still touches native bridge/Binder state on Android.
    let appListenerCleanup: (() => void) | null = null;
    // Resume reconcile used to fire on EVERY foreground, immediately. On Android
    // that means a native RevenueCat/Play round-trip on the same frame the
    // WebView is re-rasterising the screen — the 1-2s "tap does nothing" freeze
    // users felt after coming back to the app. Now: throttled to once every
    // 15 min, and pushed to idle ~1.2s after the app is actually interactive.
    let lastReconcileAt = Date.now();
    const RECONCILE_GAP_MS = 15 * 60 * 1000;
    let resumeTimer: number | null = null;
    const reconcileOnResumeDeferred = () => {
      if (Date.now() - lastReconcileAt < RECONCILE_GAP_MS) return;
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        resumeTimer = null;
        lastReconcileAt = Date.now();
        const ric = (window as any).requestIdleCallback;
        if (ric) ric(() => reconcilePremium(), { timeout: 4000 });
        else reconcilePremium();
      }, 1200);
      timers.push(resumeTimer);
    };
    runAfterBoot(() => {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", (state) => {
          if (state.isActive) reconcileOnResumeDeferred();
        }).then((handle) => {
          appListenerCleanup = () => { try { handle.remove(); } catch {} };
        }).catch(() => {});
      }).catch(() => {});
    }, 8000);


    // Initialize Meta App Events - delayed
    runAfterBoot(() => {
      import("@/services/meta-events").then((mod) => {
        mod.initMetaEvents();
      }).catch(() => {});
    }, 9000);

    // Meta CAPI - delayed
    runAfterBoot(() => {
      import("@/services/meta-capi").then((mod) => {
        mod.captureMetaClickId();
        mod.metaTrackInstallOnce();
        mod.metaTrackAppOpen();
      }).catch(() => {});
    }, 10_000);

    return () => {
      observer.disconnect();
      appListenerCleanup?.();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
  return null;
}

function NotificationTapBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import("@/services/prayer-notifications").then((mod) => {
      mod.registerNotificationTapHandler((path) => navigate(path));
    }).catch(() => {});

    (window as any).__openPrayerRoute = (path: string) => {
      if (typeof path === "string" && path.startsWith("/")) navigate(path);
    };
    return () => { try { delete (window as any).__openPrayerRoute; } catch {} };
  }, [navigate]);
  return null;
}

function GatedOverlays() {
  const isOnboardingActive = useIsOnboardingActive();
  if (isOnboardingActive) return null;
  return (
    <>
      <DailyVerseSplash />
      <FavoriteLimitModal />
      <RatingPrompt />
      <NotificationPrimer />
      <DailyPermissionNudge />
      <AdLoadingOverlay />
    </>
  );
}

function AlwaysOnOverlays() {
  return (
    <>
      <PostOnboardingPremium />
      <AutoPaywall />
    </>
  );
}

function RouterOverlays() {
  const isOnboardingActive = useIsOnboardingActive();
  if (isOnboardingActive) return null;
  return <FunnelHandoff />;
}

/**
 * The whole app shell (routes, bottom nav, chunk warm-up) stays unmounted while
 * onboarding is on screen. Previously Today mounted *behind* the onboarding
 * overlay and immediately decoded ~9 full-screen scene JPGs, pulled R2
 * backgrounds, hydrated the quiz bank and warmed 5 route chunks — all stealing
 * CPU from the slides the user is actually looking at (the low-end Android
 * onboarding stall). Now nothing app-side runs until onboarding finishes.
 */
function AppShell() {
  const isOnboardingActive = useIsOnboardingActive();
  if (isOnboardingActive) return null;
  return (
    <>
      <RoutePrefetch />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/prayscreen" element={<PrayScreen />} />
          <Route path="/wallpapers" element={<Wallpapers />} />
          <Route path="/live" element={<Wallpapers initialMode="live" />} />
          <Route path="/explore" element={<ExploreFeed />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/categories/:id" element={<CategoryView />} />
          <Route path="/static-wallpapers" element={<Wallpapers initialMode="photos" />} />
          <Route path="/devotional" element={<Devotional />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/daily-verse" element={<DailyVerse />} />
          <Route path="/challenge" element={<Challenge />} />
          <Route path="/challenge/day" element={<ChallengeDay />} />
          <Route path="/challenge/day/:n" element={<ChallengeDay />} />
          <Route path="/challenge/pro/:id" element={<ProJourney />} />
          <Route path="/challenge/pro/:id/day" element={<ProJourneyDay />} />
          {/* Old Journeys links (notifications, shares) land on the new challenge. */}
          <Route path="/journeys" element={<Navigate to="/challenge" replace />} />
          <Route path="/journeys/:id" element={<Navigate to="/challenge" replace />} />
          <Route path="/companion" element={<Companion />} />
          <Route path="/bible" element={<BibleReader />} />

          <Route path="/settings" element={<Settings />} />
          {/* Internal preview/debug tooling — dev builds only. In production
              these chunks are never referenced, so they are dropped entirely. */}
          {/* /parallax is user-facing (Today's live wallpaper rail links to it). */}
          <Route path="/parallax" element={<ParallaxPreview />} />
          {import.meta.env.DEV && (
            <>
              <Route path="/alarm-preview" element={<AlarmPreview />} />
              <Route path="/notification-preview" element={<NotificationPreview />} />
              <Route path="/debug-logs" element={<DebugLogs />} />
            </>
          )}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/files" element={<FileManager />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </>
  );
}


const App = () => {
  // NOTE: App-wide MotionConfig reducedMotion was removed intentionally. It
  // flattened every modal/sheet/nav transition on Android for marginal ANR
  // gain. ANRs are dominated by GPU-heavy effects (blur, mix-blend, infinite
  // loops) which are already stripped in src/index.css and via
  // isAndroidPerfMode() gates at the component level. Add reducedMotion
  // locally to specific decorative/background/infinite components if needed —
  // never re-add it globally here.

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <TooltipProvider>
        <PremiumBootstrap>
        <OnboardingProvider>
          <NativeSetup />
          <GatedOverlays />
          <AlwaysOnOverlays />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnrBreadcrumbs />
            <PerfProbe />
            <NotificationTapBridge />
            <RouterOverlays />
            <AppShell />
          </BrowserRouter>

        </OnboardingProvider>
        </PremiumBootstrap>
      </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default App;
