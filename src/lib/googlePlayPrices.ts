import { Capacitor, registerPlugin } from "@capacitor/core";

export interface GooglePlayPriceRequest {
  key: string;
  productId: string;
  basePlanId?: string | null;
  expectedBillingPeriod?: string | null;
}

export interface NativeStorePrice {
  key: string;
  productId: string;
  basePlanId?: string;
  offerId?: string;
  priceString: string;
  amountMicros: number;
  currencyCode: string;
  billingPeriod?: string;
  source?: string;
}

interface GooglePlayPricesPlugin {
  getSubscriptionPrices(options: { products: GooglePlayPriceRequest[] }): Promise<{ prices: NativeStorePrice[]; error?: string; debug?: unknown }>;
}

class GooglePlayPricesWeb implements GooglePlayPricesPlugin {
  async getSubscriptionPrices() {
    return { prices: [] };
  }
}

const GooglePlayPrices = registerPlugin<GooglePlayPricesPlugin>("GooglePlayPrices", {
  web: () => Promise.resolve(new GooglePlayPricesWeb()),
});

export async function fetchGooglePlaySubscriptionPrices(products: GooglePlayPriceRequest[]) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || products.length === 0) {
    return [];
  }

  try {
    const result = await GooglePlayPrices.getSubscriptionPrices({ products });
    if (import.meta.env.DEV) console.info("[PaywallPrices] native Google Play result", result);
    return Array.isArray(result.prices) ? result.prices : [];
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[PaywallPrices] native Google Play price fetch failed", error);
    return [];
  }
}