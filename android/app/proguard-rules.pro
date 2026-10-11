# =============================================================================
# Prayly ProGuard / R8 rules
# =============================================================================

# Keep line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor plugin bridge (reflection only; SDK ships its own rules) ---
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers @com.getcapacitor.annotation.CapacitorPlugin class * {
    @com.getcapacitor.PluginMethod public *;
}
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class com.getcapacitor.BridgeActivity { *; }

# --- Our native entry points loaded by name from the manifest ---
-keep class com.jesuswallpaperbible.app.MainActivity { *; }
-keep class * extends android.service.wallpaper.WallpaperService { *; }
-keep class * extends android.content.BroadcastReceiver { *; }
-keep class * extends android.app.Activity { *; }

# --- AndroidX / WebView JS interfaces ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Optional deps: warnings only, no broad keeps (SDKs bundle consumer rules) ---
-dontwarn com.google.android.gms.ads.**
-dontwarn com.facebook.**

# --- JSON / Gson typical safety net ---
-keepattributes Signature,*Annotation*,EnclosingMethod,InnerClasses

# Suppress warnings from optional deps
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**

# =============================================================================
# R8 full mode safety net (android.enableR8.fullMode=true)
# Full mode drops assumptions about reflection, generic signatures and default
# constructors, so every plugin package that Capacitor/OTA loads by name is
# kept explicitly.
# =============================================================================
-keep class ee.forgr.** { *; }
-dontwarn ee.forgr.**
-keep class io.capawesome.** { *; }
-dontwarn io.capawesome.**
-keep class com.getcapacitor.community.** { *; }
-keep class com.revenuecat.purchases.** { *; }
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Enums and Parcelables keep their reflective contracts in full mode
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Kotlin metadata used by RevenueCat / Capgo serialization
-keep class kotlin.Metadata { *; }
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
