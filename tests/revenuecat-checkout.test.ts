import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ purchase: vi.fn(), restore: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  LOG_LEVEL: { WARN: "WARN" }, PRODUCT_CATEGORY: { SUBSCRIPTION: "SUBSCRIPTION" },
  Purchases: {
    setLogLevel: vi.fn(), configure: vi.fn(), getAppUserID: vi.fn(),
    addCustomerInfoUpdateListener: vi.fn(), purchasePackage: mocks.purchase,
    restorePurchases: mocks.restore, syncPurchases: vi.fn(), invalidateCustomerInfoCache: vi.fn(),
  },
}));
vi.mock("@/lib/googlePlayPrices", () => ({ fetchGooglePlaySubscriptionPrices: vi.fn() }));
vi.mock("@/services/free-test-mode", () => ({ isFreeTestMode: () => false }));
import { purchasePackage, restorePurchases, PREMIUM_ENTITLEMENT } from "../src/services/revenuecat";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

describe("store checkout readback", () => {
  beforeEach(() => vi.clearAllMocks());
  const pkg = { identifier: "$rc_annual" } as PurchasesPackage;
  for (const [period, sandbox, event] of [
    ["TRIAL", false, "trial_started"], ["NORMAL", false, "checkout_completed"], ["TRIAL", true, "test_checkout_completed"],
  ] as const) {
    it(`${period} sandbox=${sandbox} preserves Pro access with ${event}, not paid Purchase`, async () => {
      mocks.purchase.mockResolvedValue({ customerInfo: { entitlements: { active: {
        [PREMIUM_ENTITLEMENT]: { periodType: period, isSandbox: sandbox },
      } } } });
      const result = await purchasePackage(pkg);
      expect(mocks.purchase).toHaveBeenCalledWith({ aPackage: pkg });
      expect(result.active).toBe(true);
      expect(result.event).toBe(event);
      expect(result.properties.revenue_verified).toBe(false);
      if (period === "TRIAL") expect(result.properties.price).toBe(0);
      else expect(result.properties).not.toHaveProperty("price");
    });
  }
  it("does not grant Pro when the returned entitlement is absent", async () => {
    mocks.purchase.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    expect((await purchasePackage(pkg)).active).toBe(false);
  });
  it("preserves restore access for an existing paid customer", async () => {
    mocks.restore.mockResolvedValue({ customerInfo: { entitlements: { active: {
      [PREMIUM_ENTITLEMENT]: { periodType: "NORMAL", isSandbox: false },
    } } } });
    expect(await restorePurchases()).toBe(true);
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
});