package com.jesuswallpaperbible.app;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "GooglePlayPrices")
public class GooglePlayPricesPlugin extends Plugin {
    @PluginMethod
    public void getSubscriptionPrices(PluginCall call) {
        JSArray requested = call.getArray("products");
        if (requested == null || requested.length() == 0) {
            JSObject ret = new JSObject();
            ret.put("prices", new JSArray());
            call.resolve(ret);
            return;
        }

        List<PriceRequest> requests = parseRequests(requested);
        if (requests.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("prices", new JSArray());
            call.resolve(ret);
            return;
        }

        BillingClient billingClient = BillingClient.newBuilder(getContext().getApplicationContext())
            .setListener((billingResult, purchases) -> {})
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        AtomicBoolean finished = new AtomicBoolean(false);
        Runnable timeout = () -> {
            if (finished.compareAndSet(false, true)) {
                resolveEmpty(call, billingClient, "Google Play price lookup timed out");
            }
        };
        getBridge().getActivity().runOnUiThread(() -> getBridge().getActivity().getWindow().getDecorView().postDelayed(timeout, 10000));

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (finished.get()) return;
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    if (finished.compareAndSet(false, true)) resolveEmpty(call, billingClient, billingResult.getDebugMessage());
                    return;
                }

                Set<String> uniqueProductIds = new LinkedHashSet<>();
                for (PriceRequest request : requests) uniqueProductIds.add(request.productId);

                List<QueryProductDetailsParams.Product> products = new ArrayList<>();
                for (String productId : uniqueProductIds) {
                    products.add(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build());
                }

                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(products)
                    .build();

                billingClient.queryProductDetailsAsync(params, (result, productDetailsResult) -> {
                    if (!finished.compareAndSet(false, true)) return;
                    try {
                        JSArray prices = new JSArray();
                        List<ProductDetails> productDetailsList = productDetailsResult.getProductDetailsList();
                        for (PriceRequest request : requests) {
                            ProductDetails details = findProduct(productDetailsList, request.productId);
                            if (details == null) continue;
                            ProductDetails.SubscriptionOfferDetails offer = chooseOffer(details, request.basePlanId, request.expectedBillingPeriod);
                            if (offer == null) continue;
                            ProductDetails.PricingPhase phase = chooseFullPricePhase(offer);
                            if (phase == null || phase.getFormattedPrice() == null || phase.getFormattedPrice().isEmpty()) continue;

                            JSObject item = new JSObject();
                            item.put("key", request.key);
                            item.put("productId", details.getProductId());
                            item.put("basePlanId", offer.getBasePlanId());
                            item.put("offerId", offer.getOfferId());
                            item.put("priceString", phase.getFormattedPrice());
                            item.put("amountMicros", phase.getPriceAmountMicros());
                            item.put("currencyCode", phase.getPriceCurrencyCode());
                            item.put("billingPeriod", phase.getBillingPeriod());
                            item.put("source", "google_play_billing");
                            prices.put(item);
                        }

                        JSObject ret = new JSObject();
                        ret.put("prices", prices);
                        call.resolve(ret);
                    } catch (Exception e) {
                        JSObject ret = new JSObject();
                        ret.put("prices", new JSArray());
                        ret.put("error", e.getMessage());
                        call.resolve(ret);
                    } finally {
                        try { billingClient.endConnection(); } catch (Exception ignored) {}
                    }
                });
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Google Play will reconnect on the next paywall open.
            }
        });
    }

    private List<PriceRequest> parseRequests(JSArray requested) {
        List<PriceRequest> out = new ArrayList<>();
        for (int i = 0; i < requested.length(); i++) {
            try {
                JSONObject item = requested.getJSONObject(i);
                String key = item.optString("key", "");
                String productId = item.optString("productId", "");
                String basePlanId = item.optString("basePlanId", "");
                String expectedBillingPeriod = item.optString("expectedBillingPeriod", "");
                if (!key.isEmpty() && !productId.isEmpty()) {
                    out.add(new PriceRequest(key, productId, basePlanId, expectedBillingPeriod));
                }
            } catch (Exception ignored) {}
        }
        return out;
    }

    private ProductDetails findProduct(List<ProductDetails> products, String productId) {
        for (ProductDetails product : products) {
            if (productId.equals(product.getProductId())) return product;
        }
        return null;
    }

    private ProductDetails.SubscriptionOfferDetails chooseOffer(ProductDetails details, String basePlanId, String expectedBillingPeriod) {
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.SubscriptionOfferDetails firstBasePlanMatch = null;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (basePlanId != null && !basePlanId.isEmpty() && basePlanId.equals(offer.getBasePlanId())) {
                if (offer.getOfferId() == null || offer.getOfferId().isEmpty()) return offer;
                if (firstBasePlanMatch == null) firstBasePlanMatch = offer;
            }
        }
        if (firstBasePlanMatch != null) return firstBasePlanMatch;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            ProductDetails.PricingPhase phase = chooseFullPricePhase(offer);
            if (phase != null && expectedBillingPeriod != null && !expectedBillingPeriod.isEmpty()
                && expectedBillingPeriod.equals(phase.getBillingPeriod())) return offer;
        }
        return firstBasePlanMatch != null ? firstBasePlanMatch : offers.get(0);
    }

    private ProductDetails.PricingPhase chooseFullPricePhase(ProductDetails.SubscriptionOfferDetails offer) {
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        ProductDetails.PricingPhase lastPaid = null;
        for (ProductDetails.PricingPhase phase : phases) {
            if (phase.getPriceAmountMicros() > 0) lastPaid = phase;
        }
        return lastPaid != null ? lastPaid : (phases.isEmpty() ? null : phases.get(phases.size() - 1));
    }

    private void resolveEmpty(PluginCall call, BillingClient billingClient, String error) {
        try { billingClient.endConnection(); } catch (Exception ignored) {}
        JSObject ret = new JSObject();
        ret.put("prices", new JSArray());
        ret.put("error", error);
        call.resolve(ret);
    }

    private static class PriceRequest {
        final String key;
        final String productId;
        final String basePlanId;
        final String expectedBillingPeriod;

        PriceRequest(String key, String productId, String basePlanId, String expectedBillingPeriod) {
            this.key = key;
            this.productId = productId;
            this.basePlanId = basePlanId;
            this.expectedBillingPeriod = expectedBillingPeriod;
        }
    }
}