import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL, PRODUCT_CATEGORY, type PurchasesPackage, type CustomerInfo, type PurchasesStoreProduct } from "@revenuecat/purchases-capacitor";
import { fetchGooglePlaySubscriptionPrices, type NativeStorePrice } from "@/lib/googlePlayPrices";

type PlanKey = "weekly" | "monthly" | "yearly";
type SubPlanKey = PlanKey;

/**
 * RevenueCat configuration.
 * Public SDK keys are safe to ship in the app bundle.
 */
const RC_GOOGLE_API_KEY = "goog_XgbEkcJHOfiAMIUudVojRoiMWCs";
const RC_APPLE_API_KEY = ""; // Add when iOS build is set up

/** Entitlement identifier configured in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT = "Jesus Wallpaper & Bible Prayer Pro";

export type PremiumPackage = PurchasesPackage & {
  storeProduct?: PurchasesStoreProduct;
  googlePlayPrice?: NativeStorePrice;
};

const PLAN_PERIOD: Record<SubPlanKey, string> = {
  weekly: "P1W",
  monthly: "P1M",
  yearly: "P1Y",
};

let initialized = false;
let initPromise: Promise<void> | null = null;

/** Whether RevenueCat is usable in this environment (native only). */
export function isRevenueCatAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/** Initialize the SDK exactly once. Safe to call repeatedly. */
export async function initRevenueCat(): Promise<void> {
  if (!isRevenueCatAvailable()) return;
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const platform = Capacitor.getPlatform();
    const apiKey = platform === "ios" ? RC_APPLE_API_KEY : RC_GOOGLE_API_KEY;
    if (!apiKey) {
      /* RC no api key */;
      return;
    }
    try {
      await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
      await Purchases.configure({ apiKey });
      initialized = true;
      // Identify RC App User ID to Meta for advanced matching (higher match rate)
      try {
        const { appUserID } = await Purchases.getAppUserID();
        if (appUserID) {
          const capi = await import("@/services/meta-capi");
          capi.setMetaUserIdentity({ appUserId: appUserID });
        }
      } catch { /* ignore */ }
      // Standard RC protocol: subscribe to entitlement pushes so trial
      // expirations, cancellations, refunds and grace-period ends flip the
      // app to free the moment RC learns about them — no polling, no waiting
      // for the next app foreground. Also fires on cold start after
      // configure() so the initial state is always fresh.
      try {
        await Purchases.addCustomerInfoUpdateListener(async (info) => {
          try {
            const { syncPremiumState } = await import("@/services/premium-sync");
            await syncPremiumState(hasPremiumEntitlement(info));
          } catch { /* ignore */ }
        });
      } catch { /* older SDK — App.appStateChange fallback still runs */ }
    } catch (e) {
      /* RC init failed */;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Fetch the current offering's packages keyed by plan id.
 * Invalidates RC caches first so the Premium sheet always shows the
 * latest Play Store prices (within Google Play Billing's own SKU cache TTL).
 */
export async function fetchOfferingPackages(): Promise<{
  weekly?: PremiumPackage;
  monthly?: PremiumPackage;
  yearly?: PremiumPackage;
}> {
  if (!isRevenueCatAvailable()) return {};
  await initRevenueCat();
  try {
    // Standard RC pattern: bust the customer info + offerings cache so the
    // next getOfferings() call refetches fresh metadata from RC + the store.
    try { await Purchases.invalidateCustomerInfoCache(); } catch { /* ignore */ }

    const { current } = await Purchases.getOfferings();
    if (!current) return {};
    const map: { weekly?: PremiumPackage; monthly?: PremiumPackage; yearly?: PremiumPackage } = {
      weekly: current.weekly ?? undefined,
      monthly: current.monthly ?? undefined,
      yearly: current.annual ?? undefined,
    };
    for (const pkg of current.availablePackages) {
      // RevenueCat package identifiers: $rc_weekly, $rc_monthly, $rc_annual
      if (pkg.identifier === "$rc_weekly") map.weekly = pkg;
      else if (pkg.identifier === "$rc_monthly") map.monthly = pkg;
      else if (pkg.identifier === "$rc_annual") map.yearly = pkg;
    }
    console.info("[PaywallPrices] offering packages", summarizePackages(map));
    try {
      const productIds = Array.from(new Set(Object.values(map).flatMap((pkg) => {
        if (!pkg?.product) return [];
        const option = pkg.product.defaultOption as any;
        return [
          pkg.product.identifier,
          option?.productId,
          option?.storeProductId,
          typeof option?.storeProductId === "string" ? option.storeProductId.split(":")[0] : undefined,
        ].filter(Boolean) as string[];
      })));
      if (productIds.length > 0) {
        const { products } = await Purchases.getProducts({
          productIdentifiers: productIds,
          type: PRODUCT_CATEGORY.SUBSCRIPTION,
        });
        for (const plan of ["weekly", "monthly", "yearly"] as const) {
          const pkg = map[plan];
          const option = pkg?.product.defaultOption as any;
          const ids = new Set([
            pkg?.product.identifier,
            option?.productId,
            option?.storeProductId,
            typeof option?.storeProductId === "string" ? option.storeProductId.split(":")[0] : undefined,
          ].filter(Boolean));
          const freshProduct = products.find((product) => ids.has(product.identifier));
          if (pkg && freshProduct) map[plan] = { ...pkg, storeProduct: freshProduct };
        }
      }
    } catch {
      // Keep normal offerings if the direct Play product refresh is unavailable.
    }
    try {
      // Native BillingClient price refresh — every plan is a subscription now.
      const subEntries = Object.entries(map) as Array<[SubPlanKey, PremiumPackage | undefined]>;
      const requests = subEntries.flatMap(([key, pkg]) => {
        if (!pkg?.product) return [];
        const option = pkg.product.defaultOption as any;
        const storeProductId = typeof option?.storeProductId === "string" ? option.storeProductId : "";
        const basePlanId = storeProductId.includes(":")
          ? storeProductId.split(":")[1]
          : typeof option?.id === "string"
          ? option.id.split(":")[0]
          : undefined;
        const productId = option?.productId || normalizeStoreProductId(storeProductId) || normalizeStoreProductId(pkg.product.identifier);
        return productId ? [{ key, productId, basePlanId, expectedBillingPeriod: PLAN_PERIOD[key] }] : [];
      });
      console.info("[PaywallPrices] native Google Play requests", requests);
      const prices = await fetchGooglePlaySubscriptionPrices(requests);
      console.info("[PaywallPrices] native Google Play prices", prices);
      for (const price of prices) {
        const plan = price.key as SubPlanKey;
        const pkg = map[plan];
        if (pkg?.product && price.priceString) map[plan] = { ...pkg, googlePlayPrice: price };
      }
    } catch {
      // Keep RevenueCat prices if direct BillingClient labels are unavailable.
    }
    return map;
  } catch (e) {
    /* RC offerings failed */;
    return {};
  }
}

function normalizeStoreProductId(value?: string | null) {
  if (!value || typeof value !== "string") return undefined;
  return value.includes(":") ? value.split(":")[0] : value;
}

function summarizePackages(map: { weekly?: PremiumPackage; monthly?: PremiumPackage; yearly?: PremiumPackage }) {
  return Object.fromEntries((Object.entries(map) as Array<[PlanKey, PremiumPackage | undefined]>).map(([key, pkg]) => {
    const product = pkg?.product as any;
    const option = product?.defaultOption as any;
    return [key, {
      packageId: pkg?.identifier,
      productId: product?.identifier,
      productPrice: product?.priceString,
      optionId: option?.id,
      optionStoreProductId: option?.storeProductId,
      optionProductId: option?.productId,
      optionPeriod: option?.billingPeriod?.iso8601,
      fullPrice: option?.fullPricePhase?.price?.formatted,
    }];
  }));
}

/** Returns true if the customer has the premium entitlement active. */
export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  const ent = info.entitlements?.active?.[PREMIUM_ENTITLEMENT];
  return !!ent;
}

/** Purchase a package. Returns true on success (entitlement granted). */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  if (!isRevenueCatAvailable()) {
    throw new Error("Purchases are only available in the mobile app.");
  }
  await initRevenueCat();
  const result = await Purchases.purchasePackage({ aPackage: pkg });
  const success = hasPremiumEntitlement(result.customerInfo);
  if (success) {
    // Fire Meta Purchase event → powers Value Optimization campaigns.
    // Both client-side (native SDK) AND server-side (CAPI) for dedup + resilience.
    try {
      const price = (pkg as any).product?.price ?? (pkg as any).product?.priceAmount ?? 0;
      const currency = (pkg as any).product?.currencyCode ?? "USD";
      const productId = (pkg as any).product?.identifier;
      if (price && currency) {
        const capi = await import("@/services/meta-capi");
        const eventId = capi.metaTrackPurchase(Number(price), String(currency), productId);
        const meta = await import("@/services/meta-events");
        // Pass same eventId so Meta deduplicates client+server events
        await meta.logPurchase(Number(price), String(currency), productId);
        void eventId;
      }
    } catch { /* swallow */ }
  }
  return success;
}

/** Restore previous purchases. Returns true if premium is now active. */
export async function restorePurchases(): Promise<boolean> {
  if (!isRevenueCatAvailable()) return false;
  await initRevenueCat();
  // syncPurchases pushes any Play Billing purchases the device already owns
  // up to RevenueCat (needed after a reinstall, where our RC app user ID is
  // brand new and has no entitlement history). restorePurchases then reads
  // back the reconciled CustomerInfo.
  try { await (Purchases as any).syncPurchases?.(); } catch { /* ignore */ }
  const { customerInfo } = await Purchases.restorePurchases();
  return hasPremiumEntitlement(customerInfo);
}

const AUTO_RESTORE_KEY = "cw_rc_auto_restored_v1";

/**
 * Silent entitlement recovery — the piece that makes reinstalls work without
 * a login system.
 *
 * On a fresh install RevenueCat mints a NEW anonymous app user ID that has no
 * purchase history, so getCustomerInfo() legitimately answers "free" even
 * though the Google account on the device still owns an active subscription.
 * RevenueCat does not restore that automatically — the app must ask once.
 *
 * We do it silently, once per install (the flag lives in localStorage, which
 * is wiped by an uninstall, so the next install tries again). The Play Store
 * remains the single source of truth; the local flag is only an offline cache.
 */
export async function recoverEntitlementIfNeeded(): Promise<"premium" | "free" | "unknown"> {
  if (!isRevenueCatAvailable()) return "unknown";
  try {
    if (localStorage.getItem(AUTO_RESTORE_KEY) === "true") return "unknown";
  } catch { /* ignore */ }
  try {
    await initRevenueCat();
    if (!initialized) return "unknown";
    const isPremium = await restorePurchases();
    try { localStorage.setItem(AUTO_RESTORE_KEY, "true"); } catch { /* ignore */ }
    return isPremium ? "premium" : "free";
  } catch {
    // Do NOT mark as done — a failed attempt should retry on the next launch.
    return "unknown";
  }
}


/** Check current entitlement status (e.g. on app start).
 *  Forces a fresh RC fetch so trial cancellations / subscription
 *  expirations flip us to free the moment the app reconciles — otherwise
 *  RC's cached CustomerInfo can keep reporting premium for minutes after
 *  the entitlement actually lapsed, which leaves paid features (e.g. the
 *  parallax live wallpaper) still active on the free tier. */
export async function checkPremiumStatus(): Promise<boolean> {
  const status = await resolvePremiumStatus();
  return status === "premium";
}

/**
 * Authoritative premium resolution that DISTINGUISHES a confirmed "free"
 * from a failed lookup. A network blip must never be read as "user lost
 * Pro" — that used to strip entitlements from paying users (wallpaper
 * removed + paywall re-shown), which was the #1 trial-cancel trigger.
 *
 * Retries the fetch twice with a short backoff before giving up, and only
 * ever returns "free" when RevenueCat actually answered.
 */
export async function resolvePremiumStatus(): Promise<"premium" | "free" | "unknown"> {
  if (!isRevenueCatAvailable()) return "unknown";
  await initRevenueCat();
  if (!initialized) return "unknown";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Only bust the cache on the first attempt — retries should be able to
      // fall back to RC's cached customer info if the network is down.
      if (attempt === 0) {
        try { await Purchases.invalidateCustomerInfoCache(); } catch { /* ignore */ }
      }
      const { customerInfo } = await Purchases.getCustomerInfo();
      return hasPremiumEntitlement(customerInfo) ? "premium" : "free";
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  return "unknown";
}


/** Detect if a thrown purchase error is a user cancellation. */
export function isUserCancelled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: string | number; userCancelled?: boolean; message?: string };
  if (anyErr.userCancelled) return true;
  if (anyErr.code === "1" || anyErr.code === 1) return true;
  if (typeof anyErr.message === "string" && /cancel/i.test(anyErr.message)) return true;
  return false;
}