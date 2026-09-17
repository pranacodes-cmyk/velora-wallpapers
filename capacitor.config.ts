import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jesuswallpaperbible.app',
  appName: 'Prayly',
  webDir: 'dist',
  android: {
    backgroundColor: '#0a0f1a',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#0a0f1a',
  },
  plugins: {
    // Over-the-air (live) updates — self-hosted on our own backend.
    // Bundles are downloaded silently in the background and applied on the
    // NEXT cold start, so no session is ever interrupted mid-use (important
    // for our ANR budget). notifyAppReady() in src/services/ota.ts is what
    // marks a bundle as healthy; if it never fires, the native layer rolls
    // back to the previous bundle automatically.
    CapacitorUpdater: {
      autoUpdate: true,
      directUpdate: false,
      updateUrl: 'https://jbwhlogvldhsnxtpxwih.supabase.co/functions/v1/ota-update',
      defaultChannel: 'production',
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      appReadyTimeout: 20000,
      responseTimeout: 20,
      // Poll for new bundles every 10 min during a session; the downloaded
      // bundle is applied automatically on the next cold start. No manual
      // "check for updates" UI needed.
      periodCheckDelay: 600,
      allowModifyUrl: false,
      keepUrlPathAfterReload: false,
      shakeMenu: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,

      launchAutoHide: true,
      // Android 12/13 has a platform crash in splash exit SurfaceControl
      // transfer when apps use an exit animation listener. No fade = no
      // listener, and a much smaller crash window during cold start.
      launchFadeOutDuration: 0,
      backgroundColor: '#0a0f1a',
      showSpinner: false,
      androidSplashResourceName: 'splash_screen',
      androidScaleType: 'CENTER',
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
