# R8 rules for the release build. The four native SDKs bundled here all use
# reflection somewhere (billing proxies, JSON models, JS bridges), so their
# packages are kept while the rest of the app is shrunk and obfuscated.

# --- Flutter ---------------------------------------------------------------
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# --- Google Play services / AdMob + mediation ------------------------------
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.ads.** { *; }
-keep class com.vungle.** { *; }
-dontwarn com.vungle.**

# --- Play Billing / RevenueCat ---------------------------------------------
-keep class com.android.billingclient.** { *; }
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# --- Facebook / Meta SDK ---------------------------------------------------
-keep class com.facebook.** { *; }
-dontwarn com.facebook.**
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod

# --- PostHog ---------------------------------------------------------------
-keep class com.posthog.** { *; }
-dontwarn com.posthog.**

# --- App native bridges (looked up by name from Dart) ----------------------
-keep class com.jesuswallpaperbible.app.** { *; }

# --- Kotlin / OkHttp / misc ------------------------------------------------
-dontwarn kotlin.**
-dontwarn okhttp3.**
-dontwarn okio.**
-keepclassmembers enum * { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
